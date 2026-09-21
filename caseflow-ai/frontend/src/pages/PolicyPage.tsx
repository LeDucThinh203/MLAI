import React, { useEffect, useState } from 'react';
import { getPolicies } from '../api/policies';
import { Policy } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { BookOpen, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const PolicyPage: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        const data = await getPolicies();
        setPolicies(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPolicies();
  }, []);

  if (loading) return <LoadingSpinner message="Đang tải quy chế học vụ..." />;

  return (
    <div className="space-y-6">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <span>
          <strong>SYNTHETIC HACKATHON POLICY DATA:</strong> Toàn bộ quy tắc dưới đây là dữ liệu phục vụ huấn luyện và kiểm thử quy trình Deterministic Safeguard của CaseFlow AI tại MLAI Hackathon 2026.
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-brand-600" />
          Quy Chế & Ma Trận Quyết Định (Policy Matrix)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Các điều kiện xác định mà Policy Engine sử dụng để đưa ra quyết định hoặc dừng lại.
        </p>
      </div>

      <div className="space-y-6">
        {policies.map((p) => (
          <div key={p.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-brand-600 uppercase">{p.code} (v{p.version})</span>
                <h2 className="text-base font-bold text-slate-900">{p.name}</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Đang áp dụng
              </span>
            </div>
            <p className="text-xs text-slate-600">{p.description}</p>

            {p.rules && p.rules.length > 0 && (
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Các quy tắc con (Rules)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {p.rules.map((r) => (
                    <div key={r.id} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-slate-700">{r.rule_code}</span>
                        <span className="font-bold text-[11px] px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                          {r.action}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-800">{r.name}</p>
                      <p className="text-slate-500 text-[11px] mt-1">{r.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
