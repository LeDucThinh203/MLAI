import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCaseById, analyzeCase, stopCaseWorkflow, resumeCaseWorkflow } from '../api/cases';
import { uploadEvidence, analyzeEvidence } from '../api/evidence';
import { Case } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  FileText,
  AlertTriangle,
  Play,
  Pause,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  UploadCloud,
  FileSearch,
} from 'lucide-react';

export const CaseDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchCase = async () => {
    if (!id) return;
    try {
      const data = await getCaseById(id);
      setCaseData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCase();
  }, [id]);

  const handleAnalyze = async () => {
    if (!id) return;
    setAnalyzing(true);
    try {
      await analyzeCase(id);
      await fetchCase();
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files?.[0]) return;
    setUploading(true);
    try {
      const ev = await uploadEvidence(id, e.target.files[0], 'RECEIPT');
      await analyzeEvidence(ev.id);
      await fetchCase();
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleStop = async () => {
    if (!id) return;
    await stopCaseWorkflow(id, 'Yêu cầu dừng can thiệp bởi giám sát viên');
    await fetchCase();
  };

  const handleResume = async () => {
    if (!id) return;
    await resumeCaseWorkflow(id, 'Tiếp tục phân tích luồng hồ sơ');
    await fetchCase();
  };

  if (loading) return <LoadingSpinner message="Đang tải chi tiết hồ sơ..." />;
  if (!caseData) return <div className="p-8 text-center text-slate-500">Không tìm thấy hồ sơ.</div>;

  const anyCase = caseData as any;
  const escalations = anyCase.escalations || [];
  const activeEscalation = escalations.find((e: any) => e.status === 'PENDING') || escalations[0];
  const comparisons = anyCase.comparisons || [];
  const decisions = anyCase.decisions || [];
  const latestDecision = decisions[decisions.length - 1];
  const auditLogs = anyCase.audit_logs || [];

  return (
    <div className="space-y-8">
      {/* CASE HEADER & ACTIONS */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{caseData.title}</h1>
            <StatusBadge status={caseData.status} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Mã: <span className="font-mono font-semibold">{caseData.case_code}</span> | MSSV: <span className="font-semibold text-slate-700">{caseData.student_identifier}</span> | Ngày nộp: {new Date(caseData.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {caseData.status === 'STOPPED' ? (
            <button
              onClick={handleResume}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
            >
              <Play className="w-4 h-4" /> Tiếp tục luồng
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 border border-slate-300 hover:bg-slate-200"
            >
              <Pause className="w-4 h-4" /> Dừng khẩn cấp
            </button>
          )}

          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-brand-600 hover:bg-brand-700 text-white shadow disabled:opacity-50"
          >
            <FileSearch className="w-4 h-4" />
            {analyzing ? 'Đang thẩm định...' : 'Chạy phân tích AI / Rule'}
          </button>
        </div>
      </div>

      {/* 1. CASE INFORMATION */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-2">1. CASE INFORMATION (Thông tin hồ sơ)</h2>
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
          {caseData.description}
        </p>
      </div>

      {/* 2. UPLOADED EVIDENCE & VLM EXTRACTION */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase text-slate-500 tracking-wider">
            2. UPLOADED EVIDENCE & VLM EXTRACTED FACTS (Minh chứng & Dữ kiện trích xuất)
          </h2>
          <label className="cursor-pointer text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1">
            <UploadCloud className="w-4 h-4" /> {uploading ? 'Đang tải...' : '+ Tải thêm minh chứng'}
            <input type="file" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>

        {anyCase.evidence_items && anyCase.evidence_items.length > 0 ? (
          <div className="space-y-4">
            {anyCase.evidence_items.map((ev: any) => (
              <div key={ev.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-600" />
                    <span className="text-sm font-semibold text-slate-800">{ev.original_file_name}</span>
                    <span className="text-xs text-slate-400">({(ev.file_size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 mt-1">SHA-256: {ev.sha256_hash}</p>
                </div>

                {ev.extractions && ev.extractions.length > 0 && (
                  <div className="md:w-1/2 p-3 bg-white rounded border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700">VLM Extracted JSON:</span>
                    <pre className="mt-1 text-[11px] text-slate-600 overflow-x-auto max-h-32">
                      {ev.extractions[0].structured_data_json}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có minh chứng đính kèm.</p>
        )}
      </div>

      {/* 3. EVIDENCE COMPARISON */}
      {comparisons.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-4">
            3. EVIDENCE COMPARISON (Đối soát minh chứng vs Hệ thống SIS)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-2.5 rounded-l">Trường đối soát</th>
                  <th className="p-2.5">Minh chứng tải lên</th>
                  <th className="p-2.5">Hệ thống ghi nhận</th>
                  <th className="p-2.5">Trạng thái</th>
                  <th className="p-2.5 rounded-r">Lý do đối chiếu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisons.map((c: any) => (
                  <tr key={c.id}>
                    <td className="p-2.5 font-semibold text-slate-800">{c.field_name}</td>
                    <td className="p-2.5 font-mono">{c.left_value || 'null'}</td>
                    <td className="p-2.5 font-mono">{c.right_value || 'null'}</td>
                    <td className="p-2.5"><StatusBadge status={c.comparison_status} /></td>
                    <td className="p-2.5 text-slate-500">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. ESCALATION CARD (NẾU CÓ) - Đáp ứng Mục 36 */}
      {activeEscalation && (
        <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
              <h2 className="text-lg font-bold text-amber-950">ESCALATION REFEREE CARD (HỒ SƠ LEO THANG)</h2>
            </div>
            <StatusBadge status={activeEscalation.escalation_type} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-white p-3.5 rounded-lg border border-amber-200">
              <span className="font-bold text-slate-700 block mb-1">WHY AI STOPPED (Tại sao AI dừng):</span>
              <p className="text-slate-800">{activeEscalation.reason}</p>
            </div>
            <div className="bg-white p-3.5 rounded-lg border border-amber-200">
              <span className="font-bold text-slate-700 block mb-1">WHO NEEDS TO DECIDE (Cán bộ phụ trách):</span>
              <p className="text-slate-800 font-semibold">{activeEscalation.target_role} ({activeEscalation.target_department?.name || 'Phòng ban liên quan'})</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border-2 border-amber-400">
            <span className="text-xs font-bold uppercase text-amber-800 block mb-1">QUESTION FOR HUMAN (Câu hỏi chính xác cho cán bộ):</span>
            <p className="text-sm font-semibold text-slate-900 leading-relaxed">
              "{activeEscalation.question}"
            </p>
          </div>

          <div className="flex justify-end">
            <Link
              to="/human-review"
              className="inline-flex items-center gap-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg shadow"
            >
              Chuyển sang Cổng thẩm định của Cán bộ (Human Review) <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {/* 5. DECISION EXPLANATION */}
      {latestDecision && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-2">5. DECISION & EXPLANATION</h2>
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge status={latestDecision.decision_type} />
            <span className="text-xs text-slate-500">Căn cứ: {latestDecision.policy_reference || 'Quy chế học vụ'}</span>
          </div>
          <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
            {latestDecision.reason}
          </p>
        </div>
      )}

      {/* 6. IMMUTABLE AUDIT TIMELINE */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-bold uppercase text-slate-500 tracking-wider mb-4">6. AUDIT TRAIL TIMELINE</h2>
        {auditLogs.length > 0 ? (
          <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="relative pl-8 text-xs">
                <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-brand-500 ring-4 ring-white"></div>
                <div className="flex items-center gap-2 font-mono text-slate-400">
                  <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                  <span className="font-bold text-slate-700">[{log.actor_type}] {log.actor_name}</span>
                </div>
                <p className="text-slate-800 font-semibold mt-0.5">{log.action}</p>
                {log.reason && <p className="text-slate-500 text-[11px]">{log.reason}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có bản ghi kiểm toán.</p>
        )}
      </div>
    </div>
  );
};
