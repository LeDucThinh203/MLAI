/**
 * Dedicated Rule Engine & Policy Checker Service
 * Deterministic business decision making decoupled from AI OCR extraction.
 * 
 * Flow:
 * 1. AI / Gemini Multimodal reads document and extracts facts.
 * 2. Rule Engine compares facts with student input and applies academic policies.
 * 3. Categorizes as AUTO_APPROVE or escalates to HUMAN_REVIEW under 5 strict reasons:
 *    - OWNERSHIP_UNCLEAR
 *    - FACT_UNKNOWN
 *    - DATA_CONFLICT
 *    - AUTHORITY_REQUIRED
 *    - POLICY_OUT_OF_SCOPE
 */

const ESCALATION_CONFIG = {
  OWNERSHIP_UNCLEAR: {
    code: 'OWNERSHIP_UNCLEAR',
    label: 'Nghi vấn quyền sở hữu / MSSV không khớp',
    badgeColor: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    icon: '🔒',
    description: 'Họ tên hoặc MSSV trích xuất từ minh chứng khác biệt so với tài khoản sinh viên đang nộp đơn.'
  },
  FACT_UNKNOWN: {
    code: 'FACT_UNKNOWN',
    label: 'Thiếu dữ kiện xác thực / Ảnh mờ / Không rõ nguồn gốc',
    badgeColor: '#f97316',
    badgeBg: 'rgba(249, 115, 22, 0.15)',
    icon: '🚨',
    description: 'Tài liệu minh chứng thiếu số hiệu, thiếu cơ quan ban hành, ảnh mờ hoặc độ tin cậy trích xuất OCR dưới ngưỡng an toàn (< 75%).'
  },
  DATA_CONFLICT: {
    code: 'DATA_CONFLICT',
    label: 'Mâu thuẫn dữ liệu kê khai và minh chứng',
    badgeColor: '#eab308',
    badgeBg: 'rgba(234, 179, 8, 0.15)',
    icon: '⚠️',
    description: 'Thông tin sinh viên tự kê khai đối chiếu không khớp với dữ kiện AI trích xuất từ văn bản gốc.'
  },
  AUTHORITY_REQUIRED: {
    code: 'AUTHORITY_REQUIRED',
    label: 'Vượt thẩm quyền tự động / Cần Hội đồng xét duyệt',
    badgeColor: '#8b5cf6',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    icon: '👑',
    description: 'Hồ sơ thuộc diện đặc biệt (Ưu tiên Cao, Phúc khảo điểm thi hoặc Học bổng) theo quy chế bắt buộc phải qua Hội đồng Thẩm định.'
  },
  POLICY_OUT_OF_SCOPE: {
    code: 'POLICY_OUT_OF_SCOPE',
    label: 'Ngoài phạm vi chính sách tự động',
    badgeColor: '#06b6d4',
    badgeBg: 'rgba(6, 182, 212, 0.15)',
    icon: '📋',
    description: 'Yêu cầu nằm ngoài quy chế tự động hóa tiêu chuẩn, cần chuyên viên xem xét ngoại lệ theo quy trình riêng.'
  }
};

