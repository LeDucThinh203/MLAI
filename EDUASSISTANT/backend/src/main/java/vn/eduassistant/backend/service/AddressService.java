package vn.eduassistant.backend.service;

import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import vn.eduassistant.backend.config.AppConfig;
import vn.eduassistant.backend.core.Json;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AddressService {
    private final AppConfig config; private final RestTemplate http=new RestTemplate();
    public AddressService(AppConfig config){this.config=config;}
    public Map<String,Object> parse(String address) {
        String raw=address==null?"":address.trim();
        if(raw.isEmpty())return result(null,null,null,null,null,"",Arrays.asList("houseNumber","street","wardCommune","district","provinceCity"),Arrays.asList("rawAddress"),0.0);
        String normalized=preprocess(raw);String[] split=normalized.split(",");List<String> parts=new ArrayList<String>();for(String p:split)if(!p.trim().isEmpty())parts.add(p.trim());
        String house=null,street=null,ward=null,district=null,province=null;List<String> unmatched=new ArrayList<String>();
        for(String p:parts){String t=stripTones(p).toLowerCase(Locale.ROOT);
            if(containsAny(t,"ho chi minh","tphcm","ha noi","da nang","can tho","hai phong","dong nai","binh duong","long an","tinh","thanh pho")){
                if(province==null){if(t.contains("ho chi minh")||t.contains("tphcm"))province="TP. Hồ Chí Minh";else if(t.contains("ha noi"))province="Hà Nội";else if(t.contains("da nang"))province="TP. Đà Nẵng";else province=capitalize(p);}continue;
            }
            if(matches(t,"^(quận|q\\b|huyện|h\\b|thị xã|tx\\b|tp\\.\\s*[a-z]).*")){if(district==null)district=capitalize(p);continue;}
            if(matches(t,"^(phường|p\\b|xã|x\\b|thị trấn|tt\\b).*")){if(ward==null)ward=capitalize(p);continue;}
            unmatched.add(p);
        }
        if(!unmatched.isEmpty()){
            String first=unmatched.get(0);Matcher m=Pattern.compile("^([0-9]+[a-zA-Z0-9/\\-]*)\\s+(.+)$").matcher(first);
            if(m.find()){house=m.group(1).trim();street=capitalize(m.group(2).trim());}
            else if(matches(first,"^[0-9]+[a-zA-Z0-9/\\-]*$")){house=first;if(unmatched.size()>1)street=capitalize(unmatched.get(1));}
            else street=capitalize(first);
        }
        List<String> missing=new ArrayList<String>();if(house==null)missing.add("houseNumber");if(street==null)missing.add("street");if(ward==null)missing.add("wardCommune");if(province==null)missing.add("provinceCity");
        List<String> components=new ArrayList<String>();if(house!=null&&street!=null)components.add(house+" "+street);else if(street!=null)components.add(street);else if(house!=null)components.add(house);
        if(ward!=null)components.add(starts(ward,"Phường","Xã","Thị trấn")?ward:"Phường "+ward);
        if(district!=null)components.add(starts(district,"Quận","Huyện","Thị xã","TP.")?district:"Quận "+district);
        if(province!=null)components.add(province);
        double confidence=Math.max(.40,Math.min(.96,.95-.15*missing.size()));
        return result(house,street,ward,district,province,components.isEmpty()?capitalize(raw):String.join(", ",components),missing,Collections.emptyList(),Math.round(confidence*100.0)/100.0);
    }
    public Map<String,Object> normalize(String raw,String addressType) {
        long start=System.currentTimeMillis();String mode=config.aiMode;Map<String,Object> fallback=parse(raw);
        if(raw==null||raw.trim().isEmpty()){fallback.put("modeUsed",mode);fallback.put("isLive",false);fallback.put("isFallback",true);fallback.put("isSynthetic","mock".equals(mode));fallback.put("durationMs",System.currentTimeMillis()-start);return fallback;}
        if("live".equals(mode)){
            String prompt="Normalize the syntax of this Vietnamese address. Extract only stated information; do not fill in missing parts or make legal conclusions. Return JSON with houseNumber, street, wardCommune, district, provinceCity, normalizedAddress, missingFields, ambiguousFields, confidence. Address: "+raw;
            Map<String,Object> parsed=null;String provider=null,model=null;int calls=0;
            if(config.geminiApiKey.length()>10){Map<String,Object> response=callGemini(prompt,config.geminiApiKey);calls++;parsed=validAddress(response)?response:null;if(parsed!=null){provider="Google Gemini";model=AppConfig.value("GEMINI_TEXT_MODEL","gemini-2.0-flash");}}
            if(parsed==null){Map<String,Object> response=callOpenRouter(prompt);calls++;parsed=validAddress(response)?response:null;if(parsed!=null){provider="OpenRouter";model=AppConfig.value("OPENROUTER_MODEL","");}}
            if(parsed!=null){Map<String,Object> out=new LinkedHashMap<String,Object>(parsed);out.put("modeUsed","live");out.put("isLive",true);out.put("isFallback","OpenRouter".equals(provider));out.put("isSynthetic",false);out.put("provider",provider);out.put("model",model);out.put("modelUsed",model);out.put("apiCallPerformed",true);out.put("apiAttempts",calls);out.put("attemptedModels",model==null?Collections.emptyList():Collections.singletonList(model));out.put("durationMs",System.currentTimeMillis()-start);return out;}
        }
        fallback.put("modeUsed",mode);fallback.put("isLive",false);fallback.put("isFallback",true);fallback.put("isSynthetic","mock".equals(mode));fallback.put("provider","DETERMINISTIC_PARSER");fallback.put("model","deterministic-regex");fallback.put("modelUsed","deterministic-regex");fallback.put("apiCallPerformed",false);fallback.put("apiAttempts",0);fallback.put("attemptedModels",Collections.emptyList());fallback.put("durationMs",System.currentTimeMillis()-start);return fallback;
    }
    public boolean conflict(String left,String right) {
        if(left==null||left.trim().isEmpty()||right==null||right.trim().isEmpty())return true;
        if(clean(left).equals(clean(right)))return false;
        Map<String,Object>a=parse(left),b=parse(right);
        for(String key:Arrays.asList("provinceCity","district","wardCommune")){String x=clean(Json.str(a.get(key))),y=clean(Json.str(b.get(key)));if(!x.isEmpty()&&!y.isEmpty()&&!x.equals(y))return true;}
        String hn1=Json.str(a.get("houseNumber")).toLowerCase(),hn2=Json.str(b.get("houseNumber")).toLowerCase();if(!hn1.isEmpty()&&!hn2.isEmpty()&&!hn1.equals(hn2))return true;
        String st1=clean(Json.str(a.get("street"))),st2=clean(Json.str(b.get("street")));return !st1.isEmpty()&&!st2.isEmpty()&&!st1.contains(st2)&&!st2.contains(st1);
    }
    public String conflictExplanation(String left,String right){Map<String,Object>a=parse(left),b=parse(right);for(String key:Arrays.asList("provinceCity","district","wardCommune","houseNumber","street")){String x=clean(Json.str(a.get(key))),y=clean(Json.str(b.get(key)));if(!x.isEmpty()&&!y.isEmpty()&&!x.equals(y))return "Mâu thuẫn "+key+": '"+a.get(key)+"' khác với '"+b.get(key)+"'";}return "Địa chỉ tương thích, không phát hiện mâu thuẫn trọng yếu";}
    public static String clean(String s){String t=stripTones(s==null?"":s).toLowerCase(Locale.ROOT).replaceAll("\\b(phuong|xa|thi tran|quan|huyen|thi xa|thanh pho|tp|tphcm|tinh|p|q|x|h|t)\\b"," ").replaceAll("[^a-z0-9]"," ");return t.replaceAll("\\s+"," ").trim();}
    private Map<String,Object> callGemini(String prompt,String key){try{String model=AppConfig.value("GEMINI_TEXT_MODEL","gemini-2.0-flash");Map<String,Object> body=UserService.map("contents",Collections.singletonList(UserService.map("parts",Collections.singletonList(UserService.map("text",prompt)))),"generationConfig",UserService.map("responseMimeType","application/json","temperature",0,"maxOutputTokens",1000));HttpHeaders h=new HttpHeaders();h.set("x-goog-api-key",key);h.setContentType(MediaType.APPLICATION_JSON);ResponseEntity<Map>r=http.exchange("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",HttpMethod.POST,new HttpEntity<Object>(body,h),Map.class);List<?> cs=(List<?>)r.getBody().get("candidates");Map c=Json.object(cs.get(0));Map content=Json.object(c.get("content"));List<?> parts=(List<?>)content.get("parts");String text=Json.str(Json.object(parts.get(0)).get("text"));return Json.map(stripFences(text));}catch(Exception e){return null;}}
    private Map<String,Object> callOpenRouter(String prompt){String key=config.openRouterApiKey;if(key.isEmpty())return null;try{String model=AppConfig.value("OPENROUTER_MODEL","openai/gpt-4o-mini");if(model.trim().isEmpty())model="openai/gpt-4o-mini";HttpHeaders h=new HttpHeaders();h.setBearerAuth(key);h.setContentType(MediaType.APPLICATION_JSON);Map<String,Object> body=UserService.map("model",model,"temperature",0,"max_tokens",1000,"response_format",UserService.map("type","json_object"),"messages",Collections.singletonList(UserService.map("role","user","content",prompt)));ResponseEntity<Map>r=http.postForEntity("https://openrouter.ai/api/v1/chat/completions",new HttpEntity<Object>(body,h),Map.class);Map choice=Json.object(((List)r.getBody().get("choices")).get(0));String text=Json.str(Json.object(choice.get("message")).get("content"));return Json.map(stripFences(text));}catch(Exception e){return null;}}
    private boolean validAddress(Map<String,Object> m){if(m==null)return false;for(String k:Arrays.asList("houseNumber","street","wardCommune","district","provinceCity"))if(m.get(k)!=null&&!(m.get(k) instanceof String))return false;Object c=m.get("confidence");if(!(c instanceof Number)||((Number)c).doubleValue()<0||((Number)c).doubleValue()>1||!(m.get("normalizedAddress") instanceof String)||!(m.get("missingFields") instanceof List)||!(m.get("ambiguousFields") instanceof List))return false;return true;}
    private Map<String,Object> result(Object house,Object street,Object ward,Object district,Object province,String normalized,List<String> missing,List<String> ambiguous,double confidence){return UserService.map("houseNumber",house,"street",street,"wardCommune",ward,"district",district,"provinceCity",province,"normalizedAddress",normalized,"missingFields",missing,"ambiguousFields",ambiguous,"confidence",confidence);}
    private static String preprocess(String raw){String s=" "+raw.trim().replaceAll("\\s+"," ")+" ";String[][] patterns={{"(?i)\\b(tphcm|tp\\.hcm|tp\\s*hcm|hcmc|hcm)\\b",", TP. Hồ Chí Minh"},{"(?i)\\b(tp\\.?\\s*hồ\\s*chí\\s*minh)\\b",", TP. Hồ Chí Minh"},{"(?i)\\b(hà\\s*nội|ha\\s*noi|hn)\\b",", Hà Nội"},{"(?i)\\b(đà\\s*nẵng|da\\s*nang)\\b",", TP. Đà Nẵng"},{"(?i)\\b(cần\\s*thơ|can\\s*tho)\\b",", TP. Cần Thơ"},{"(?i)\\b(hải\\s*phòng|hai\\s*phong)\\b",", TP. Hải Phòng"},{"(?i)\\b(quận|q\\.)\\s*([0-9a-zA-ZÀ-ỹ\\s]+?)(?=,|$)",", Quận $2"},{"(?i)\\bq\\s*([0-9]+)\\b",", Quận $1"},{"(?i)\\b(huyện|h\\.)\\s*([0-9a-zA-ZÀ-ỹ\\s]+?)(?=,|$)",", Huyện $2"},{"(?i)\\b(thị\\s*xã|tx\\.)\\s*([0-9a-zA-ZÀ-ỹ\\s]+?)(?=,|$)",", Thị xã $2"},{"(?i)\\b(phường|p\\.)\\s*([0-9a-zA-ZÀ-ỹ\\s]+?)(?=,|$)",", Phường $2"},{"(?i)\\bp\\s+([0-9a-zA-ZÀ-ỹ\\s]+?)(?=,\\s*Quận|,\\s*Huyện|,\\s*TP|$)",", Phường $1"},{"(?i)\\b(xã|x\\.)\\s*([0-9a-zA-ZÀ-ỹ\\s]+?)(?=,|$)",", Xã $2"},{"(?i)\\b(thị\\s*trấn|tt\\.)\\s*([0-9a-zA-ZÀ-ỹ\\s]+?)(?=,|$)",", Thị trấn $2"}};for(String[] p:patterns)s=s.replaceAll(p[0],p[1]);return s.replaceAll(",\\s*,+",",").replaceAll("\\s+"," ").replaceAll("^[ ,]+|[ ,]+$","");}
    private static String capitalize(String s){if(s==null)return "";StringBuilder out=new StringBuilder();for(String w:s.trim().split("\\s+")){if(out.length()>0)out.append(' ');if(w.contains("/")||w.matches(".*\\d.*")&&!w.matches("(?i)^[a-zA-ZÀ-ỹ].*"))out.append(w.toUpperCase());else if(!w.isEmpty())out.append(w.substring(0,1).toUpperCase()).append(w.substring(1).toLowerCase());}return out.toString();}
    private static String stripTones(String s){String t=Normalizer.normalize(s,Normalizer.Form.NFD).replaceAll("\\p{M}+","");return t.replace('đ','d').replace('Đ','D');}
    private static String stripFences(String text){return text==null?"":text.trim().replaceFirst("^```(?:json)?\\s*","").replaceFirst("\\s*```$","").trim();}
    private static boolean containsAny(String s,String... parts){for(String p:parts)if(s.contains(p))return true;return false;}
    private static boolean matches(String s,String regex){return Pattern.compile(regex,Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE).matcher(s).find();}
    private static boolean starts(String s,String... values){for(String x:values)if(s.startsWith(x))return true;return false;}
}
