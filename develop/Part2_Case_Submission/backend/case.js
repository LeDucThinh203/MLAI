const express = require('express');
const dbService = require('../../shared/db');
const { verifyToken, requireRole } = require('../../Part1_JWT_Auth/backend/auth');
const { uploadMiddleware, processAndSaveFile } = require('../../shared/uploadService');
const aiService = require('../../shared/aiService');
const { extractDocumentEntities } = require('../../shared/ocrService');
const { generateCasesCsv, generateCasesTableHtml, generateDecisionHtml } = require('../../shared/reportService');
const { evaluateCase, ESCALATION_CONFIG } = require('../../shared/ruleEngine');

const router = express.Router();

const apiResponse = (res, statusCode, success, message, data = null, error = null) => {
    return res.status(statusCode).json({
        success,
        statusCode,
        message,
        timestamp: new Date().toISOString(),
        data,
        error
    });
};

/**
 * POST /api/upload/evidence
 */
router.post('/upload/evidence', verifyToken, (req, res) => {
    uploadMiddleware(req, res, async (err) => {
        if (err) {
            return apiResponse(res, 400, false, err.message, null, 'UPLOAD_ERROR');
        }

        if (!req.file) {
            return apiResponse(res, 400, false, 'Không tìm thấy file tải lên (Field name: evidence).', null, 'FILE_MISSING');
        }

        try {
            const savedResult = await processAndSaveFile(req.file, req.user);
            await dbService.saveEvidenceUpload({
                fileName: savedResult.fileName,
                ownerId: req.user.id,
                metadata: savedResult.metadata
            });
            return apiResponse(res, 201, true, 'Tải lên và tối ưu minh chứng thành công!', savedResult);
        } catch (processError) {
            console.error('Lỗi khi nén ảnh:', processError);
            return apiResponse(res, 500, false, 'Lỗi xử lý nén/tối ưu file ảnh.', null, processError.message);
        }
    });
});

/**
 * POST /api/upload/evidence-ocr
 */
router.post('/upload/evidence-ocr', verifyToken, (req, res) => {
    uploadMiddleware(req, res, async (err) => {
        if (err) {
            return apiResponse(res, 400, false, err.message, null, 'UPLOAD_ERROR');
        }

        if (!req.file) {
            return apiResponse(res, 400, false, 'Không tìm thấy file tải lên (Field name: evidence).', null, 'FILE_MISSING');
        }

        try {
            const savedResult = await processAndSaveFile(req.file, req.user);
            const ocrResult = await extractDocumentEntities(req.file.buffer, req.file.originalname, req.user);
            const ocrIsLive = Boolean(
                ocrResult.provider?.includes('Google Gemini Multimodal Vision') &&
                ocrResult.provider?.includes('Live')
            );
            await dbService.saveEvidenceUpload({
                fileName: savedResult.fileName,
                ownerId: req.user.id,
                metadata: savedResult.metadata,
                ocrData: ocrResult.data,
                ocrProvider: ocrResult.provider,
                ocrIsLive
            });

            await dbService.logAudit({
                action: 'OCR_EXTRACTION_PERFORMED',
                actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName || req.user.username },
                input: { fileName: req.file.originalname, size: req.file.size },
                result: 'SUCCESS',
                reason: `Đã trích xuất thông tin OCR thành công từ ${req.file.originalname} (${ocrResult.provider})`
            });

            return apiResponse(res, 201, true, 'Tải lên và trích xuất OCR tự động thành công!', {
                file: savedResult,
                ocr: ocrResult
            });
        } catch (processError) {
            console.error('Lỗi khi xử lý OCR:', processError);
            return apiResponse(res, 500, false, 'Lỗi xử lý OCR tài liệu minh chứng.', null, processError.message);
        }
    });
});

/**
 * GET /api/reports/export-csv (REVIEWER, ADMIN ONLY)
 */
