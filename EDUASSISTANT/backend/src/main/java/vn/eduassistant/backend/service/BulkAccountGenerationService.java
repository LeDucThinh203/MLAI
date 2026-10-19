package vn.eduassistant.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.postgresql.PGConnection;
import org.postgresql.copy.CopyManager;
import vn.eduassistant.backend.config.AppConfig;
import vn.eduassistant.backend.db.JdbcSupport;

import java.io.BufferedWriter;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.GZIPOutputStream;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

@Service
public class BulkAccountGenerationService {
    public static final int ACCOUNT_COUNT = 100_000;
    private static final int BATCH_SIZE = 5000;
    private final JdbcSupport db;
    private final JdbcTemplate jdbc;
    private final UserService users;
    private final AuditService audits;
    private final AppConfig config;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread thread = new Thread(r, "bulk-account-generator");
        thread.setDaemon(true);
        return thread;
    });
    private final AtomicBoolean running = new AtomicBoolean(false);

    public BulkAccountGenerationService(JdbcSupport db, UserService users, AuditService audits, AppConfig config) {
        this.db = db;
        this.jdbc = db.jdbc();
        this.users = users;
        this.audits = audits;
        this.config = config;
    }

    public synchronized Map<String,Object> start(Map<String,Object> actor) {
        if (running.get() || db.count("SELECT COUNT(*) FROM account_generation_jobs WHERE status IN ('QUEUED','RUNNING')") > 0) {
            throw new IllegalStateException("A bulk account generation job is already running.");
        }
        String id = UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String now = Instant.now().toString();
        byte[] seed = new byte[32];
        new SecureRandom().nextBytes(seed);
        String encryptedSeed = encryptSeed(seed);
        db.update("INSERT INTO account_generation_jobs(id,createdby,status,total,generated,error,credentialseed,createdat,updatedat) VALUES(?,?,'QUEUED',?,0,NULL,?,?,?)",
                id, actor.get("id"), ACCOUNT_COUNT, encryptedSeed, now, now);
        running.set(true);
        worker.submit(() -> generate(id, String.valueOf(actor.get("id")), seed));
        return job(id);
    }

    public Map<String,Object> job(String id) {
        Map<String,Object> result = db.one("SELECT id,createdby AS \"createdBy\",status,total,generated,error,createdat AS \"createdAt\",updatedat AS \"updatedAt\",(credentialseed IS NOT NULL) AS \"credentialsReady\" FROM account_generation_jobs WHERE id=?", id);
        return result;
    }

    public Map<String,Object> latestJob() {
        return db.one("SELECT id,createdby AS \"createdBy\",status,total,generated,error,createdat AS \"createdAt\",updatedat AS \"updatedAt\",(credentialseed IS NOT NULL) AS \"credentialsReady\" FROM account_generation_jobs ORDER BY createdat DESC LIMIT 1");
    }

    public boolean credentialsReady(String id) {
        return db.count("SELECT COUNT(*) FROM account_generation_jobs WHERE id=? AND status='COMPLETE' AND credentialseed IS NOT NULL", id) > 0;
    }

    public void writeCredentials(String id, OutputStream output) throws java.io.IOException {
        Map<String,Object> result = db.one("SELECT credentialseed FROM account_generation_jobs WHERE id=? AND status='COMPLETE'", id);
        if (result == null || result.get("credentialseed") == null) throw new java.io.FileNotFoundException("Credential export is not ready.");
        byte[] seed = decryptSeed(String.valueOf(result.get("credentialseed")));
        GZIPOutputStream gzip = new GZIPOutputStream(output, 65536);
        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(gzip, StandardCharsets.UTF_8), 65536);
        try {
            jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>)connection -> {
                boolean oldAutoCommit = connection.getAutoCommit();
                connection.setAutoCommit(false);
                try (java.sql.PreparedStatement statement = connection.prepareStatement(
                        "SELECT username FROM users WHERE accountbatchid=? ORDER BY username",
                        java.sql.ResultSet.TYPE_FORWARD_ONLY, java.sql.ResultSet.CONCUR_READ_ONLY)) {
                    statement.setString(1, id);
                    statement.setFetchDirection(java.sql.ResultSet.FETCH_FORWARD);
                    statement.setFetchSize(2000);
                    try (java.sql.ResultSet rows = statement.executeQuery()) {
                        writer.write("username,temporary_password\n");
                        Mac mac = Mac.getInstance("HmacSHA256");
                        mac.init(new SecretKeySpec(seed, "HmacSHA256"));
                        Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
                        while (rows.next()) {
                            String username = rows.getString(1);
                            String password = encoder.encodeToString(mac.doFinal(("eduassistant-bulk-v1:" + username).getBytes(StandardCharsets.UTF_8)));
                            writer.write(username);
                            writer.write(',');
                            writer.write(password);
                            writer.write('\n');
                        }
                        writer.flush();
                        gzip.finish();
                    } catch (java.io.IOException e) {
                        throw new java.sql.SQLException("Credential export stream failed.", e);
                    }
                    connection.commit();
                    return null;
                } catch (Exception e) {
                    connection.rollback();
                    if (e instanceof java.sql.SQLException) throw (java.sql.SQLException)e;
                    throw new java.sql.SQLException("Credential export failed.", e);
                } finally {
                    connection.setAutoCommit(oldAutoCommit);
                }
            });
        } catch (Exception e) {
            throw new java.io.IOException("Credential export failed.", e);
        } finally {
            java.util.Arrays.fill(seed, (byte)0);
        }
    }

    @Transactional
    public long deleteBatch(String id) {
        Map<String,Object> result = job(id);
        if (result == null) throw new IllegalArgumentException("Account generation job not found.");
        if ("QUEUED".equals(result.get("status")) || "RUNNING".equals(result.get("status"))) {
            throw new IllegalStateException("Wait for account generation to finish before removing the batch.");
        }
        long count = db.count("SELECT COUNT(*) FROM users WHERE accountbatchid=?", id);
        long linkedCases = db.count("SELECT COUNT(*) FROM cases WHERE studentid IN (SELECT id FROM users WHERE accountbatchid=?)", id);
        long evidenceFiles = db.count("SELECT COUNT(*) FROM evidence_uploads WHERE ownerid IN (SELECT id FROM users WHERE accountbatchid=?)", id);
        long accountActivity = db.count("SELECT COUNT(*) FROM audits WHERE actorid IN (SELECT id FROM users WHERE accountbatchid=?)", id);
        long agentConversations = db.count("SELECT COUNT(*) FROM agent_conversations WHERE user_id IN (SELECT id FROM users WHERE accountbatchid=?)", id);
        if (linkedCases > 0 || evidenceFiles > 0 || accountActivity > 0 || agentConversations > 0) {
            throw new IllegalStateException("This account batch has been used and cannot be removed automatically.");
        }
        db.update("DELETE FROM notifications WHERE userid IN (SELECT id FROM users WHERE accountbatchid=?)", id);
        db.update("DELETE FROM refresh_tokens WHERE userid IN (SELECT id FROM users WHERE accountbatchid=?)", id);
        db.update("DELETE FROM sis_student_records WHERE userid IN (SELECT id FROM users WHERE accountbatchid=?)", id);
        db.update("DELETE FROM users WHERE accountbatchid=?", id);
        db.update("UPDATE account_generation_jobs SET status='DELETED',generated=0,credentialseed=NULL,updatedat=? WHERE id=?", Instant.now().toString(), id);
        return count;
    }

    private void generate(String jobId, String actorId, byte[] seed) {
        int generated = 0;
        try {
            String now = Instant.now().toString();
            SecureRandom random = new SecureRandom();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(seed, "HmacSHA256"));
            List<Object[]> userBatch = new ArrayList<Object[]>(BATCH_SIZE);
            List<Object[]> sisBatch = new ArrayList<Object[]>(BATCH_SIZE);

            updateJob(jobId, "RUNNING", 0, null);
            for (int index = 1; index <= ACCOUNT_COUNT; index++) {
                String suffix = leftPad(index, 7);
                String username = "bench_" + jobId + "_" + suffix;
                String userId = "usr_bench_" + jobId + "_" + suffix;
                String code = "BM" + jobId.toUpperCase() + suffix;
                String fullName = "Benchmark Student " + suffix;
                String password = encoder.encodeToString(mac.doFinal(("eduassistant-bulk-v1:" + username).getBytes(StandardCharsets.UTF_8)));
                byte[] salt = new byte[16];
                random.nextBytes(salt);
                String passwordHash = UserService.hashGeneratedPassword(password, salt, digest);

                userBatch.add(new Object[]{userId, username, passwordHash, fullName, code,
                        username + "@example.invalid", "STUDENT", "Benchmark Dataset", null,
                        "Synthetic account created for a database load demonstration; change the temporary password after first sign-in.",
                        false, true, now, now, "BENCHMARK", jobId});
                sisBatch.add(new Object[]{"SIS-" + userId, userId, code, fullName, "Benchmark Dataset",
                        "ACCOUNT_BENCHMARK", "ACCOUNT_BENCHMARK", "UNVERIFIED", "ACTIVE", now, now, "SYSTEM_BENCHMARK_GENERATOR"});

                if (userBatch.size() == BATCH_SIZE) {
                    flush(userBatch, sisBatch);
                    generated += userBatch.size();
                    userBatch.clear();
                    sisBatch.clear();
                    if (generated % 10000 == 0) updateJob(jobId, "RUNNING", generated, null);
                }
            }
            if (!userBatch.isEmpty()) {
                flush(userBatch, sisBatch);
                generated += userBatch.size();
                updateJob(jobId, "RUNNING", generated, null);
            }

            updateJob(jobId, "COMPLETE", generated, null);
            try {
                Map<String,Object> actor = users.userById(actorId);
                audits.log("ADMIN_BULK_USERS_GENERATED", actor,
                        UserService.map("jobId", jobId, "accountCount", generated, "accountSource", "BENCHMARK"),
                        "SUCCESS", "Admin generated synthetic login accounts for a database load demonstration.");
            } catch (Exception auditError) {
                System.err.println("[BulkAccounts] Generated account batch " + jobId + ", but the completion audit could not be written.");
            }
        } catch (Exception e) {
            boolean cleaned = false;
            try {
                db.update("DELETE FROM sis_student_records WHERE userid IN (SELECT id FROM users WHERE accountbatchid=?)", jobId);
                db.update("DELETE FROM users WHERE accountbatchid=?", jobId);
                cleaned = true;
            } catch (Exception cleanupError) {
                System.err.println("[BulkAccounts] Failed to clean partial account batch " + jobId + ".");
            }
            updateJob(jobId, "FAILED", cleaned ? 0 : generated,
                    cleaned ? "Generation failed; partial rows were removed." : "Generation failed and partial rows may remain; remove the batch from the admin page.");
            if (cleaned) db.update("UPDATE account_generation_jobs SET credentialseed=NULL WHERE id=?", jobId);
            System.err.println("[BulkAccounts] Generation failed for job " + jobId + " (" + e.getClass().getSimpleName() + ").");
        } finally {
            java.util.Arrays.fill(seed, (byte)0);
            running.set(false);
        }
    }

    private void flush(List<Object[]> userBatch, List<Object[]> sisBatch) {
        jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<Void>) connection -> {
            boolean previousAutoCommit = connection.getAutoCommit();
            connection.setAutoCommit(false);
            try {
                CopyManager copy = connection.unwrap(PGConnection.class).getCopyAPI();
                long usersCopied = copy.copyIn("COPY users(id,username,password,fullname,studentcode,email,role,department,avatar,bio,twofactorenabled,mustchangepassword,createdat,updatedat,accountsource,accountbatchid) FROM STDIN WITH (FORMAT CSV)",
                        new StringReader(toCsv(userBatch)));
                long sisCopied = copy.copyIn("COPY sis_student_records(id,userid,studentcode,fullname,faculty,source,sourcetype,verificationstatus,recordstatus,createdat,updatedat,updatedby) FROM STDIN WITH (FORMAT CSV)",
                        new StringReader(toCsv(sisBatch)));
                if (usersCopied != userBatch.size() || sisCopied != sisBatch.size()) {
                    throw new java.sql.SQLException("PostgreSQL COPY row count did not match the generated batch.");
                }
                connection.commit();
                return null;
            } catch (Exception e) {
                connection.rollback();
                if (e instanceof java.sql.SQLException) throw (java.sql.SQLException)e;
                throw new java.sql.SQLException("PostgreSQL COPY batch failed.", e);
            } finally {
                connection.setAutoCommit(previousAutoCommit);
            }
        });
    }

    private String toCsv(List<Object[]> rows) {
        StringBuilder csv = new StringBuilder(rows.size() * 256);
        for (Object[] row : rows) {
            for (int column = 0; column < row.length; column++) {
                if (column > 0) csv.append(',');
                Object value = row[column];
                if (value == null) {
                    csv.append("\\N");
                } else {
                    String text = value instanceof Boolean
                            ? (((Boolean)value).booleanValue() ? "true" : "false")
                            : String.valueOf(value);
                    csv.append('"').append(text.replace("\"", "\"\"")).append('"');
                }
            }
            csv.append('\n');
        }
        return csv.toString();
    }

    private void updateJob(String id, String status, int generated, String error) {
        db.update("UPDATE account_generation_jobs SET status=?,generated=?,error=?,updatedat=? WHERE id=?",
                status, generated, error, Instant.now().toString(), id);
    }

    private String encryptSeed(byte[] seed) {
        try {
            byte[] nonce = new byte[12];
            new SecureRandom().nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(encryptionKey(), "AES"), new GCMParameterSpec(128, nonce));
            byte[] encrypted = cipher.doFinal(seed);
            ByteBuffer payload = ByteBuffer.allocate(nonce.length + encrypted.length);
            payload.put(nonce).put(encrypted);
            return "v1:" + Base64.getUrlEncoder().withoutPadding().encodeToString(payload.array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not protect generated account credentials.", e);
        }
    }

    private byte[] decryptSeed(String encryptedSeed) {
        try {
            if (encryptedSeed == null || !encryptedSeed.startsWith("v1:")) throw new IllegalArgumentException("Unsupported credential export version.");
            byte[] payload = Base64.getUrlDecoder().decode(encryptedSeed.substring(3));
            ByteBuffer buffer = ByteBuffer.wrap(payload);
            byte[] nonce = new byte[12];
            buffer.get(nonce);
            byte[] ciphertext = new byte[buffer.remaining()];
            buffer.get(ciphertext);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(encryptionKey(), "AES"), new GCMParameterSpec(128, nonce));
            return cipher.doFinal(ciphertext);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not decrypt generated account credentials.", e);
        }
    }

    private byte[] encryptionKey() throws GeneralSecurityException {
        return MessageDigest.getInstance("SHA-256").digest(config.jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    private static String leftPad(int value, int width) {
        String digits = Integer.toString(value);
        StringBuilder result = new StringBuilder(width);
        for (int i = digits.length(); i < width; i++) result.append('0');
        return result.append(digits).toString();
    }
}
