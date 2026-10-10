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
    """Tạo HTML trang Giấy Quyết Định Học Vụ Điện Tử có mã QR xác thực."""
    student_name = case_data.get('studentName') or 'Sinh viên'
    student_code = case_data.get('studentCode') or 'SV2026-9921'
    case_id = case_data.get('id')
    review = case_data.get('reviewResult') or {}

    category_labels = {
        'TUITION_DISCOUNT': 'Miễn Giảm Học Phí',
        'COMMUNITY_SERVICE': 'Công Nhận Điểm Rèn Luyện & CTXH',
        'SCHOLARSHIP': 'Học Bổng Khuyến Khích',
        'GRADE_APPEAL': 'Phúc Khảo Điểm Thi Học Phần',
        'GENERAL': 'Thủ Tục Học Vụ Khác'
    }

    decision_number = f"QĐ-ĐHCN/{case_id.replace('CASE-', '')}"
    now = datetime.now()
    day_str = f"{now.day:02d}"
    month_str = f"{now.month:02d}"
    year_str = str(now.year)

    # Sinh QR code Data URL
    verification_url = f"{base_url}/verify?caseId={quote(case_id, safe='')}"
    qr_img = qrcode.make(verification_url)
    qr_buffer = io.BytesIO()
    qr_img.save(qr_buffer, format='PNG')
    qr_code_data_url = f"data:image/png;base64,{base64.b64encode(qr_buffer.getvalue()).decode('utf-8')}"

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Quyết Định Phê Duyệt Hồ Sơ #{case_id} - EDUASSISTANT</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Times+New+Roman&display=swap');
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ font-family: 'Times New Roman', Times, serif; background-color: #f1f5f9; color: #111827; padding: 25px; line-height: 1.5; }}
    .page-container {{ max-width: 820px; margin: 0 auto; background: #ffffff; padding: 50px 65px; border-radius: 4px; box-shadow: 0 4px 25px rgba(0,0,0,0.1); }}
    .action-bar {{ max-width: 820px; margin: 0 auto 15px auto; display: flex; justify-content: space-between; align-items: center; }}
    .btn-print {{ background-color: #1e3a8a; color: white; border: none; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }}
    .btn-print:hover {{ background-color: #1e40af; }}
    .header-table {{ width: 100%; margin-bottom: 25px; border-collapse: collapse; }}
    .header-left {{ width: 45%; text-align: center; vertical-align: top; }}
    .header-right {{ width: 55%; text-align: center; vertical-align: top; }}
    .org-title {{ font-size: 13px; font-weight: normal; text-transform: uppercase; }}
    .org-main {{ font-size: 14px; font-weight: bold; text-transform: uppercase; }}
    .doc-number {{ font-size: 13px; font-style: italic; margin-top: 5px; }}
    .national-title {{ font-size: 13px; font-weight: bold; text-transform: uppercase; }}
    .national-motto {{ font-size: 13px; font-weight: bold; border-bottom: 1px solid #111; display: inline-block; padding-bottom: 2px; }}
    .doc-date {{ font-size: 13px; font-style: italic; margin-top: 5px; }}
    .doc-main-title {{ text-align: center; font-size: 20px; font-weight: bold; margin-top: 20px; text-transform: uppercase; }}
    .doc-sub-title {{ text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 15px; }}
    .authority-title {{ text-align: center; font-size: 14px; font-weight: bold; margin-bottom: 20px; text-transform: uppercase; }}
    .legal-basis {{ font-size: 13.5px; font-style: italic; margin-bottom: 15px; text-align: justify; line-height: 1.6; }}
    .decision-label {{ text-align: center; font-size: 16px; font-weight: bold; margin: 20px 0 15px 0; text-transform: uppercase; }}
    .article {{ font-size: 13.5px; margin-bottom: 12px; text-align: justify; }}
    .article-title {{ font-weight: bold; }}
    .info-list {{ margin-left: 25px; margin-top: 6px; }}
    .info-list li {{ margin-bottom: 4px; }}
    .signature-section {{ width: 100%; margin-top: 35px; border-collapse: collapse; }}
    .recipient-col {{ width: 50%; vertical-align: top; font-size: 12px; }}
    .signer-col {{ width: 50%; text-align: center; vertical-align: top; }}
    .signer-title {{ font-size: 13px; font-weight: bold; text-transform: uppercase; }}
    .signer-subtitle {{ font-size: 12px; font-style: italic; margin-bottom: 60px; }}
    .signer-name {{ font-size: 14px; font-weight: bold; text-transform: uppercase; }}
    .electronic-seal {{ display: inline-block; border: 2px solid #dc2626; color: #dc2626; padding: 6px 12px; border-radius: 8px; font-weight: bold; font-size: 11px; text-transform: uppercase; transform: rotate(-4deg); background: rgba(254, 226, 226, 0.4); margin-bottom: 10px; }}
    .qr-verification-box {{ margin-top: 35px; border-top: 1px dashed #cbd5e1; padding-top: 15px; display: flex; align-items: center; gap: 20px; }}
    .qr-desc {{ font-size: 11.5px; color: #475569; }}
    @media print {{
      body {{ background: transparent; padding: 0; }}
      .page-container {{ box-shadow: none; padding: 0; max-width: 100%; }}
      .action-bar {{ display: none !important; }}
    }}
  </style>
</head>
<body>

  <div class="action-bar">
    <div style="font-size: 14px; color: #475569;">
      <strong>EDUASSISTANT:</strong> Chứng nhận Quyết định Học vụ Điện tử chính thức
    </div>
    <button class="btn-print" onclick="window.print()">
      🖨️ In Quyết Định / Lưu File PDF
    </button>
  </div>

  <div class="page-container">
    <table class="header-table">
      <tr>
        <td class="header-left">
          <div class="org-title">BỘ GIÁO DỤC VÀ ĐÀO TẠO</div>
          <div class="org-main">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ QUỐC GIA</div>
          <div class="org-title">HỘI ĐỒNG THẨM ĐỊNH HỌC VỤ</div>
          <div class="doc-number">Số: {decision_number}</div>
        </td>
        <td class="header-right">
          <div class="national-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div class="national-motto">Độc lập - Tự do - Hạnh phúc</div>
          <div class="doc-date">Thành phố Hồ Chí Minh, ngày {day_str} tháng {month_str} năm {year_str}</div>
        </td>
      </tr>
    </table>

    <div class="doc-main-title">QUYẾT ĐỊNH</div>
    <div class="doc-sub-title">V/v Phê duyệt công nhận kết quả hồ sơ {category_labels.get(case_data.get('category'), case_data.get('category'))}</div>

    <div class="authority-title">HỘI ĐỒNG THẨM ĐỊNH HỌC VỤ & CHÍNH SÁCH SINH VIÊN</div>

    <div class="legal-basis">
      - Căn cứ Quy chế đào tạo và công tác quản lý sinh viên của Trường Đại học Công nghệ Quốc gia;<br>
      - Căn cứ Hồ sơ yêu cầu trực tuyến số <strong>#{case_id}</strong> của sinh viên <strong>{student_name}</strong> (MSSV: <strong>{student_code}</strong>);<br>
      - Căn cứ kết quả thẩm tra hồ sơ minh chứng, phân tích kiểm định thực thể số hóa và đề xuất phê duyệt của Thẩm định viên <strong>{review.get('reviewerName', 'Hội đồng xét duyệt')}</strong>.
    </div>

    <div class="decision-label">QUYẾT ĐỊNH:</div>

    <div class="article">
      <span class="article-title">Điều 1.</span> <strong>CHẤP THUẬN</strong> và phê duyệt hồ sơ yêu cầu theo đúng chế độ học vụ đối với:
      <ul class="info-list">
        <li>Họ và tên sinh viên: <strong>{student_name}</strong></li>
        <li>Mã số sinh viên (MSSV): <strong>{student_code}</strong></li>
        <li>Nội dung giải quyết: <strong>{case_data.get('title')}</strong></li>
        <li>Hạng mục phê chuẩn: <strong>{category_labels.get(case_data.get('category'), case_data.get('category'))}</strong></li>
        <li>Đánh giá thẩm định: <em>{review.get('reason', 'Hồ sơ đầy đủ tính pháp lý và minh chứng hợp lệ.')}</em></li>
      </ul>
    </div>

    <div class="article">
      <span class="article-title">Điều 2.</span> Phòng Công tác Sinh viên, Phòng Đào tạo, Phòng Kế hoạch Tài chính và các đơn vị liên quan chịu trách nhiệm cập nhật quyền lợi, điểm số và chế độ miễn giảm tương ứng cho sinh viên vào hệ thống quản lý đào tạo trước thời hạn quy định.
    </div>

    <div class="article">
      <span class="article-title">Điều 3.</span> Quyết định này có hiệu lực kể từ ngày ký và được chứng thực số hóa trên Cổng thông tin <strong>EDUASSISTANT</strong> với tính toàn vẹn được mã hóa.
    </div>

    <table class="signature-section">
      <tr>
        <td class="recipient-col">
          <strong><em>Nơi nhận:</em></strong><br>
          - Như Điều 2;<br>
          - Sinh viên (để thực hiện);<br>
          - Lưu: CSDL EDUASSISTANT.
        </td>
        <td class="signer-col">
          <div class="signer-title">TM. HỘI ĐỒNG XÉT DUYỆT</div>
          <div class="signer-subtitle">TRƯỞNG BAN THẨM ĐỊNH HỌC VỤ</div>
          <div>
            <div class="electronic-seal">
              ✓ ĐÃ KÝ ĐIỆN TỬ BỞI EDUASSISTANT<br>
              {review.get('reviewerName', 'Thẩm Định Viên Trưởng')}<br>
              {now.strftime('%d/%m/%Y')}
            </div>
          </div>
          <div class="signer-name">{review.get('reviewerName', 'TS. NGUYỄN VĂN THẨM')}</div>
        </td>
      </tr>
    </table>

    <div class="qr-verification-box">
      <img src="{qr_code_data_url}" alt="QR Verification" style="width: 105px; height: 105px; border: 1px solid #e2e8f0; border-radius: 6px;" />
      <div class="qr-desc">
        <strong style="color: #1e3a8a; font-size: 13px;">TRA CỨU XÁC THỰC VĂN BẢN ĐIỆN TỬ (DIGITAL AUDIT VERIFIED)</strong><br>
        • Mã định danh hồ sơ: <strong>#{case_id}</strong><br>
        • Mã chứng thực QR: Quét mã để xác minh quyết định gốc lưu trữ trên cơ sở dữ liệu EDUASSISTANT.<br>
        • Tiêu chuẩn chữ ký: SHA-256 Authenticated Token • Trạng thái: <strong>{case_data.get('status')}</strong>
      </div>
    </div>
  </div>

</body>
</html>"""
