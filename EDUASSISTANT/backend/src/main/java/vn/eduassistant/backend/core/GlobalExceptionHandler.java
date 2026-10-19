package vn.eduassistant.backend.core;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import javax.servlet.http.HttpServletRequest;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String,Object>> api(ApiException e) { return ApiResponse.fail(e.getStatus(), e.getMessage(), e.getErrorCode()); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String,Object>> validation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().isEmpty() ? "Dữ liệu yêu cầu không hợp lệ." : e.getBindingResult().getFieldErrors().get(0).getDefaultMessage();
        return ApiResponse.fail(HttpStatus.BAD_REQUEST, message, "VALIDATION_ERROR");
    }
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String,Object>> unknown(HttpServletRequest request, Exception e) {
        System.err.println("[Unhandled error] " + request.getMethod() + " " + request.getRequestURI() + ": " + e.getClass().getSimpleName() + ": " + e.getMessage());
        return ApiResponse.fail(HttpStatus.INTERNAL_SERVER_ERROR, "Máy chủ gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại.", "INTERNAL_SERVER_ERROR");
    }
}
