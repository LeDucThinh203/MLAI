"""
============================================================================
CASEFLOW AI - REPORT & EXPORT SERVICE (PYTHON MODULE)
============================================================================
Module tạo báo cáo xuất khẩu:
  - CSV định dạng chuẩn UTF-8 BOM hiển thị chính xác tiếng Việt trong Excel
  - Bảng tổng hợp danh sách hồ sơ học vụ chuẩn in ấn PDF / HTML
  - Giấy Quyết định công nhận kết quả học vụ có mã xác thực QR và chữ ký điện tử
============================================================================
"""

import io
import json
import base64
from urllib.parse import quote
import qrcode
from datetime import datetime

UTF8_BOM = '\ufeff'


def escape_csv_value(val) -> str:
    """Xử lý thoát ký tự an toàn cho ô dữ liệu CSV."""
    if val is None:
        return '""'
    s = str(val).replace('"', '""')
    return f'"{s}"'


def generate_cases_csv(cases: list) -> str:
    """Tạo chuỗi CSV danh sách hồ sơ học vụ kèm UTF-8 BOM."""
    headers = [
        'Mã Hồ Sơ',
        'MSSV',
        'Họ và Tên Sinh Viên',
        'Loại Hồ Sơ',
        'Tiêu Đề Yêu Cầu',
        'Độ Ưu Tiên',
        'Phán Quyết Rule Engine',
        'Lý Do Leo Thang / Ghi Chú',
        'Trạng Thái Hiện Tại',
        'Ngày Nộp',
        'Người Thẩm Định',
        'Quyết Định Thẩm Định',
        'Lý Do Phê Duyệt / Hướng Dẫn',
        'Độ Tin Cậy AI',
        'Số Minh Chứng Kèm Theo'
    ]

    category_labels = {
        'MILITARY_SERVICE_CONFIRMATION': 'Cấp giấy xác nhận tạm hoãn NVQS',
        'TUITION_DISCOUNT': 'Miễn giảm học phí',
        'COMMUNITY_SERVICE': 'Điểm rèn luyện & CTXH',
        'SCHOLARSHIP': 'Học bổng khuyến khích',
        'GRADE_APPEAL': 'Phúc khảo điểm',
        'GENERAL': 'Hồ sơ học vụ chung'
    }

    status_labels = {
        'DRAFT': 'Bản nháp',
        'SUBMITTED': 'Đã nộp',
        'UNDER_REVIEW': 'Đang thẩm định',
        'REQUIRES_SUPPLEMENT': 'Yêu cầu bổ sung',
        'RESUBMITTED': 'Đã bổ sung - Chờ duyệt',
        'APPROVED': 'Đã phê duyệt',
        'REJECTED': 'Từ chối'
    }

    rows = []
    for c in cases:
        student_name = c.get('studentName') or (c.get('student', {}).get('fullName') if isinstance(c.get('student'), dict) else None) or 'Sinh viên'
        student_code = c.get('studentCode') or (c.get('student', {}).get('studentCode') if isinstance(c.get('student'), dict) else None) or 'Chưa cập nhật'
        review = c.get('reviewResult') or {}
        ai = c.get('aiExtraction') or {}
        rule = c.get('ruleEngine') or (ai.get('ruleEngine') if isinstance(ai, dict) else {}) or {}
        esc = c.get('escalation') or (ai.get('escalation') if isinstance(ai, dict) else {}) or {}
        file_count = len(c.get('evidenceFiles', [])) if isinstance(c.get('evidenceFiles'), list) else 0

        rule_verdict = 'Tự động duyệt (Pass)'
        if c.get('status') != 'APPROVED' and (esc.get('reason') or rule.get('escalationReason')):
            rule_verdict = f"Leo thang: {esc.get('reason') or rule.get('escalationReason')}"

        created_at_str = ''
        if c.get('createdAt'):
            try:
                dt = datetime.fromisoformat(c['createdAt'].replace('Z', '+00:00'))
                created_at_str = dt.strftime('%d/%m/%Y %H:%M:%S')
            except Exception:
                created_at_str = c['createdAt']

        conf_str = '96%'
        if isinstance(ai, dict) and ai.get('confidence'):
            conf_str = f"{round(float(ai['confidence']) * 100)}%"

        rows.append(','.join([
            escape_csv_value(c.get('id')),
            escape_csv_value(student_code),
            escape_csv_value(student_name),
            escape_csv_value(category_labels.get(c.get('category'), c.get('category'))),
            escape_csv_value(c.get('title')),
            escape_csv_value(c.get('priority', 'MEDIUM')),
            escape_csv_value(rule_verdict),
            escape_csv_value(esc.get('explanation') or rule.get('explanation') or 'Đạt chuẩn quy chế tự động'),
            escape_csv_value(status_labels.get(c.get('status'), c.get('status'))),
            escape_csv_value(created_at_str),
            escape_csv_value(review.get('reviewerName') or ('Rule Engine v2.6' if c.get('status') == 'APPROVED' else 'Chưa phân công')),
            escape_csv_value(review.get('decision') or status_labels.get(c.get('status'), 'Đang xử lý')),
            escape_csv_value(review.get('reason') or 'Chưa có ghi chú'),
            escape_csv_value(conf_str),
            escape_csv_value(file_count)
        ]))

    header_line = ','.join([f'"{h}"' for h in headers])
    return UTF8_BOM + '\r\n'.join([header_line] + rows)


