package vn.eduassistant.backend.service;

import org.springframework.stereotype.Service;
import vn.eduassistant.backend.config.AppConfig;
import vn.eduassistant.backend.core.Json;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Manual evaluator for the frozen dataset; ordinary runtime paths never call it. */
@Service
public class HoldoutService {
    private static final Set<String> DECISIONS = new HashSet<String>(Arrays.asList("AUTO_APPROVE", "ESCALATE_TO_HUMAN"));
    private static final Set<String> REASONS = new HashSet<String>(Arrays.asList("OWNERSHIP_UNCLEAR", "FACT_UNKNOWN", "DATA_CONFLICT", "AUTHORITY_REQUIRED", "POLICY_OUT_OF_SCOPE"));
    private final RuleEngineService rules;
    private final AppConfig config;

    public HoldoutService(RuleEngineService rules, AppConfig config) { this.rules = rules; this.config = config; }

    public Map<String,Object> run() throws Exception {
        Path root=Paths.get(config.projectRoot).toAbsolutePath().normalize();
        Path directory=root.resolve("benchmark/holdout");
        Path dataset=directory.resolve("track_a_holdout_v1.json"),manifestFile=directory.resolve("manifest.json");
        byte[] raw=Files.readAllBytes(dataset);String digest=sha256(raw);
        Map<String,Object> manifest=Json.object(Json.MAPPER.readValue(Files.readAllBytes(manifestFile),Object.class));
        if(!dataset.getFileName().toString().equals(manifest.get("dataset"))||!Boolean.TRUE.equals(manifest.get("frozen")))throw new IllegalStateException("Frozen holdout manifest metadata is invalid.");
        for(String field:Arrays.asList("usedByRuntime","usedByTraining","usedByUnitTests"))if(!Boolean.FALSE.equals(manifest.get(field)))throw new IllegalStateException("Frozen holdout manifest usage flags are invalid.");
        if(!digest.equalsIgnoreCase(Json.str(manifest.get("sha256"))))throw new IllegalStateException("Frozen holdout SHA-256 does not match the manifest; evaluation stopped.");
        Object decoded=Json.MAPPER.readValue(raw,Object.class);if(!(decoded instanceof List)||((List<?>)decoded).isEmpty())throw new IllegalStateException("Frozen holdout dataset is empty or invalid.");
        List<?> cases=(List<?>)decoded;if(number(manifest.get("scenarioCount"))!=cases.size())throw new IllegalStateException("Frozen holdout scenarioCount does not match the dataset.");
        Set<String> seen=new HashSet<String>();List<Map<String,Object>> results=new ArrayList<Map<String,Object>>();int correct=0,approved=0,escalated=0,expectedEscalations=0,missed=0,expectedApprovals=0,unnecessary=0;long started=System.nanoTime();
        for(Object item:cases){Map<String,Object> c=copy(item);String id=Json.str(c.get("id")),expected=Json.str(c.get("expectedDecision")),expectedReason=Json.str(c.get("expectedEscalationReason"));
            if(id.trim().isEmpty()||!seen.add(id)||!DECISIONS.contains(expected)||("AUTO_APPROVE".equals(expected)&&!expectedReason.isEmpty())||("ESCALATE_TO_HUMAN".equals(expected)&&!REASONS.contains(expectedReason)))throw new IllegalStateException("Frozen holdout contains an invalid or duplicate scenario.");
            Map<String,Object> facts=copy(c.get("institutionalFacts"));facts.put("sourceType","SYNTHETIC_TEST_SIS");facts.put("verificationStatus","TEST_VERIFIED");
            Map<String,Object> student=new LinkedHashMap<String,Object>(facts),ai=copy(c.get("aiMetadata"));
            Map<String,Object> payload=UserService.map("id",id,"title",c.get("name"),"description",c.getOrDefault("description",c.get("name")),"category","MILITARY_SERVICE_CONFIRMATION","priority","MEDIUM","evidenceFiles",Collections.emptyList(),"aiMetadata",ai,"studentClaim",copy(c.get("studentClaim")),"institutionalFacts",facts,"authoritativeInstitutionalFacts",facts,"addressAnalysis",copy(c.get("addressAnalysis")));
            Map<String,Object> aiContext=UserService.map("modeUsed",ai.getOrDefault("modeUsed","fixture"),"isLive",ai.getOrDefault("isLive",false),"isFallback",ai.getOrDefault("isFallback",ai.getOrDefault("fallbackOccurred",false)),"isSynthetic",ai.getOrDefault("isSynthetic",true),"provider",ai.getOrDefault("provider","FIXED_TEST_FIXTURE"),"apiCallPerformed",ai.getOrDefault("apiCallPerformed",false),"source","FROZEN_HOLDOUT_FIXTURE");
            Map<String,Object> evaluation=UserService.map("evaluationMode","DETERMINISTIC_TEST","allowSyntheticVerifiedInstitutionalFacts",true,"allowSyntheticAIAnalysis",true);
            long caseStarted=System.nanoTime();Map<String,Object> verdict=rules.evaluate(payload,null,student,aiContext,evaluation);String actual=Json.str(verdict.get("decision")),actualReason=Json.str(verdict.get("escalationReason"));boolean reasonMatches=expectedReason.isEmpty()||expectedReason.equals(actualReason);boolean pass=expected.equals(actual)&&reasonMatches;
            if(pass)correct++;if("AUTO_APPROVE".equals(actual))approved++;if("ESCALATE_TO_HUMAN".equals(actual))escalated++;if("ESCALATE_TO_HUMAN".equals(expected)){expectedEscalations++;if("AUTO_APPROVE".equals(actual))missed++;}else{expectedApprovals++;if("ESCALATE_TO_HUMAN".equals(actual))unnecessary++;}
            results.add(UserService.map("id",id,"scenarioGroup",c.get("scenarioGroup"),"expectedDecision",expected,"actualDecision",actual,"expectedReason",expectedReason.isEmpty()?null:expectedReason,"actualReason",actualReason.isEmpty()?null:actualReason,"isCorrect",pass,"ruleMatched",verdict.get("ruleMatched"),"durationMs",Math.round((System.nanoTime()-caseStarted)/10000d)/100d));
        }
        int total=cases.size();Map<String,Object> metrics=UserService.map("totalCases",total,"correctCases",correct,"decisionAccuracy",percent(correct,total),"automationRate",percent(approved,total),"escalationRate",percent(escalated,total),"missedEscalationRate",percent(missed,expectedEscalations),"unnecessaryEscalationRate",percent(unnecessary,expectedApprovals),"expectedEscalations",expectedEscalations,"missedEscalationCount",missed,"expectedAutoApprovals",expectedApprovals,"unnecessaryEscalationCount",unnecessary);
        Map<String,Object> result=UserService.map("status","COMPLETED","benchmarkType","FROZEN_TRACK_A_HOLDOUT_EVALUATION","dataset",manifest.get("dataset"),"datasetVersion",manifest.get("version"),"datasetSha256",digest,"scenarioCount",total,"decisionAccuracy",metrics.get("decisionAccuracy"),"automationRate",metrics.get("automationRate"),"escalationRate",metrics.get("escalationRate"),"missedEscalationRate",metrics.get("missedEscalationRate"),"unnecessaryEscalationRate",metrics.get("unnecessaryEscalationRate"),"expectedEscalations",expectedEscalations,"missedEscalationCount",missed,"expectedAutoApprovals",expectedApprovals,"unnecessaryEscalationCount",unnecessary,"executionTimeSec",Math.round((System.nanoTime()-started)/1000000d)/1000d,"timestamp",Instant.now().toString(),"aiCallsPerformed",false,"networkCallsPerformed",false,"databaseWritesPerformed",false,"thresholdMutationPerformed",false,"metrics",metrics,"caseResults",results);
        Path output=directory.resolve("results");Files.createDirectories(output);Files.write(output.resolve("latest.json"),Json.MAPPER.writerWithDefaultPrettyPrinter().writeValueAsBytes(result));writeCsv(output.resolve("latest.csv"),results);return result;
    }
    private static void writeCsv(Path path,List<Map<String,Object>> rows)throws Exception{StringBuilder s=new StringBuilder("\uFEFFid,scenarioGroup,expectedDecision,actualDecision,expectedReason,actualReason,isCorrect,ruleMatched,durationMs\r\n");for(Map<String,Object> row:rows){Object[] values={row.get("id"),row.get("scenarioGroup"),row.get("expectedDecision"),row.get("actualDecision"),row.get("expectedReason"),row.get("actualReason"),row.get("isCorrect"),row.get("ruleMatched"),row.get("durationMs")};for(int i=0;i<values.length;i++){if(i>0)s.append(',');s.append('"').append(String.valueOf(values[i]==null?"":values[i]).replace("\"","\"\"")).append('"');}s.append("\r\n");}Files.write(path,s.toString().getBytes(StandardCharsets.UTF_8));}
    private static Map<String,Object> copy(Object o){return o instanceof Map?new LinkedHashMap<String,Object>(Json.object(o)):new LinkedHashMap<String,Object>();}
    private static long number(Object o){return o instanceof Number?((Number)o).longValue():-1;}
    private static double percent(int n,int d){return d==0?0d:Math.round(n*10000d/d)/100d;}
    private static String sha256(byte[] b)throws Exception{byte[] hash=MessageDigest.getInstance("SHA-256").digest(b);StringBuilder s=new StringBuilder();for(byte x:hash)s.append(String.format("%02x",x));return s.toString();}
}
