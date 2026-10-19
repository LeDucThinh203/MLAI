package vn.eduassistant.backend.service;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import vn.eduassistant.backend.core.Json;
import java.util.*;
import java.util.concurrent.CopyOnWriteArraySet;

@Component
public class RealtimeHub {
    private final Set<WebSocketSession> sessions=new CopyOnWriteArraySet<WebSocketSession>();
    public void register(WebSocketSession session){sessions.add(session);}
    public void unregister(WebSocketSession session){sessions.remove(session);}
    public void comment(String caseId,Object event){for(WebSocketSession s:sessions)if(s.isOpen()&&"comment".equals(s.getAttributes().get("roomType"))&&caseId.equals(s.getAttributes().get("caseId")))send(s,event);}
    public void caseEvent(Object event,Set<String>roles,Set<String>users){for(WebSocketSession s:sessions){if(!s.isOpen())continue;String role=String.valueOf(s.getAttributes().get("role")),id=String.valueOf(s.getAttributes().get("userId"));if(roles!=null&&!roles.contains(role)||users!=null&&!users.contains(id))continue;send(s,event);}}
    public void notification(String userId,Object event){caseEvent(event,null,Collections.singleton(userId));}
    private void send(WebSocketSession session,Object event){try{synchronized(session){session.sendMessage(new TextMessage(Json.stringify(event)));}}catch(Exception e){try{session.close(CloseStatus.SERVER_ERROR);}catch(Exception ignored){}}}
}
