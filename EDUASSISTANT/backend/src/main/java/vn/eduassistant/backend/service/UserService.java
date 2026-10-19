package vn.eduassistant.backend.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import vn.eduassistant.backend.core.Json;
import vn.eduassistant.backend.db.JdbcSupport;
import java.time.Instant;
import java.util.*;

@Service
public class UserService {
    private final JdbcSupport db;
    private final AuditService audits;
    private final RedisSupport redis;
    private final BCryptPasswordEncoder bcrypt = new BCryptPasswordEncoder();
    public UserService(JdbcSupport db, AuditService audits,RedisSupport redis) { this.db = db; this.audits = audits;this.redis=redis; }

    public Map<String,Object> userById(String id) { return db.one("SELECT * FROM users WHERE id=?", id); }
    public Map<String,Object> userByUsername(String username) { return db.one("SELECT * FROM users WHERE LOWER(username)=LOWER(?)", username == null ? "" : username.trim()); }
    public Map<String,Object> userForToken(String id, String jti) {
        Map<String,Object> user = db.one("SELECT u.*, EXISTS(SELECT 1 FROM revoked_access_tokens r WHERE r.jti=? AND r.expiresat>?) AS accesstokenrevoked FROM users u WHERE u.id=?", jti, Instant.now().toString(), id);
        if (user != null) user.put("accessTokenRevoked", Json.bool(user.get("accessTokenRevoked")));
        return user;
    }
    public List<Map<String,Object>> users() {
        List<Map<String,Object>> rows = db.all("SELECT id,username,fullname AS \"fullName\",studentcode AS \"studentCode\",email,role,department,avatar,bio,twofactorenabled AS \"twoFactorEnabled\",mustchangepassword AS \"mustChangePassword\",createdat AS \"createdAt\" FROM users ORDER BY createdat DESC");
        return rows;
    }
    public Map<String,Object> create(Map<String,Object> data, Map<String,Object> actor) {
        String username = Json.str(data.get("username")).trim(); String role = Json.str(data.get("role")).isEmpty() ? "STUDENT" : Json.str(data.get("role")).toUpperCase();
        String rawPassword = Json.str(data.get("password"));
        if (rawPassword.isEmpty()) throw new IllegalArgumentException("A password is required when creating an account.");
        String id = "usr_" + role.toLowerCase() + "_" + UUID.randomUUID().toString().substring(0,8);
        String studentCode = "STUDENT".equals(role) ? (Json.str(data.get("studentCode")).isEmpty() ? "SV2026-" + (1000 + new Random().nextInt(9000)) : Json.str(data.get("studentCode")).trim().toUpperCase()) : null;
        String name = Json.str(data.get("fullName")).trim(); if (name.isEmpty()) name=username;
        String email = Json.str(data.get("email")).trim(); if (email.isEmpty()) email=username+"@eduassistant.edu";
        String department = Json.str(data.get("department")).trim(); if (department.isEmpty()) department="Khoa Công Nghệ Thông Tin";
        String now=Instant.now().toString(); String password=rawPassword.startsWith("$2")?rawPassword:bcrypt.encode(rawPassword);
        db.update("INSERT INTO users(id,username,password,fullname,studentcode,email,role,department,avatar,bio,twofactorenabled,mustchangepassword,createdat,updatedat) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                id, username, password, name, studentCode, email, role, department,
                "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150", "Người dùng hệ thống EduAssistant.", false, Json.bool(data.get("mustChangePassword")), now, now);
        Map<String,Object> created=userById(id);
        audits.log("AUTH_REGISTER", actor == null ? created : actor,
                map("username",username,"role",role,"studentCode",studentCode,"department",department), "SUCCESS", "Đăng ký tài khoản mới thành công với vai trò " + role);
        if ("STUDENT".equals(role)) {
            db.update("INSERT INTO sis_student_records(id,userid,studentcode,fullname,faculty,createdat,updatedat,updatedby) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(userid) DO NOTHING",
                    "SIS-"+id,id,studentCode,name,department,now,now,"SYSTEM_MIGRATION");
        }
        redis.bumpCacheVersion("admin-users");redis.bumpCacheVersion("admin-stats");
        return created;
    }
    public Map<String,Object> updateProfile(String id, Map<String,Object> updates, Map<String,Object> actor) {
        Map<String,Object> old=userById(id); if(old==null)return null;
        String full=nonEmpty(updates.get("fullName"), old.get("fullName"));
        String bio=updates.containsKey("bio")?Json.str(updates.get("bio")):Json.str(old.get("bio"));
        String avatar=nonEmpty(updates.get("avatar"),old.get("avatar"));
        String dept=nonEmpty(updates.get("department"),old.get("department"));
        String email=nonEmpty(updates.get("email"),old.get("email"));
        String code="STUDENT".equals(old.get("role"))?nonEmpty(updates.get("studentCode"),old.get("studentCode")):Json.str(old.get("studentCode"));
        db.update("UPDATE users SET fullname=?,bio=?,avatar=?,department=?,email=?,studentcode=?,updatedat=? WHERE id=?",full,bio,avatar,dept,email,code,Instant.now().toString(),id);
        audits.log("USER_PROFILE_UPDATED", actor, map("userId",id,"fullName",full,"email",email,"bio",bio),"SUCCESS","Người dùng đã cập nhật thông tin hồ sơ cá nhân.");
        redis.bumpCacheVersion("admin-users");
        return userById(id);
    }
    public void changePassword(String id, String oldPassword, String newPassword, Map<String,Object> actor) {
        Map<String,Object> u=userById(id); if(u==null)throw new IllegalArgumentException("Người dùng không tồn tại.");
        if(!passwordMatches(oldPassword,Json.str(u.get("password")))) throw new IllegalArgumentException("Mật khẩu hiện tại không chính xác. Vui lòng thử lại.");
        if(newPassword==null||newPassword.length()<6)throw new IllegalArgumentException("Mật khẩu mới phải có độ dài từ 6 ký tự trở lên.");
        db.update("UPDATE users SET password=?,mustchangepassword=FALSE,updatedat=? WHERE id=?",bcrypt.encode(newPassword),Instant.now().toString(),id);
        db.update("DELETE FROM refresh_tokens WHERE userid=?",id);
        audits.log("USER_PASSWORD_CHANGED",actor,map("userId",id),"SUCCESS","Đổi mật khẩu thành công; các phiên khác đã bị thu hồi.");
        redis.bumpCacheVersion("admin-users");
    }
    public boolean passwordMatches(String raw, String encoded) {
        if(encoded==null)return false;
        try { return encoded.startsWith("$2") ? bcrypt.matches(raw == null ? "" : raw, encoded) : encoded.equals(raw); }
        catch(Exception e){return encoded.equals(raw);}
    }
    public void saveRefresh(String userId,String token,String expiry) {
        db.update("INSERT INTO refresh_tokens(id,userid,token,expiresat,createdat) VALUES(?,?,?,?,?)","rt_"+UUID.randomUUID(),userId,sha256(token),expiry,Instant.now().toString());
    }
    public Map<String,Object> refresh(String token) { return db.one("SELECT * FROM refresh_tokens WHERE token=?",sha256(token)); }
    public void deleteRefresh(String token) { db.update("DELETE FROM refresh_tokens WHERE token=? OR token=?",sha256(token),token); }
    public void revokeAccess(String jti,String expiry) { db.update("DELETE FROM revoked_access_tokens WHERE expiresat<=?",Instant.now().toString()); db.update("INSERT INTO revoked_access_tokens(jti,expiresat,createdat) VALUES(?,?,?) ON CONFLICT(jti) DO NOTHING",jti,expiry,Instant.now().toString()); }
    public boolean totpEnabled(Map<String,Object> user) { return Json.bool(user.get("twoFactorEnabled")); }
    public String hashToken(String token) { return sha256(token); }
    private static String sha256(String value) { try { byte[] b=java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes("UTF-8")); StringBuilder s=new StringBuilder(); for(byte x:b)s.append(String.format("%02x",x)); return s.toString(); } catch(Exception e){throw new IllegalStateException(e);} }
    private static String nonEmpty(Object value,Object fallback){String v=Json.str(value).trim();return v.isEmpty()?Json.str(fallback):v;}
    public static Map<String,Object> map(Object... pairs) { Map<String,Object> m=new LinkedHashMap<String,Object>(); for(int i=0;i+1<pairs.length;i+=2)m.put(String.valueOf(pairs[i]),pairs[i+1]); return m; }
}
