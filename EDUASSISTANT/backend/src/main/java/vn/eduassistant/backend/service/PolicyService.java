package vn.eduassistant.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.eduassistant.backend.db.JdbcSupport;
import java.time.Instant;
import java.util.*;

@Service
public class PolicyService {
    public static final double DEFAULT=.75,MIN=.65,MAX=.90,STEP=.02;
    private final JdbcSupport db;private volatile double fallback=DEFAULT;
    public PolicyService(JdbcSupport db){this.db=db;}
    public double threshold(){try{Map<String,Object> r=db.one("SELECT currentthreshold FROM escalation_policy_state WHERE id='GLOBAL_NVQS_POLICY'");if(r!=null&&r.get("currentThreshold") instanceof Number){fallback=((Number)r.get("currentThreshold")).doubleValue();return round(fallback);}}catch(Exception ignored){}return round(fallback);}
    public Map<String,Object> set(double value,String actor,String reason,String actorId){double old=threshold(),next=Math.max(MIN,Math.min(MAX,value));String now=Instant.now().toString();try{db.update("INSERT INTO escalation_policy_state(id,currentthreshold,minthreshold,maxthreshold,stepsize,updatedat,updatedby) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET currentthreshold=EXCLUDED.currentthreshold,updatedat=EXCLUDED.updatedat,updatedby=EXCLUDED.updatedby","GLOBAL_NVQS_POLICY",next,MIN,MAX,STEP,now,actor);db.update("INSERT INTO escalation_threshold_history(id,caseid,feedbacktype,oldthreshold,newthreshold,reviewerid,reviewername,note,createdat) VALUES(?,?,?,?,?,?,?,?,?)","HIST-"+UUID.randomUUID().toString().replace("-",""),"MANUAL_SET","MANUAL_OVERRIDE",old,next,actorId,actor,reason,now);}catch(Exception e){System.err.println("[Policy] Database update deferred: "+e.getClass().getSimpleName());}fallback=next;return UserService.map("currentThreshold",round(next),"oldThreshold",round(old),"newThreshold",round(next));}
    @Transactional
    public Map<String,Object> feedback(String caseId,String type,String reviewer,String note,String reviewerId){
        String ft=type.trim().toUpperCase();if(!Arrays.asList("CORRECT","MISSED_ESCALATION","UNNECESSARY_ESCALATION").contains(ft))throw new IllegalArgumentException("Loại feedback không hợp lệ.");
        Map<String,Object> state=db.one("SELECT currentthreshold FROM escalation_policy_state WHERE id='GLOBAL_NVQS_POLICY' FOR UPDATE");double old=state!=null&&state.get("currentThreshold") instanceof Number?((Number)state.get("currentThreshold")).doubleValue():fallback;double next=old;
        if("MISSED_ESCALATION".equals(ft))next=Math.min(MAX,round(old+STEP));else if("UNNECESSARY_ESCALATION".equals(ft))next=Math.max(MIN,round(old-STEP));
        String why=note==null?"":note;if(why.isEmpty())why="MISSED_ESCALATION".equals(ft)?"Phát hiện bỏ sót leo thang -> Nâng ngưỡng kiểm định an toàn +0.02":("UNNECESSARY_ESCALATION".equals(ft)?"Leo thang không cần thiết -> Hạ ngưỡng kiểm định -0.02":"Phán quyết hệ thống chính xác -> Giữ nguyên ngưỡng kiểm định");
        String now=Instant.now().toString(),id="HIST-"+UUID.randomUUID().toString().replace("-","");
        db.update("INSERT INTO escalation_policy_state(id,currentthreshold,minthreshold,maxthreshold,stepsize,updatedat,updatedby) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET currentthreshold=EXCLUDED.currentthreshold,updatedat=EXCLUDED.updatedat,updatedby=EXCLUDED.updatedby","GLOBAL_NVQS_POLICY",next,MIN,MAX,STEP,now,reviewer);
        db.update("INSERT INTO escalation_threshold_history(id,caseid,feedbacktype,oldthreshold,newthreshold,reviewerid,reviewername,note,createdat) VALUES(?,?,?,?,?,?,?,?,?)",id,caseId,ft,old,next,reviewerId,reviewer,why,now);fallback=next;
        return UserService.map("oldThreshold",round(old),"newThreshold",round(next),"feedback",ft,"caseId",caseId,"record",UserService.map("id",id,"createdAt",now,"oldThreshold",round(old),"newThreshold",round(next),"caseId",caseId,"feedbackType",ft,"reviewerId",reviewerId,"reviewerName",reviewer,"note",why));
    }
    public List<Map<String,Object>> history(int limit){try{return db.all("SELECT id,caseid AS \"caseId\",feedbacktype AS \"feedbackType\",oldthreshold AS \"oldThreshold\",newthreshold AS \"newThreshold\",reviewerid AS \"reviewerId\",reviewername AS \"reviewerName\",note,createdat AS \"createdAt\" FROM escalation_threshold_history ORDER BY createdat DESC LIMIT ?",Math.max(1,Math.min(200,limit)));}catch(Exception e){return Collections.emptyList();}}
    public Map<String,Object> summary(){Map<String,Object>s=db.one("SELECT currentthreshold AS \"currentThreshold\",minthreshold AS \"minThreshold\",maxthreshold AS \"maxThreshold\",stepsize AS step,updatedat AS \"updatedAt\" FROM escalation_policy_state WHERE id='GLOBAL_NVQS_POLICY'");if(s==null)s=UserService.map("currentThreshold",threshold(),"minThreshold",MIN,"maxThreshold",MAX,"step",STEP);long count=0;try{count=db.count("SELECT COUNT(*) FROM escalation_threshold_history WHERE feedbacktype IN ('CORRECT','MISSED_ESCALATION','UNNECESSARY_ESCALATION')");}catch(Exception ignored){}s.put("currentThreshold",s.get("currentThreshold")==null?threshold():s.get("currentThreshold"));s.put("feedbackEventCount",count);return s;}
    private static double round(double n){return Math.round(n*10000.0)/10000.0;}
}
