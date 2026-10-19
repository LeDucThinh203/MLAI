package vn.eduassistant.backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import vn.eduassistant.backend.core.Json;
import java.time.Instant;
import java.io.InputStream;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;

@Configuration
public class BackendConfiguration {
    @Bean
    @ConditionalOnMissingBean(DataSource.class)
    public DataSource dataSource(@Value("${DATABASE_URL:}") String databaseUrl,
                                 @Value("${DB_POOL_MIN_SIZE:1}") int minPool,
                                 @Value("${DB_POOL_MAX_SIZE:10}") int maxPool,
                                 @Value("${DB_POOL_TIMEOUT_SECONDS:8}") int timeout,
                                 @Value("${eduassistant.evaluation:}") String evaluation) {
        if (evaluation != null && !evaluation.trim().isEmpty()) return new org.springframework.jdbc.datasource.AbstractDataSource() {
            @Override public java.sql.Connection getConnection() throws java.sql.SQLException { throw new java.sql.SQLException("Database access is disabled for standalone evaluation."); }
            @Override public java.sql.Connection getConnection(String username, String password) throws java.sql.SQLException { throw new java.sql.SQLException("Database access is disabled for standalone evaluation."); }
        };
        HikariConfig config = new HikariConfig();
        config.setPoolName("eduassistant-postgres");
        config.setMinimumIdle(Math.max(1, minPool));
        config.setMaximumPoolSize(Math.max(config.getMinimumIdle(), maxPool));
        config.setConnectionTimeout(Math.max(1000, timeout * 1000L));
        if (databaseUrl == null || databaseUrl.trim().isEmpty()) {
            config.setJdbcUrl("jdbc:postgresql://localhost:5432/eduassistant");
        } else {
            String url = databaseUrl.trim().replace("postgresql+psycopg://", "postgresql://")
                    .replace("postgresql+psycopg2://", "postgresql://");
            if (url.startsWith("postgres://")) url = "postgresql://" + url.substring("postgres://".length());
            URI uri = URI.create(url);
            String authority = uri.getRawAuthority();
            String rawUserInfo = uri.getRawUserInfo();
            if (authority == null || authority.isEmpty()) {
                throw new IllegalArgumentException("DATABASE_URL must include a PostgreSQL host.");
            }
            // JDBC URLs do not accept URI user-info in the authority. Keep credentials
            // out of the URL and pass them through Hikari's dedicated setters instead.
            String hostAuthority = rawUserInfo == null ? authority : authority.substring(rawUserInfo.length() + 1);
            if (hostAuthority.isEmpty()) throw new IllegalArgumentException("DATABASE_URL must include a PostgreSQL host.");
            String path = uri.getRawPath();
            String jdbc = "jdbc:postgresql://" + hostAuthority + (path == null || path.isEmpty() ? "/" : path);
            if (uri.getRawQuery() != null) jdbc += "?" + uri.getRawQuery();
            config.setJdbcUrl(jdbc);
            config.setDriverClassName("org.postgresql.Driver");
            if (rawUserInfo != null) {
                String[] credentials = rawUserInfo.split(":", 2);
                config.setUsername(decodeUriComponent(credentials[0]));
                if (credentials.length > 1) config.setPassword(decodeUriComponent(credentials[1]));
            }
        }
        return new HikariDataSource(config);
    }

    private static String decodeUriComponent(String value) {
        try {
            // URLDecoder treats '+' as a space; in URI user-info it is a literal plus.
            return URLDecoder.decode(value.replace("+", "%2B"), "UTF-8");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException("UTF-8 is not available.", e);
        }
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) { return new JdbcTemplate(dataSource); }

    @Bean
    public WebMvcConfigurer corsConfigurer(@Value("${FRONTEND_URL:}") String frontendUrl, AppConfig appConfig) {
        return new WebMvcConfigurer() {
            @Override public void addCorsMappings(CorsRegistry registry) {
                java.util.Set<String> origins = new java.util.LinkedHashSet<String>(Arrays.asList("http://localhost:5173", "http://127.0.0.1:5173", "https://edu-sp.pages.dev"));
                if (frontendUrl != null && !frontendUrl.trim().isEmpty()) origins.add(frontendUrl.trim().replaceAll("/$", ""));
                registry.addMapping("/**").allowedOrigins(origins.toArray(new String[0]))
                        .allowedOriginPatterns("https://*.edu-sp.pages.dev")
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD")
                        .allowedHeaders("*").allowCredentials(true).maxAge(3600);
            }
            @Override public void addResourceHandlers(ResourceHandlerRegistry registry) {
                java.nio.file.Path dist=java.nio.file.Paths.get(appConfig.projectRoot,"frontend","dist").toAbsolutePath().normalize();
                if(java.nio.file.Files.isDirectory(dist))registry.addResourceHandler("/**").addResourceLocations(dist.toUri().toString());
            }
        };
    }

    @Bean
    public DatabaseBootstrap databaseBootstrap(JdbcTemplate jdbcTemplate,
                                                @Value("${DATABASE_URL:}") String databaseUrl,
                                                @Value("${eduassistant.evaluation:}") String evaluation, AppConfig config) {
        return new DatabaseBootstrap(jdbcTemplate, databaseUrl, evaluation, config);
    }