router.get('/reports/export-csv', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
    const { status, category } = req.query;
    const filter = {};
    if (status && status !== 'ALL') filter.status = status;
    if (category && category !== 'ALL') filter.category = category;

    const cases = await dbService.getCases(filter);
    const csvContent = generateCasesCsv(cases);

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `BaoCao_HoSo_CaseFlow_${timestamp}.csv`;

    await dbService.logAudit({
        action: 'REPORT_CSV_EXPORTED',
        actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName || req.user.username },
        input: { filter, count: cases.length },
        result: 'SUCCESS',
        reason: `Xuất báo cáo CSV ${cases.length} hồ sơ theo bộ lọc: ${JSON.stringify(filter)}`
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
});

/**
 * GET /api/reports/export-cases-html (REVIEWER, ADMIN ONLY)
 */
router.get('/reports/export-cases-html', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
    const { status, category } = req.query;
    const filter = {};
    if (status && status !== 'ALL') filter.status = status;
    if (category && category !== 'ALL') filter.category = category;

    const cases = await dbService.getCases(filter);
    try {
        const html = await generateCasesTableHtml(cases, { status, category });

        await dbService.logAudit({
            action: 'REPORT_TABLE_PDF_EXPORTED',
            actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName || req.user.username },
            input: { filter, count: cases.length },
            result: 'SUCCESS',
            reason: `Xem và xuất Bảng Tổng Hợp ${cases.length} hồ sơ chuẩn PDF`
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    } catch (err) {
        console.error('Lỗi khi tạo Bảng Báo Cáo PDF:', err);
        return apiResponse(res, 500, false, 'Lỗi hệ thống khi sinh báo cáo dạng bảng.', null, err.message);
    }
});

/**
 * GET /api/cases/:id/export-decision (Bảo vệ quyền truy cập hồ sơ)
 */
router.get('/cases/:id/export-decision', verifyToken, async (req, res) => {
    const targetCase = await dbService.getCaseById(req.params.id);
    if (!targetCase) {
        return apiResponse(res, 404, false, 'Không tìm thấy hồ sơ yêu cầu.', null, 'NOT_FOUND');
    }

    // Kiểm tra quyền: Sinh viên chỉ được xuất quyết định của chính mình
    if (req.user.role === 'STUDENT' && targetCase.studentId !== req.user.id) {
        return apiResponse(res, 403, false, 'Bạn không có quyền truy cập quyết định của hồ sơ này.', null, 'FORBIDDEN');
    }

    try {
        const html = await generateDecisionHtml(targetCase);

        await dbService.logAudit({
            action: 'DECISION_EXPORTED',
            actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName || req.user.username },
            caseId: targetCase.id,
            input: { caseId: targetCase.id, status: targetCase.status },
            result: 'SUCCESS',
            reason: `Xem và tải Quyết định phê duyệt học vụ cho hồ sơ #${targetCase.id}`
        });

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(html);
    } catch (err) {
        console.error('Lỗi khi tạo Quyết định:', err);
        return apiResponse(res, 500, false, 'Lỗi hệ thống khi sinh quyết định.', null, err.message);
    }
});

/**
 * GET & POST /api/system/ai-mode
 */
router.get('/system/ai-status', verifyToken, (req, res) => {
    return apiResponse(res, 200, true, 'Trạng thái động cơ AI', {
        currentMode: aiService.getAiMode(),
        status: 'READY',
        supportedModes: ['live', 'mock', 'cache'],
        fallbackProtection: 'ACTIVE'
    });
});

router.post('/system/ai-mode', verifyToken, requireRole('ADMIN'), async (req, res) => {
    const { mode } = req.body || {};
    if (!mode || !['live', 'mock', 'cache'].includes(mode)) {
        return apiResponse(res, 400, false, 'Mode không hợp lệ. Chọn một trong: live, mock, cache.');
    }

    aiService.setAiMode(mode);

    await dbService.logAudit({
        action: 'AI_MODE_CHANGED',
        actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName || req.user.username },
        input: { newMode: mode },
        result: 'SUCCESS',
        reason: `Quản trị viên chuyển đổi chế độ hoạt động AI sang [${mode.toUpperCase()}]`
    });

    return apiResponse(res, 200, true, `Đã chuyển đổi AI Mode sang: ${mode.toUpperCase()}`, {
        currentMode: mode
    });
});

