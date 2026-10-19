package vn.eduassistant.backend.config;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.eduassistant.backend.core.ApiResponse;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@Component
public class CsrfFilter extends OncePerRequestFilter {
    private final AppConfig config;
    private final Set<String> exempt = new HashSet<String>(Arrays.asList("/api/login", "/api/register", "/api/auth/2fa/login"));
    public CsrfFilter(AppConfig config) { this.config = config; }
    @Override protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String method = req.getMethod(); String path = req.getRequestURI();
        boolean mutation = "POST".equals(method) || "PUT".equals(method) || "PATCH".equals(method) || "DELETE".equals(method);
        if (mutation && path.startsWith("/api/") && !exempt.contains(path)
                && (req.getCookies() != null && (cookie(req, config.accessCookie) != null || cookie(req, config.refreshCookie) != null))) {
            String csrf = cookie(req, config.csrfCookie); String header = req.getHeader("X-CSRF-Token");
            if (csrf == null || header == null || !MessageDigest.isEqual(csrf.getBytes(StandardCharsets.UTF_8), header.getBytes(StandardCharsets.UTF_8))) {
                res.setStatus(403); res.setContentType("application/json;charset=UTF-8");
                res.getWriter().write(vn.eduassistant.backend.core.Json.stringify(ApiResponse.failure(403,"CSRF validation failed.","CSRF_INVALID").getBody())); return;
            }
        }
        chain.doFilter(req, res);
    }
    private String cookie(HttpServletRequest req, String name) { if (req.getCookies() == null) return null; for (javax.servlet.http.Cookie c : req.getCookies()) if (name.equals(c.getName())) return c.getValue(); return null; }
}