    public static class DatabaseBootstrap implements org.springframework.boot.CommandLineRunner {
        private final JdbcTemplate jdbc;
        private final String databaseUrl;
        private final String evaluation;
        private final AppConfig config;
        public DatabaseBootstrap(JdbcTemplate jdbc, String databaseUrl, String evaluation, AppConfig config) { this.jdbc = jdbc; this.databaseUrl = databaseUrl; this.evaluation = evaluation; this.config = config; }
        @Override public void run(String... args) {
            if (evaluation != null && !evaluation.trim().isEmpty()) {
                System.out.println("[Database] Initialization skipped for the standalone evaluation runner.");
                return;
            }
            if (databaseUrl == null || databaseUrl.trim().isEmpty()) {
                System.out.println("[Database] PostgreSQL initialization deferred (DATABASE_URL is not set).");
                return;
            }
            new ResourceDatabasePopulator(new ClassPathResource("db/migration/schema.sql")).execute(jdbc.getDataSource());
            seedUsers();
            backfillSis();
            System.out.println("[Database] PostgreSQL schema ready.");
        }
        private void seedUsers() {
            if (!config.seedDemoData || count("SELECT COUNT(*) FROM users") != 0) return;
            try (InputStream source=getClass().getClassLoader().getResourceAsStream("db/data.json")) {
                if(source==null) { System.err.println("[Database] Demo seed data file is missing."); return; }
                Map<String,Object> data=Json.object(Json.MAPPER.readValue(source,Object.class));
                Object entries=data.get("users");if(!(entries instanceof List))return;
                BCryptPasswordEncoder bcrypt=new BCryptPasswordEncoder();
                for(Object item:(List<?>)entries){Map<String,Object> u=Json.object(item);String raw=Json.str(u.get("password"));if(raw.isEmpty())throw new IllegalStateException("Seeded demo accounts must define a password.");String password=raw.startsWith("$2a$")||raw.startsWith("$2b$")?raw:bcrypt.encode(raw);String now=Instant.now().toString();
                    jdbc.update("INSERT INTO users(id,username,password,fullname,studentcode,email,role,department,avatar,bio,twofactorenabled,twofactorsecret,mustchangepassword,academicstatus,coursestartdate,courseenddate,currenttermactive,hascurrentschedule,registeredpermanentaddress,faculty,createdat,updatedat) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                            u.get("id"),u.get("username"),password,u.get("fullName"),u.get("studentCode"),u.getOrDefault("email",Json.str(u.get("username"))+"@eduassistant.edu"),u.get("role"),u.getOrDefault("department","Khoa Công Nghệ Thông Tin"),u.get("avatar"),u.get("bio"),Boolean.TRUE.equals(u.get("twoFactorEnabled")),u.get("twoFactorSecret"),false,u.get("academicStatus"),u.get("courseStartDate"),u.get("courseEndDate"),u.get("currentTermActive"),u.get("hasCurrentSchedule"),u.get("registeredPermanentAddress"),u.getOrDefault("faculty",u.get("department")),u.getOrDefault("createdAt",now),u.getOrDefault("updatedAt",now));
                }
            } catch(Exception e) { throw new IllegalStateException("Demo account seed failed.",e); }
        }
        private void backfillSis() {
            String now=Instant.now().toString();
            jdbc.update("INSERT INTO sis_student_records(id,userid,studentcode,fullname,academicstatus,coursestartdate,courseenddate,currenttermactive,hascurrentschedule,registeredpermanentaddress,faculty,createdat,updatedat,updatedby) SELECT 'SIS-'||id,id,studentcode,fullname,academicstatus,coursestartdate,courseenddate,currenttermactive,hascurrentschedule,registeredpermanentaddress,faculty,?,?, 'SYSTEM_MIGRATION' FROM users WHERE role='STUDENT' ON CONFLICT(userid) DO NOTHING",now,now);
            if(!config.seedDemoData)return;
            try (InputStream source=getClass().getClassLoader().getResourceAsStream("db/data.json")) {if(source==null)return;Map<String,Object> data=Json.object(Json.MAPPER.readValue(source,Object.class));Object entries=data.get("users");if(!(entries instanceof List))return;
                for(Object item:(List<?>)entries){Map<String,Object>u=Json.object(item);if(!"STUDENT".equals(u.get("role")))continue;
                    jdbc.update("UPDATE sis_student_records SET academicstatus=CASE WHEN academicstatus IS NULL OR academicstatus='UNKNOWN' THEN ? ELSE academicstatus END,coursestartdate=COALESCE(coursestartdate,?),courseenddate=COALESCE(courseenddate,?),currenttermactive=COALESCE(currenttermactive,?),hascurrentschedule=COALESCE(hascurrentschedule,?),registeredpermanentaddress=COALESCE(registeredpermanentaddress,?),faculty=COALESCE(faculty,?) WHERE userid=?",
                            u.get("academicStatus"),u.get("courseStartDate"),u.get("courseEndDate"),u.get("currentTermActive"),u.get("hasCurrentSchedule"),u.get("registeredPermanentAddress"),u.get("faculty"),u.get("id"));
                }
            } catch(Exception e){throw new IllegalStateException("Demo SIS facts could not be synchronized.",e);}
        }
        private long count(String sql){Long n=jdbc.queryForObject(sql,Long.class);return n==null?0:n;}
    }
}
