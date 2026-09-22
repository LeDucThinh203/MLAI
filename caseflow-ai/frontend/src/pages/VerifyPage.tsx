import React, { useState } from 'react';
import { runVerificationSuite } from '../api/verify';
import { VerificationRun } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { StatusBadge } from '../components/common/StatusBadge';
import { getErrorMessage } from '../utils/errors';
import { PlayCircle, CheckCircle2, XCircle, Clock, ShieldCheck } from 'lucide-react';

export const VerifyPage: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<VerificationRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunTests = async () => {
    setRunning(true);
    setError(null);
    try {
      const result = await runVerificationSuite();
      setRunResult(result);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Lỗi khi chạy bộ kiểm thử.'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Single Big Run Button */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900">
          Hệ Thống Kiểm Thử Chuẩn Hóa (Verify Harness)
        </h1>
        <p className="text-sm text-slate-500 max-w-xl mx-auto">
          Chạy toàn bộ các test case độc lập qua đường ống logic thực tế của Deterministic Decision Engine để kiểm tra tính chính xác và an toàn.
        </p>

        {/* Big CTA Button */}
        <div className="pt-2">
          <button
            onClick={handleRunTests}
            disabled={running}
            className="inline-flex items-center gap-3 px-8 py-4 bg-brand-600 hover:bg-brand-700 text-white font-bold text-lg rounded-xl shadow-lg transition transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <PlayCircle className="w-6 h-6" />
            {running ? 'ĐANG CHẠY BỘ KIỂM THỬ...' : 'RUN ALL TESTS (CHẠY TOÀN BỘ KIỂM THỬ)'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200 mt-4">
            {error}
          </div>
        )}
      </div>

      {running && <LoadingSpinner message="Đang chạy kiểm thử qua Decision Engine thực tế..." />}

      {/* Results Section */}
      {runResult && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Mã lượt chạy</span>
              <p className="text-lg font-mono font-bold text-slate-800 mt-1">{runResult.run_code}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase">Tổng số Cases</span>
              <p className="text-2xl font-bold text-slate-900 mt-1">{runResult.total_cases}</p>
            </div>
            <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200 shadow-sm">
              <span className="text-xs font-bold text-emerald-600 uppercase">PASSED (Đạt)</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{runResult.passed_cases}</p>
            </div>
            <div className={`p-5 rounded-xl border shadow-sm ${runResult.failed_cases > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              <span className="text-xs font-bold uppercase">FAILED (Thất bại)</span>
              <p className="text-2xl font-bold mt-1">{runResult.failed_cases}</p>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Chi tiết kết quả từng Test Case
              </h2>
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Thời gian chạy: {runResult.duration_ms} ms
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold">
                  <tr>
                    <th className="p-3">Mã Test Case</th>
                    <th className="p-3">Tình huống kiểm thử</th>
                    <th className="p-3">Kỳ vọng</th>
                    <th className="p-3">Thực tế AI</th>
                    <th className="p-3">Leo thang kỳ vọng</th>
                    <th className="p-3">Leo thang thực tế</th>
                    <th className="p-3 text-center">Kết quả</th>
                    <th className="p-3 text-right">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {runResult.results?.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono text-slate-600 font-bold">{res.case_identifier}</td>
                      <td className="p-3 text-slate-900 max-w-xs font-semibold">{res.case_title}</td>
                      <td className="p-3 text-slate-600">{res.expected_decision}</td>
                      <td className="p-3">
                        <StatusBadge status={res.actual_decision} />
                      </td>
                      <td className="p-3 text-slate-500">{res.expected_escalation || '-'}</td>
                      <td className="p-3">
                        {res.actual_escalation ? <StatusBadge status={res.actual_escalation} /> : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="p-3 text-center">
                        {res.is_passed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-bold border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> ĐẠT (PASS)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full font-bold border border-rose-200">
                            <XCircle className="w-3.5 h-3.5" /> THẤT BẠI
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right text-slate-400 font-mono">{res.duration_ms} ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
