package vn.eduassistant.backend.service;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.interfaces.DecodedJWT;
import org.springframework.stereotype.Service;
import vn.eduassistant.backend.config.AppConfig;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {
    private final Algorithm algorithm;
    private final JWTVerifier verifier;
    public JwtService(AppConfig config) { algorithm=Algorithm.HMAC256(config.jwtSecret); verifier=JWT.require(algorithm).build(); }
    public String issue(Map<String,Object> user, long lifetimeMillis) {
        Date now=new Date();
        return JWT.create().withIssuedAt(now).withExpiresAt(new Date(now.getTime()+lifetimeMillis))
                .withJWTId(UUID.randomUUID().toString().replace("-", ""))
                .withClaim("id",str(user,"id")).withClaim("username",str(user,"username"))
                .withClaim("role",str(user,"role")).withClaim("fullName",str(user,"fullName"))
                .withClaim("studentCode", nullable(user.get("studentCode")))
                .withClaim("department", nullable(user.get("department")))
                .withClaim("mustChangePassword",Boolean.TRUE.equals(user.get("mustChangePassword")))
                .sign(algorithm);
    }
    public String temporary2fa(Map<String,Object> user) {
        Date now=new Date();return JWT.create().withIssuedAt(now).withExpiresAt(new Date(now.getTime()+600000))
                .withClaim("id",str(user,"id")).withClaim("username",str(user,"username")).withClaim("temp2FA",true).sign(algorithm);
    }
    public DecodedJWT verify(String token) { return verifier.verify(token); }
    public Algorithm getAlgorithm() { return algorithm; }
    private static String str(Map<String,Object> map,String key){Object v=map.get(key);return v==null?"":String.valueOf(v);}
    private static String nullable(Object value){return value==null?null:String.valueOf(value);}
}
