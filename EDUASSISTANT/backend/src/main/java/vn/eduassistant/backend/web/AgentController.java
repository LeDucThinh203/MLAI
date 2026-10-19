package vn.eduassistant.backend.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vn.eduassistant.backend.core.ApiResponse;
import vn.eduassistant.backend.core.Json;
import vn.eduassistant.backend.service.AgentService;
import vn.eduassistant.backend.service.AuthService;
import vn.eduassistant.backend.service.UserService;
import javax.servlet.http.HttpServletRequest;
import java.util.Map;

@RestController
public class AgentController {
    private final AuthService auth;private final AgentService agent;
    public AgentController(AuthService auth,AgentService agent){this.auth=auth;this.agent=agent;}
    @PostMapping("/api/agent/chat") public ResponseEntity<?> chat(@RequestBody Map<String,Object>body,HttpServletRequest req){Map<String,Object>u=auth.require(req,"STUDENT");try{Map<String,Object>result=agent.chat(u,Json.str(body.get("message")),Json.str(body.get("conversationId")).isEmpty()?null:Json.str(body.get("conversationId")),Json.str(body.get("evidenceFileName")).isEmpty()?null:Json.str(body.get("evidenceFileName")));return ApiResponse.success(200,"Agent đã xử lý yêu cầu.",result);}catch(AgentService.AgentException e){return ApiResponse.failure(e.status,false,e.getMessage(),null,e.code);}}
    @GetMapping("/api/agent/conversations") public ResponseEntity<?> list(HttpServletRequest req){Map<String,Object>u=auth.require(req,"STUDENT");return ApiResponse.success(200,"Đã tải danh sách hội thoại.",UserService.map("conversations",agent.listConversations(u)));}
    @PostMapping("/api/agent/conversations") public ResponseEntity<?> create(@RequestBody(required=false)Map<String,Object>body,HttpServletRequest req){Map<String,Object>u=auth.require(req,"STUDENT");return ApiResponse.success(201,"Đã tạo hội thoại.",UserService.map("conversation",agent.createConversation(u,body==null?null:Json.str(body.get("title")))));}
    @GetMapping("/api/agent/conversations/{id}") public ResponseEntity<?> detail(@PathVariable String id,HttpServletRequest req){Map<String,Object>u=auth.require(req,"STUDENT");try{return ApiResponse.success(200,"Đã tải hội thoại.",UserService.map("conversation",agent.conversation(id,u)));}catch(AgentService.AgentException e){return ApiResponse.failure(e.status,false,e.getMessage(),null,e.code);}}
    @DeleteMapping("/api/agent/conversations/{id}") public ResponseEntity<?> delete(@PathVariable String id,HttpServletRequest req){Map<String,Object>u=auth.require(req,"STUDENT");try{return ApiResponse.success(200,"Đã xóa hội thoại.",agent.deleteConversation(id,u));}catch(AgentService.AgentException e){return ApiResponse.failure(e.status,false,e.getMessage(),null,e.code);}}
    @PostMapping("/api/agent/actions/{id}/confirm") public ResponseEntity<?> confirm(@PathVariable String id,HttpServletRequest req){Map<String,Object>u=auth.require(req,"STUDENT");try{return ApiResponse.success(200,"Thao tác đã được xác nhận.",agent.confirm(id,u));}catch(AgentService.AgentException e){return ApiResponse.failure(e.status,false,e.getMessage(),null,e.code);}}
    @PostMapping("/api/agent/actions/{id}/cancel") public ResponseEntity<?> cancel(@PathVariable String id,HttpServletRequest req){Map<String,Object>u=auth.require(req,"STUDENT");try{agent.cancel(id,u);return ApiResponse.success(200,"Đã hủy thao tác chờ xác nhận.",UserService.map("actionId",id,"status","CANCELLED"));}catch(AgentService.AgentException e){return ApiResponse.failure(e.status,false,e.getMessage(),null,e.code);}}
    @GetMapping("/api/admin/agent/rag/status") public ResponseEntity<?> ragStatus(HttpServletRequest req){auth.require(req,"ADMIN");return ApiResponse.success(200,"Đã tải trạng thái RAG.",UserService.map("rag",agent.ragStatus()));}
    @PostMapping("/api/admin/agent/rag/reindex") public ResponseEntity<?> reindex(HttpServletRequest req){auth.require(req,"ADMIN");try{Map<String,Object>result=agent.reindex(true);boolean failed=result.get("failedDocuments") instanceof java.util.List&&!((java.util.List<?>)result.get("failedDocuments")).isEmpty();return ApiResponse.build(failed?207:200,!failed,failed?"Lập chỉ mục RAG hoàn tất nhưng có nguồn thất bại.":"Đã lập chỉ mục RAG.",result,failed?"RAG_PARTIAL_FAILURE":null);}catch(Exception e){return ApiResponse.failure(503,false,"Không thể lập chỉ mục RAG.",UserService.map("reason",e.getClass().getSimpleName()),"RAG_REINDEX_FAILED");}}
}
