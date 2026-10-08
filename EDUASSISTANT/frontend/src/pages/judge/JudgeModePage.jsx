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

export default function JudgeModePage({ onNavigateTab }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [verifyResults, setVerifyResults] = useState(null);
  const [runningVerify, setRunningVerify] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchJudgeMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await axios.get(`${API_BASE}/admin/system/metrics`, { headers });
      if (res.data?.success) {
        setMetrics(res.data.data);
      }
    } catch (err) {
      // Nếu không có quyền admin, vẫn có thể đọc thông tin cơ bản
      console.warn('Không thể tải admin metrics (cần quyền admin):', err);
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
  }, [token]);

  const openPortalTab = (tab) => {
    onNavigateTab?.(tab);
    navigate(token ? '/' : '/login');
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>
      {/* HEADER BANNER */}
      <div style={{
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
                JUDGE MODE (GIÁM KHẢO)
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: 0 }}>
              Team 1 — MLAI Hackathon 2026 | Track VNG – Option A: <strong>Escalation Referee & Human-in-the-Loop</strong>
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
              RUN VERIFY (KIỂM CHUẨN)
            </button>
            <button
              onClick={fetchJudgeMetrics}
              disabled={loadingMetrics}
              className="btn-secondary"
              style={{ padding: '10px 14px', fontSize: '0.85rem' }}
              title="Làm mới chỉ số"
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
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Hệ Thống</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
              <strong style={{ fontSize: '1.05rem', color: '#34d399' }}>{metrics?.systemStatus || 'ONLINE'}</strong>
            </div>
          </div>

          <div style={{ background: '#090d16', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>AI Engine Mode</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Cpu size={16} color="#38bdf8" />
              <strong style={{ fontSize: '1.05rem', color: '#38bdf8' }}>
                {(metrics?.aiMode || 'mock').toUpperCase()}
              </strong>
            </div>
          </div>

          <div style={{ background: '#090d16', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Ngưỡng Tin Cậy (Threshold)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Activity size={16} color="#f59e0b" />
              <strong style={{ fontSize: '1.05rem', color: '#f59e0b' }}>
                {metrics?.currentEscalationThreshold || '0.75'} (75%)
              </strong>
            </div>
          </div>

          <div style={{ background: '#090d16', padding: '12px 16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Human Overrides (HITL)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <Shield size={16} color="#8b5cf6" />
              <strong style={{ fontSize: '1.05rem', color: '#8b5cf6' }}>
                {metrics?.totalHumanOverrides || 0} lần
              </strong>
            </div>
          </div>
        </div>
      </div>

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
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Run Verify Harness</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Chạy kiểm chuẩn 6 ca nghiệp vụ</div>
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
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Human Review Portal</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Hàng đợi thẩm định & Override</div>
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
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Audit Trail Toàn Trường</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Nhật ký Who/What/When/Input/Result</div>
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
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f8fafc' }}>Public QR Verify</div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Tra cứu chứng thực chữ ký số</div>
          </div>
        </a>
      </div>

      {/* VERIFY HARNESS RESULTS */}
      <div className="card-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Play size={18} color="#38bdf8" /> Kết Quả Verify Harness (Kiểm Chuẩn Một Chạm)
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Được thiết kế riêng cho Ban Giám Khảo để đánh giá tính chuẩn xác của 5 nguyên nhân leo thang trong vài giây.
            </p>
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
                {verifyResults.passed} / {verifyResults.total} PASSED
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
                          <CheckCircle2 size={15} /> PASS
                        </span>
                      ) : (
                        <span style={{ color: '#ef4444', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <XCircle size={15} /> FAIL
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
                        {r.expectedDecision}
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
                        {r.actualDecision}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#f59e0b', fontWeight: 600 }}>
                      {r.actualReason || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '0.74rem' }}>
                      <code>{r.ruleMatched}</code>
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
            <p style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600, margin: 0 }}>Chưa kích hoạt Verify Harness</p>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 16px 0' }}>
              Bấm nút bên dưới để thực thi toàn bộ 6 kịch bản kiểm thử quy tắc độc lập in-memory.
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
              Kích Hoạt Run Verify
            </button>
          </div>
        )}
      </div>

      {/* BENCHMARK ACCURACY & METRICS SECTION */}
      <div className="card-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={18} color="#34d399" /> Chỉ Số Đo Lường Benchmark Thật (Measurement Metrics)
        </h3>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 16px 0' }}>
          Được tính toán tự động qua runner <code>run_benchmark.py</code> trên tập dữ liệu kiểm chuẩn độc lập (Held-Out Cases), không sinh số giả.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Decision Accuracy</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#34d399', marginTop: '6px' }}>
              {metrics?.benchmarkMetrics?.decisionAccuracy || 'Not measured yet'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Tỷ lệ phán quyết chuẩn xác</div>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Automation Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
              {metrics?.benchmarkMetrics?.automationRate || 'Not measured yet'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Tỷ lệ hồ sơ tự động duyệt</div>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Missed Escalation Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: metrics?.benchmarkMetrics?.missedEscalationRate === '0.0%' ? '#34d399' : '#ef4444', marginTop: '6px' }}>
              {metrics?.benchmarkMetrics?.missedEscalationRate || 'Not measured yet'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Tỷ lệ bỏ sót ca cần leo thang (Mục tiêu 0%)</div>
          </div>

          <div style={{ background: '#090d16', padding: '16px', borderRadius: '10px', border: '1px solid #1e293b' }}>
            <span style={{ fontSize: '0.74rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Unnecessary Escalation Rate</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b', marginTop: '6px' }}>
              {metrics?.benchmarkMetrics?.unnecessaryEscalationRate || 'Not measured yet'}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>Tỷ lệ leo thang thừa không cần thiết</div>
          </div>
        </div>
      </div>
    </div>
  );
}