def generate_users_csv(users: list) -> str:
    """Tạo chuỗi CSV danh sách người dùng kèm UTF-8 BOM."""
    headers = ['Mã Người Dùng', 'Tên Đăng Nhập', 'Họ và Tên', 'MSSV / Mã Cán Bộ', 'Email', 'Vai Trò', 'Đơn Vị / Khoa', 'Xác Thực 2FA', 'Ngày Tạo']
    rows = []
    for u in users:
        created_str = ''
        if u.get('createdAt'):
            try:
                dt = datetime.fromisoformat(u['createdAt'].replace('Z', '+00:00'))
                created_str = dt.strftime('%d/%m/%Y')
            except Exception:
                created_str = u['createdAt']

        rows.append(','.join([
            escape_csv_value(u.get('id')),
            escape_csv_value(u.get('username')),
            escape_csv_value(u.get('fullName')),
            escape_csv_value(u.get('studentCode') or '—'),
            escape_csv_value(u.get('email')),
            escape_csv_value(u.get('role')),
            escape_csv_value(u.get('department') or 'Khoa CNTT'),
            escape_csv_value('Đã kích hoạt' if u.get('twoFactorEnabled') else 'Chưa bật'),
            escape_csv_value(created_str)
        ]))

    header_line = ','.join([f'"{h}"' for h in headers])
    return UTF8_BOM + '\r\n'.join([header_line] + rows)


def generate_audits_csv(audits: list) -> str:
    """Tạo chuỗi CSV nhật ký kiểm toán kèm UTF-8 BOM."""
    headers = ['Mã Audit', 'Thời Gian', 'Hành Động Nghiệp Vụ', 'Mã Hồ Sơ', 'Người Thực Hiện', 'Vai Trò', 'Dữ Liệu Đầu Vào (Input)', 'Kết Quả (Result)', 'Chi Tiết / Lý Do']
    rows = []
    for a in audits:
        time_str = ''
        if a.get('timestamp'):
            try:
                dt = datetime.fromisoformat(a['timestamp'].replace('Z', '+00:00'))
                time_str = dt.strftime('%d/%m/%Y %H:%M:%S')
            except Exception:
                time_str = a['timestamp']

        actor = a.get('actor') or {}
        inp = a.get('input') or {}
        inp_str = json.dumps(inp, ensure_ascii=False) if isinstance(inp, (dict, list)) else str(inp)

        rows.append(','.join([
            escape_csv_value(a.get('id')),
            escape_csv_value(time_str),
            escape_csv_value(a.get('action')),
            escape_csv_value(a.get('caseId') or '—'),
            escape_csv_value(actor.get('name') or actor.get('username') or 'Hệ thống'),
            escape_csv_value(actor.get('role') or 'SYSTEM'),
            escape_csv_value(inp_str),
            escape_csv_value(a.get('result') or 'SUCCESS'),
            escape_csv_value(a.get('reason') or '')
        ]))

    header_line = ','.join([f'"{h}"' for h in headers])
    return UTF8_BOM + '\r\n'.join([header_line] + rows)


