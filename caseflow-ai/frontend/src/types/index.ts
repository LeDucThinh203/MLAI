export type CaseStatus =
  | 'NEW'
  | 'EVIDENCE_UPLOADED'
  | 'ANALYZING'
  | 'WAITING_FOR_INFORMATION'
  | 'AUTO_RESOLVED'
  | 'ESCALATED'
  | 'WAITING_FOR_HUMAN'
  | 'APPROVED'
  | 'REJECTED'
  | 'STOPPED'
  | 'COMPLETED'
  | 'FAILED';

export type EscalationType =
  | 'FACT_UNKNOWN'
  | 'POLICY_OUT_OF_SCOPE'
  | 'AUTHORITY_REQUIRED'
  | 'DATA_CONFLICT'
  | 'OWNERSHIP_UNCLEAR';

export type DecisionType =
  | 'AUTO_RESOLVE'
  | 'REQUEST_INFORMATION'
  | 'ESCALATE'
  | 'REJECT'
  | 'NO_DECISION';

export interface Department {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

export interface Case {
  id: string;
  case_code: string;
  title: string;
  description: string;
  student_identifier: string;
  case_type: string;
  sis_amount?: number;
  sis_status?: string;
  status: CaseStatus;
  current_department_id?: string;
  current_department?: Department;
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface CaseDetail extends Case {
  evidence_items: Evidence[];
  comparisons: EvidenceComparison[];
  decisions: CaseDecision[];
  escalations: Escalation[];
  human_reviews: HumanReview[];
  audit_logs: AuditLog[];
}

export interface AnalysisResult {
  decision: DecisionType;
  reason: string;
  policy_reference?: string;
  escalation_type?: EscalationType;
  question?: string;
}

export interface WorkflowActionResult {
  status: CaseStatus;
  case_id: string;
}

export interface SeedCasesResult {
  status: 'SUCCESS';
  message: string;
  cases: Array<Pick<Case, 'id' | 'title'> & {
    case_id: string;
    decision?: DecisionType;
    escalation_type?: EscalationType;
    question?: string;
  }>;
}

export interface EvidenceExtraction {
  id: string;
  evidence_id: string;
  provider: string;
  model_name: string;
  document_type: string;
  structured_data_json: string;
  extraction_summary?: string;
  has_uncertain_fields: boolean;
  uncertain_fields_json?: string;
  created_at: string;
}

export interface Evidence {
  id: string;
  case_id: string;
  evidence_type: string;
  original_file_name: string;
  stored_file_name: string;
  mime_type: string;
  file_size: number;
  sha256_hash: string;
  storage_path: string;
  source_description?: string;
  uploaded_at: string;
  analysis_status: string;
  extractions?: EvidenceExtraction[];
}

export interface EvidenceComparison {
  id: string;
  case_id: string;
  field_name: string;
  left_value?: string;
  right_value?: string;
  comparison_status: 'MATCH' | 'MISMATCH' | 'UNKNOWN' | 'NOT_COMPARABLE';
  reason?: string;
  created_at: string;
}

export interface CaseDecision {
  id: string;
  case_id: string;
  decision_type: DecisionType;
  reason: string;
  policy_reference?: string;
  evidence_summary?: string;
  confidence?: number;
  created_at: string;
}

export interface Escalation {
  id: string;
  case_id: string;
  escalation_type: EscalationType;
  target_department_id?: string;
  target_department?: Department;
  target_role: string;
  question: string;
  reason: string;
  evidence_summary?: string;
  status: string;
  created_at: string;
  resolved_at?: string;
}

export interface HumanReview {
  id: string;
  case_id: string;
  reviewer_name: string;
  reviewer_role: string;
  decision: string;
  reason: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  case_id: string;
  actor_type: string;
  actor_name: string;
  action: string;
  input_snapshot?: string;
  evidence_ids?: string;
  reason?: string;
  policy_reference?: string;
  result_snapshot?: string;
  created_at: string;
}

export interface PolicyRule {
  id: string;
  policy_id: string;
  rule_code: string;
  name: string;
  description: string;
  condition_type: string;
  condition_value: string;
  action: string;
  priority: number;
  is_active: boolean;
  created_at: string;
}

export interface Policy {
  id: string;
  code: string;
  name: string;
  description: string;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  rules?: PolicyRule[];
}

export interface VerificationResult {
  id: string;
  run_id: string;
  case_identifier: string;
  case_title: string;
  expected_decision: string;
  actual_decision: string;
  expected_escalation?: string;
  actual_escalation?: string;
  is_passed: boolean;
  duration_ms: number;
  details_json?: string;
  created_at: string;
}

export interface VerificationRun {
  id: string;
  run_code: string;
  status: string;
  total_cases: number;
  passed_cases: number;
  failed_cases: number;
  duration_ms: number;
  created_at: string;
  completed_at?: string;
  results?: VerificationResult[];
}
