package vn.eduassistant.backend.service;

import com.auth0.jwt.interfaces.DecodedJWT;
import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorConfig;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import vn.eduassistant.backend.config.AppConfig;
import vn.eduassistant.backend.core.ApiException;
import vn.eduassistant.backend.core.Json;
import vn.eduassistant.backend.db.JdbcSupport;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService {
    private final AppConfig config; private final JwtService jwt; private final UserService users; private final JdbcSupport db; private final AuditService audits; private final RedisSupport redis;
    private final GoogleAuthenticator authenticator;
    private static final long ACCESS_MS=15*60*1000L, REFRESH_MS=7*24*60*60*1000L, LOCK_MS=5*60*1000L;
    private final Map<String,Attempt> attempts=new ConcurrentHashMap<String,Attempt>();
    private static class Attempt { int count; long lockedUntil; }
    public AuthService(AppConfig config,JwtService jwt,UserService users,JdbcSupport db,AuditService audits,RedisSupport redis) {
        this.config=config;this.jwt=jwt;this.users=users;this.db=db;this.audits=audits;this.redis=redis;
        GoogleAuthenticatorConfig cfg=new GoogleAuthenticatorConfig.GoogleAuthenticatorConfigBuilder().setWindowSize(3).build();
        authenticator=new GoogleAuthenticator(cfg);
    }
    public Map<String,Object> currentUser(HttpServletRequest request) {
        String raw=cookie(request,config.accessCookie);
        if(raw==null){String header=request.getHeader("Authorization");if(header!=null&&header.startsWith("Bearer "))raw=header.substring(7).trim();}
        if(raw==null||raw.isEmpty())throw new ApiException(HttpStatus.UNAUTHORIZED,"Thiếu cookie xác thực.","UNAUTHORIZED");
        DecodedJWT decoded;
        try{decoded=jwt.verify(raw);}catch(Exception e){throw new ApiException(HttpStatus.UNAUTHORIZED,"Token không hợp lệ hoặc đã hết hạn.","INVALID_TOKEN");}
        Map<String,Object> u=users.userForToken(decoded.getClaim("id").asString(),decoded.getId());
        if(u==null)throw new ApiException(HttpStatus.UNAUTHORIZED,"Tài khoản của phiên đăng nhập không còn tồn tại.","INVALID_USER");
        if(Json.bool(u.get("accessTokenRevoked")))throw new ApiException(HttpStatus.UNAUTHORIZED,"Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.","TOKEN_REVOKED");
        Map<String,Object> info=new LinkedHashMap<String,Object>();
        info.put("id",decoded.getClaim("id").asString());info.put("jti",decoded.getId());info.put("username",u.get("username"));info.put("role",u.get("role"));
        info.put("fullName",u.get("fullName"));info.put("studentCode",u.get("studentCode"));info.put("department",u.get("department"));info.put("avatar",u.get("avatar"));
        info.put("mustChangePassword",Json.bool(u.get("mustChangePassword")));
        if(Json.bool(info.get("mustChangePassword"))){String path=request.getRequestURI();String[] allowed={"/auth/change-password","/auth/me","/auth/logout"};boolean ok=false;for(String p:allowed)if(path.endsWith(p))ok=true;if(!ok)throw new ApiException(HttpStatus.FORBIDDEN,"Tài khoản của bạn đang có yêu cầu bắt buộc đổi mật khẩu trước khi thực hiện các tác vụ khác.","PASSWORD_CHANGE_REQUIRED");}
        return info;
    }
    public Map<String,Object> require(HttpServletRequest request,String... roles) {
        Map<String,Object> user=currentUser(request);String role=Json.str(user.get("role"));
        for(String allowed:roles)if(allowed.equals(role))return user;
        audits.log("ACCESS_FORBIDDEN_ATTEMPT",user,UserService.map("requiredRoles",Arrays.asList(roles)),"BLOCKED","User có role "+role+" cố gắng truy cập endpoint yêu cầu ["+String.join(", ",roles)+"]");
        throw new ApiException(HttpStatus.FORBIDDEN,"Truy cập bị từ chối! Yêu cầu quyền: ["+String.join(", ",roles)+"].","FORBIDDEN");
    }
    public Map<String,Object> login(String username,String password,String otp,HttpServletResponse response) {
        String key=username==null?"":username.trim().toLowerCase();Attempt attempt=attempts.get(key);long now=System.currentTimeMillis();Long distributedLock=redis.loginLockSeconds(key);
        if(distributedLock!=null&&distributedLock>0)throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"Tài khoản đang bị tạm khóa do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau "+distributedLock+" giây.","RATE_LIMIT_EXCEEDED");
        if(distributedLock==null&&attempt!=null&&attempt.lockedUntil>now)throw new ApiException(HttpStatus.TOO_MANY_REQUESTS,"Tài khoản đang bị tạm khóa do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau "+((attempt.lockedUntil-now)/1000)+" giây.","RATE_LIMIT_EXCEEDED");
        Map<String,Object> user=users.userByUsername(username);
        if(user==null||!users.passwordMatches(password,Json.str(user.get("password")))){
            failAttempt(key); audits.log("AUTH_LOGIN_FAILED",user==null?UserService.map("username",username,"role","GUEST","name","Khách"):user,UserService.map("username",username),"FAILED",user==null?"Tên đăng nhập không tồn tại trong hệ thống":"Nhập sai mật khẩu tài khoản");
            throw new ApiException(HttpStatus.UNAUTHORIZED,"Tên đăng nhập hoặc mật khẩu không chính xác.","INVALID_CREDENTIALS");
        }
        attempts.remove(key);redis.clearLoginFailures(key);
        if(Json.bool(user.get("twoFactorEnabled"))){
            if(otp==null||otp.trim().isEmpty())return UserService.map("require2FA",true,"requires2FA",true,"userId",user.get("id"),"tempToken",jwt.temporary2fa(user),"username",user.get("username"),"maskedEmail",maskEmail(Json.str(user.get("email"))));
            if(!verifyTotp(Json.str(user.get("twoFactorSecret")),otp))throw new ApiException(HttpStatus.BAD_REQUEST,"Mã xác thực 2 bước không chính xác hoặc đã hết hạn.","INVALID_2FA_CODE");
        }
        return establish(user,response,"Đăng nhập thành công.");
    }
    public Map<String,Object> login2fa(String userId,String tempToken,String otp,HttpServletResponse response) {
        Map<String,Object> user;
        try {
            if(tempToken!=null&&!tempToken.isEmpty()){DecodedJWT decoded=jwt.verify(tempToken);if(!decoded.getClaim("temp2FA").asBoolean())throw new Exception();user=users.userById(decoded.getClaim("id").asString());}
            else user=users.userById(userId);
        } catch(Exception e){throw new ApiException(HttpStatus.UNAUTHORIZED,"Phiên xác thực 2 bước không hợp lệ hoặc đã hết hạn.","INVALID_TOKEN");}
        if(user==null||!Json.bool(user.get("twoFactorEnabled"))||!verifyTotp(Json.str(user.get("twoFactorSecret")),otp))throw new ApiException(HttpStatus.BAD_REQUEST,"Mã xác thực 2 bước không chính xác hoặc đã hết hạn.","INVALID_2FA_CODE");
        return establish(user,response,"Đăng nhập 2 bước thành công.");
    }
    private Map<String,Object> establish(Map<String,Object> user,HttpServletResponse response,String message) {
        String access=jwt.issue(user,ACCESS_MS);String refresh=randomHex(32);users.saveRefresh(Json.str(user.get("id")),refresh,Instant.now().plusMillis(REFRESH_MS).toString());
        audits.log("AUTH_LOGIN_SUCCESS",user,UserService.map("username",user.get("username"),"role",user.get("role")),"SUCCESS","Đăng nhập thành công với vai trò "+user.get("role"));
        String csrf=randomToken();setCookie(response,config.accessCookie,access,900,"/",true);setCookie(response,config.refreshCookie,refresh,604800,"/api/auth",true);setCookie(response,config.csrfCookie,csrf,604800,"/",false);
        Map<String,Object> clean=JdbcSupport.copyWithout(user,"password","twoFactorSecret","accessTokenRevoked");
        return UserService.map("success",true,"statusCode",200,"message",message,"timestamp",Instant.now().toString(),"data",UserService.map("csrfToken",csrf,"user",clean),"error",null);
    }
    public String refresh(HttpServletRequest request,HttpServletResponse response) {
        String old=cookie(request,config.refreshCookie);if(old==null)throw new ApiException(HttpStatus.BAD_REQUEST,"Refresh Token là bắt buộc.","VALIDATION_ERROR");
        Map<String,Object> record=users.refresh(old);if(record==null)throw new ApiException(HttpStatus.UNAUTHORIZED,"Refresh Token không hợp lệ hoặc đã bị thu hồi an toàn.","INVALID_TOKEN");
        Instant expiry=parseInstant(record.get("expiresAt"));if(expiry!=null&&Instant.now().isAfter(expiry)){users.deleteRefresh(old);throw new ApiException(HttpStatus.UNAUTHORIZED,"Refresh Token đã hết hạn.","EXPIRED_TOKEN");}
        Map<String,Object> user=users.userById(Json.str(record.get("userId")));if(user==null){users.deleteRefresh(old);throw new ApiException(HttpStatus.UNAUTHORIZED,"Người dùng của phiên đăng nhập không còn tồn tại.","USER_NOT_FOUND");}
        users.deleteRefresh(old);String next=randomHex(32);users.saveRefresh(Json.str(user.get("id")),next,Instant.now().plusMillis(REFRESH_MS).toString());
        String access=jwt.issue(user,ACCESS_MS),csrf=randomToken();setCookie(response,config.accessCookie,access,900,"/",true);setCookie(response,config.refreshCookie,next,604800,"/api/auth",true);setCookie(response,config.csrfCookie,csrf,604800,"/",false);return csrf;
    }
    public void logout(HttpServletRequest request,HttpServletResponse response) {
        String refresh=cookie(request,config.refreshCookie);if(refresh!=null)users.deleteRefresh(refresh);
        String access=cookie(request,config.accessCookie);if(access!=null)try{DecodedJWT d=jwt.verify(access);users.revokeAccess(d.getId(),d.getExpiresAt().toInstant().toString());}catch(Exception ignored){}
        clearCookie(response,config.accessCookie,"/");clearCookie(response,config.refreshCookie,"/api/auth");clearCookie(response,config.csrfCookie,"/");
    }
    public String csrf(HttpServletRequest request,HttpServletResponse response) {
        boolean has=cookie(request,config.accessCookie)!=null||cookie(request,config.refreshCookie)!=null;
        if(!has)return null;String csrf=cookie(request,config.csrfCookie);if(csrf==null){csrf=randomToken();setCookie(response,config.csrfCookie,csrf,604800,"/",false);}return csrf;
    }
    public boolean verifyTotp(String secret,String code){try{return authenticator.authorize(secret,Integer.parseInt(code.trim()));}catch(Exception e){return false;}}
    public String newTotpSecret(){return authenticator.createCredentials().getKey();}
    public void setTotpSecret(String id,String secret){db.update("UPDATE users SET twofactorsecret=? WHERE id=?",secret,id);}
    public void setTotpEnabled(String id,boolean enabled){db.update("UPDATE users SET twofactorenabled=?,twofactorsecret=? WHERE id=?",enabled,enabled?db.one("SELECT twofactorsecret AS \"twoFactorSecret\" FROM users WHERE id=?",id).get("twoFactorSecret"):null,id);}
    public String cookie(HttpServletRequest request,String name){if(request.getCookies()==null)return null;for(Cookie c:request.getCookies())if(name.equals(c.getName()))return c.getValue();return null;}
    public void setCookie(HttpServletResponse response,String name,String value,int maxAge,String path,boolean httpOnly){StringBuilder h=new StringBuilder(name).append('=').append(value).append("; Path=").append(path).append("; Max-Age=").append(maxAge).append("; SameSite=").append(config.cookieSameSite);if(httpOnly)h.append("; HttpOnly");if(config.cookieSecure)h.append("; Secure");if(config.cookieDomain!=null)h.append("; Domain=").append(config.cookieDomain);response.addHeader("Set-Cookie",h.toString());}
    private void clearCookie(HttpServletResponse response,String name,String path){setCookie(response,name,"",0,path,true);}
    private void failAttempt(String key){if(redis.recordLoginFailure(key))return;Attempt a=attempts.get(key);if(a==null){a=new Attempt();attempts.put(key,a);}a.count++;if(a.count>=5)a.lockedUntil=System.currentTimeMillis()+LOCK_MS;}
    private static String randomHex(int length){byte[] b=new byte[length];new java.security.SecureRandom().nextBytes(b);StringBuilder s=new StringBuilder();for(byte x:b)s.append(String.format("%02x",x));return s.toString();}
    private static String randomToken(){byte[] b=new byte[32];new java.security.SecureRandom().nextBytes(b);return Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
    private static String maskEmail(String email){int at=email.indexOf('@');return at>0?email.substring(0,Math.min(2,at))+"***@"+email.substring(at+1):"***";}
    private static Instant parseInstant(Object value){try{return Instant.parse(String.valueOf(value));}catch(Exception e){try{return java.time.OffsetDateTime.parse(String.valueOf(value)).toInstant();}catch(Exception ignored){return null;}}}
}
