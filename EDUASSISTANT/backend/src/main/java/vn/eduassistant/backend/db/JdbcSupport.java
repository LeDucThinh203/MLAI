package vn.eduassistant.backend.db;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.sql.ResultSetMetaData;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class JdbcSupport {
    private final JdbcTemplate jdbc;
    public JdbcSupport(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public Map<String,Object> one(String sql, Object... args) {
        List<Map<String,Object>> rows = all(sql, args); return rows.isEmpty() ? null : rows.get(0);
    }
    public List<Map<String,Object>> all(String sql, Object... args) {
        return jdbc.query(sql, args, (rs, rowNum) -> {
            Map<String,Object> row = new LinkedHashMap<String,Object>();
            ResultSetMetaData md = rs.getMetaData();
            for (int i=1; i<=md.getColumnCount(); i++) row.put(camel(md.getColumnLabel(i)), rs.getObject(i));
            return row;
        });
    }
    public int update(String sql, Object... args) { return jdbc.update(sql, args); }
    public long count(String sql, Object... args) { Long value = jdbc.queryForObject(sql, Long.class, args); return value == null ? 0L : value; }
    public JdbcTemplate jdbc() { return jdbc; }
    public static String camel(String raw) {
        if (raw == null) return null;
        String[] fields = {"studentId","studentName","studentCode","reviewResult","supplementHistory","aiExtraction","evidenceFiles","assignedDepartment","digitalSignature","reviewerFeedback","studentClaim","institutionalFacts","addressAnalysis","actorId","actorName","actorRole","actorUsername","inputData","caseId","authorId","authorName","authorRole","authorAvatar","userId","isRead","createdAt","updatedAt","expiresAt","twoFactorEnabled","twoFactorSecret","mustChangePassword","academicStatus","courseStartDate","courseEndDate","currentTermActive","hasCurrentSchedule","registeredPermanentAddress","fileName","ownerId","ocrData","ocrProvider","ocrIsLive","currentThreshold","minThreshold","maxThreshold","stepSize","verifiedBy","verifiedAt","recordStatus","updatedBy","sourceKey","sourcePath","sourceType","verificationStatus","contentHash","documentId","chunkIndex","embeddingProvider","embeddingModel","embeddingDimension","conversationId","roleAtRequest","argumentsHash","accessTokenRevoked","fullName","source","totalThreshold"};
        for (String field : fields) if (field.equalsIgnoreCase(raw)) return field;
        return raw;
    }
    public static Map<String,Object> copyWithout(Map<String,Object> source, String... excluded) {
        Map<String,Object> out = new LinkedHashMap<String,Object>(source);
        for (String key : excluded) out.remove(key);
        return out;
    }
}