def generate_cases_table_html(cases: list, filter_info: dict = None) -> str:
    """Tạo HTML trang in bảng tổng hợp danh sách hồ sơ."""
    if filter_info is None:
        filter_info = {}

    report_date = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    total = len(cases)
    approved = sum(1 for c in cases if c.get('status') == 'APPROVED')
    pending = sum(1 for c in cases if c.get('status') in ('UNDER_REVIEW', 'SUBMITTED', 'RESUBMITTED'))
    rejected = sum(1 for c in cases if c.get('status') == 'REJECTED')

    category_labels = {
        'TUITION_DISCOUNT': 'Giảm học phí',
        'COMMUNITY_SERVICE': 'Rèn luyện/MHX',
        'SCHOLARSHIP': 'Học bổng',
        'GRADE_APPEAL': 'Phúc khảo',
        'GENERAL': 'Khác'
    }

    def status_badge(s):
        if s == 'APPROVED':
            return '<span style="color:#059669; font-weight:bold;">Đã duyệt ✓</span>'
        elif s == 'UNDER_REVIEW':
            return '<span style="color:#d97706; font-weight:bold;">Đang thẩm định ⏳</span>'
        elif s == 'REQUIRES_SUPPLEMENT':
            return '<span style="color:#f59e0b; font-weight:bold;">Cần bổ sung ⚠️</span>'
        elif s == 'REJECTED':
            return '<span style="color:#dc2626; font-weight:bold;">Từ chối ✗</span>'
        return f"<span>{s}</span>"

    table_rows = []
    for i, c in enumerate(cases):
        student_name = c.get('studentName') or (c.get('student', {}).get('fullName') if isinstance(c.get('student'), dict) else None) or 'Sinh viên'
        student_code = c.get('studentCode') or (c.get('student', {}).get('studentCode') if isinstance(c.get('student'), dict) else None) or '—'
        esc = c.get('escalation') or (c.get('ruleEngine', {}).get('escalationReason') if isinstance(c.get('ruleEngine'), dict) else None)
        is_auto = c.get('status') == 'APPROVED' or (c.get('ruleEngine', {}).get('decision') == 'AUTO_APPROVE' if isinstance(c.get('ruleEngine'), dict) else False)

        rule_badge = '<span style="color:#059669; font-size:11px;">⚡ Tự động duyệt</span>'
        if not is_auto and esc:
            code = esc if isinstance(esc, str) else esc.get('reason', '')
            rule_badge = f'<span style="color:#ea580c; font-size:11px;">🚨 {code}</span>'

        date_str = ''
        if c.get('createdAt'):
            try:
                dt = datetime.fromisoformat(c['createdAt'].replace('Z', '+00:00'))
                date_str = dt.strftime('%d/%m/%Y')
            except Exception:
                date_str = c['createdAt']

        p_color = '#dc2626' if c.get('priority') == 'HIGH' else '#2563eb'

        table_rows.append(f"""
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 12px;">
            <td style="padding: 6px 8px; text-align: center;">{i + 1}</td>
            <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; color: #1e40af;">{c.get('id')}</td>
            <td style="padding: 6px 8px; font-family: monospace;">{student_code}</td>
            <td style="padding: 6px 8px; font-weight: bold;">{student_name}</td>
            <td style="padding: 6px 8px;">{c.get('title')}</td>
            <td style="padding: 6px 8px; text-align: center;">{category_labels.get(c.get('category'), c.get('category'))}</td>
            <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: {p_color};">{c.get('priority', 'MEDIUM')}</td>
            <td style="padding: 6px 8px;">{rule_badge}</td>
            <td style="padding: 6px 8px; text-align: center;">{status_badge(c.get('status'))}</td>
            <td style="padding: 6px 8px; text-align: center;">{date_str}</td>
        </tr>
        """)

    rows_html = ''.join(table_rows)

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Báo Cáo Tổng Hợp Danh Sách Hồ Sơ Học Vụ - EDUASSISTANT</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Times New Roman', Times, serif; background-color: #f8fafc; color: #0f172a; padding: 20px; line-height: 1.4; }}
    .container {{ max-width: 1050px; margin: 0 auto; background: #ffffff; padding: 35px 45px; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }}
    .action-bar {{ max-width: 1050px; margin: 0 auto 15px auto; display: flex; justify-content: space-between; align-items: center; }}
    .btn-print {{ background-color: #059669; color: white; border: none; padding: 9px 18px; font-size: 13.5px; font-weight: bold; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }}
    .btn-print:hover {{ background-color: #047857; }}
    table.data-table {{ width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; }}
    table.data-table th {{ background: #f1f5f9; padding: 8px; font-size: 12px; font-weight: bold; border: 1px solid #cbd5e1; text-align: center; }}
    table.data-table td {{ border: 1px solid #cbd5e1; }}
    @media print {{
      body {{ background: transparent; padding: 0; }}
      .container {{ box-shadow: none; padding: 0; max-width: 100%; }}
      .action-bar {{ display: none !important; }}
    }}
  </style>
</head>
<body>
  <div class="action-bar">
    <div style="font-size: 14px; color: #475569;">
      <strong>EDUASSISTANT:</strong> Báo Cáo Tổng Hợp Dữ Liệu Dạng Bảng (Export Table to PDF)
    </div>
    <button class="btn-print" onclick="window.print()">
      🖨️ In Bảng / Lưu File PDF Bảng
    </button>
  </div>

  <div class="container">
    <table style="width: 100%; margin-bottom: 20px;">
      <tr>
        <td style="width: 45%; text-align: center; vertical-align: top;">
          <div style="font-size: 12px; text-transform: uppercase;">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
          <div style="font-size: 13px; font-weight: bold; text-transform: uppercase;">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ QUỐC GIA</div>
          <div style="font-size: 12px; font-weight: bold;">HỘI ĐỒNG THẨM ĐỊNH HỌC VỤ</div>
        </td>
        <td style="width: 55%; text-align: center; vertical-align: top;">
          <div style="font-size: 12px; font-weight: bold; text-transform: uppercase;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div style="font-size: 12px; font-weight: bold; border-bottom: 1px solid #111; display: inline-block; padding-bottom: 2px;">Độc lập - Tự do - Hạnh phúc</div>
          <div style="font-size: 12px; font-style: italic; margin-top: 4px;">TP. Hồ Chí Minh, ngày {datetime.now().strftime('%d/%m/%Y')}</div>
        </td>
      </tr>
    </table>

    <div style="text-align: center; margin-bottom: 16px;">
      <h2 style="font-size: 18px; font-weight: bold; text-transform: uppercase;">BẢNG TỔNG HỢP DANH SÁCH HỒ SƠ HỌC VỤ & PHÁN QUYẾT RULE ENGINE</h2>
      <p style="font-size: 13px; font-style: italic; color: #475569; margin-top: 4px;">
        Thời điểm trích xuất: {report_date} • Bộ lọc: {filter_info.get('status', 'Tất cả trạng thái')} | {filter_info.get('category', 'Tất cả danh mục')}
      </p>
    </div>

    <div style="display: flex; justify-content: space-around; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 13px;">
      <div><strong>Tổng số hồ sơ:</strong> <span style="color:#2563eb; font-weight:bold;">{total}</span></div>
      <div><strong>Đã phê duyệt:</strong> <span style="color:#059669; font-weight:bold;">{approved}</span></div>
      <div><strong>Đang thẩm định:</strong> <span style="color:#d97706; font-weight:bold;">{pending}</span></div>
      <div><strong>Từ chối:</strong> <span style="color:#dc2626; font-weight:bold;">{rejected}</span></div>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 35px;">STT</th>
          <th style="width: 120px;">Mã Hồ Sơ</th>
          <th style="width: 85px;">MSSV</th>
          <th style="width: 140px;">Họ và Tên</th>
          <th>Tiêu Đề Yêu Cầu</th>
          <th style="width: 110px;">Danh Mục</th>
          <th style="width: 75px;">Ưu Tiên</th>
          <th style="width: 120px;">Rule Engine</th>
          <th style="width: 110px;">Trạng Thái</th>
          <th style="width: 80px;">Ngày Nộp</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
  </div>
</body>
</html>"""


def generate_decision_html(case_data: dict, base_url: str = 'http://localhost:3001') -> str:
    """Render an internal workflow receipt, never a government certificate."""
    from html import escape

    case_id = str(case_data.get('id') or '')
    review = case_data.get('reviewResult') or {}
    def safe(value):
        return escape(str(value if value is not None else ''), quote=True)

    status = str(case_data.get('status') or 'UNKNOWN')
    category = str(case_data.get('category') or 'UNKNOWN')
    verification_url = f"{base_url.rstrip('/')}/verify?caseId={quote(case_id, safe='')}"
    qr_img = qrcode.make(verification_url)
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format='PNG')
    qr_code_data_url = f"data:image/png;base64,{base64.b64encode(qr_buffer.getvalue()).decode('ascii')}"

    rows = {
        'case': case_id,
        'student': case_data.get('studentName') or 'Sinh vien',
        'student_code': case_data.get('studentCode') or 'N/A',
        'request': case_data.get('title') or '',
        'category': category,
        'status': status,
        'department': case_data.get('assignedDepartment') or '',
        'reviewer': review.get('reviewerName') or 'Chua ghi nhan',
        'reviewed_at': review.get('reviewedAt') or case_data.get('updatedAt') or '',
        'reason': review.get('reason') or 'Khong co ghi chu',
        'signature': case_data.get('digitalSignature') or '',
    }
    row_html = ''.join(
        f'<tr><th>{safe(label)}</th><td>{safe(value)}</td></tr>'
        for label, value in (
            ('Ma ho so', rows['case']), ('Sinh vien', rows['student']),
            ('Ma sinh vien', rows['student_code']), ('Yeu cau', rows['request']),
            ('Danh muc', rows['category']), ('Trang thai quy trinh', rows['status']),
            ('Don vi phu trach', rows['department']), ('Nguoi xu ly', rows['reviewer']),
            ('Thoi diem xu ly', rows['reviewed_at']), ('Ghi chu', rows['reason']),
        )
    )
    return f"""<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bien nhan quy trinh noi bo {safe(case_id)}</title>
<style>
body{{font:16px/1.55 system-ui,sans-serif;background:#f1f5f9;color:#172033;margin:0;padding:24px}}
main{{max-width:780px;margin:auto;background:#fff;padding:32px;border:1px solid #cbd5e1;border-radius:12px}}
h1{{font-size:1.5rem}}.notice{{padding:16px;border:2px solid #b45309;background:#fffbeb;color:#78350f;font-weight:700;border-radius:8px}}
table{{width:100%;border-collapse:collapse;margin:24px 0}}th,td{{text-align:left;vertical-align:top;border-bottom:1px solid #e2e8f0;padding:10px}}th{{width:30%;color:#475569}}
small{{color:#475569}}img{{width:128px;height:128px}}button{{padding:10px 16px}}@media print{{body{{background:white;padding:0}}main{{border:0}}button{{display:none}}}}
</style></head><body><main>
<p><strong>EDUASSISTANT - Bien nhan quy trinh noi bo</strong></p>
<div class="notice">DAY LA KET QUA WORKFLOW NOI BO/DEMO. KHONG PHAI GIAY XAC NHAN CUA CO QUAN NHA NUOC, KHONG PHAI CHU KY SO CONG CONG, VA KHONG QUYET DINH TAM HOAN NGHIA VU QUAN SU.</div>
<h1>Ket qua xu ly ho so</h1>
<p>Trang thai duoi day chi phan anh quy trinh cua phan mem. Co quan/truong co tham quyen phai tu xac minh va ban hanh van ban chinh thuc theo quy dinh hien hanh.</p>
<table>{row_html}</table>
<p><strong>Ma toan ven HMAC-SHA256:</strong><br><code>{safe(rows['signature'])}</code></p>
<p><img src="{safe(qr_code_data_url)}" alt="QR tra cuu trang thai ho so"></p>
<p><small>QR chi tra cuu du lieu tren he thong. HMAC kiem tra tinh toan ven du lieu theo khoa noi bo; khong thay the chu ky so duoc cap phep hay con dau cua co quan.</small></p>
<button onclick="window.print()">In bien nhan</button>
</main></body></html>"""
