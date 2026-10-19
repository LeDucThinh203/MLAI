package vn.eduassistant.backend.core;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Collections;
import java.util.Map;

public final class Json {
    public static final ObjectMapper MAPPER = new ObjectMapper();
    private Json() { }
    public static String stringify(Object value) {
        try { return MAPPER.writeValueAsString(value); } catch (Exception e) { return "null"; }
    }
    public static Object parse(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        try { return MAPPER.readValue(value, Object.class); } catch (Exception e) { return null; }
    }
    @SuppressWarnings("unchecked")
    public static Map<String,Object> map(String value) {
        Object data = parse(value); return data instanceof Map ? (Map<String,Object>)data : Collections.<String,Object>emptyMap();
    }
    @SuppressWarnings("unchecked")
    public static Map<String,Object> object(Object value) { return value instanceof Map ? (Map<String,Object>)value : Collections.<String,Object>emptyMap(); }
    public static String str(Object value) { return value == null ? "" : String.valueOf(value); }
    public static boolean bool(Object value) { return Boolean.TRUE.equals(value) || "true".equalsIgnoreCase(str(value)) || "1".equals(str(value)); }
}
