import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCase, seed5Escalations } from '../api/cases';
import { uploadEvidence } from '../api/evidence';
import type { LucideIcon } from 'lucide-react';
import { getErrorMessage } from '../utils/errors';
import {
  Upload,
  AlertCircle,
  Sparkles,
  CheckCircle,
  ShieldAlert,
  Scale,
  FileQuestion,
  Dices,
  RefreshCw,
  FileCheck2,
  FileText
} from 'lucide-react';

interface PresetCase {
  shortTitle: string;
  badge: string;
  badgeColor: string;
  studentId: string;
  caseType: string;
  title: string;
  description: string;
  suggestedFile: string;
  icon: LucideIcon;
}

const PRESETS: PresetCase[] = [
  {
    shortTitle: '1. Minh chứng mờ',
    badge: 'FACT_UNKNOWN',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    studentId: 'SV2026-001',
    caseType: 'TUITION_STATUS',
    title: 'Minh chứng biên lai thanh toán bị mờ thông tin (FACT_UNKNOWN)',
    description: 'Sinh viên nộp ảnh chụp biên lai qua ứng dụng mobile banking nhưng chất lượng ảnh mờ, không thể đọc rõ mã giao dịch và số tiền.',
    suggestedFile: 'receipt_blurry.png',
    icon: FileQuestion,
  },
  {
    shortTitle: '2. Mâu thuẫn dữ liệu',
    badge: 'DATA_CONFLICT',
    badgeColor: 'bg-orange-100 text-orange-800 border-orange-300',
    studentId: 'SV2026-001',
    caseType: 'TUITION_STATUS',
    title: 'Mâu thuẫn số tiền nộp 12.500.000 VNĐ vs Hệ thống SIS 10.500.000 VNĐ (DATA_CONFLICT)',
    description: 'Biên lai chuyển khoản thể hiện số tiền 12.500.000 VNĐ nhưng hệ thống SIS ghi nhận mức nợ học phí là 10.500.000 VNĐ (chênh lệch 2 triệu VNĐ).',
    suggestedFile: 'receipt_conflict.png',
    icon: ShieldAlert,
  },
  {
    shortTitle: '3. Ngoài quy chế',
    badge: 'POLICY_OUT_OF_SCOPE',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    studentId: 'SV2026-001',
    caseType: 'REGISTRATION_BLOCK',
    title: 'Đơn xin mở khóa đăng ký tín chỉ học vụ ngoài quy chế (POLICY_OUT_OF_SCOPE)',
    description: 'Tài khoản sinh viên bị khóa đăng ký tín chỉ do hoàn cảnh đặc thù chưa có trong quy định xử lý tự động, cần Trưởng phòng Đào tạo phê duyệt.',
    suggestedFile: 'sis_screenshot.png',
    icon: Sparkles,
  },
  {
    shortTitle: '4. Tranh chấp 2 phòng',
    badge: 'OWNERSHIP_UNCLEAR',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300',
    studentId: 'SV2026-001',
    caseType: 'CROSS_DEPARTMENT_DISPUTE',
    title: 'Hồ sơ mắc kẹt tranh chấp giữa Phòng Đào tạo và Phòng Kế toán (OWNERSHIP_UNCLEAR)',
    description: 'Sinh viên nộp đơn xin miễn giảm môn học kết hợp hoàn học phí. Phòng Đào tạo và Phòng Kế toán đùn đẩy trách nhiệm không bên nào tiếp nhận.',
    suggestedFile: 'dispute_letter.png',
    icon: Scale,
  },
  {
    shortTitle: '5. Vượt quyền AI (>50tr)',
    badge: 'AUTHORITY_REQUIRED',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    studentId: 'SV2026-001',
    caseType: 'TUITION_STATUS',
    title: 'Giao dịch đóng học phí 85.000.000 VNĐ vượt hạn mức AI 50 triệu (AUTHORITY_REQUIRED)',
    description: 'Sinh viên nộp học phí toàn khóa 85.000.000 VNĐ. Số tiền vượt quá hạn mức AI được phép tự động phê duyệt (tối đa 50 triệu) nên phải chuyển Kế toán trưởng.',
    suggestedFile: 'receipt_high_value.png',
    icon: AlertCircle,
  },
];

