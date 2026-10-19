package vn.eduassistant.backend.service;

import org.springframework.stereotype.Service;
import vn.eduassistant.backend.config.AppConfig;
import vn.eduassistant.backend.core.Json;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.io.IOException;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Runs the checked-in, deterministic synthetic Track A fixture without calling AI or PostgreSQL. */
@Service
public class BenchmarkService {
    private final RuleEngineService rules;
    private final AddressService addresses;
    private final AppConfig config;
    private final AtomicBoolean running = new AtomicBoolean(false);
    public BenchmarkService(RuleEngineService rules, AddressService addresses, AppConfig config) { this.rules=rules;this.addresses=addresses;this.config=config; }
    public boolean isRunning() { return running.get(); }

    public Map<String,Object> run() throws Exception {
        if (!running.compareAndSet(false,true)) throw new BenchmarkRunningException();
        try { return execute(); } finally { running.set(false); }
    }
    private Map<String,Object> execute() throws Exception {
        Path root=Paths.get(config.projectRoot).toAbsolutePath().normalize();Path dataset=root.resolve("benchmark/fixed_synthetic_cases.json");
        if(!Files.isRegularFile(dataset))throw new IOException("Benchmark fixture dataset is unavailable.");
        byte[] raw=Files.readAllBytes(dataset);String digest=sha256(raw);Object decoded=Json.MAPPER.readValue(raw,Object.class);
        if(!(decoded instanceof List))throw new IOException("Benchmark fixture dataset has an invalid format.");
        List<?> cases=(List<?>)decoded;long started=System.nanoTime();int correct=0,approved=0,escalated=0,expectedEscalations=0,missed=0,expectedApprovals=0,unnecessary=0;
        List<Map<String,Object>> results=new ArrayList<Map<String,Object>>();
        for(Object value:cases){Map<String,Object> c=copy(value);long caseStart=System.nanoTime();Map<String,Object> student=copy(c.get("student"));Map<String,Object> facts=copy(c.get("institutionalFacts"));if(facts.isEmpty())facts.putAll(student);facts.put("sourceType","SYNTHETIC_TEST_SIS");facts.put("verificationStatus",Json.bool(c.get("benchmarkSISVerified"))||!c.containsKey("benchmarkSISVerified")?"TEST_VERIFIED":"UNVERIFIED");Map<String,Object> studentUser=new LinkedHashMap<String,Object>(facts);
            Map<String,Object> payload=UserService.map("id",c.get("id"),"title",c.get("title"),"description",c.get("description"),"category",c.get("category"),"priority",c.get("priority"),"evidenceFiles",c.getOrDefault("evidenceFiles",Collections.emptyList()),"aiMetadata",c.getOrDefault("aiMetadata",Collections.emptyMap()),"studentClaim",c.getOrDefault("studentClaim",Collections.emptyMap()),"institutionalFacts",facts,"authoritativeInstitutionalFacts",facts,"addressAnalysis",c.getOrDefault("addressAnalysis",Collections.emptyMap()));
            Object ocr=null;List<?> files=c.get("evidenceFiles") instanceof List?(List<?>)c.get("evidenceFiles"):Collections.emptyList();if(!files.isEmpty())ocr=Json.object(files.get(0)).get("ocrData");else ocr=c.get("ocr");
            Map<String,Object> ai=copy(c.get("aiMetadata"));Map<String,Object> aiContext=UserService.map("modeUsed",ai.getOrDefault("modeUsed","live"),"isLive",ai.getOrDefault("isLive",true),"isFallback",ai.getOrDefault("fallbackOccurred",false),"isSynthetic",ai.getOrDefault("isSynthetic",true),"provider",ai.getOrDefault("provider","FIXED_TEST_FIXTURE"),"apiCallPerformed",ai.getOrDefault("apiCallPerformed",false),"source","FIXED_TEST_FIXTURE");
            Map<String,Object> eval=UserService.map("evaluationMode","DETERMINISTIC_TEST","allowSyntheticVerifiedInstitutionalFacts",true,"allowSyntheticAIAnalysis",true);
            Map<String,Object> verdict=rules.evaluate(payload,ocr instanceof Map?Json.object(ocr):null,studentUser,aiContext,eval);
            String actual=Json.str(verdict.get("decision")),actualReason=Json.str(verdict.get("escalationReason")),expected=Json.str(c.get("expectedDecision")),expectedReason=Json.str(c.get("expectedEscalationReason"));boolean match=actual.equals(expected)&&Objects.equals(emptyNull(actualReason),emptyNull(expectedReason));if(match)correct++;
            if("AUTO_APPROVE".equals(actual))approved++;else if("ESCALATE_TO_HUMAN".equals(actual))escalated++;
            if("ESCALATE_TO_HUMAN".equals(expected)){expectedEscalations++;if("AUTO_APPROVE".equals(actual))missed++;}if("AUTO_APPROVE".equals(expected)){expectedApprovals++;if("ESCALATE_TO_HUMAN".equals(actual))unnecessary++;}
            double duration=Math.round((System.nanoTime()-caseStart)/10000d)/100d;
            results.add(UserService.map("id",c.get("id"),"name",c.get("name"),"category",c.get("category"),"priority",c.get("priority"),"expectedDecision",expected,"actualDecision",actual,"expectedReason",emptyNull(expectedReason),"actualReason",emptyNull(actualReason),"ruleMatched",verdict.get("ruleMatched"),"institutionalTrust",verdict.get("institutionalTrust"),"confidence",verdict.get("confidence"),"isCorrect",match,"durationMs",duration));
        }
        int total=cases.size();double seconds=Math.round((System.nanoTime()-started)/1000000d)/1000d;
        Map<String,Object> metrics=UserService.map("totalCases",total,"correctCases",correct,"decisionAccuracy",percent(correct,total),"automationRate",percent(approved,total),"escalationRate",percent(escalated,total),"missedEscalationRate",percent(missed,expectedEscalations),"unnecessaryEscalationRate",percent(unnecessary,expectedApprovals),"expectedEscalations",expectedEscalations,"missedEscalationCount",missed,"expectedAutoApprovals",expectedApprovals,"unnecessaryEscalationCount",unnecessary,"shouldEscalateCount",expectedEscalations,"missedEscalateCount",missed,"shouldAutoApproveCount",expectedApprovals,"unnecessaryEscalateCount",unnecessary);
        Map<String,Object> result=UserService.map("benchmarkType","DETERMINISTIC_TRACK_A_DECISION_BENCHMARK","aiCallsPerformed",false,"evaluationTarget","ESCALATION_DECISION_POLICY","scenarioCount",total,"datasetSha256",digest,"benchmarkRunId","BM-"+Instant.now().getEpochSecond(),"timestamp",Instant.now().toString(),"executionTimeSec",seconds,"metrics",metrics,"caseResults",results,"results",results);
        Path out=root.resolve("benchmark/results");Files.createDirectories(out);Files.write(out.resolve("latest.json"),Json.MAPPER.writerWithDefaultPrettyPrinter().writeValueAsBytes(result));writeCsv(out.resolve("latest.csv"),results);
        return result;
    }
    private static void writeCsv(Path path,List<Map<String,Object>> results)throws Exception{StringBuilder out=new StringBuilder("\uFEFFMã Ca,Tên Tình Huống,Danh Mục,Độ Ưu Tiên,Kỳ Vọng Quyết Định,Thực Tế Quyết Định,Kỳ Vọng Lý Do,Thực Tế Lý Do,Mã Quy Tắc,Độ Tin Cậy,Kết Quả Kiểm Thử,Thời Gian (ms)\r\n");for(Map<String,Object>r:results){Object[] cols={r.get("id"),r.get("name"),r.get("category"),r.get("priority"),r.get("expectedDecision"),r.get("actualDecision"),r.get("expectedReason"),r.get("actualReason"),r.get("ruleMatched"),r.get("confidence"),Boolean.TRUE.equals(r.get("isCorrect"))?"PASS":"FAIL",r.get("durationMs")};for(int i=0;i<cols.length;i++){if(i>0)out.append(',');out.append('"').append(String.valueOf(cols[i]==null?"—":cols[i]).replace("\"","\"\"")).append('"');}out.append("\r\n");}Files.write(path,out.toString().getBytes(StandardCharsets.UTF_8));}
    private static Map<String,Object> copy(Object value){if(value instanceof Map)return new LinkedHashMap<String,Object>(Json.object(value));return new LinkedHashMap<String,Object>();}
    private static String emptyNull(String value){return value==null||value.isEmpty()?null:value;}
    private static double percent(int a,int b){return b==0?0d:Math.round(((double)a*10000d/b))/100d;}
    private static String sha256(byte[] bytes)throws Exception{byte[] h=MessageDigest.getInstance("SHA-256").digest(bytes);StringBuilder s=new StringBuilder();for(byte b:h)s.append(String.format("%02x",b));return s.toString();}
    public static class BenchmarkRunningException extends RuntimeException { }
}
