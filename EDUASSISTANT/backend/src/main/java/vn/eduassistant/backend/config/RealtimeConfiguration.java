package vn.eduassistant.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.*;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import vn.eduassistant.backend.core.Json;
import vn.eduassistant.backend.db.JdbcSupport;
import vn.eduassistant.backend.service.JwtService;
import vn.eduassistant.backend.service.RealtimeHub;
import java.util.*;

@Configuration
@EnableWebSocket
public class RealtimeConfiguration implements WebSocketConfigurer {
    private final RealtimeHub hub;private final JwtService jwt;private final JdbcSupport db;private final AppConfig config;
    public RealtimeConfiguration(RealtimeHub hub,JwtService jwt,JdbcSupport db,AppConfig config){this.hub=hub;this.jwt=jwt;this.db=db;this.config=config;}
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry registry){WebSocketHandler handler=new AbstractWebSocketHandler(){@Override public void afterConnectionEstablished(WebSocketSession session){hub.register(session);}@Override protected void handleTextMessage(WebSocketSession session,TextMessage message){}@Override public void afterConnectionClosed(WebSocketSession session,CloseStatus status){hub.unregister(session);}};registry.addHandler(handler,"/ws/comments/*","/ws/cases").addInterceptors(new HandshakeInterceptor(){@Override public boolean beforeHandshake(ServerHttpRequest req,ServerHttpResponse res,WebSocketHandler h,Map<String,Object>attrs)throws Exception{String cookie=req.getHeaders().getFirst("Cookie"),token=cookieValue(cookie,config.accessCookie);if(token==null){res.setStatusCode(HttpStatus.UNAUTHORIZED);return false;}try{com.auth0.jwt.interfaces.DecodedJWT decoded=jwt.verify(token);String id=decoded.getClaim("id").asString();Map<String,Object> user=db.one("SELECT u.*,EXISTS(SELECT 1 FROM revoked_access_tokens r WHERE r.jti=? AND r.expiresat>?) AS \"accessTokenRevoked\" FROM users u WHERE id=?",decoded.getId(),java.time.Instant.now().toString(),id);if(user==null||Json.bool(user.get("accessTokenRevoked"))){res.setStatusCode(HttpStatus.UNAUTHORIZED);return false;}String path=req.getURI().getPath();attrs.put("userId",id);attrs.put("role",user.get("role"));if(path.startsWith("/ws/comments/")){String caseId=path.substring("/ws/comments/".length());Map<String,Object>c=db.one("SELECT studentid AS \"studentId\" FROM cases WHERE id=?",caseId);if(c==null||("STUDENT".equals(user.get("role"))&&!id.equals(c.get("studentId")))){res.setStatusCode(HttpStatus.FORBIDDEN);return false;}attrs.put("roomType","comment");attrs.put("caseId",caseId);}else{attrs.put("roomType","cases");}return true;}catch(Exception e){res.setStatusCode(HttpStatus.UNAUTHORIZED);return false;}}@Override public void afterHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler handler,Exception exception){}}).setAllowedOriginPatterns("http://localhost:5173","http://127.0.0.1:5173","https://edu-sp.pages.dev","https://*.edu-sp.pages.dev");}
    private static String cookieValue(String cookie,String name){if(cookie==null)return null;for(String item:cookie.split(";")){String[]p=item.trim().split("=",2);if(p.length==2&&name.equals(p[0]))return p[1];}return null;}
}