/**
 * POST /api/cases/:id/review (REVIEWER, ADMIN ONLY)
 */
router.post('/cases/:id/review', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
    const { action, reason } = req.body || {};

    if (!action || !['APPROVE', 'REJECT', 'REQUIRE_SUPPLEMENT', 'REQUEST_INFO', 'OVERRIDE'].includes(action)) {
        return apiResponse(res, 400, false, 'Hành động không hợp lệ. Chọn: APPROVE, REJECT, REQUIRE_SUPPLEMENT.');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
        return apiResponse(res, 400, false, 'Vui lòng nhập lý do / yêu cầu bổ sung cụ thể (tối thiểu 5 ký tự).', null, 'REASON_REQUIRED');
    }

    const targetCase = await dbService.getCaseById(req.params.id);
    if (!targetCase) {
        return apiResponse(res, 404, false, 'Không tìm thấy hồ sơ yêu cầu.', null, 'NOT_FOUND');
    }

    let nextStatus = 'UNDER_REVIEW';
    let actionLabel = '';

    if (action === 'APPROVE') {
        nextStatus = 'APPROVED';
        actionLabel = 'CHẤP THUẬN (APPROVED)';
    } else if (action === 'REJECT') {
        nextStatus = 'REJECTED';
        actionLabel = 'TỪ CHỐI (REJECTED)';
    } else if (action === 'REQUIRE_SUPPLEMENT' || action === 'REQUEST_INFO') {
        nextStatus = 'REQUIRES_SUPPLEMENT';
        actionLabel = 'YÊU CẦU BỔ SUNG HỒ SƠ ĐỂ DUYỆT LẠI';
    } else if (action === 'OVERRIDE') {
        nextStatus = targetCase.status === 'APPROVED' ? 'REJECTED' : 'APPROVED';
        actionLabel = `GHI ĐÈ PHÁN QUYẾT (${nextStatus})`;
    }

    const reviewerUser = await dbService.getUserById(req.user.id);
    const reviewerInfo = {
        action,
        decision: actionLabel,
        reason: reason.trim(),
        reviewerId: req.user.id,
        reviewerUsername: req.user.username,
        reviewerName: req.user.fullName || reviewerUser?.fullName || req.user.username,
        reviewerRole: req.user.role,
        reviewerDepartment: req.user.department || reviewerUser?.department || 'Ban Thẩm Định & Xét Duyệt Học Bổng',
        reviewerAvatar: req.user.avatar || reviewerUser?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
        reviewedAt: new Date().toISOString()
    };

    const updated = await dbService.updateCaseStatus(
        targetCase.id, 
        nextStatus, 
        req.user, 
        `Cán bộ thẩm định ${reviewerInfo.reviewerName} (${reviewerInfo.reviewerRole}) đã [${actionLabel}]. Chi tiết: "${reason.trim()}"`,
        { reviewResult: reviewerInfo }
    );

    return apiResponse(res, 200, true, `Đã cập nhật trạng thái hồ sơ #${targetCase.id}: ${actionLabel}`, {
        case: updated
    });
});

/**
 * POST /api/cases/:id/supplement (Bảo vệ quyền sở hữu hồ sơ)
 */
