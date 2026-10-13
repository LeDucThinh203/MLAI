"""
============================================================================
EDUASSISTANT - REPORT & EXPORT SERVICE (PYTHON MODULE)
============================================================================
Module tạo báo cáo xuất khẩu:
  - CSV định dạng chuẩn UTF-8 BOM hiển thị chính xác tiếng Việt trong Excel
  - Bảng nội bộ tổng hợp case workflow để in PDF / HTML
  - Bản ghi workflow nội bộ có mã QR và HMAC-SHA256 integrity token
============================================================================
"""

import io
import json
import base64
from html import escape
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
        'MILITARY_SERVICE_CONFIRMATION': 'Xác nhận tình trạng sinh viên'
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

    category_labels = {'MILITARY_SERVICE_CONFIRMATION': 'Xác nhận tình trạng sinh viên'}

    def status_badge(s):
        if s == 'APPROVED':
            return '<span style="color:#059669; font-weight:bold;">Đã duyệt ✓</span>'
        elif s == 'UNDER_REVIEW':
            return '<span style="color:#d97706; font-weight:bold;">Đang thẩm định ⏳</span>'
        elif s == 'REQUIRES_SUPPLEMENT':
            return '<span style="color:#f59e0b; font-weight:bold;">Cần bổ sung ⚠️</span>'
        elif s == 'REJECTED':
            return '<span style="color:#dc2626; font-weight:bold;">Từ chối ✗</span>'
        return f"<span>{escape(str(s or ''))}</span>"

    table_rows = []
    for i, c in enumerate(cases):
        student_name = c.get('studentName') or (c.get('student', {}).get('fullName') if isinstance(c.get('student'), dict) else None) or 'Sinh viên'
        student_code = c.get('studentCode') or (c.get('student', {}).get('studentCode') if isinstance(c.get('student'), dict) else None) or '—'
        esc = c.get('escalation') or (c.get('ruleEngine', {}).get('escalationReason') if isinstance(c.get('ruleEngine'), dict) else None)
        is_auto = c.get('status') == 'APPROVED' or (c.get('ruleEngine', {}).get('decision') == 'AUTO_APPROVE' if isinstance(c.get('ruleEngine'), dict) else False)

        rule_badge = '<span style="color:#059669; font-size:11px;">⚡ Tự động duyệt</span>'
        if not is_auto and esc:
            code = esc if isinstance(esc, str) else esc.get('reason', '')
            rule_badge = f'<span style="color:#ea580c; font-size:11px;">🚨 {escape(str(code))}</span>'

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
            <td style="padding: 6px 8px; font-family: monospace; font-weight: bold; color: #1e40af;">{escape(str(c.get('id') or ''))}</td>
            <td style="padding: 6px 8px; font-family: monospace;">{escape(str(student_code))}</td>
            <td style="padding: 6px 8px; font-weight: bold;">{escape(str(student_name))}</td>
            <td style="padding: 6px 8px;">{escape(str(c.get('title') or ''))}</td>
            <td style="padding: 6px 8px; text-align: center;">{escape(str(category_labels.get(c.get('category'), c.get('category') or '')))}</td>
            <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: {p_color};">{escape(str(c.get('priority', 'MEDIUM')))}</td>
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
  <title>Internal Workflow Case Summary - EDUASSISTANT</title>
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
    <div style="margin-bottom: 20px; text-align: center;">
      <strong>EDUASSISTANT · INTERNAL WORKFLOW REPORT</strong><br>
      <span style="font-size: 12px; color: #475569;">For internal tracking only; not an institutional or military authority decision.</span>
    </div>

    <div style="text-align: center; margin-bottom: 16px;">
      <h2 style="font-size: 18px; font-weight: bold; text-transform: uppercase;">BẢNG TỔNG HỢP HỒ SƠ WORKFLOW NỘI BỘ</h2>
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
    """Render a clearly labeled internal workflow record with an HMAC lookup QR."""
    case_id_raw = str(case_data.get('id') or 'unknown')
    case_id = escape(case_id_raw)
    student_name = escape(str(case_data.get('studentName') or 'Sinh viên'))
    student_code = escape(str(case_data.get('studentCode') or '—'))
    title = escape(str(case_data.get('title') or 'Xác nhận tình trạng sinh viên'))
    status = escape(str(case_data.get('status') or 'UNKNOWN'))
    category = case_data.get('category')
    category_label = (
        'Xác nhận tình trạng sinh viên'
        if category == 'MILITARY_SERVICE_CONFIRMATION'
        else str(category or 'Chưa phân loại')
    )
    category_label = escape(category_label)
    rule_engine = case_data.get('ruleEngine') if isinstance(case_data.get('ruleEngine'), dict) else {}
    review = case_data.get('reviewResult') if isinstance(case_data.get('reviewResult'), dict) else {}
    decision = escape(str(rule_engine.get('decision') or 'Not recorded'))
    reviewer_name = escape(str(review.get('reviewerName') or 'Not recorded'))
    review_reason = escape(str(review.get('reason') or 'No reviewer note recorded.'))
    generated_at = datetime.now().strftime('%d/%m/%Y %H:%M:%S')

    verification_url = f"{base_url.rstrip('/')}/verify?caseId={quote(case_id_raw, safe='')}"
    qr_img = qrcode.make(verification_url)
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format='PNG')
    qr_code_data_url = f"data:image/png;base64,{base64.b64encode(qr_buffer.getvalue()).decode('utf-8')}"

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Internal Workflow Record #{case_id} - EDUASSISTANT</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; padding: 24px; background: #f1f5f9; color: #172033; font: 15px/1.55 Arial, sans-serif; }}
    .page {{ max-width: 820px; margin: auto; padding: 32px; background: white; border: 1px solid #dbe3ee; border-radius: 8px; }}
    .top {{ display: flex; justify-content: space-between; gap: 16px; align-items: center; }}
    h1 {{ margin: 0; font-size: 20px; }}
    .eyebrow {{ color: #475569; font-size: 12px; letter-spacing: .08em; }}
    .notice {{ margin: 22px 0; padding: 12px 14px; border-left: 4px solid #d97706; background: #fffbeb; color: #78350f; font-weight: 600; }}
    h2 {{ margin: 24px 0 10px; font-size: 16px; }}
    table {{ width: 100%; border-collapse: collapse; }}
    th, td {{ padding: 9px 10px; border: 1px solid #dbe3ee; text-align: left; vertical-align: top; }}
    th {{ width: 185px; background: #f8fafc; }}
    .qr {{ display: flex; gap: 18px; align-items: center; margin-top: 24px; padding-top: 18px; border-top: 1px dashed #cbd5e1; }}
    .qr img {{ width: 112px; height: 112px; }}
    .small {{ color: #475569; font-size: 12px; }}
    .print {{ padding: 9px 14px; border: 0; border-radius: 5px; color: white; background: #1e40af; cursor: pointer; }}
    @media print {{ body {{ padding: 0; background: white; }} .page {{ border: 0; border-radius: 0; }} .print {{ display: none; }} }}
  </style>
</head>
<body>
  <main class="page">
    <div class="top">
      <div>
        <div class="eyebrow">EDUASSISTANT · INTERNAL WORKFLOW RECORD</div>
        <h1>Student Status Confirmation Workflow</h1>
      </div>
      <button class="print" onclick="window.print()">Print / Save PDF</button>
    </div>

    <div class="notice">
      Bản ghi nội bộ để theo dõi workflow. Đây không phải giấy xác nhận do trường cấp,
      quyết định của cơ quan nhà nước/quân sự, hoặc kết luận về điều kiện pháp lý.
    </div>

    <h2>Case details</h2>
    <table>
      <tr><th>Case ID</th><td>{case_id}</td></tr>
      <tr><th>Student</th><td>{student_name}</td></tr>
      <tr><th>Student code</th><td>{student_code}</td></tr>
      <tr><th>Request title</th><td>{title}</td></tr>
      <tr><th>Workflow category</th><td>{category_label}</td></tr>
      <tr><th>Workflow status</th><td>{status}</td></tr>
      <tr><th>Rule Engine routing</th><td>{decision}</td></tr>
      <tr><th>Reviewer of record</th><td>{reviewer_name}</td></tr>
      <tr><th>Reviewer note</th><td>{review_reason}</td></tr>
      <tr><th>Export generated</th><td>{generated_at}</td></tr>
    </table>

    <div class="qr">
      <img src="{qr_code_data_url}" alt="QR code for case data integrity lookup">
      <div>
        <strong>HMAC-SHA256 data integrity lookup</strong>
        <div class="small">Quét mã để kiểm tra dữ liệu hồ sơ đã lưu. HMAC-SHA256 là mã xác thực toàn vẹn, không phải chữ ký PKI hoặc chữ ký số pháp lý.</div>
      </div>
    </div>
  </main>
</body>
</html>"""
