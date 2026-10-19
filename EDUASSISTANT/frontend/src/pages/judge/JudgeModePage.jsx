import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
  Shield, CheckCircle2, XCircle, Play, RefreshCw,
  Scale, FileText, Cpu, Activity, ExternalLink,
  Layers
} from 'lucide-react';
import { API_BASE } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import PageSkeleton from '../../components/common/PageSkeleton';
import { RULE_DECISION_LABELS, labelFor } from '../../utils/displayLabels';

const VERIFY_REASON_LABELS = {
  OWNERSHIP_UNCLEAR: 'Thông tin sinh viên chưa khớp',
  FACT_UNKNOWN: 'Thiếu thông tin xác nhận',
  DATA_CONFLICT: 'Thông tin kê khai chưa khớp',
  AUTHORITY_REQUIRED: 'Cần cán bộ có thẩm quyền kiểm tra',
  POLICY_OUT_OF_SCOPE: 'Yêu cầu cần xem xét riêng'
};

const connectivityLabel = (value) => ({
  CONNECTED: 'Đã kết nối', AVAILABLE: 'Đã kết nối',
  UNAVAILABLE: 'Chưa kết nối', UNKNOWN: 'Chưa kiểm tra'
}[value] || 'Chưa kiểm tra');
const serviceLabel = (value) => value === 'AVAILABLE' ? 'Sẵn sàng' : 'Không sẵn sàng';
const shortSha = (value) => typeof value === 'string' ? value.slice(0, 12) : '—';