router.post('/cases/:id/supplement', verifyToken, requireRole('STUDENT', 'ADMIN'), async (req, res) => {
    const { additionalDescription, newEvidenceFiles } = req.body || {};

    const targetCase = await dbService.getCaseById(req.params.id);
    if (!targetCase) {
        return apiResponse(res, 404, false, 'Không tìm thấy hồ sơ.', null, 'NOT_FOUND');
    }

    if (req.user.role === 'STUDENT' && targetCase.studentId !== req.user.id) {
        return apiResponse(res, 403, false, 'Bạn không sở hữu hồ sơ này.', null, 'FORBIDDEN');
    }

    let mergedEvidence = targetCase.evidenceFiles || [];
    if (newEvidenceFiles && Array.isArray(newEvidenceFiles) && newEvidenceFiles.length > 0) {
        mergedEvidence = [...mergedEvidence, ...newEvidenceFiles];
    }

    const supplementHistory = targetCase.supplementHistory || [];
    supplementHistory.push({
        submittedAt: new Date().toISOString(),
        note: additionalDescription || 'Đã nộp bổ sung minh chứng theo yêu cầu.',
        addedFilesCount: newEvidenceFiles ? newEvidenceFiles.length : 0
    });

    const updated = await dbService.updateCaseStatus(
        targetCase.id,
        'RESUBMITTED',
        req.user,
        `Sinh viên ${req.user.fullName || req.user.username} đã nộp bổ sung hồ sơ và gửi duyệt lại. Ghi chú: "${additionalDescription || 'Đã bổ sung minh chứng'}"`,
        { evidenceFiles: mergedEvidence, supplementHistory }
    );

    return apiResponse(res, 200, true, `Đã gửi bổ sung hồ sơ #${targetCase.id} để thẩm định lại!`, {
        case: updated
    });
});

/**
 * GET /api/rules/escalation-reasons
 */
router.get('/rules/escalation-reasons', (req, res) => {
    return apiResponse(res, 200, true, 'Danh mục lý do leo thang nghiệp vụ', {
        escalationReasons: ESCALATION_CONFIG
    });
});

/**
 * POST /api/cases/:id/evaluate-rules (REVIEWER, ADMIN ONLY)
 */
router.post('/cases/:id/evaluate-rules', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
    const targetCase = await dbService.getCaseById(req.params.id);
    if (!targetCase) {
        return apiResponse(res, 404, false, 'Không tìm thấy hồ sơ.', null, 'NOT_FOUND');
    }

    const studentUser = await dbService.getUserById(targetCase.studentId) || {
        id: targetCase.studentId,
        fullName: targetCase.studentName,
        studentCode: targetCase.studentCode
    };

    const firstEvidenceOcr = targetCase.evidenceFiles?.[0]?.ocrData || targetCase.aiExtraction;
    const ruleEvaluation = evaluateCase(targetCase, firstEvidenceOcr, studentUser || {});

    return apiResponse(res, 200, true, 'Đã thẩm định hồ sơ qua Rule Engine', {
        evaluation: ruleEvaluation
    });
});

/**
 * POST /api/cases (NỘP HỒ SƠ & BẢO VỆ CHẶT CHẼ QUYỀN TỰ ĐỘNG DUYỆT)
 */
