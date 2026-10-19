package vn.eduassistant.backend.config;

import org.springframework.stereotype.Component;
import java.security.SecureRandom;
import java.util.Base64;

@Component
public class AppConfig {
    public final String appEnv;
    public final boolean production;
    public final String jwtSecret;
    public final String refreshSecret;
    public final String cookieSameSite;
    public final String cookieDomain;
    public final boolean cookieSecure;
    public final String accessCookie = "edu_access";
    public final String refreshCookie = "edu_refresh";
    public final String csrfCookie = "edu_csrf";
    public final String redisUrl;
    public final String redisPrefix;
    public final String geminiApiKey;
    public final String openRouterApiKey;
    public final String aiMode;
    public final boolean agentEnabled;
    public final boolean seedDemoData;
    public final boolean allowAdminVerifiedDemoSis;
    public final String projectRoot;

    public AppConfig() {
        String env = firstEnv("APP_ENV", "ENV", "NODE_ENV");
        production = "production".equalsIgnoreCase(env);
        appEnv = env.isEmpty() ? "development" : env.toLowerCase();
        jwtSecret = secret("JWT_SECRET");
        refreshSecret = secret("REFRESH_SECRET");
        if (jwtSecret.equals(refreshSecret)) throw new IllegalStateException("JWT_SECRET and REFRESH_SECRET must differ.");
        cookieSecure = bool("COOKIE_SECURE", production);
        cookieSameSite = value("COOKIE_SAMESITE", cookieSecure ? "none" : "lax").toLowerCase();
        if ("none".equals(cookieSameSite) && !cookieSecure) throw new IllegalStateException("COOKIE_SAMESITE=none requires COOKIE_SECURE=true");
        cookieDomain = emptyToNull(value("COOKIE_DOMAIN", ""));
        redisUrl = value("REDIS_URL", "").trim();
        redisPrefix = value("REDIS_KEY_PREFIX", "eduassistant").trim();
        geminiApiKey = value("GEMINI_API_KEY", "").trim();
        openRouterApiKey = value("OPENROUTER_API_KEY", "").trim();
        aiMode = value("AI_MODE", "live").trim().toLowerCase();
        agentEnabled = bool("AGENT_ENABLED", true);
        seedDemoData = bool("SEED_DEMO_DATA", "development".equals(appEnv) || "demo".equals(appEnv));
        allowAdminVerifiedDemoSis = bool("ALLOW_ADMIN_VERIFIED_DEMO_SIS", "development".equals(appEnv) || "demo".equals(appEnv));
        projectRoot = value("PROJECT_ROOT", resolveProjectRoot(System.getProperty("user.dir", ".")));
    }

    private static String secret(String name) {
        String value = value(name, "");
        if (value != null) value = value.trim();
        if (value != null && !value.isEmpty()) {
            if ("production".equalsIgnoreCase(firstEnv("APP_ENV", "ENV", "NODE_ENV")) && value.length() < 32)
                throw new IllegalStateException(name + " must contain at least 32 characters in production.");
            return value;
        }
        byte[] bytes = new byte[32]; new SecureRandom().nextBytes(bytes);
        return "caseflow_" + name.toLowerCase() + "_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
    public static String value(String name, String fallback) { String value = System.getenv(name);if(value==null||value.isEmpty())value=System.getProperty(name);return value == null ? fallback : value; }
    public static boolean bool(String name, boolean fallback) { return Boolean.parseBoolean(value(name, String.valueOf(fallback)).trim()); }
    private static String firstEnv(String... names) { for (String name : names) { String v = value(name, ""); if (v != null && !v.trim().isEmpty()) return v.trim(); } return ""; }
    private static String emptyToNull(String value) { return value == null || value.trim().isEmpty() ? null : value.trim(); }
    private static String resolveProjectRoot(String current) {
        java.nio.file.Path path = java.nio.file.Paths.get(current).toAbsolutePath().normalize();
        if (path.getFileName() != null && "backend".equalsIgnoreCase(path.getFileName().toString())
                && java.nio.file.Files.isDirectory(path.getParent().resolve("frontend"))) return path.getParent().toString();
        if (java.nio.file.Files.isDirectory(path.resolve("EDUASSISTANT/backend"))) return path.resolve("EDUASSISTANT").toString();
        if (java.nio.file.Files.isDirectory(path.resolve("backend")) && java.nio.file.Files.isDirectory(path.resolve("frontend"))) return path.toString();
        return path.toString();
    }
}
