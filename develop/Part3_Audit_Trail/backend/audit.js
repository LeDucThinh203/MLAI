const express = require('express');
const dbService = require('../../shared/db');
const { verifyToken, requireRole } = require('../../Part1_JWT_Auth/backend/auth');
const { generateAuditsCsv } = require('../../shared/reportService');

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
 * GET /api/audits/export-csv (REVIEWER, ADMIN ONLY)
 */
router.get('/audits/export-csv', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
    const { action, caseId, actorRole, date } = req.query;
    const filter = {};
    if (action) filter.action = action;
    if (caseId) filter.caseId = caseId;
    if (actorRole) filter.actorRole = actorRole;
    if (date) filter.date = date;

    const audits = await dbService.getAudits(filter);
    const csvContent = generateAuditsCsv(audits);
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `NhatKy_AuditTrail_${date ? date + '_' : ''}${timestamp}.csv`;

    await dbService.logAudit({
        action: 'AUDIT_CSV_EXPORTED',
        actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName || req.user.username },
        input: { count: audits.length, date: date || 'ALL' },
        result: 'SUCCESS',
        reason: `Xuất danh sách ${audits.length} bản ghi Audit Trail ${date ? `ngày ${date}` : 'toàn trường'} ra file CSV`
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
});

/**
 * GET /api/audits (PHÂN QUYỀN: SINH VIÊN CHỈ XEM AUDIT CỦA CHÍNH MÌNH)
 */
router.get('/audits', verifyToken, async (req, res) => {
    const { action, caseId, actorRole, date } = req.query;
    const filter = {};

    if (req.user.role === 'STUDENT') {
        // Sinh viên xem nhật ký hoạt động cá nhân và toàn bộ tiến độ xử lý trên các hồ sơ của mình
        const studentCases = await dbService.getCases({ studentId: req.user.id });
        const caseIds = studentCases.map(c => c.id);
        filter.studentVisibleFor = { studentId: req.user.id, caseIds };
    } else {
        if (action) filter.action = action;
        if (caseId) filter.caseId = caseId;
        if (actorRole) filter.actorRole = actorRole;
    }

    if (date) filter.date = date;

    const audits = await dbService.getAudits(filter);
    return apiResponse(res, 200, true, 'Lấy danh sách nhật ký kiểm toán thành công.', {
        total: audits.length,
        filterDate: date || null,
        audits
    });
});

/**
 * GET /api/audits/stats (REVIEWER, ADMIN ONLY)
 */
router.get('/audits/stats', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
    const audits = await dbService.getAudits();
    
    const actionCounts = {};
    const actorCounts = {};

    audits.forEach(a => {
        actionCounts[a.action] = (actionCounts[a.action] || 0) + 1;
        const role = a.actor?.role || 'UNKNOWN';
        actorCounts[role] = (actorCounts[role] || 0) + 1;
    });

    return apiResponse(res, 200, true, 'Thống kê kiểm toán', {
        totalLogs: audits.length,
        byAction: actionCounts,
        byActorRole: actorCounts,
        latestLog: audits[0] || null
    });
});

/**
 * POST /api/audits (REVIEWER, ADMIN ONLY)
 */
router.post('/audits', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
    const { action, caseId, input, result, reason } = req.body || {};

    if (!action || !reason) {
        return apiResponse(res, 400, false, 'Action và Lý do (Reason) là bắt buộc khi ghi nhận audit.', null, 'VALIDATION_ERROR');
    }

    const log = await dbService.logAudit({
        action,
        caseId: caseId || null,
        input: input || {},
        result: result || 'SUCCESS',
        reason,
        actor: {
            id: req.user.id,
            username: req.user.username,
            role: req.user.role,
            name: req.user.fullName || req.user.username
        }
    });

    return apiResponse(res, 201, true, 'Ghi nhận Audit Trail thành công!', { audit: log });
});

module.exports = router;
