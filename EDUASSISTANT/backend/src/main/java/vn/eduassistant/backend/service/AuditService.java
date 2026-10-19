package vn.eduassistant.backend.service;

import org.springframework.stereotype.Service;
import vn.eduassistant.backend.core.Json;
import vn.eduassistant.backend.db.JdbcSupport;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditService {
    private final JdbcSupport db;
    private final RedisSupport redis;
    public AuditService(JdbcSupport db,RedisSupport redis) { this.db = db;this.redis=redis; }
    public void log(String action, Map<String,Object> actor, Object input, Object result, String reason, String caseId) {
        Map<String,Object> a = actor == null ? new LinkedHashMap<String,Object>() : actor;
        try {
            db.update("INSERT INTO audits(id,action,caseid,actorid,actorname,actorrole,actorusername,inputdata,result,reason,timestamp) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                    "audit_" + UUID.randomUUID().toString().replace("-", ""), action, caseId,
                    a.get("id"), a.get("name") == null ? a.get("fullName") : a.get("name"), a.get("role"), a.get("username"),
                    Json.stringify(input), result instanceof String ? result : Json.stringify(result), reason, Instant.now().toString());
            redis.bumpCacheVersion("admin-stats");
        } catch (Exception e) { System.err.println("[Audit] Deferred: " + e.getClass().getSimpleName()); }
    }
    public void log(String action, Map<String,Object> actor, Object input, Object result, String reason) { log(action, actor, input, result, reason, null); }
}