// Helper: Dynamically render an authentic bank receipt slip on an HTML5 canvas and convert to File
async function generateCanvasReceipt(
  studentName: string,
  studentId: string,
  amount: number,
  txId: string,
  bankName: string,
  isBlurry: boolean = false
): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 750;
    canvas.height = 950;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve(new File([''], 'receipt.png', { type: 'image/png' }));
      return;
    }

    // 1. Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Bank header
    const primaryColor = bankName.includes('Vietcombank')
      ? '#005a36'
      : bankName.includes('Techcombank')
      ? '#c5161d'
      : '#0a3871';

    ctx.fillStyle = primaryColor;
    ctx.fillRect(0, 0, canvas.width, 130);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(bankName.toUpperCase(), 40, 58);
    ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('HỆ THỐNG GIAO DỊCH NGÂN HÀNG ĐIỆN TỬ 24/7 (INTERNET BANKING)', 40, 92);

    // 3. Card Container
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.fillRect(40, 160, 670, 740);
    ctx.strokeRect(40, 160, 670, 740);

    // 4. Status Badge
    ctx.fillStyle = isBlurry ? '#fffbeb' : '#ecfdf5';
    ctx.fillRect(70, 190, 610, 75);
    ctx.fillStyle = isBlurry ? '#b45309' : '#047857';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(isBlurry ? '⚠ CHUYỂN KHOẢN ĐANG XỬ LÝ' : '✓ GIAO DỊCH CHUYỂN TIỀN THÀNH CÔNG', 170, 237);

    // 5. Amount
    const formattedAmt = amount.toLocaleString('vi-VN') + ' VNĐ';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isBlurry ? '***.***.*** VNĐ' : formattedAmt, canvas.width / 2, 320);
    ctx.textAlign = 'left';

    // 6. Timestamp
    const nowStr = new Date().toLocaleString('vi-VN');
    ctx.fillStyle = '#64748b';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Thời gian thực hiện: ${nowStr}`, canvas.width / 2, 355);
    ctx.textAlign = 'left';

    // Divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(70, 390);
    ctx.lineTo(680, 390);
    ctx.stroke();

    // Key-value rows
    const drawRow = (label: string, value: string, y: number) => {
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(label, 70, y);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.textAlign = 'right';
      ctx.fillText(value, 680, y);
      ctx.textAlign = 'left';
    };

    drawRow('Mã giao dịch (TxID)', isBlurry ? '***-******' : txId, 435);
    drawRow('Người chuyển tiền', studentName, 480);
    drawRow('Mã số sinh viên (MSSV)', studentId, 525);
    drawRow('Tài khoản thụ hưởng', 'ĐẠI HỌC QUỐC GIA - THU HỌC PHÍ', 570);
    drawRow('Số tài khoản nhận', '0011009832104', 615);
    drawRow('Nội dung chuyển khoản', `${studentId} ${studentName} NOP HOC PHI`, 660);
    drawRow('Kênh thực hiện', 'Mobile Banking Smart App', 705);
    drawRow('Trạng thái đối soát', isBlurry ? 'Không rõ mã tham chiếu' : 'Đã ghi có tài khoản đích', 750);

    // Watermark
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Biên lai điện tử có giá trị pháp lý đối soát theo Thông tư NHNN Việt Nam', canvas.width / 2, 855);

    // If isBlurry is true, apply noise and blur simulation
    if (isBlurry) {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 160;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
      ctx.putImageData(imgData, 0, 0);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const fileName = `bien_lai_${txId}_${studentId}.png`;
        const generatedFile = new File([blob], fileName, { type: 'image/png' });
        resolve(generatedFile);
      } else {
        resolve(new File([''], 'receipt.png', { type: 'image/png' }));
      }
    }, 'image/png');
  });
}

export const NewCasePage: React.FC = () => {
  const navigate = useNavigate();
  const [studentId, setStudentId] = useState('SV2026-001');
  const [caseType, setCaseType] = useState('TUITION_STATUS');
  const [title, setTitle] = useState('Sinh viên đã nộp tiền học phí nhưng hệ thống vẫn báo UNPAID');
  const [description, setDescription] = useState('Em đã chuyển khoản 10.500.000 VNĐ qua ngân hàng từ hôm qua nhưng tài khoản SIS vẫn báo trạng thái nợ học phí và chưa mở đăng ký môn.');
  const [file, setFile] = useState<File | null>(null);
  const [suggestedHint, setSuggestedHint] = useState<string | null>(null);
  const [randomBanner, setRandomBanner] = useState<{
    scenarioName: string;
    studentName: string;
    amountStr: string;
    expectedEscalation: string;
    reason: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [randomizing, setRandomizing] = useState(false);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (p: PresetCase) => {
    setStudentId(p.studentId);
    setCaseType(p.caseType);
    setTitle(p.title);
    setDescription(p.description);
    setSuggestedHint(`Minh chứng đề xuất: Chọn tệp '${p.suggestedFile}' trong thư mục storage/evidence/`);
    setRandomBanner(null);
  };

  // Generate completely random realistic dynamic test case
  const handleRandomize = async () => {
    setRandomizing(true);
    setError(null);

    try {
      const studentPool = [
        'Nguyễn Hoàng Long',
        'Trần Minh Quân',
        'Lê Thị Ánh Tuyết',
        'Phạm Quốc Đạt',
        'Vũ Hải Đăng',
        'Đỗ Mai Phương',
        'Hoàng Bảo Ngọc',
        'Bùi Đức Thắng',
        'Phan Gia Hưng',
        'Đặng Thùy Dung'
      ];
      const bankPool = ['Vietcombank', 'Techcombank', 'MB Bank', 'VietinBank', 'BIDV'];
      
      const randomStudent = studentPool[Math.floor(Math.random() * studentPool.length)];
      const randomIdNum = Math.floor(100 + Math.random() * 899);
      const generatedStudentId = `SV2026-${randomIdNum}`;
      const randomBank = bankPool[Math.floor(Math.random() * bankPool.length)];
      const randomTxId = `TXN-${Math.floor(100000 + Math.random() * 900000)}`;

      // Pick one of 6 test scenarios randomly
      const scenarioIndex = Math.floor(Math.random() * 6);

      let genCaseType = 'TUITION_STATUS';
      let genTitle = '';
      let genDesc = '';
      let genAmount = 10500000;
      let isBlurry = false;
      let expectedEsc = '';
      let scenarioLabel = '';
      let reasonText = '';

      if (scenarioIndex === 0) {
        // High value > 50M -> AUTHORITY_REQUIRED
        genAmount = 52000000 + Math.floor(Math.random() * 38) * 1000000; // 52M to 89M
        const amtFmt = genAmount.toLocaleString('vi-VN') + ' VNĐ';
        scenarioLabel = 'Vượt hạn mức AI (AUTHORITY_REQUIRED)';
        genTitle = `Nộp học phí đào tạo quốc tế ${amtFmt} của SV ${randomStudent} (${generatedStudentId})`;
        genDesc = `Sinh viên ${randomStudent} (${generatedStudentId}) đã nộp học phí toàn khóa số tiền ${amtFmt} qua ${randomBank} (Mã GD: ${randomTxId}). Số tiền này vượt ngưỡng phê duyệt tự động của AI (50 triệu VNĐ) nên hồ sơ cần trình Kế toán trưởng ký duyệt.`;
        expectedEsc = 'AUTHORITY_REQUIRED -> Kế toán trưởng (Chief Accountant)';
        reasonText = `Số tiền ${amtFmt} > 50.000.000 VNĐ vượt trần hạn mức an toàn của AI.`;
      } else if (scenarioIndex === 1) {
        // Data Conflict -> DATA_CONFLICT
        genAmount = 12000000 + Math.floor(Math.random() * 15) * 500000; // 12M to 19.5M (lệch SIS 10.5M)
        const amtFmt = genAmount.toLocaleString('vi-VN') + ' VNĐ';
        scenarioLabel = 'Mâu thuẫn dữ liệu (DATA_CONFLICT)';
        genTitle = `Khiếu nại số tiền biên lai ${amtFmt} lệch số nợ SIS 10.500.000 VNĐ (${randomStudent})`;
        genDesc = `Sinh viên ${randomStudent} (${generatedStudentId}) nộp biên lai ${randomBank} ghi nhận số tiền ${amtFmt} (Mã GD: ${randomTxId}). Tuy nhiên hệ thống SIS ghi nhận nợ là 10.500.000 VNĐ. Có sự sai lệch số tiền thanh toán giữa minh chứng và cổng SIS.`;
        expectedEsc = 'DATA_CONFLICT -> Chuyên viên Kế toán (Finance Officer)';
        reasonText = `Minh chứng thể hiện ${amtFmt} nhưng Hệ thống SIS ghi nhận 10.500.000 VNĐ.`;
      } else if (scenarioIndex === 2) {
        // Blurry receipt -> FACT_UNKNOWN
        isBlurry = true;
        genAmount = 10500000;
        scenarioLabel = 'Minh chứng mờ / thiếu dữ kiện (FACT_UNKNOWN)';
        genTitle = `Minh chứng biên lai thanh toán chụp bị nhòe và lóa của SV ${randomStudent}`;
        genDesc = `Sinh viên ${randomStudent} (${generatedStudentId}) chụp ảnh màn hình chuyển khoản qua app ngân hàng bị vỡ hạt, lóa đèn flash, không đọc được số tiền và mã giao dịch.`;
        expectedEsc = 'FACT_UNKNOWN -> Cán bộ Hỗ trợ Sinh viên (Student Support Officer)';
        reasonText = 'Ảnh minh chứng không đủ độ nét để trích xuất mã giao dịch và số tiền.';
      } else if (scenarioIndex === 3) {
        // Ownership dispute -> OWNERSHIP_UNCLEAR
        genCaseType = 'CROSS_DEPARTMENT_DISPUTE';
        scenarioLabel = 'Tranh chấp 2 phòng ban (OWNERSHIP_UNCLEAR)';
        genTitle = `Hồ sơ hoàn học phí môn miễn giảm tín chỉ của ${randomStudent} (${generatedStudentId})`;
        genDesc = `Sinh viên ${randomStudent} (${generatedStudentId}) nộp đơn xin hoàn trả học phí môn học được công nhận tương đương. Phòng Đào tạo chuyển sang Phòng Kế toán xử lý, nhưng Phòng Kế toán trả lại do chưa có quyết định phê duyệt bằng văn bản của Phòng Đào tạo.`;
        expectedEsc = 'OWNERSHIP_UNCLEAR -> Trọng tài học vụ / Trưởng phòng CTSV';
        reasonText = 'Tranh chấp phạm vi thụ lý giữa Phòng Đào tạo và Phòng Kế toán.';
      } else if (scenarioIndex === 4) {
        // Policy out of scope -> POLICY_OUT_OF_SCOPE
        genCaseType = 'REGISTRATION_BLOCK';
        scenarioLabel = 'Ngoài quy chế học vụ (POLICY_OUT_OF_SCOPE)';
        genTitle = `Đơn xin bảo lưu học phần muộn sau hạn chót của sinh viên ${randomStudent}`;
        genDesc = `Sinh viên ${randomStudent} (${generatedStudentId}) làm đơn xin rút bớt học phần và mở khóa đăng ký sau thời hạn quy chế 4 tuần với lý do hỗ trợ điều trị bệnh tại quê. Đây là tình huống ngoại lệ đặc biệt chưa có quy định tự động.`;
        expectedEsc = 'POLICY_OUT_OF_SCOPE -> Trưởng phòng Quản lý Đào tạo';
        reasonText = 'Tình huống đặc thù chưa có quy tắc xử lý tự động trong quy chế học vụ.';
      } else {
        // Valid matching -> AUTO_RESOLVE
        genAmount = 10500000;
        const amtFmt = genAmount.toLocaleString('vi-VN') + ' VNĐ';
        scenarioLabel = 'Khớp hoàn toàn 100% (AUTO_RESOLVE)';
        genTitle = `Xác nhận nộp học phí học kỳ chính ${amtFmt} của SV ${randomStudent}`;
        genDesc = `Sinh viên ${randomStudent} (${generatedStudentId}) đã nộp đúng ${amtFmt} qua ${randomBank} (Mã GD: ${randomTxId}). Biên lai rõ nét, số tiền khớp 100% với hệ thống SIS và dưới hạn mức 50 triệu.`;
        expectedEsc = 'AUTO_RESOLVE -> AI tự động phê duyệt';
        reasonText = 'Dữ liệu minh chứng hợp lệ, đầy đủ và khớp với hệ thống SIS.';
      }

      // Generate dynamic receipt file via canvas
      const generatedFile = await generateCanvasReceipt(
        randomStudent,
        generatedStudentId,
        genAmount,
        randomTxId,
        randomBank,
        isBlurry
      );

      // Update state
      setStudentId(generatedStudentId);
      setCaseType(genCaseType);
      setTitle(genTitle);
      setDescription(genDesc);
      setFile(generatedFile);
      setSuggestedHint(null);

      setRandomBanner({
        scenarioName: scenarioLabel,
        studentName: `${randomStudent} (${generatedStudentId})`,
        amountStr: genAmount.toLocaleString('vi-VN') + ' VNĐ',
        expectedEscalation: expectedEsc,
        reason: reasonText,
      });
    } catch (error: unknown) {
      setError(`Lỗi khi sinh dữ liệu ngẫu nhiên: ${getErrorMessage(error, 'Không thể tạo dữ liệu.')}`);
    } finally {
      setRandomizing(false);
    }
  };

  const handleSeedAll = async () => {
    setSeedingLoading(true);
    setError(null);
    try {
      await seed5Escalations();
      navigate('/human-review');
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Lỗi khi tạo tự động 5 ca.'));
    } finally {
      setSeedingLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Create case
      const created = await createCase({
        title,
        description,
        student_identifier: studentId,
        case_type: caseType,
      });

      // 2. If file attached, upload evidence
      if (file) {
        let evType = 'RECEIPT';
        if (caseType === 'CROSS_DEPARTMENT_DISPUTE' || caseType === 'SPECIAL_EXEMPTION') {
          evType = 'DOCUMENT';
        } else if (caseType === 'REGISTRATION_BLOCK') {
          evType = 'SCREENSHOT';
        }
        await uploadEvidence(created.id, file, evType, 'Minh chứng nộp kèm hồ sơ');
      }

      // Navigate to detail
      navigate(`/cases/${created.id}`);
    } catch (error: unknown) {
      setError(getErrorMessage(error, 'Lỗi khi tạo hồ sơ.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Dynamic Randomize & Fast Test Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400 text-slate-950">
                DYNAMIC TEST HARNESS
              </span>
              <span className="text-xs text-slate-300 font-medium">Hệ thống xử lý dữ liệu động</span>
            </div>
            <h2 className="text-xl font-extrabold mt-1.5 flex items-center gap-2 text-white">
              Tạo Hồ Sơ & Kiểm Thử Logic Thời Gian Thực
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Dữ liệu không hề bị gắn cứng (hardcoded)! Mỗi lần nhấn, hệ thống sẽ bốc ngẫu nhiên sinh viên, số tiền, ngân hàng và tự động vẽ biên lai điện tử thực tế bằng Canvas để AI phân tích.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 flex-shrink-0">
            {/* Randomizer Button */}
            <button
              type="button"
              disabled={randomizing}
              onClick={handleRandomize}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Dices className={`w-4 h-4 ${randomizing ? 'animate-spin' : ''}`} />
              {randomizing ? 'Đang sinh biên lai...' : '🎲 Sinh Dữ Liệu Ngẫu Nhiên & Biên Lai'}
            </button>

            {/* Fast Seed 5 Cases Button */}
            <button
              type="button"
              disabled={seedingLoading}
              onClick={handleSeedAll}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {seedingLoading ? 'Đang nạp 5 ca...' : '🚀 Nạp nhanh cả 5 ca'}
            </button>
          </div>
        </div>

        {/* 5 Presets Quick Selection */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            Hoặc chọn 5 tình huống Safeguard mẫu:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {PRESETS.map((p, idx) => {
              const Icon = p.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="p-2.5 bg-white/5 hover:bg-white/15 border border-white/10 hover:border-amber-400/50 rounded-xl text-left transition flex flex-col justify-between group cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{p.shortTitle}</span>
                  </div>
                  <div className="mt-1">
                    <span className={`inline-block text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Random Data Preview Banner */}
      {randomBanner && (
        <div className="bg-emerald-50 border-2 border-emerald-300 p-5 rounded-2xl shadow-sm text-emerald-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-300">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-600 text-white flex items-center gap-1">
                <FileCheck2 className="w-3.5 h-3.5" />
                DỮ LIỆU ĐÃ SINH NGẪU NHIÊN
              </span>
              <span className="text-xs font-bold text-emerald-800">{randomBanner.scenarioName}</span>
            </div>
            <div className="text-sm font-semibold text-emerald-900">
              Sinh viên: <span className="font-bold">{randomBanner.studentName}</span> | Số tiền: <span className="font-bold">{randomBanner.amountStr}</span>
            </div>
            <div className="text-xs text-emerald-700">
              <span className="font-bold">Dự đoán AI:</span> {randomBanner.expectedEscalation} — <em>{randomBanner.reason}</em>
            </div>
          </div>
          <div className="text-xs bg-white px-3 py-2 rounded-xl border border-emerald-200 text-emerald-800 font-medium flex items-center gap-1.5 flex-shrink-0">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Đã tự động vẽ biên lai PNG đính kèm!</span>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-slate-900">Tạo hồ sơ xử lý học vụ mới</h1>
          <button
            type="button"
            onClick={handleRandomize}
            className="text-xs text-brand-600 hover:text-brand-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Đổi dữ liệu ngẫu nhiên khác
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Bạn có thể sửa trực tiếp bất kỳ ô nào (MSSV, số tiền, mô tả) hoặc tải ảnh lên để kiểm tra xem Decision Engine phản ứng ra sao.
        </p>

        {suggestedHint && (
          <div className="mb-6 p-3 bg-brand-50 border border-brand-200 text-brand-800 text-xs rounded-lg flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600 flex-shrink-0" />
            <span>{suggestedHint}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Mã số sinh viên (MSSV)</label>
              <input
                type="text"
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                placeholder="VD: SV2026-001"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Loại hồ sơ / Vấn đề</label>
              <select
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="TUITION_STATUS">Học phí chưa cập nhật (Tuition Status)</option>
                <option value="CROSS_DEPARTMENT_DISPUTE">Hồ sơ mắc kẹt giữa nhiều phòng ban (Cross-Department Dispute)</option>
                <option value="REGISTRATION_BLOCK">Khóa đăng ký tín chỉ (Registration Block)</option>
                <option value="URGENT_SLA_LETTER">Giấy xác nhận khẩn trước hạn (Urgent Letter)</option>
                <option value="SPECIAL_EXEMPTION">Đơn đặc cách ngoại lệ (Special Exemption)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Tiêu đề hồ sơ</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Mô tả chi tiết tình huống (Chứa số tiền, mã GD, lý do)</label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Đính kèm minh chứng (Multimodal Evidence)
            </label>
            <div className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer relative ${
              file ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-300 hover:bg-slate-50'
            }`}>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex flex-col items-center">
                {file ? (
                  <CheckCircle className="w-8 h-8 text-emerald-600 mb-2" />
                ) : (
                  <Upload className="w-8 h-8 text-slate-400 mb-2" />
                )}
                <p className="text-sm font-semibold text-slate-800">
                  {file ? `Đã đính kèm: ${file.name} (${(file.size / 1024).toFixed(1)} KB)` : 'Kéo thả file ảnh biên lai, screenshot SIS hoặc PDF vào đây'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {file ? 'Click để thay đổi tệp khác' : 'Hỗ trợ JPG, PNG, WEBP, PDF (Tối đa 20MB)'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleRandomize}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
            >
              <Dices className="w-4 h-4 text-emerald-600" />
              Đổi ngẫu nhiên khác
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold shadow-md disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Đang gửi & phân tích...' : 'Gửi hồ sơ lên CaseFlow'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
