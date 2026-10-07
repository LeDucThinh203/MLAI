const dbService = require('./db');

// Cấu hình AI Fallback Engine
let currentAiMode = process.env.AI_MODE || 'mock'; // 'live' | 'mock' | 'cache'

// Bộ đệm trích xuất Cache Extraction
const extractionCache = new Map([
  [
    'TUITION_DISCOUNT',
    {
      extractedHouseholdId: 'HN-2026-8812',
      householdStatus: 'CẬN NGHÈO',
      issuingAuthority: 'UBND Phường Linh Trung, TP. Thủ Đức',
      verifiedDate: '2026-01-15',
      confidence: 0.96,
      policyRuleMatch: 'RULE_TUITION_SEC_4A_VALID',
      suggestedAction: 'AUTO_APPROVE_ELIGIBLE'
    }
  ],
  [
    'COMMUNITY_SERVICE',
    {
      activityName: 'Chiến dịch Tình nguyện Mùa Hè Xanh 2026',
      unitSigned: 'Ban Thường Vụ Đoàn Trường',
      awardedPoints: 15,
      confidence: 0.98,
      policyRuleMatch: 'RULE_COMM_ACTIVITY_VALID',
      suggestedAction: 'AUTO_APPROVE_ELIGIBLE'
    }
  ],
  [
    'SCHOLARSHIP',
    {
      gpa: 3.85,
      trainingScore: 92,
      certificateType: 'Học bổng Doanh nghiệp loại Giỏi',
      confidence: 0.94,
      policyRuleMatch: 'RULE_SCHOLARSHIP_MERIT_OK',
      suggestedAction: 'FORWARD_TO_COMMITTEE'
    }
  ],
  [
    'DEFAULT',
    {
      documentType: 'Đơn từ thông thường',
      contentSummary: 'Hồ sơ đã được kiểm tra cấu trúc hợp lệ',
      confidence: 0.90,
      policyRuleMatch: 'RULE_STANDARD_VERIFIED',
      suggestedAction: 'NEEDS_HUMAN_REVIEW'
    }
  ]
]);

// Helper: Sanitize JSON string (loại bỏ markdown blocks ```json ... ```)
function sanitizeJsonString(raw) {
  if (typeof raw !== 'string') return raw;
  let clean = raw.trim();
  if (clean.startsWith('```json')) {
    clean = clean.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  } else if (clean.startsWith('```')) {
    clean = clean.replace(/^```\s*/i, '').replace(/```$/, '').trim();
  }
  return clean;
}

/**
 * Trích xuất dữ liệu bằng AI với cơ chế Fail-Safe & Fallback 3 chế độ: live -> cache -> mock
 */
async function extractCaseData(caseData, actor = { id: 'SYSTEM', username: 'ai_engine', role: 'SYSTEM' }) {
  const startTime = Date.now();
  let modeUsed = currentAiMode;
  let fallbackOccurred = false;
  let fallbackReason = '';
  let extractedResult = null;

  try {
    if (currentAiMode === 'live') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim().length < 10) {
        throw new Error('Thiếu GEMINI_API_KEY hợp lệ trong file .env để kích hoạt AI Live mode.');
      }

      const promptText = `Bạn là hệ thống AI thẩm định hồ sơ học vụ sinh viên (CaseFlow AI Engine). Hãy phân tích hồ sơ dưới đây và đánh giá tính hợp lệ theo quy chế học vụ:
- Tiêu đề hồ sơ: "${caseData.title}"
- Danh mục yêu cầu: "${caseData.category}"
- Nội dung giải trình: "${caseData.description}"
- Người nộp: ${actor.name || actor.username || 'Sinh viên'}

Hãy phản hồi dưới dạng JSON duy nhất với cấu trúc:
{
  "documentType": "${caseData.category}",
  "titleExtracted": "${caseData.title}",
  "aiAnalysis": "Phân tích súc tích 2-3 câu về tính hợp lệ và sự đầy đủ của nội dung hồ sơ",
  "confidence": 0.96,
  "policyRuleMatch": "Mã quy tắc phù hợp (ví dụ: RULE_${caseData.category}_PASSED)",
  "suggestedAction": "RECOMMEND_APPROVAL hoặc NEEDS_HUMAN_REVIEW hoặc REJECT_INVALID"
}
Chỉ trả về JSON hợp lệ.`;

      let rawResponse = null;
      let usedModel = 'gemini-2.5-flash';

      // Phương án 1: Gọi qua @google/genai SDK
      try {
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptText,
          config: { responseMimeType: 'application/json' }
        });
        rawResponse = res.text || res.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (sdkError) {
        // Phương án 2: Gọi qua REST API fallback
        const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        for (const m of models) {
          try {
            usedModel = m;
            const restRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey.trim()}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { responseMimeType: 'application/json' }
              })
            });
            if (restRes.ok) {
              const resJson = await restRes.json();
              rawResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawResponse) break;
            }
          } catch (mErr) {
            // thử tiếp model tiếp theo
          }
        }
      }

      if (rawResponse) {
        let clean = sanitizeJsonString(rawResponse);
        const parsed = JSON.parse(clean);
        extractedResult = {
          ...parsed,
          model: usedModel,
          provider: `Google Gemini (${usedModel} - Live)`,
          extractedAt: new Date().toISOString()
        };
      } else {
        throw new Error('Gemini API không phản hồi nội dung trích xuất.');
      }

    } else if (currentAiMode === 'cache') {
      // Chế độ Cache Extraction
      extractedResult = extractionCache.get(caseData.category) || extractionCache.get('DEFAULT');
      modeUsed = 'cache';

    } else {
      // Chế độ Mock Extraction mặc định
      const cached = extractionCache.get(caseData.category) || extractionCache.get('DEFAULT');
      extractedResult = {
        ...cached,
        isMocked: true,
        extractedAt: new Date().toISOString()
      };
      modeUsed = 'mock';
    }

  } catch (liveError) {
    // FAIL-SAFE: Tự động chuyển đổi sang Cache / Mock khi Live Gemini gặp lỗi
    fallbackOccurred = true;
    fallbackReason = liveError.message;
    modeUsed = extractionCache.has(caseData.category) ? 'cache' : 'mock';
    extractedResult = extractionCache.get(caseData.category) || extractionCache.get('DEFAULT');

    // Ghi nhận Audit Trail cho sự kiện Fallback
    dbService.logAudit({
      action: 'AI_FALLBACK_TRIGGERED',
      actor: { id: 'SYSTEM_AI', username: 'gemini_engine', role: 'SYSTEM', name: 'Gemini VLM Engine' },
      caseId: caseData.id || null,
      input: { requestedMode: 'live', error: fallbackReason },
      result: `FALLBACK_TO_${modeUsed.toUpperCase()}`,
      reason: `Tự động chuyển đổi sang ${modeUsed} do lỗi: ${fallbackReason}. Hệ thống tiếp tục hoạt động không gián đoạn.`
    });
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    modeUsed,
    fallbackOccurred,
    fallbackReason,
    durationMs,
    data: extractedResult
  };
}

module.exports = {
  getAiMode: () => currentAiMode,
  setAiMode: (mode) => {
    if (['live', 'mock', 'cache'].includes(mode)) {
      currentAiMode = mode;
      return true;
    }
    return false;
  },
  extractCaseData,
  sanitizeJsonString
};