router.post('/cases', verifyToken, async (req, res) => {
    const { title, category, priority, description, evidenceFiles, ocrData } = req.body || {};

    if (!title || typeof title !== 'string' || title.trim().length < 5) {
        return apiResponse(res, 400, false, 'Tiêu đề hồ sơ phải có ít nhất 5 ký tự.', null, 'VALIDATION_ERROR');
    }

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
        return apiResponse(res, 400, false, 'Nội dung mô tả hồ sơ phải có ít nhất 10 ký tự.', null, 'VALIDATION_ERROR');
    }

    const validCategories = ['TUITION_DISCOUNT', 'COMMUNITY_SERVICE', 'GRADE_APPEAL', 'SCHOLARSHIP', 'GENERAL'];
    const chosenCategory = validCategories.includes(category) ? category : 'GENERAL';
    const chosenPriority = priority || 'MEDIUM';

    try {
        // 1. Trích xuất thông tin AI
        const aiExtractionResult = await aiService.extractCaseData({
            title: title.trim(),
            category: chosenCategory,
            description: description.trim()
        }, req.user);

        // 2. Kiểm tra minh chứng thực tế trên server
        const requestedFiles = Array.isArray(evidenceFiles) ? evidenceFiles : [];
        const { UPLOAD_DIR } = require('../../shared/uploadService');
        const fs = require('fs');
        const path = require('path');
        const attachedFiles = [];
        let verifiedServerOcr = null;

        for (const requestedFile of requestedFiles) {
            const fileName = path.basename(String(requestedFile?.fileName || ''));
            const record = fileName ? await dbService.getEvidenceUpload(fileName, req.user.id) : null;
            const fileExists = fileName && fs.existsSync(path.join(UPLOAD_DIR, fileName));

            if (record && fileExists) {
                if (!record.ocrData) {
                    try {
                        const storedBuffer = fs.readFileSync(path.join(UPLOAD_DIR, fileName));
                        const ocrResult = await extractDocumentEntities(storedBuffer, fileName, req.user);
                        record.ocrData = ocrResult.data;
                        record.ocrProvider = ocrResult.provider;
                        record.ocrIsLive = Boolean(
                            ocrResult.provider?.includes('Google Gemini Multimodal Vision') &&
                            ocrResult.provider?.includes('Live')
                        );
                        await dbService.saveEvidenceUpload({
                            fileName,
                            ownerId: req.user.id,
                            metadata: record.metadata,
                            ocrData: record.ocrData,
                            ocrProvider: record.ocrProvider,
                            ocrIsLive: record.ocrIsLive
                        });
                    } catch {}
                }

                if (!verifiedServerOcr && record.ocrData) {
                    verifiedServerOcr = record.ocrData;
                }

                attachedFiles.push({
                    fileName,
                    fileUrl: `/api/evidence/${fileName}`,
                    metadata: record.metadata,
                    ocrData: record.ocrData,
                    ocrProvider: record.ocrProvider,
                    ocrIsLive: record.ocrIsLive
                });
            } else {
                attachedFiles.push({
                    fileName: fileName || 'evidence.webp',
                    fileUrl: requestedFile?.fileUrl || `/api/evidence/${fileName || 'evidence.webp'}`,
                    ocrData: null
                });
            }
        }

        const effectiveOcr = verifiedServerOcr || null;

        const rawCasePayload = {
            title: title.trim(),
            category: chosenCategory,
            priority: chosenPriority,
            description: description.trim(),
            evidenceFiles: attachedFiles,
            aiExtraction: aiExtractionResult.data
        };

        const ruleVerdict = evaluateCase(rawCasePayload, effectiveOcr, req.user);

        // Auto-approve is intentionally disabled until OCR confidence is independently calibrated.
        // Keep all submissions in the reviewer queue, including cases the rule engine would pass.
        const initialStatus = 'UNDER_REVIEW';
        const reviewResult = null;
        const reasonCode = ruleVerdict.decision === 'AUTO_APPROVE'
            ? 'FACT_UNKNOWN'
            : (ruleVerdict.escalationReason || 'AUTHORITY_REQUIRED');
        const escalationObj = {
            reason: reasonCode,
            title: ESCALATION_CONFIG[reasonCode]?.label || 'Cần cán bộ xem xét trực tiếp',
            config: ESCALATION_CONFIG[reasonCode],
            ruleMatched: ruleVerdict.ruleMatched || 'RULE_ESCALATE_DEFAULT',
            explanation: ruleVerdict.decision === 'AUTO_APPROVE'
                ? 'Rule Engine đề xuất tự động duyệt nhưng chức năng này đang tắt cho tới khi độ tin cậy OCR được hiệu chuẩn độc lập. Cán bộ cần kiểm tra hồ sơ.'
                : ruleVerdict.explanation,
            discrepancies: ruleVerdict.discrepancies || [],
            confidence: ruleVerdict.confidence || 0.0,
            tamperRisk: ruleVerdict.tamperRisk || 'LOW',
            evaluatedAt: ruleVerdict.evaluatedAt || new Date().toISOString(),
            suggestedAction: ruleVerdict.suggestedAction || 'Cán bộ kiểm tra hồ sơ và minh chứng gốc'
        };

        const newCase = await dbService.createCase({
            title: title.trim(),
            category: chosenCategory,
            priority: chosenPriority,
            description: description.trim(),
            status: initialStatus,
            reviewResult: reviewResult,
            escalation: escalationObj,
            ruleEngine: ruleVerdict,
            evidenceFiles: attachedFiles,
            aiExtraction: {
                ...aiExtractionResult.data,
                modeUsed: aiExtractionResult.modeUsed,
                fallbackOccurred: aiExtractionResult.fallbackOccurred
            }
        }, req.user);

        const responseMsg = initialStatus === 'APPROVED'
            ? `Tạo hồ sơ #${newCase.id} thành công! [TỰ ĐỘNG DUYỆT BỞI RULE ENGINE]`
            : `Tạo hồ sơ #${newCase.id} thành công! [ĐÃ LEO THANG LÊN CÁN BỘ: ${escalationObj?.title || 'Chờ thẩm định'}]`;

        return apiResponse(res, 201, true, responseMsg, {
            case: newCase,
            ruleEvaluation: ruleVerdict,
            aiFallbackNotice: aiExtractionResult.fallbackOccurred ? `Đã kích hoạt AI Fallback: ${aiExtractionResult.modeUsed}` : null
        });
    } catch (err) {
        console.error('Lỗi khi tạo case:', err);
        return apiResponse(res, 500, false, 'Lỗi máy chủ khi lưu hồ sơ.', null, err.message);
    }
});

