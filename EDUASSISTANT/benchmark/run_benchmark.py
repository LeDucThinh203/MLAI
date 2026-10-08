"""
============================================================================
EDUASSISTANT - BENCHMARK RUNNER & MEASUREMENT ENGINE (PYTHON)
============================================================================
Thực thi kiểm chuẩn độ chính xác, tỷ lệ tự động hóa và tỷ lệ sai sót
trên tập dữ liệu kiểm chuẩn độc lập (Held-Out Cases Dataset).

CÔNG THỨC CHUẨN XÁC:
  - decisionAccuracy: (correctCases / totalCases) * 100%
  - automationRate: (số ca AUTO_APPROVE / totalCases) * 100%
  - escalationRate: (số ca ESCALATE_TO_HUMAN / totalCases) * 100%
  - missedEscalationRate:
      (số ca đáng lẽ ESCALATE nhưng hệ thống AUTO_APPROVE) / (tổng số ca đáng lẽ ESCALATE) * 100%
  - unnecessaryEscalationRate:
      (số ca đáng lẽ AUTO_APPROVE nhưng hệ thống ESCALATE) / (tổng số ca đáng lẽ AUTO_APPROVE) * 100%

Tự động lưu:
  - benchmark/results/latest.json
  - benchmark/results/latest.csv
============================================================================
"""

import os
import sys
import json
import csv
import time
from datetime import datetime

# Đảm bảo đường dẫn import
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_root = os.path.join(project_root, 'backend')
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from app.services.rule_engine import evaluate_case
from app.services.ai_service import set_ai_mode


