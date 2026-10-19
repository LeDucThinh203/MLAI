package vn.eduassistant.backend.core;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public final class ApiResponse {
    private ApiResponse() { }
    public static ResponseEntity<Map<String,Object>> success(int code, String message, Object data) {
        return build(code, true, message, data, null);
    }
    public static ResponseEntity<Map<String,Object>> success(int code, String message) { return success(code, message, null); }
    public static ResponseEntity<Map<String,Object>> failure(int code, String message, Object error) {
        return build(code, false, message, null, error);
    }
    public static ResponseEntity<Map<String,Object>> failure(int code, boolean success, String message, Object data, Object error) {
        return build(code, success, message, data, error);
    }
    public static ResponseEntity<Map<String,Object>> build(int code, boolean ok, String message, Object data, Object error) {
        Map<String,Object> body = new LinkedHashMap<String,Object>();
        body.put("success", ok); body.put("statusCode", code); body.put("message", message);
        body.put("timestamp", Instant.now().toString()); body.put("data", data); body.put("error", error);
        return ResponseEntity.status(code).body(body);
    }
    public static ResponseEntity<Map<String,Object>> fail(HttpStatus status, String message, String code) {
        return failure(status.value(), message, code);
    }
}
