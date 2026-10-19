package vn.eduassistant.backend.service;

import org.springframework.context.ConfigurableApplicationContext;
import vn.eduassistant.backend.config.AppConfig;
import vn.eduassistant.backend.db.JdbcSupport;

import java.net.URI;
import java.util.Map;

/** One-shot local command for writing the confirmed account batch directly to Neon. */
public final class DirectNeonAccountSeedCommand {
    private static final String CONFIRMATION = "CREATE_100000_USERS";

    private DirectNeonAccountSeedCommand() { }

    public static int execute(ConfigurableApplicationContext context) {
        String confirmation = context.getEnvironment().getProperty("eduassistant.bulk-accounts.confirmation", "");
        String databaseUrl = context.getEnvironment().getProperty("DATABASE_URL", "");
        if (!CONFIRMATION.equals(confirmation)) {
            System.err.println("[BulkAccounts] Direct Neon seeding needs eduassistant.bulk-accounts.confirmation=CREATE_100000_USERS.");
            return 2;
        }
        if (!isNeonUrl(databaseUrl)) {
            System.err.println("[BulkAccounts] Refusing direct seeding: DATABASE_URL does not point to a *.neon.tech host.");
            return 2;
        }
        String configuredJwtSecret = context.getEnvironment().getProperty("JWT_SECRET", "").trim();
        AppConfig config = context.getBean(AppConfig.class);
        if (configuredJwtSecret.length() < 32 || !configuredJwtSecret.equals(config.jwtSecret)) {
            System.err.println("[BulkAccounts] Set the same JWT_SECRET used by the deployed service so Admin can export credentials later.");
            return 2;
        }

        try {
            JdbcSupport db = context.getBean(JdbcSupport.class);
            BulkAccountGenerationService accounts = context.getBean(BulkAccountGenerationService.class);
            if (db.count("SELECT COUNT(*) FROM users WHERE accountsource='BENCHMARK'") > 0) {
                System.err.println("[BulkAccounts] Benchmark accounts already exist in Neon; refusing to create a duplicate 100,000-account batch.");
                return 2;
            }
            Map<String,Object> actor = db.one("SELECT id,username,fullname AS \"fullName\",role FROM users WHERE role='ADMIN' ORDER BY createdat ASC NULLS LAST LIMIT 1");
            if (actor == null) {
                System.err.println("[BulkAccounts] No ADMIN account was found in Neon; no accounts were created.");
                return 2;
            }

            Map<String,Object> job = accounts.start(actor);
            String jobId = String.valueOf(job.get("id"));
            System.out.println("[BulkAccounts] Neon job started: " + jobId);
            int lastReported = -1;
            while (true) {
                Map<String,Object> state = accounts.job(jobId);
                if (state == null) throw new IllegalStateException("The account generation job disappeared.");
                int generated = ((Number)state.get("generated")).intValue();
                if (generated != lastReported) {
                    System.out.println("[BulkAccounts] Progress: " + generated + "/" + BulkAccountGenerationService.ACCOUNT_COUNT);
                    lastReported = generated;
                }
                String status = String.valueOf(state.get("status"));
                if ("COMPLETE".equals(status)) {
                    long userCount = db.count("SELECT COUNT(*) FROM users WHERE accountbatchid=?", jobId);
                    long sisCount = db.count("SELECT COUNT(*) FROM sis_student_records s JOIN users u ON u.id=s.userid WHERE u.accountbatchid=?", jobId);
                    if (userCount != BulkAccountGenerationService.ACCOUNT_COUNT || sisCount != BulkAccountGenerationService.ACCOUNT_COUNT) {
                        System.err.println("[BulkAccounts] Job reported COMPLETE, but persisted counts did not match the requested batch: users=" + userCount + ", SIS records=" + sisCount + ".");
                        return 1;
                    }
                    System.out.println("[BulkAccounts] Verified persisted rows: users=" + userCount + ", SIS records=" + sisCount + ".");
                    System.out.println("[BulkAccounts] Complete. Admin credential export ready: " + state.get("credentialsReady"));
                    return 0;
                }
                if ("FAILED".equals(status)) {
                    System.err.println("[BulkAccounts] Failed: " + state.get("error"));
                    return 1;
                }
                Thread.sleep(2000L);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            System.err.println("[BulkAccounts] Direct Neon seeding was interrupted; inspect job status before retrying.");
            return 1;
        } catch (Exception e) {
            System.err.println("[BulkAccounts] Direct Neon seeding failed: " + e.getClass().getSimpleName());
            return 1;
        }
    }

    private static boolean isNeonUrl(String databaseUrl) {
        try {
            String normalized = databaseUrl.trim()
                    .replace("postgresql+psycopg2://", "postgresql://")
                    .replace("postgresql+psycopg://", "postgresql://")
                    .replaceFirst("^postgres://", "postgresql://");
            String host = URI.create(normalized).getHost();
            return host != null && host.toLowerCase(java.util.Locale.ROOT).endsWith(".neon.tech");
        } catch (Exception e) {
            return false;
        }
    }
}