/**
 * GET /api/cases/my-cases (CHỈ LẤY HỒ SƠ CỦA SINH VIÊN ĐANG ĐĂNG NHẬP)
 */
router.get('/cases/my-cases', verifyToken, async (req, res) => {
    const myCases = await dbService.getCases({ studentId: req.user.id });
    return apiResponse(res, 200, true, 'Lấy danh sách hồ sơ thành công.', {
        total: myCases.length,
        cases: myCases
    });
});

/**
 * GET /api/cases (BẢO VỆ PHÂN QUYỀN: SINH VIÊN CHỈ XEM HỒ SƠ CỦA CHÍNH MÌNH)
 */
router.get('/cases', verifyToken, async (req, res) => {
    const { status, studentId, category, department } = req.query;
    const filter = {};

    if (req.user.role === 'STUDENT') {
        // Sinh viên BẮT BUỘC chỉ được xem hồ sơ của chính mình
        filter.studentId = req.user.id;
    } else {
        // Reviewer / Admin có thể xem toàn bộ hoặc lọc theo studentId cụ thể
        if (studentId) filter.studentId = studentId;
    }

    if (status && status !== 'ALL') filter.status = status;
    if (category && category !== 'ALL') filter.category = category;
    if (department && department !== 'ALL') filter.department = department;

    const cases = await dbService.getCases(filter);
    return apiResponse(res, 200, true, 'Lấy danh sách hồ sơ thành công.', {
        total: cases.length,
        cases
    });
});

/**
 * GET /api/cases/:id (BẢO VỆ PHÂN QUYỀN IDOR)
 */
router.get('/cases/:id', verifyToken, async (req, res) => {
    const targetCase = await dbService.getCaseById(req.params.id);

    if (!targetCase) {
        return apiResponse(res, 404, false, 'Không tìm thấy hồ sơ yêu cầu.', null, 'NOT_FOUND');
    }

    // Kiểm tra quyền sở hữu đối với Sinh viên
    if (req.user.role === 'STUDENT' && targetCase.studentId !== req.user.id) {
        return apiResponse(res, 403, false, 'Bạn không có quyền xem thông tin hồ sơ của sinh viên khác.', null, 'FORBIDDEN');
    }

    return apiResponse(res, 200, true, 'Lấy chi tiết hồ sơ thành công.', {
        case: targetCase
    });
});

/**
 * GET /api/notifications
 */
router.get('/notifications', verifyToken, async (req, res) => {
    const list = await dbService.getNotifications(req.user.id);
    const unreadCount = list.filter(n => !n.isRead).length;
    return apiResponse(res, 200, true, 'Lấy danh sách thông báo thành công.', {
        notifications: list,
        unreadCount
    });
});

/**
 * POST /api/notifications/:id/read
 */
router.post('/notifications/:id/read', verifyToken, async (req, res) => {
    const success = await dbService.markNotificationAsRead(req.params.id, req.user.id);
    return apiResponse(res, 200, true, success ? 'Đã đánh dấu đã đọc.' : 'Không tìm thấy thông báo.');
});

/**
 * POST /api/notifications/read-all
 */
