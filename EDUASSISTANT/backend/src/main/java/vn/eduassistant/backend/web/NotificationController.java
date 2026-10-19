package vn.eduassistant.backend.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.eduassistant.backend.core.ApiResponse;
import vn.eduassistant.backend.service.*;
import javax.servlet.http.HttpServletRequest;

@RestController
public class NotificationController {
    private final AuthService auth;private final CaseService cases;private final RedisSupport redis;
    public NotificationController(AuthService auth,CaseService cases,RedisSupport redis){this.auth=auth;this.cases=cases;this.redis=redis;}
    @GetMapping("/api/notifications") public ResponseEntity<?> list(HttpServletRequest req){java.util.Map<String,Object>u=auth.currentUser(req);String id=String.valueOf(u.get("id"));java.util.Map<String,Object>identity=UserService.map("userId",id);Object cached=redis.getJson("notifications:"+id,identity);if(cached!=null)return ApiResponse.success(200,"Cached notifications.",cached);java.util.List<java.util.Map<String,Object>> items=cases.notifications(id);redis.setJson("notifications:"+id,identity,items,15);return ApiResponse.success(200,"Lấy thông báo thành công.",items);}
    @RequestMapping(value="/api/notifications/{id}/read",method={RequestMethod.POST,RequestMethod.PUT}) public ResponseEntity<?> read(@PathVariable String id,HttpServletRequest req){java.util.Map<String,Object>u=auth.currentUser(req);cases.markNotification(id,String.valueOf(u.get("id")));return ApiResponse.success(200,"Đã đánh dấu thông báo là đã đọc.");}
    @RequestMapping(value="/api/notifications/read-all",method={RequestMethod.POST,RequestMethod.PUT}) public ResponseEntity<?> readAll(HttpServletRequest req){java.util.Map<String,Object>u=auth.currentUser(req);cases.markAllNotifications(String.valueOf(u.get("id")));return ApiResponse.success(200,"Đã đánh dấu tất cả thông báo là đã đọc.");}
}
