import React from 'react';
import { Link } from 'react-router-dom';
import { PlayCircle, PlusCircle, AlertOctagon, CheckCircle2, FileQuestion, UserCheck, Shuffle } from 'lucide-react';

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section - Understand in 10 seconds */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 text-white p-8 md:p-12 rounded-2xl shadow-xl border border-slate-700">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30 mb-4">
            MLAI Hackathon 2026 • Challenge A: The Escalation Referee
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
            CASEFLOW AI
          </h1>
          <p className="text-xl md:text-2xl text-slate-200 font-medium mb-3">
            "AI xử lý các trường hợp thường quy và dừng đúng lúc khi cần con người."
          </p>
          <p className="text-sm text-slate-400">
            Tagline: <span className="italic">Automate the routine. Escalate the uncertain. Keep humans accountable.</span>
          </p>
        </div>

        {/* Large CTA - TRY THIS FIRST */}
        <div className="mt-8 p-6 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
          <h2 className="text-xs uppercase tracking-wider font-bold text-brand-300 mb-3">
            ⚡ TRY THIS FIRST – KHỞI ĐẦU NHANH
          </h2>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/cases/new"
              className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-bold px-6 py-3.5 rounded-xl shadow-lg transition transform hover:-translate-y-0.5"
            >
              <PlusCircle className="w-5 h-5" />
              SUBMIT A CASE (NỘP HỒ SƠ)
            </Link>
            <Link
              to="/verify"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3.5 rounded-xl shadow-lg transition transform hover:-translate-y-0.5"
            >
              <PlayCircle className="w-5 h-5" />
              RUN VERIFY (CHẠY BỘ KIỂM THỬ)
            </Link>
          </div>
        </div>
      </div>

      {/* Safeguards Guarantee Section */}
      <div className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
          <AlertOctagon className="w-5 h-5 text-amber-500" />
          CaseFlow sẽ DỪNG TỰ ĐỘNG HÓA và LEO THANG nếu:
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Hệ thống không đoán mò và không hallucinate khi phát hiện các điều kiện rủi ro sau:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-200/60">
            <div className="w-8 h-8 rounded bg-amber-100 text-amber-700 flex items-center justify-center font-bold mb-2">1</div>
            <h3 className="font-semibold text-slate-800 text-sm">Thiếu dữ liệu (FACT_UNKNOWN)</h3>
            <p className="text-xs text-slate-500 mt-1">Ảnh biên lai quá mờ hoặc thiếu trường bắt buộc.</p>
          </div>

          <div className="p-4 rounded-lg bg-rose-50/50 border border-rose-200/60">
            <div className="w-8 h-8 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-bold mb-2">2</div>
            <h3 className="font-semibold text-slate-800 text-sm">Dữ liệu xung đột (DATA_CONFLICT)</h3>
            <p className="text-xs text-slate-500 mt-1">Biên lai và hệ thống SIS có số tiền khác nhau.</p>
          </div>

          <div className="p-4 rounded-lg bg-purple-50/50 border border-purple-200/60">
            <div className="w-8 h-8 rounded bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2">3</div>
            <h3 className="font-semibold text-slate-800 text-sm">Policy không bao phủ (OUT_OF_SCOPE)</h3>
            <p className="text-xs text-slate-500 mt-1">Tình huống ngoại lệ chưa có quy tắc chính sách.</p>
          </div>

          <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-200/60">
            <div className="w-8 h-8 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2">4</div>
            <h3 className="font-semibold text-slate-800 text-sm">Không rõ trách nhiệm (OWNERSHIP)</h3>
            <p className="text-xs text-slate-500 mt-1">Hồ sơ mắc kẹt giữa 2 phòng ban không bên nào nhận.</p>
          </div>

          <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-200/60">
            <div className="w-8 h-8 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">5</div>
            <h3 className="font-semibold text-slate-800 text-sm">Vượt thẩm quyền (AUTHORITY_REQUIRED)</h3>
            <p className="text-xs text-slate-500 mt-1">Số tiền &gt;50 triệu hoặc cần chữ ký cấp Trưởng phòng.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