router.post('/notifications/read-all', verifyToken, async (req, res) => {
    await dbService.markAllNotificationsAsRead(req.user.id);
    return apiResponse(res, 200, true, 'Đã đánh dấu tất cả thông báo là đã đọc.');
});

/**
 * GET /api/cases/:id/comments (BẢO VỆ QUYỀN TRUY CẬP IDOR)
 */
router.get('/cases/:id/comments', verifyToken, async (req, res) => {
    const targetCase = await dbService.getCaseById(req.params.id);
    if (!targetCase) {
        return apiResponse(res, 404, false, 'Không tìm thấy hồ sơ.', null, 'NOT_FOUND');
    }

    if (req.user.role === 'STUDENT' && targetCase.studentId !== req.user.id) {
        return apiResponse(res, 403, false, 'Bạn không có quyền xem thảo luận của hồ sơ này.', null, 'FORBIDDEN');
    }

    const comments = await dbService.getComments(req.params.id);
    return apiResponse(res, 200, true, 'Lấy danh sách bình luận thành công.', {
        comments
    });
});

/**
 * POST /api/cases/:id/comments (BẢO VỆ QUYỀN TRUY CẬP IDOR)
 */
router.post('/cases/:id/comments', verifyToken, async (req, res) => {
    const { content } = req.body;
    if (!content || !content.trim()) {
        return apiResponse(res, 400, false, 'Nội dung bình luận không được để trống.');
    }

    const targetCase = await dbService.getCaseById(req.params.id);
    if (!targetCase) {
        return apiResponse(res, 404, false, 'Không tìm thấy hồ sơ để bình luận.', null, 'NOT_FOUND');
    }

    if (req.user.role === 'STUDENT' && targetCase.studentId !== req.user.id) {
        return apiResponse(res, 403, false, 'Bạn không có quyền bình luận trên hồ sơ của sinh viên khác.', null, 'FORBIDDEN');
    }

    const comment = await dbService.addComment({
        caseId: req.params.id,
        author: req.user,
        content: content.trim()
    });

    return apiResponse(res, 201, true, 'Gửi bình luận thành công!', {
        comment
    });
});

/**
 * GET /api/cases/verify/:id (PUBLIC)
 */
router.get('/cases/verify/:id', async (req, res) => {
    const verifyData = await dbService.getCaseForVerification(req.params.id);
    if (!verifyData) {
        return apiResponse(res, 404, false, 'Không tìm thấy thông tin xác thực cho mã hồ sơ này.', null, 'NOT_FOUND');
    }
    return apiResponse(
        res,
        200,
        true,
        verifyData.verified ? 'Chứng nhận và chữ ký số hợp lệ.' : 'Không xác thực được chứng nhận.',
        verifyData
    );
});

/**
 * POST /api/cases/:id/re-route (REVIEWER, ADMIN ONLY)
 */
router.post('/cases/:id/re-route', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
    const { department, reason } = req.body;
    if (!department) {
        return apiResponse(res, 400, false, 'Vui lòng chọn phòng ban tiếp nhận.');
    }

    const updated = await dbService.updateCaseStatus(
        req.params.id,
        'UNDER_REVIEW',
        req.user,
        reason || `Điều phối hồ sơ sang: ${department}`,
        { assignedDepartment: department }
    );

    if (!updated) {
        return apiResponse(res, 404, false, 'Không tìm thấy hồ sơ để điều phối.');
    }

    return apiResponse(res, 200, true, `Đã điều phối hồ sơ thành công sang ${department}!`, {
        case: updated
    });
});

/**
 * GET /api/ai/status
 */
router.get('/ai/status', verifyToken, requireRole('ADMIN'), (req, res) => {
    const hasKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10);
    return apiResponse(res, 200, true, 'Trạng thái động cơ AI', {
        mode: aiService.getAiMode(),
        hasGeminiKey: hasKey,
        provider: hasKey ? 'Google Gemini 2.5 Flash / 1.5 Flash Vision (Live API)' : 'Intelligent Academic Semantic VLM Engine (Offline Fallback)'
    });
});

module.exports = router;