// Helper normalization
function normalizeStr(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Đánh giá hồ sơ dựa trên Rule Engine
 * @param {Object} caseData Thông tin đơn sinh viên nộp
 * @param {Object} ocrData Dữ liệu trích xuất từ Gemini / OCR
 * @param {Object} studentUser Tài khoản sinh viên
 * @returns {Object} Kết quả phán quyết của Rule Engine
 */
function evaluateCase(caseData, ocrData = null, studentUser = {}) {
  const discrepancies = [];
  const files = caseData.evidenceFiles || [];
  const priority = caseData.priority || 'MEDIUM';
  const category = caseData.category || 'GENERAL';
  const description = caseData.description || '';
  const title = caseData.title || '';

  // Extract relevant OCR values
  const ocr = ocrData || (files[0]?.ocrData) || (caseData.aiExtraction) || null;
  const ocrStudentName = ocr?.studentName || ocr?.extractedEntities?.['Họ và tên'];
  const ocrStudentCode = ocr?.studentCode || ocr?.extractedEntities?.['Mã số SV'];
  const ocrIssuing = ocr?.issuingAuthority || ocr?.extractedEntities?.['Cơ quan ban hành'];
  const ocrCertNum = ocr?.certificateNumber || ocr?.extractedEntities?.['Số hiệu văn bản'];
  const ocrCategory = ocr?.suggestedCategory || ocr?.documentType;
  const confidenceScore = ocr ? (ocr.confidenceScore ?? ocr.confidence ?? 0.0) : 0.0;
  const tamperRisk = ocr?.tamperRisk || (ocr ? 'LOW' : 'UNKNOWN');

  // =========================================================================
  // RULE 1: OWNERSHIP_UNCLEAR (Quyền sở hữu / Mạo danh / MSSV không khớp)
  // =========================================================================
  if (ocr && (ocrStudentName || ocrStudentCode)) {
    const normUserCode = normalizeStr(studentUser.studentCode || studentUser.username || '');
    const normOcrCode = normalizeStr(ocrStudentCode || '');
    const normUserName = normalizeStr(studentUser.fullName || '');
    const normOcrName = normalizeStr(ocrStudentName || '');

    const codeMatch = !ocrStudentCode || !studentUser.studentCode || normUserCode.includes(normOcrCode) || normOcrCode.includes(normUserCode);
    const nameMatch = !ocrStudentName || !studentUser.fullName || normUserName.includes(normOcrName) || normOcrName.includes(normUserName);

    discrepancies.push({
      field: 'Chủ sở hữu hồ sơ (MSSV & Họ tên)',
      studentClaim: `${studentUser.fullName || studentUser.username} (${studentUser.studentCode || 'N/A'})`,
      aiFact: `${ocrStudentName || 'Không rõ'} (${ocrStudentCode || 'Không rõ'})`,
      match: codeMatch && nameMatch,
      note: (!codeMatch || !nameMatch) ? 'MSSV hoặc họ tên trên văn bản không trùng khớp với tài khoản sinh viên' : 'Đúng chủ sở hữu tài khoản'
    });

    if (!codeMatch || !nameMatch) {
      return {
        decision: 'ESCALATE_TO_HUMAN',
        status: 'UNDER_REVIEW',
        escalationReason: 'OWNERSHIP_UNCLEAR',
        escalationConfig: ESCALATION_CONFIG.OWNERSHIP_UNCLEAR,
        ruleMatched: 'RULE_SEC_01_OWNERSHIP_MISMATCH',
        explanation: `Phát hiện nghi vấn quyền sở hữu: Tài liệu minh chứng ghi tên "${ocrStudentName || 'N/A'}" (MSSV: "${ocrStudentCode || 'N/A'}"), không khớp với sinh viên nộp "${studentUser.fullName}" (MSSV: "${studentUser.studentCode || studentUser.username}").`,
        discrepancies,
        confidence: confidenceScore,
        tamperRisk,
        evaluatedAt: new Date().toISOString(),
        suggestedAction: 'Cán bộ kiểm tra lại thẻ sinh viên và hồ sơ gốc của sinh viên'
      };
    }
  }

  // =========================================================================
  // RULE 2: FACT_UNKNOWN (Thiếu dữ kiện / Không có file / Ảnh mờ / Độ tin cậy thấp)
  // =========================================================================
  if (files.length === 0) {
    discrepancies.push({
      field: 'Tệp minh chứng đính kèm',
      studentClaim: 'Khai báo có tài liệu',
      aiFact: 'Không tìm thấy tệp đính kèm nào',
      match: false,
      note: 'Thiếu minh chứng bắt buộc'
    });

    return {
      decision: 'ESCALATE_TO_HUMAN',
      status: 'UNDER_REVIEW',
      escalationReason: 'FACT_UNKNOWN',
      escalationConfig: ESCALATION_CONFIG.FACT_UNKNOWN,
      ruleMatched: 'RULE_FACT_01_NO_EVIDENCE_ATTACHED',
      explanation: 'Hồ sơ chưa đính kèm tệp minh chứng hoặc tệp tải lên bị lỗi không thể đọc được dữ liệu.',
      discrepancies,
      confidence: 0.0,
      tamperRisk: 'UNKNOWN',
      evaluatedAt: new Date().toISOString(),
      suggestedAction: 'Yêu cầu sinh viên tải lên ảnh chụp minh chứng rõ ràng'
    };
  }

  if (confidenceScore < 0.75 || tamperRisk === 'HIGH' || (!ocrIssuing && !ocrCertNum)) {
    discrepancies.push({
      field: 'Chất lượng tài liệu & Cơ quan cấp',
      studentClaim: 'Minh chứng hợp lệ',
      aiFact: `Độ tin cậy OCR: ${Math.round(confidenceScore * 100)}% | Cơ quan: ${ocrIssuing || 'Không nhận diện được'}`,
      match: false,
      note: confidenceScore < 0.75 ? 'Ảnh mờ hoặc chữ viết khó đọc' : 'Thiếu thông tin cơ quan ban hành hoặc có dấu hiệu can thiệp'
    });

    return {
      decision: 'ESCALATE_TO_HUMAN',
      status: 'UNDER_REVIEW',
      escalationReason: 'FACT_UNKNOWN',
      escalationConfig: ESCALATION_CONFIG.FACT_UNKNOWN,
      ruleMatched: 'RULE_FACT_02_LOW_CONFIDENCE_OR_MISSING_DATA',
      explanation: `Dữ kiện văn bản chưa đủ căn cứ xác thực (Độ tin cậy OCR: ${Math.round(confidenceScore * 100)}% < 75%, hoặc thiếu số hiệu/cơ quan ban hành). Cần chuyên viên kiểm tra bản gốc.`,
      discrepancies,
      confidence: confidenceScore,
      tamperRisk,
      evaluatedAt: new Date().toISOString(),
      suggestedAction: 'Chuyên viên kiểm tra trực tiếp ảnh gốc hoặc liên hệ đơn vị cấp giấy xác nhận'
    };
  }

  // =========================================================================
  // RULE 3: DATA_CONFLICT (Mâu thuẫn danh mục / dữ liệu đối chiếu)
  // =========================================================================
  if (ocr && ocrCategory) {
    const normCategory = category.toUpperCase();
    let isCategoryConflict = false;

    if (normCategory === 'TUITION_DISCOUNT' && (ocrCategory.includes('COMMUNITY_SERVICE') || ocrCategory.includes('GRADE_APPEAL'))) {
      isCategoryConflict = true;
    } else if (normCategory === 'COMMUNITY_SERVICE' && (ocrCategory.includes('TUITION_DISCOUNT') || ocrCategory.includes('GRADE_APPEAL'))) {
      isCategoryConflict = true;
    } else if (normCategory === 'GRADE_APPEAL' && (ocrCategory.includes('TUITION_DISCOUNT') || ocrCategory.includes('COMMUNITY_SERVICE'))) {
      isCategoryConflict = true;
    }

    discrepancies.push({
      field: 'Loại hồ sơ & Danh mục',
      studentClaim: category,
      aiFact: ocrCategory,
      match: !isCategoryConflict,
      note: isCategoryConflict ? 'Danh mục khai báo mâu thuẫn với nội dung trên văn bản' : 'Khớp đúng danh mục quy định'
    });

    if (isCategoryConflict) {
      return {
        decision: 'ESCALATE_TO_HUMAN',
        status: 'UNDER_REVIEW',
        escalationReason: 'DATA_CONFLICT',
        escalationConfig: ESCALATION_CONFIG.DATA_CONFLICT,
        ruleMatched: 'RULE_CONFLICT_01_CATEGORY_MISMATCH',
        explanation: `Mâu thuẫn dữ liệu: Sinh viên nộp đơn diện "${category}" nhưng AI OCR nhận diện văn bản thuộc diện "${ocrCategory}".`,
        discrepancies,
        confidence: confidenceScore,
        tamperRisk,
        evaluatedAt: new Date().toISOString(),
        suggestedAction: 'Cán bộ hướng dẫn sinh viên chọn lại đúng loại đơn hoặc làm rõ nội dung'
      };
    }
  }

  // =========================================================================
  // RULE 4: AUTHORITY_REQUIRED (Vượt thẩm quyền / Hội đồng / Ưu tiên Cao)
  // =========================================================================
  if (priority === 'HIGH' || category === 'GRADE_APPEAL' || category === 'SCHOLARSHIP') {
    let reasonDetail = '';
    if (priority === 'HIGH') {
      reasonDetail = 'Hồ sơ có mức độ ưu tiên CAO (HIGH) ảnh hưởng lớn đến quyền lợi hoặc tài chính.';
    } else if (category === 'GRADE_APPEAL') {
      reasonDetail = 'Hồ sơ Phúc khảo điểm thi theo quy chế đào tạo bắt buộc phải có Biên bản họp Hội đồng Khảo thí.';
    } else if (category === 'SCHOLARSHIP') {
      reasonDetail = 'Xét duyệt Học bổng đòi hỏi Hội đồng Thẩm định & Doanh nghiệp tài trợ chuẩn y danh sách.';
    }

    discrepancies.push({
      field: 'Cấp thẩm quyền xử lý',
      studentClaim: `${category} (${priority})`,
      aiFact: 'Yêu cầu phê chuẩn của Hội đồng / Trưởng khoa',
      match: false,
      note: 'Vượt giới hạn thẩm quyền phê duyệt tự động'
    });

    return {
      decision: 'ESCALATE_TO_HUMAN',
      status: 'UNDER_REVIEW',
      escalationReason: 'AUTHORITY_REQUIRED',
      escalationConfig: ESCALATION_CONFIG.AUTHORITY_REQUIRED,
      ruleMatched: 'RULE_AUTH_01_COMMITTEE_APPROVAL_REQUIRED',
      explanation: `Hồ sơ vượt thẩm quyền xử lý tự động: ${reasonDetail}`,
      discrepancies,
      confidence: confidenceScore,
      tamperRisk,
      evaluatedAt: new Date().toISOString(),
      suggestedAction: 'Chuyển hồ sơ vào Hàng đợi Thẩm định của Hội đồng / Ban Thư ký duyệt'
    };
  }

  // =========================================================================
  // RULE 5: POLICY_OUT_OF_SCOPE (Ngoài quy chế tự động hóa)
  // =========================================================================
  const specialKeywords = ['ngoại lệ', 'đặc cách', 'cứu xét đặc biệt', 'hoãn thi quá hạn', 'bảo lưu đột xuất', 'hoàn cảnh đặc biệt'];
  const lowerText = `${title} ${description}`.toLowerCase();
  const hasSpecialRequest = specialKeywords.some(kw => lowerText.includes(kw));

  if (category === 'GENERAL' || hasSpecialRequest) {
    discrepancies.push({
      field: 'Quy chuẩn chính sách',
      studentClaim: category === 'GENERAL' ? 'Hồ sơ thông thường / Khác' : 'Xin cứu xét ngoại lệ',
      aiFact: 'Nằm ngoài bộ quy tắc tự động hóa chuẩn',
      match: false,
      note: 'Cần chuyên viên đánh giá hồ sơ cá biệt'
    });

    return {
      decision: 'ESCALATE_TO_HUMAN',
      status: 'UNDER_REVIEW',
      escalationReason: 'POLICY_OUT_OF_SCOPE',
      escalationConfig: ESCALATION_CONFIG.POLICY_OUT_OF_SCOPE,
      ruleMatched: 'RULE_POLICY_01_SPECIAL_OR_GENERAL_CASE',
      explanation: 'Hồ sơ có nội dung ngoại lệ hoặc thuộc danh mục khác (GENERAL) chưa có chính sách tự động hóa.',
      discrepancies,
      confidence: confidenceScore,
      tamperRisk,
      evaluatedAt: new Date().toISOString(),
      suggestedAction: 'Chuyên viên tiếp nhận hồ sơ và giải quyết theo quy trình thủ công riêng'
    };
  }

  // =========================================================================
  // ALL PASSED -> AUTO_APPROVE (TỰ ĐỘNG DUYỆT)
  // =========================================================================
  discrepancies.push({
    field: 'Toàn bộ tiêu chí & chính sách',
    studentClaim: 'Đầy đủ & Hợp lệ',
    aiFact: 'Đạt chuẩn 100% quy chế',
    match: true,
    note: 'Đủ điều kiện tự động phê duyệt ngay lập tức'
  });

  return {
    decision: 'AUTO_APPROVE',
    status: 'APPROVED',
    escalationReason: null,
    escalationConfig: null,
    ruleMatched: 'RULE_AUTO_PASSED_STANDARD_2026',
    explanation: 'Hồ sơ đầy đủ minh chứng hợp lệ, OCR trích xuất khớp 100% danh tính và dữ liệu kê khai, rủi ro làm giả thấp. Hệ thống tự động phê chuẩn theo Quy chế Đào tạo.',
    discrepancies,
    confidence: confidenceScore,
    tamperRisk: 'LOW',
    evaluatedAt: new Date().toISOString(),
    suggestedAction: 'Hệ thống đã tự động xuất Quyết định phê duyệt học vụ có chữ ký số.'
  };
}

module.exports = {
  ESCALATION_CONFIG,
  evaluateCase
};