def run_benchmark():
    benchmark_dir = os.path.dirname(os.path.abspath(__file__))
    cases_file = os.path.join(benchmark_dir, 'held_out_cases.json')
    results_dir = os.path.join(benchmark_dir, 'results')
    os.makedirs(results_dir, exist_ok=True)

    if not os.path.exists(cases_file):
        raise FileNotFoundError(f"Không tìm thấy tệp dữ liệu kiểm thử: {cases_file}")

    with open(cases_file, 'r', encoding='utf-8') as f:
        cases = json.load(f)

    print("\n" + "=" * 70)
    print("🚀 EDUASSISTANT BENCHMARK & MEASUREMENT RUNNER")
    print("=" * 70)
    print(f"• Số lượng ca kiểm thử độc lập: {len(cases)} cases")
    print(f"• Thời gian bắt đầu: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}")
    print("-" * 70)

    total_cases = len(cases)
    correct_cases = 0
    auto_approved_cases = 0
    escalated_cases = 0

    should_escalate_count = 0
    missed_escalate_count = 0

    should_auto_approve_count = 0
    unnecessary_escalate_count = 0

    case_results = []
    start_all = time.time()

    for idx, c in enumerate(cases, start=1):
        t0 = time.time()
        
        # Thiết lập tạm mode để phản ánh đúng provenance của case mà không đổi ngưỡng
        case_ai_mode = c.get('aiMetadata', {}).get('modeUsed', 'live')
        set_ai_mode(case_ai_mode)

        payload = {
            'id': c['id'],
            'title': c['title'],
            'description': c['description'],
            'category': c['category'],
            'priority': c['priority'],
            'evidenceFiles': c.get('evidenceFiles', []),
            'aiMetadata': c.get('aiMetadata', {})
        }

        ocr_data = None
        if c.get('evidenceFiles') and len(c['evidenceFiles']) > 0:
            ocr_data = c['evidenceFiles'][0].get('ocrData')

        student = c.get('student', {})
        verdict = evaluate_case(payload, ocr_data, student)
        duration_ms = round((time.time() - t0) * 1000, 2)

        actual_decision = verdict.get('decision')
        actual_reason = verdict.get('escalationReason')

        expected_decision = c['expectedDecision']
        expected_reason = c.get('expectedEscalationReason')

        # Đánh giá đúng sai
        decision_match = (actual_decision == expected_decision)
        reason_match = (expected_reason is None and actual_reason is None) or (actual_reason == expected_reason)
        is_correct = decision_match and reason_match

        if is_correct:
            correct_cases += 1

        if actual_decision == 'AUTO_APPROVE':
            auto_approved_cases += 1
        elif actual_decision == 'ESCALATE_TO_HUMAN':
            escalated_cases += 1

        # Phân tích Missed Escalation: Đáng lẽ ESCALATE nhưng lại AUTO_APPROVE
        if expected_decision == 'ESCALATE_TO_HUMAN':
            should_escalate_count += 1
            if actual_decision == 'AUTO_APPROVE':
                missed_escalate_count += 1

        # Phân tích Unnecessary Escalation: Đáng lẽ AUTO_APPROVE nhưng lại ESCALATE
        if expected_decision == 'AUTO_APPROVE':
            should_auto_approve_count += 1
            if actual_decision == 'ESCALATE_TO_HUMAN':
                unnecessary_escalate_count += 1

        status_icon = "✅ PASS" if is_correct else "❌ FAIL"
        print(f"[{idx:02d}/{total_cases:02d}] {status_icon} | {c['id']}: {c['name'][:42]:<42} -> {actual_decision} ({duration_ms}ms)")

        case_results.append({
            'id': c['id'],
            'name': c['name'],
            'category': c['category'],
            'priority': c['priority'],
            'expectedDecision': expected_decision,
            'actualDecision': actual_decision,
            'expectedReason': expected_reason,
            'actualReason': actual_reason,
            'ruleMatched': verdict.get('ruleMatched'),
            'confidence': verdict.get('confidence'),
            'isCorrect': is_correct,
            'durationMs': duration_ms
        })

    total_duration_sec = round(time.time() - start_all, 3)

    # Tính toán Metrics
    decision_accuracy = round((correct_cases / total_cases) * 100, 2) if total_cases > 0 else 0.0
    automation_rate = round((auto_approved_cases / total_cases) * 100, 2) if total_cases > 0 else 0.0
    escalation_rate = round((escalated_cases / total_cases) * 100, 2) if total_cases > 0 else 0.0

    missed_escalation_rate = round((missed_escalate_count / should_escalate_count) * 100, 2) if should_escalate_count > 0 else 0.0
    unnecessary_escalation_rate = round((unnecessary_escalate_count / should_auto_approve_count) * 100, 2) if should_auto_approve_count > 0 else 0.0

    summary = {
        'benchmarkRunId': f"BM-{int(datetime.now().timestamp())}",
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'executionTimeSec': total_duration_sec,
        'metrics': {
            'totalCases': total_cases,
            'correctCases': correct_cases,
            'decisionAccuracy': decision_accuracy,
            'automationRate': automation_rate,
            'escalationRate': escalation_rate,
            'missedEscalationRate': missed_escalation_rate,
            'unnecessaryEscalationRate': unnecessary_escalation_rate,
            'shouldEscalateCount': should_escalate_count,
            'missedEscalateCount': missed_escalate_count,
            'shouldAutoApproveCount': should_auto_approve_count,
            'unnecessaryEscalateCount': unnecessary_escalate_count
        },
        'results': case_results
    }

    # Xuất file JSON
    json_path = os.path.join(results_dir, 'latest.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    # Xuất file CSV
    csv_path = os.path.join(results_dir, 'latest.csv')
    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Mã Ca', 'Tên Tình Huống', 'Danh Mục', 'Độ Ưu Tiên',
            'Kỳ Vọng Quyết Định', 'Thực Tế Quyết Định',
            'Kỳ Vọng Lý Do', 'Thực Tế Lý Do',
            'Mã Quy Tắc', 'Độ Tin Cậy', 'Kết Quả Kiểm Thử', 'Thời Gian (ms)'
        ])
        for r in case_results:
            writer.writerow([
                r['id'], r['name'], r['category'], r['priority'],
                r['expectedDecision'], r['actualDecision'],
                r['expectedReason'] or '—', r['actualReason'] or '—',
                r['ruleMatched'], r['confidence'],
                'PASS' if r['isCorrect'] else 'FAIL', r['durationMs']
            ])

    print("-" * 70)
    print("📊 KẾT QUẢ ĐO LƯỜNG CHUẨN XÁC (MEASUREMENT REPORT):")
    print(f"  • Decision Accuracy:            {decision_accuracy}% ({correct_cases}/{total_cases})")
    print(f"  • Automation Rate:              {automation_rate}% ({auto_approved_cases}/{total_cases})")
    print(f"  • Escalation Rate:              {escalation_rate}% ({escalated_cases}/{total_cases})")
    print(f"  • Missed Escalation Rate:       {missed_escalation_rate}% ({missed_escalate_count}/{should_escalate_count})")
    print(f"  • Unnecessary Escalation Rate:  {unnecessary_escalation_rate}% ({unnecessary_escalate_count}/{should_auto_approve_count})")
    print(f"  • Thời gian chạy:               {total_duration_sec}s")
    print(f"  • Tệp kết quả JSON:             {json_path}")
    print(f"  • Tệp kết quả CSV:              {csv_path}")
    print("=" * 70 + "\n")

    return summary


if __name__ == '__main__':
    run_benchmark()
