package vn.eduassistant.backend.service;

import java.util.*;

public final class WorkflowGuard {
    private static final Map<String,Set<String>> ALLOWED=new HashMap<String,Set<String>>();
    private static final Set<String> VALID=new HashSet<String>(Arrays.asList("SUBMITTED","UNDER_REVIEW","REQUIRES_SUPPLEMENT","APPROVED","REJECTED","STOPPED"));
    static {ALLOWED.put("SUBMITTED",new HashSet<String>(Arrays.asList("UNDER_REVIEW","REQUIRES_SUPPLEMENT","STOPPED")));ALLOWED.put("UNDER_REVIEW",new HashSet<String>(Arrays.asList("APPROVED","REJECTED","REQUIRES_SUPPLEMENT","STOPPED")));ALLOWED.put("REQUIRES_SUPPLEMENT",new HashSet<String>(Arrays.asList("UNDER_REVIEW","STOPPED")));ALLOWED.put("STOPPED",Collections.<String>emptySet());ALLOWED.put("APPROVED",Collections.<String>emptySet());ALLOWED.put("REJECTED",Collections.<String>emptySet());}
    private WorkflowGuard(){}
    public static String validate(String current,String next,String role,boolean adminOverride){if(!VALID.contains(next))return "Trạng thái đích '"+next+"' không tồn tại trong hệ thống.";if(current.equals(next))return null;if("ADMIN".equals(role)&&adminOverride)return null;if(ALLOWED.getOrDefault(current,Collections.<String>emptySet()).contains(next))return null;if(Arrays.asList("APPROVED","REJECTED","STOPPED").contains(current))return "Hồ sơ đã ở trạng thái kết thúc ("+current+"). Không được phép chuyển sang "+next+" trừ khi có quyền ADMIN Ghi đè (Explicit Override).";return "Chuyển trạng thái bất hợp lệ: từ '"+current+"' sang '"+next+"' không được quy định trong quy trình.";}
}