export default function JudgeModePage({ onNavigateTab }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [verifyResults, setVerifyResults] = useState(null);
  const [runningVerify, setRunningVerify] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const configuredProviders = metrics?.ai?.providers;
  const providerNames = Array.isArray(configuredProviders)
    ? configuredProviders
    : configuredProviders && typeof configuredProviders === 'object'
      ? Object.entries(configuredProviders)
        .filter(([, isConfigured]) => isConfigured === true)
        .map(([provider]) => provider)
      : typeof configuredProviders === 'string'
        ? [configuredProviders]
        : [];
  const providerLabel = providerNames
    .map((provider) => {
      const normalized = String(provider).toLowerCase();
      if (normalized === 'gemini') return 'Google Gemini';
      if (normalized === 'openrouter') return 'OpenRouter';
      return String(provider);
    })
    .join(', ') || 'Bộ kiểm tra theo quy tắc';

  const fetchJudgeMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await axios.get(`${API_BASE}/judge/summary`, { withCredentials: true });
      if (res.data?.success) {
        setMetrics(res.data.data);
      } else {
        setErrorMsg('Không thể tải tình trạng hệ thống.');
      }
    } catch {
      setErrorMsg('Không thể tải tình trạng hệ thống.');
    } finally {
      setLoadingMetrics(false);
    }
  };

  const handleRunVerify = async () => {
    setRunningVerify(true);
    setErrorMsg(null);
    try {
      const res = await axios.post(`${API_BASE}/verify/run`);
      if (res.data?.success) {
        setVerifyResults(res.data.data);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Lỗi khi thực thi Verify Harness!');
    } finally {
      setRunningVerify(false);
    }
  };

  useEffect(() => {
    fetchJudgeMetrics();
  }, []);

  const openPortalTab = (tab) => {
    onNavigateTab?.(tab);
    navigate(token ? '/' : '/login');
  };

  if (loadingMetrics && !metrics) {
    return <PageSkeleton variant="dashboard" label="Đang tải chỉ số đánh giá" />;
  }

  return (
    <div className="judge-page" style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* HEADER BANNER */}
      <div className="judge-banner" style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
        border: '1px solid rgba(56, 189, 248, 0.3)',
        borderRadius: '16px',
        padding: '24px 28px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #38bdf8, #6366f1)',
                borderRadius: '10px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff'
              }}>
                <Scale size={24} />
              </div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0, color: '#f8fafc' }}>
                EDUASSISTANT
              </h1>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                CHẾ ĐỘ BAN GIÁM KHẢO
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              MLAI Hackathon 2026 · Giải pháp điều phối hồ sơ cần cán bộ xem xét
            </p>
            <p style={{ color: '#38bdf8', fontSize: '0.82rem', margin: '4px 0 0 0', fontWeight: 600 }}>
              Tình huống: Xác nhận tình trạng sinh viên để bổ sung hồ sơ nghĩa vụ quân sự
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleRunVerify}
              disabled={runningVerify}
              style={{
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 18px',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)'
              }}
            >
              {runningVerify ? <RefreshCw size={16} className="animate-spin" /> : <Play size={16} fill="white" />}
              Chạy kiểm tra 9 tình huống
            </button>
            <button
              onClick={fetchJudgeMetrics}
              disabled={loadingMetrics}
              className="btn-secondary"
              style={{ padding: '10px 14px', fontSize: '0.85rem' }}
              title="Cập nhật thông tin"
            >
              <RefreshCw size={15} className={loadingMetrics ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* STATUS CARDS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(148, 163, 184, 0.15)'
        }}>
          <div style={{ background: '#090d16', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Tình trạng hệ thống</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
              <strong style={{ fontSize: '1.05rem', color: metrics?.apiStatus === 'AVAILABLE' ? '#34d399' : '#ef4444' }}>Dịch vụ: {serviceLabel(metrics?.apiStatus)}</strong>
              <small style={{ color: '#94a3b8' }}>Kho dữ liệu: {serviceLabel(metrics?.databaseStatus)}</small>
            </div>
          </div>

          <div style={{ background: '#090d16', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Dịch vụ hỗ trợ phân tích</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Cpu size={16} color="#38bdf8" />
              <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
                {providerLabel}
              </strong>
            </div>
            <small style={{ color: '#94a3b8' }}>{metrics?.ai?.status === 'CONFIGURED' ? 'Đã cấu hình' : 'Đang dùng bộ kiểm tra theo quy tắc'} · Kết nối: {connectivityLabel(metrics?.ai?.connectivity)}</small>
          </div>

          <div style={{ background: '#090d16', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Ngưỡng thích ứng hiện tại</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Activity size={16} color="#f59e0b" />
              <strong style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {typeof metrics?.adaptivePolicy?.currentThreshold === 'number' ? `${Math.round(metrics.adaptivePolicy.currentThreshold * 100)}%` : 'Chưa có dữ liệu'}
              </strong>
            </div>
            <small style={{ color: '#94a3b8' }}>
              Phạm vi {Math.round((metrics?.adaptivePolicy?.minThreshold ?? 0.65) * 100)}–{Math.round((metrics?.adaptivePolicy?.maxThreshold ?? 0.9) * 100)}% · bước {Math.round((metrics?.adaptivePolicy?.step ?? 0.02) * 100)}% · {metrics?.adaptivePolicy?.feedbackEventCount ?? 0} phản hồi
            </small>
          </div>

          <div style={{ background: '#090d16', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Quyền điều chỉnh kết quả</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Shield size={16} color="#8b5cf6" />
              <strong style={{ fontSize: '1.05rem', color: '#8b5cf6' }}>
                {'Chỉ dành cho cán bộ được phân quyền'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <section className="card-panel" style={{ padding: '18px 22px', border: '1px solid #38bdf830' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Dành cho Ban Giám Khảo</h2>
        <ol style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '0.84rem', lineHeight: 1.7 }}>
          <li>Chọn <strong>Chạy kiểm tra 9 tình huống</strong>.</li>
          <li>Xem từng tình huống đạt hay chưa đạt.</li>
          <li>Tham khảo kết quả trên bộ tình huống cố định và mức tin cậy.</li>
        </ol>
        <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: '0.78rem' }}>
          Kiểm tra nhanh 9 tình huống, benchmark phát triển 18 tình huống tổng hợp và kết quả frozen holdout được hiển thị thành các mục riêng. User validation vẫn PENDING cho đến khi có phiên thử nghiệm với người dùng thật.
        </p>
      </section>

      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#ef4444', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem' }}>
          {errorMsg}
        </div>
      )}

      {/* QUICK ACTIONS ROW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <button
          onClick={handleRunVerify}
          className="card-panel"
          style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', border: '1px solid #38bdf830' }}
        >
          <div style={{ background: '#38bdf820', color: '#38bdf8', padding: '10px', borderRadius: '8px' }}>
            <Play size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Kiểm tra 9 tình huống</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Chạy nhanh các trường hợp nghiệp vụ mẫu</div>
          </div>
        </button>

        <button
          onClick={() => openPortalTab('reviewer_queue')}
          className="card-panel"
          style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', border: '1px solid #6366f130' }}
        >
          <div style={{ background: '#6366f120', color: '#6366f1', padding: '10px', borderRadius: '8px' }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Hàng đợi hồ sơ</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Xem xét và xử lý hồ sơ cần cán bộ</div>
          </div>
        </button>

        <button
          onClick={() => openPortalTab('admin_audit')}
          className="card-panel"
          style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left', border: '1px solid #34d39930' }}
        >
          <div style={{ background: '#34d39920', color: '#34d399', padding: '10px', borderRadius: '8px' }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Nhật ký hoạt động</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Theo dõi ai đã làm gì và vào thời điểm nào</div>
          </div>
        </button>

        <a
          href="/verify"
          target="_blank"
          rel="noreferrer"
          className="card-panel"
          style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', border: '1px solid #eab30830' }}
        >
          <div style={{ background: '#eab30820', color: '#eab308', padding: '10px', borderRadius: '8px' }}>
            <ExternalLink size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Tra cứu bằng mã QR</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Kiểm tra trạng thái hồ sơ đã lưu</div>
          </div>
        </a>
      </div>

      {/* VERIFY HARNESS RESULTS */}
      <div className="card-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={18} color="#38bdf8" /> Kiểm tra nhanh · 9 tình huống
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Dùng để kiểm tra nhanh cách hệ thống xử lý các tình huống cần cán bộ xem xét.
            </p>
            <div style={{
              marginTop: '8px',
              padding: '6px 10px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              borderRadius: '6px',
              fontSize: '0.74rem',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Shield size={13} />
              <span><strong>Bài kiểm tra cố định:</strong> 9 tình huống mẫu; không gọi dịch vụ bên ngoài, không ghi dữ liệu và không thay đổi cấu hình xử lý.</span>
            </div>
            {verifyResults?.durationMs != null && <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: '.76rem' }}>Mã lượt kiểm tra: {verifyResults.runId} · Thời gian: {verifyResults.durationMs} ms · {verifyResults.timestamp}</p>}
          </div>

          {verifyResults && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                background: verifyResults.status === 'ALL_PASSED' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: verifyResults.status === 'ALL_PASSED' ? '#34d399' : '#ef4444',
                border: `1px solid ${verifyResults.status === 'ALL_PASSED' ? '#34d399' : '#ef4444'}`,
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '0.8rem',
                fontWeight: 700
              }}>
                {verifyResults.passed} / {verifyResults.total} tình huống đạt
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Mã chạy: {verifyResults.runId}
              </span>
            </div>
          )}
        </div>

        {verifyResults ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#090d16', borderBottom: '1px solid #1e293b', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '10px 12px' }}>Trạng Thái</th>
                  <th style={{ padding: '10px 12px' }}>Tình Huống Kiểm Thử</th>
                  <th style={{ padding: '10px 12px' }}>Quyết Định Kỳ Vọng</th>
                  <th style={{ padding: '10px 12px' }}>Quyết Định Thực Tế</th>
                  <th style={{ padding: '10px 12px' }}>Lý Do Leo Thang</th>
                  <th style={{ padding: '10px 12px' }}>Quy Tắc Khớp</th>
                  <th style={{ padding: '10px 12px' }}>Thời Gian</th>
                </tr>
              </thead>
              <tbody>
                {verifyResults.results.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(15, 23, 42, 0.3)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      {r.pass ? (
                        <span style={{ color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={15} /> Đạt
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={15} /> Chưa đạt
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#f8fafc', fontWeight: 600 }}>
                      <div>{r.caseName}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{r.caseId}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: r.expectedDecision === 'AUTO_APPROVE' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                        color: r.expectedDecision === 'AUTO_APPROVE' ? '#34d399' : '#f97316'
                      }}>
                        {labelFor(r.expectedDecision, RULE_DECISION_LABELS, 'Cần kiểm tra thêm')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        background: r.actualDecision === 'AUTO_APPROVE' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                        color: r.actualDecision === 'AUTO_APPROVE' ? '#34d399' : '#f97316'
                      }}>
                        {labelFor(r.actualDecision, RULE_DECISION_LABELS, 'Chưa có kết quả')}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#f59e0b', fontWeight: 600 }}>
                      {labelFor(r.actualReason, VERIFY_REASON_LABELS, 'Không cần chuyển cán bộ')}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '0.74rem' }}>
                      {r.ruleMatched ? <details><summary>Quy tắc áp dụng</summary><code>{r.ruleMatched}</code></details> : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                      {r.durationMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: '#090d16', borderRadius: '8px', border: '1px dashed #334155' }}>
            <Scale size={32} style={{ opacity: 0.35, marginBottom: '8px', color: '#38bdf8' }} />
            <p style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600, margin: 0 }}>Chưa chạy kiểm tra</p>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 16px 0' }}>
              Bấm nút bên dưới để chạy 9 tình huống mẫu và xem hệ thống xử lý ra sao.
            </p>
            <button
              onClick={handleRunVerify}
              disabled={runningVerify}
              style={{
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              Chạy kiểm tra
            </button>
          </div>
        )}
      </div>

      {/* FIXED SYNTHETIC DEVELOPMENT BENCHMARK */}
      <div className="card-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#34d399" /> Benchmark phát triển · 18 tình huống
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
          Bộ tình huống tổng hợp cố định, có thể tái lập; không gọi AI và không đại diện cho dữ liệu độc lập hay độ chính xác trên production.
        </p>

        {metrics?.benchmark?.totalCases && <div style={{ margin: '0 0 16px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.20)', color: '#cbd5e1', fontSize: '0.78rem' }}>
          <strong style={{ color: '#38bdf8' }}>Fixed Synthetic Development Benchmark:</strong> {metrics.benchmark.scenarioCount || metrics.benchmark.totalCases} tình huống · Không độc lập/held-out · SHA {shortSha(metrics.benchmark.datasetSha256)} · Mã lượt chạy {metrics.benchmark.benchmarkRunId || '—'} · Cập nhật {metrics.benchmark.timestamp ? new Date(metrics.benchmark.timestamp).toLocaleString('vi-VN') : '—'}.
        </div>}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Decision Accuracy</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
              {typeof metrics?.benchmark?.decisionAccuracy === 'number' ? `${metrics.benchmark.decisionAccuracy}%` : 'Chưa có dữ liệu'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Tỷ lệ phán quyết chuẩn xác</div>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Automation Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
              {typeof metrics?.benchmark?.automationRate === 'number' ? `${metrics.benchmark.automationRate}%` : 'Chưa có dữ liệu'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Tỷ lệ hồ sơ được hệ thống xử lý mà không cần cán bộ can thiệp</div>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Escalation Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '6px' }}>
              {typeof metrics?.benchmark?.escalationRate === 'number' ? `${metrics.benchmark.escalationRate}%` : 'Chưa có dữ liệu'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Tỷ lệ tình huống được chuyển sang người thẩm định</div>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Missed Escalation Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: metrics?.benchmark?.missedEscalationRate === 0 ? '#34d399' : '#ef4444', marginTop: '6px' }}>
              {typeof metrics?.benchmark?.missedEscalationRate === 'number' ? `${metrics.benchmark.missedEscalationRate}%` : 'Chưa có dữ liệu'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
              {metrics?.benchmark?.missedEscalationCount ?? '—'} / {metrics?.benchmark?.expectedEscalations ?? '—'} ca kỳ vọng chuyển cán bộ
            </div>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Unnecessary Escalation Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '6px' }}>
              {typeof metrics?.benchmark?.unnecessaryEscalationRate === 'number' ? `${metrics.benchmark.unnecessaryEscalationRate}%` : 'Chưa có dữ liệu'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
              {metrics?.benchmark?.unnecessaryEscalationCount ?? '—'} / {metrics?.benchmark?.expectedAutoApprovals ?? '—'} ca kỳ vọng xử lý tự động
            </div>
          </div>
        </div>
      </div>

      <section className="card-panel" style={{ padding: '18px 22px', border: '1px solid rgba(129, 140, 248, .35)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Kết quả đánh giá cuối trên bộ frozen holdout</h3>
        {metrics?.frozenHoldout?.status === 'COMPLETED' ? (
          <>
            <p style={{ margin: '0 0 12px', color: '#cbd5e1', fontSize: '.82rem' }}>
              {metrics.frozenHoldout.scenarioCount} tình huống · Phiên bản {metrics.frozenHoldout.datasetVersion} · SHA {shortSha(metrics.frozenHoldout.datasetSha256)} · {metrics.frozenHoldout.timestamp ? new Date(metrics.frozenHoldout.timestamp).toLocaleString('vi-VN') : '—'}.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
              {Object.entries(metrics.frozenHoldout.metrics || {}).map(([key, value]) => (
                <div key={key} style={{ background: '#090d16', padding: '12px', borderRadius: '8px' }}>
                  <small style={{ color: '#94a3b8' }}>{key}</small>
                  <div style={{ color: '#f8fafc', fontWeight: 700 }}>{value}%</div>
                </div>
              ))}
            </div>
          </>
        ) : metrics?.frozenHoldout?.status === 'INVALID' ? (
          <p style={{ margin: 0, color: '#f87171', fontSize: '.86rem' }}>Kết quả frozen holdout không khớp manifest; chưa hiển thị metrics.</p>
        ) : (
          <p style={{ margin: 0, color: '#fbbf24', fontSize: '.86rem' }}>Chưa chạy đánh giá final holdout.</p>
        )}
      </section>

      <section className="card-panel" style={{ padding: '18px 22px' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Bằng chứng live và đánh giá tổng hợp</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '.82rem', lineHeight: 1.7 }}>
          <li>Live application: frontend/API đang triển khai, PostgreSQL và trạng thái cấu hình Gemini/OpenRouter được báo ở đầu trang; hoạt động AI phụ thuộc cấu hình máy chủ.</li>
          <li>Verify Harness (9) và Fixed Synthetic Development Benchmark (18) dùng tình huống tổng hợp, không gọi AI; Verify không ghi cơ sở dữ liệu.</li>
          <li>Registry SIS nội bộ là dữ liệu demo; chưa có kết nối SIS đại học bên ngoài.</li>
          <li>User Validation với người tham gia thật: <strong>PENDING</strong>.</li>
        </ul>
      </section>

      <section className="card-panel" style={{ padding: '18px 22px', border: '1px solid rgba(245, 158, 11, .28)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Giới hạn và rủi ro</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '.82rem', lineHeight: 1.7 }}>
          <li>AI có thể chuẩn hóa địa chỉ sai; điểm confidence chưa được hiệu chỉnh thống kê trên quần thể production. Lỗi xử lý được chuyển sang human review.</li>
          <li>Fixed synthetic benchmark là bộ phát triển, không phải frozen holdout hay độ chính xác production.</li>
          <li>AUTO_APPROVE chỉ là kết quả workflow nội bộ, không quyết định việc hoãn NVQS và không phải giấy xác nhận pháp lý chính thức.</li>
          <li>HMAC-SHA256 kiểm tra integrity/status trong EDUASSISTANT; không chứng nhận tính xác thực pháp lý bên ngoài hệ thống.</li>
        </ul>
      </section>

      <section className="card-panel" style={{ padding: '18px 22px', border: '1px solid rgba(129, 140, 248, .35)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: '1rem' }}>Kiểm tra AI trực tiếp (dành cho kỹ thuật viên)</h3>
        <p style={{ margin: 0, color: '#cbd5e1', fontSize: '.82rem', lineHeight: 1.6 }}>
          Lệnh kỹ thuật: <code>benchmark\\run_live_ai_eval.bat</code>. Bài kiểm tra gọi dịch vụ AI thật; nếu dịch vụ không trả kết quả dùng được, hệ thống sẽ báo rõ và dùng bộ xử lý theo quy tắc. Kết quả này không làm thay đổi các tình huống kiểm tra cố định.
        </p>
        <p style={{ margin: '8px 0 0', color: '#94a3b8', fontSize: '.76rem' }}>
          Mức tin cậy do AI đưa ra chỉ là gợi ý, chưa được hiệu chỉnh bằng dữ liệu vận hành thực tế.
        </p>
      </section>
    </div>
  );
}
