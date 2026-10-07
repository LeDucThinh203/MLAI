const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Load environment variables (.env at root and backend)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

// Import database & readiness
const { dbReady } = require('../../shared/database');
const dbService = require('../../shared/db');
const { UPLOAD_DIR } = require('../../shared/uploadService');

// Import routes & middlewares
const { router: authRouter, verifyToken } = require('./auth');
const caseRouter = require('../../Part2_Case_Submission/backend/case');
const auditRouter = require('../../Part3_Audit_Trail/backend/audit');

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token']
}));
app.use(express.json());

// Request logger middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Endpoint phục vụ Avatar an toàn
app.get('/api/avatar/:filename', (req, res) => {
    const sanitizedFilename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, sanitizedFilename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy ảnh đại diện.' });
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
});

// Endpoint phục vụ Minh Chứng An Toàn (Kiểm tra quyền sở hữu hoặc Vai trò Cán bộ)
app.get('/api/evidence/:filename', verifyToken, async (req, res) => {
    const sanitizedFilename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, sanitizedFilename);

    if (!['STUDENT', 'REVIEWER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Vai trò này không được phép truy cập minh chứng.' });
    }

    // Sinh viên phải sở hữu tệp và tệp phải được đính kèm vào hồ sơ của mình.
    if (req.user.role === 'STUDENT') {
        const ownedUpload = await dbService.getEvidenceUpload(sanitizedFilename, req.user.id);
        const studentCases = await dbService.getCases({ studentId: req.user.id });
        const attachedToOwnedCase = studentCases.some(c =>
            (c.evidenceFiles || []).some(f => f.fileName === sanitizedFilename || (f.fileUrl && f.fileUrl.includes(sanitizedFilename)))
        );

        if (!ownedUpload || !attachedToOwnedCase) {
            await dbService.logAudit({
                action: 'UNAUTHORIZED_FILE_ACCESS_ATTEMPT',
                actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName },
                input: { requestedFile: sanitizedFilename },
                result: 'BLOCKED',
                reason: `Sinh viên ${req.user.username} cố gắng truy cập trái phép tệp minh chứng ${sanitizedFilename}`
            });
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập tệp minh chứng này.' });
        }
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy tệp minh chứng.' });
    }

    const ext = path.extname(sanitizedFilename).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf' : 'image/webp';
    res.setHeader('Content-Type', mime);
    return res.sendFile(filePath);
});

// Chuyển tiếp tương thích cho các đường dẫn cũ /uploads/:filename có kèm token
app.get('/uploads/:filename', (req, res) => {
    const sanitized = path.basename(req.params.filename);
    if (sanitized.startsWith('avatar-')) {
        return res.redirect(`/api/avatar/${sanitized}`);
    }
    const tokenQuery = req.query.token ? `?token=${encodeURIComponent(req.query.token)}` : '';
    return res.redirect(`/api/evidence/${sanitized}${tokenQuery}`);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'CaseFlow AI Unified Core Services',
        modules: {
            auth: 'ONLINE (JWT + Bcrypt + Role + RateLimit)',
            cases: 'ONLINE (Submission & Single-Source SQLite)',
            upload: 'ONLINE (Magic Bytes & Secure RBAC Evidence)',
            ai: 'ONLINE (AI Fallback live/mock/cache - Live Guard Active)',
            audit: 'ONLINE (Audit Trail & RBAC Filter)'
        },
        timestamp: new Date().toISOString(),
        version: '3.0.0'
    });
});

// Mount các Module chức năng
app.use('/api', authRouter);
app.use('/api', caseRouter);
app.use('/api', auditRouter);

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        statusCode: 404,
        message: `Endpoint ${req.method} ${req.originalUrl} không tồn tại trên hệ thống.`,
        error: 'NOT_FOUND'
    });
});

// Start Server chỉ sau khi SQLite Database đã khởi tạo & migrate thành công
dbReady.then(() => {
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║             🚀 CASEFLOW AI - ENTERPRISE HARDENED ENGINE 3.0              ║
╠══════════════════════════════════════════════════════════════════════════╣
║  • Status: ONLINE & SQLite Single Source of Truth Verified               ║
║  • Port: ${PORT}                                                            ║
║  • Modules Active:                                                       ║
║     [1] JWT Auth + Bcrypt Password + No-Backdoor 2FA                     ║
║     [2] Case Submission + IDOR Access Control                            ║
║     [3] Secure Evidence Storage + Magic Bytes Check                      ║
║     [4] Live OCR Guard & Rule Engine Safety                              ║
║     [5] Audit Trail with Student Privacy Isolation                       ║
║  • Base URL: http://localhost:${PORT}/api                                   ║
╚══════════════════════════════════════════════════════════════════════════╝
`);
    });
}).catch(err => {
    console.error('Fatal Database Initialization Failure:', err);
    process.exit(1);
});
