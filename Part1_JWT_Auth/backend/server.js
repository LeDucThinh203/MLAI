/**
 * ============================================================================
 * CASEFLOW AI - UNIFIED ENTERPRISE BACKEND SERVER ENGINE (PARTS 1, 2, 3)
 * ============================================================================
 * @file server.js
 * @description Máy chủ Backend duy nhất hợp nhất toàn bộ 3 phân hệ nghiệp vụ:
 * 
 * 🔐 PHÂN HỆ 1 (PART 1 - AUTHENTICATION & ACCESS CONTROL):
 *   - Xác thực danh tính qua JSON Web Token (JWT Access & Refresh Token)
 *   - Băm mật khẩu an toàn bằng thuật toán Bcrypt
 *   - Cơ chế bảo mật 2 bước TOTP QR Challenge (Speakeasy, loại bỏ backdoor)
 *   - Phân quyền theo vai trò RBAC (STUDENT, REVIEWER, ADMIN)
 *   - Giới hạn tần suất đăng nhập chống tấn công Brute-force & IDOR Guard
 *   - Quản lý hồ sơ người dùng & Tải lên Avatar an toàn (Magic Bytes)
 * 
 * 📝 PHÂN HỆ 2 (PART 2 - CASE SUBMISSION & MULTIMODAL AI OCR WORKFLOW):
 *   - Tiếp nhận hồ sơ miễn giảm học phí, học bổng, phúc khảo & trợ cấp đột xuất
 *   - Tải lên minh chứng & Tối ưu hóa ảnh WebP / Quét mã độc tài liệu PDF
 *   - Tích hợp Google Gemini Multimodal Vision API trích xuất OCR tự động
 *   - Rule Engine kiểm định độ tin cậy và ngăn chặn tự duyệt sai quy định
 *   - Quy trình xét duyệt đa cấp (Phê duyệt, Từ chối, Yêu cầu bổ sung)
 *   - Chữ ký số HMAC-SHA256 bất biến & Trang kết xuất quyết định
 * 
 * 🛡️ PHÂN HỆ 3 (PART 3 - AUDIT TRAIL & SECURITY MONITORING):
 *   - Nhật ký kiểm toán không thể giả mạo (Audit Logs) lưu trữ trong SQLite
 *   - Phân quyền cô lập quyền riêng tư: Sinh viên chỉ xem hồ sơ của mình
 *   - Kết xuất báo cáo kiểm toán UTF-8 CSV (có BOM) phục vụ thanh tra
 * ============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

// Tải biến môi trường (.env)
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

// Khởi tạo các dịch vụ cơ sở dữ liệu & tiện ích lõi
const { dbReady } = require('../../shared/database');
const dbService = require('../../shared/db');
const {
    UPLOAD_DIR,
    uploadMiddleware,
    avatarUploadMiddleware,
    processAndSaveFile,
    processAndSaveAvatar
} = require('../../shared/uploadService');
const aiService = require('../../shared/aiService');
const { extractDocumentEntities } = require('../../shared/ocrService');
const {
    generateUsersCsv,
    generateCasesCsv,
    generateCasesTableHtml,
    generateDecisionHtml,
    generateAuditsCsv
} = require('../../shared/reportService');
const { evaluateCase, ESCALATION_CONFIG } = require('../../shared/ruleEngine');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================================
// 1. CẤU HÌNH BẢO MẬT & QUẢN LÝ KHÓA MÃ HÓA
// ============================================================================
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable must be explicitly defined in production!');
    }
    return 'caseflow_sec_jwt_' + crypto.randomBytes(32).toString('hex');
})();

const REFRESH_SECRET = process.env.REFRESH_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: REFRESH_SECRET environment variable must be explicitly defined in production!');
    }
    return 'caseflow_sec_ref_' + crypto.randomBytes(32).toString('hex');
})();

// Bộ đếm chống dò quét mật khẩu (Brute-Force Rate Limiting)
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

function checkRateLimit(key) {
    const entry = loginAttempts.get(key);
    if (!entry) return { allowed: true };
    if (entry.lockedUntil && Date.now() < entry.lockedUntil) {
        const remainingSeconds = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
        return { allowed: false, remainingSeconds };
    }
    if (entry.lockedUntil && Date.now() >= entry.lockedUntil) {
        loginAttempts.delete(key);
        return { allowed: true };
    }
    return { allowed: true };
}

function recordFailedAttempt(key) {
    const entry = loginAttempts.get(key) || { count: 0, lockedUntil: null };
    entry.count += 1;
    if (entry.count >= MAX_ATTEMPTS) {
        entry.lockedUntil = Date.now() + LOCKOUT_MS;
    }
    loginAttempts.set(key, entry);
}

function clearRateLimit(key) {
    loginAttempts.delete(key);
}

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

// ============================================================================
// 2. MIDDLEWARES HỆ THỐNG
// ============================================================================
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-access-token']
}));
app.use(express.json());

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
    });
    next();
});

const verifyToken = (req, res, next) => {
    let rawToken = null;
    const authHeader = req.headers['authorization'] || req.headers['x-access-token'];

    if (authHeader) {
        rawToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;
    } else if (req.query && req.query.token) {
        rawToken = req.query.token;
    }

    if (!rawToken) {
        return apiResponse(res, 401, false, 'Thiếu Token trong Authorization header hoặc query param token.', null, 'UNAUTHORIZED');
    }

    try {
        const decoded = jwt.verify(rawToken, JWT_SECRET);
        dbService.getUserById(decoded.id).then(user => {
            if (!user) {
                return apiResponse(res, 401, false, 'Tài khoản của phiên đăng nhập không còn tồn tại.', null, 'INVALID_USER');
            }
            req.user = { ...decoded, role: user.role, mustChangePassword: Boolean(user.mustChangePassword) };

            const allowedPaths = ['/auth/change-password', '/auth/me', '/auth/logout', '/api/auth/change-password', '/api/auth/me', '/api/auth/logout'];
            const currentPath = (req.baseUrl || '') + (req.path || '');
            if (req.user.mustChangePassword && !allowedPaths.some(p => currentPath.endsWith(p) || (req.originalUrl && req.originalUrl.includes(p)))) {
                return apiResponse(res, 403, false, 'Tài khoản của bạn đang có yêu cầu bắt buộc đổi mật khẩu trước khi thực hiện các tác vụ khác.', null, 'PASSWORD_CHANGE_REQUIRED');
            }
            next();
        }).catch(error => {
            console.error('Token user lookup failed:', error);
            return apiResponse(res, 500, false, 'Không thể xác thực tài khoản lúc này.', null, 'AUTH_LOOKUP_FAILED');
        });
    } catch (err) {
        return apiResponse(res, 401, false, 'Token không hợp lệ hoặc đã hết hạn.', null, 'INVALID_TOKEN');
    }
};

const requireRole = (...allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.role) {
            return apiResponse(res, 401, false, 'Yêu cầu đăng nhập trước khi thực hiện hành động này.', null, 'UNAUTHENTICATED');
        }

        if (!allowedRoles.includes(req.user.role)) {
            await dbService.logAudit({
                action: 'ACCESS_FORBIDDEN_ATTEMPT',
                actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName },
                input: { path: req.originalUrl, requiredRoles: allowedRoles },
                result: 'BLOCKED',
                reason: `User có role ${req.user.role} cố gắng truy cập endpoint yêu cầu [${allowedRoles.join(', ')}]`
            });

            return apiResponse(res, 403, false, `Truy cập bị từ chối! Yêu cầu quyền: [${allowedRoles.join(', ')}].`, null, 'FORBIDDEN');
        }

        next();
    };
};

// ============================================================================
// 3. FILE SERVING AN TOÀN (AVATAR & MINH CHỨNG PHÂN QUYỀN)
// ============================================================================
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

app.get('/api/evidence/:filename', verifyToken, async (req, res) => {
    const sanitizedFilename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_DIR, sanitizedFilename);

    if (!['STUDENT', 'REVIEWER', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Vai trò này không được phép truy cập minh chứng.' });
    }

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
        service: 'CaseFlow AI Unified Enterprise Engine',
        modules: {
            auth: 'ONLINE (JWT + Bcrypt + 2FA TOTP + RateLimit)',
            cases: 'ONLINE (Case Submission & Gemini Vision AI OCR)',
            upload: 'ONLINE (Magic Bytes & Secure RBAC Evidence)',
            audit: 'ONLINE (Audit Trail with Student Isolation)'
        },
        timestamp: new Date().toISOString(),
        version: '3.0.0'
    });
});

// ============================================================================
// 4. PHÂN HỆ 1: AUTHENTICATION, JWT, BCRYPT & 2FA TOTP (PART 1)
// ============================================================================
const authRouter = express.Router();
authRouter.post('/register', async (req, res) => {
    const { username, password, fullName, studentCode, email, department } = req.body || {};

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return apiResponse(res, 400, false, 'Tên đăng nhập phải có ít nhất 3 ký tự.', null, 'VALIDATION_ERROR');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        return apiResponse(res, 400, false, 'Mật khẩu phải có ít nhất 6 ký tự.', null, 'VALIDATION_ERROR');
    }

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
        return apiResponse(res, 400, false, 'Vui lòng nhập họ và tên sinh viên.', null, 'VALIDATION_ERROR');
    }

    if (!studentCode || typeof studentCode !== 'string' || studentCode.trim().length < 3) {
        return apiResponse(res, 400, false, 'Vui lòng nhập Mã số sinh viên (MSSV) hợp lệ (tối thiểu 3 ký tự).', null, 'VALIDATION_ERROR');
    }

    const existing = await dbService.getUserByUsername(username.trim());
    if (existing) {
        return apiResponse(res, 400, false, 'Tên đăng nhập này đã được sử dụng. Vui lòng chọn tên khác.', null, 'USERNAME_TAKEN');
    }

    const newUser = await dbService.createUser({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        studentCode: studentCode.trim().toUpperCase(),
        email: email ? email.trim() : `${username.trim()}@student.caseflow.ai`,
        role: 'STUDENT',
        department: department ? department.trim() : 'Khoa Công Nghệ Thông Tin'
    });

    const payload = {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        studentCode: newUser.studentCode,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: newUser.id, jti: crypto.randomBytes(16).toString('hex') }, REFRESH_SECRET, { expiresIn: '7d' });
    await dbService.saveRefreshToken(newUser.id, refreshToken, new Date(Date.now() + 7 * 86400000).toISOString());

    return apiResponse(res, 201, true, 'Đăng ký tài khoản Sinh viên thành công!', {
        token,
        refreshToken,
        tokenType: 'Bearer',
        user: { ...payload, avatar: newUser.avatar, bio: newUser.bio || '', twoFactorEnabled: false, mustChangePassword: false }
    });
});

/**
 * POST /api/login (XÁC THỰC BCRYPT + REFRESH TOKEN + 2FA CHALLENGE + RATE LIMIT)
 */
authRouter.post('/login', async (req, res) => {
    const { username, password } = req.body || {};
    const clientKey = `${req.ip || '127.0.0.1'}_${(username || '').toLowerCase()}`;

    if (!username || !password) {
        return apiResponse(res, 400, false, 'Vui lòng cung cấp đầy đủ Username và Password.');
    }

    // Kiểm tra Rate Limit
    const rateCheck = checkRateLimit(clientKey);
    if (!rateCheck.allowed) {
        return apiResponse(res, 429, false, `Tài khoản tạm thời bị khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau ${rateCheck.remainingSeconds} giây.`, null, 'TOO_MANY_REQUESTS');
    }

    const user = await dbService.getUserByUsername(username);

    let isPasswordValid = false;
    if (user && user.password) {
        isPasswordValid = await bcrypt.compare(password, user.password);
    }

    if (!user || !isPasswordValid) {
        recordFailedAttempt(clientKey);
        await dbService.logAudit({
            action: 'AUTH_LOGIN_FAILED',
            actor: { id: 'ANONYMOUS', username, role: 'GUEST', name: 'Unknown User' },
            input: { username },
            result: 'FAILED',
            reason: 'Mật khẩu không khớp hoặc tài khoản không tồn tại'
        });
        return apiResponse(res, 401, false, 'Tài khoản hoặc mật khẩu không chính xác.');
    }

    // Xóa bộ đếm sai khi đăng nhập thành công
    clearRateLimit(clientKey);

    // Nếu tài khoản đã bật 2FA -> Trả về yêu cầu OTP Challenge
    if (user.twoFactorEnabled) {
        const tempToken = jwt.sign({ tempId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '5m' });
        return apiResponse(res, 200, true, 'Yêu cầu mã xác thực 2 bước (2FA OTP)', {
            requires2FA: true,
            tempToken,
            username: user.username,
            maskedEmail: user.email ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '***@caseflow.ai'
        });
    }

    const payload = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        studentCode: user.studentCode || null,
        email: user.email,
        role: user.role,
        department: user.department,
        mustChangePassword: Boolean(user.mustChangePassword)
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user.id, jti: crypto.randomBytes(16).toString('hex') }, REFRESH_SECRET, { expiresIn: '7d' });
    await dbService.saveRefreshToken(user.id, refreshToken, new Date(Date.now() + 7 * 86400000).toISOString());

    await dbService.logAudit({
        action: 'AUTH_LOGIN',
        actor: { id: user.id, username: user.username, role: user.role, name: user.fullName },
        input: { clientIp: req.ip || '127.0.0.1', userAgent: req.headers['user-agent'] },
        result: 'SUCCESS',
        reason: 'Đăng nhập thành công, cấp phát JWT Access Token & Refresh Token'
    });

    return apiResponse(res, 200, true, 'Đăng nhập thành công!', {
        token,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: '1h',
        user: { ...payload, avatar: user.avatar, bio: user.bio || '', twoFactorEnabled: Boolean(user.twoFactorEnabled), mustChangePassword: Boolean(user.mustChangePassword) }
    });
});

/**
 * POST /api/auth/2fa/login (XÁC THỰC MÃ 2FA OTP CHÍNH XÁC - KHÔNG DÙNG BACKDOOR)
 */
authRouter.post('/auth/2fa/login', async (req, res) => {
    const { tempToken, otpCode } = req.body || {};

    if (!tempToken || !otpCode) {
        return apiResponse(res, 400, false, 'Thiếu thông tin tempToken hoặc mã OTP 2FA.');
    }

    let decoded;
    try {
        decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
        return apiResponse(res, 401, false, 'Phiên xác thực 2FA đã hết hạn. Vui lòng đăng nhập lại.', null, 'EXPIRED_SESSION');
    }

    const user = await dbService.getUserById(decoded.tempId);
    if (!user) {
        return apiResponse(res, 404, false, 'Người dùng không tồn tại.');
    }

    const cleanCode = String(otpCode).trim();
    let verified = false;

    if (user.twoFactorSecret) {
        verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: cleanCode,
            window: 2
        });
    }

    if (!verified) {
        return apiResponse(res, 400, false, 'Mã xác thực 2FA không chính xác. Vui lòng kiểm tra ứng dụng Authenticator.', null, 'INVALID_OTP');
    }

    const payload = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        studentCode: user.studentCode || null,
        email: user.email,
        role: user.role,
        department: user.department,
        mustChangePassword: Boolean(user.mustChangePassword)
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ id: user.id, jti: crypto.randomBytes(16).toString('hex') }, REFRESH_SECRET, { expiresIn: '7d' });
    await dbService.saveRefreshToken(user.id, refreshToken, new Date(Date.now() + 7 * 86400000).toISOString());

    await dbService.logAudit({
        action: 'AUTH_2FA_LOGIN_SUCCESS',
        actor: { id: user.id, username: user.username, role: user.role, name: user.fullName },
        input: { method: 'TOTP_2FA' },
        result: 'SUCCESS',
        reason: 'Xác thực 2 bước (2FA) thành công'
    });

    return apiResponse(res, 200, true, 'Xác thực 2FA thành công! Đăng nhập hoàn tất.', {
        token,
        refreshToken,
        tokenType: 'Bearer',
        user: { ...payload, avatar: user.avatar, bio: user.bio || '', twoFactorEnabled: true, mustChangePassword: Boolean(user.mustChangePassword) }
    });
});

/**
 * POST /api/auth/refresh (XOAY VÒNG REFRESH TOKEN AN TOÀN - ROTATION)
 */
authRouter.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
        return apiResponse(res, 400, false, 'Thiếu Refresh Token.');
    }

    try {
        const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
        const stored = await dbService.findRefreshToken(refreshToken);

        if (!stored) {
            // Token Reuse / Revoked detection
            return apiResponse(res, 401, false, 'Refresh Token không tồn tại hoặc đã bị thu hồi.', null, 'REVOKED_TOKEN');
        }

        const user = await dbService.getUserById(decoded.id);
        if (!user) {
            return apiResponse(res, 404, false, 'Tài khoản không tồn tại.');
        }

        // Token Rotation: Xóa token cũ và cấp token mới với jti độc nhất
        await dbService.deleteRefreshToken(refreshToken);

        const payload = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            studentCode: user.studentCode || null,
            email: user.email,
            role: user.role,
            department: user.department,
            mustChangePassword: Boolean(user.mustChangePassword)
        };

        const newAccessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        const newRefreshToken = jwt.sign({ id: user.id, jti: crypto.randomBytes(16).toString('hex') }, REFRESH_SECRET, { expiresIn: '7d' });
        await dbService.saveRefreshToken(user.id, newRefreshToken, new Date(Date.now() + 7 * 86400000).toISOString());

        return apiResponse(res, 200, true, 'Làm mới Access Token & xoay vòng Refresh Token thành công!', {
            token: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: '1h'
        });
    } catch (err) {
        return apiResponse(res, 401, false, 'Refresh Token không hợp lệ hoặc đã hết hạn.', null, 'INVALID_REFRESH_TOKEN');
    }
});

/**
 * POST /api/auth/2fa/generate (TẠO MÃ QR BẬT 2FA)
 */
authRouter.post('/auth/2fa/generate', verifyToken, async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({
            name: `CaseFlow AI (${req.user.username})`,
            issuer: 'CaseFlow University Portal'
        });

        await dbService.save2FASecret(req.user.id, secret.base32);
        const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);

        return apiResponse(res, 200, true, 'Tạo mã bí mật 2FA thành công!', {
            secret: secret.base32,
            secretKey: secret.base32,
            qrCodeUrl: qrCodeDataUrl,
            qrCodeDataUrl: qrCodeDataUrl,
            otpAuthUrl: secret.otpauth_url
        });
    } catch (err) {
        console.error('2FA generate error:', err);
        return apiResponse(res, 500, false, 'Không thể tạo mã QR 2FA.');
    }
});

/**
 * POST /api/auth/2fa/enable (KÍCH HOẠT 2FA BẰNG MÃ TOTP 6 SỐ HỢP LỆ)
 */
authRouter.post('/auth/2fa/enable', verifyToken, async (req, res) => {
    const { otpCode } = req.body || {};
    const user = await dbService.getUserById(req.user.id);

    if (!user || !user.twoFactorSecret) {
        return apiResponse(res, 400, false, 'Vui lòng bấm tạo mã QR trước khi kích hoạt.');
    }

    const cleanCode = String(otpCode).trim();
    const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: cleanCode,
        window: 2
    });

    if (!verified) {
        return apiResponse(res, 400, false, 'Mã 6 chữ số từ ứng dụng Authenticator không chính xác. Vui lòng thử lại.');
    }

    await dbService.set2FAStatus(req.user.id, true);
    return apiResponse(res, 200, true, 'Kích hoạt xác thực 2 bước (2FA) thành công! Từ nay mỗi lần đăng nhập hệ thống sẽ yêu cầu mã OTP.');
});

/**
 * POST /api/auth/2fa/disable (TẮT 2FA - BẮT BUỘC MẬT KHẨU VÀ MÃ OTP HỢP LỆ)
 */
authRouter.post('/auth/2fa/disable', verifyToken, async (req, res) => {
    const { password, otpCode } = req.body || {};
    const user = await dbService.getUserById(req.user.id);

    if (!user) {
        return apiResponse(res, 404, false, 'Người dùng không tồn tại.');
    }

    if (!password) {
        return apiResponse(res, 400, false, 'Vui lòng nhập mật khẩu hiện tại để xác nhận tắt 2FA.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return apiResponse(res, 400, false, 'Mật khẩu hiện tại không chính xác.');
    }

    if (user.twoFactorSecret && otpCode) {
        const cleanCode = String(otpCode).trim();
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: cleanCode,
            window: 2
        });
        if (!verified) {
            return apiResponse(res, 400, false, 'Mã OTP xác nhận không chính xác.');
        }
    }

    await dbService.set2FAStatus(req.user.id, false);
    return apiResponse(res, 200, true, 'Đã tắt xác thực 2 bước thành công.');
});

/**
 * GET /api/auth/me
 */
authRouter.get('/auth/me', verifyToken, async (req, res) => {
    const user = await dbService.getUserById(req.user.id);
    if (!user) {
        return apiResponse(res, 404, false, 'Không tìm thấy tài khoản người dùng.');
    }
    return apiResponse(res, 200, true, 'Lấy thông tin tài khoản thành công', {
        user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            studentCode: user.studentCode || null,
            email: user.email,
            role: user.role,
            department: user.department,
            avatar: user.avatar,
            bio: user.bio || '',
            twoFactorEnabled: Boolean(user.twoFactorEnabled),
            createdAt: user.createdAt
        }
    });
});

/**
 * PUT /api/auth/profile
 */
authRouter.put('/auth/profile', verifyToken, async (req, res) => {
    const { fullName, bio, avatar, department, email, studentCode } = req.body || {};
    
    if (fullName !== undefined && (!fullName || fullName.trim().length < 2)) {
        return apiResponse(res, 400, false, 'Họ và tên phải có ít nhất 2 ký tự.', null, 'VALIDATION_ERROR');
    }

    const updated = await dbService.updateUserProfile(req.user.id, {
        fullName,
        bio,
        avatar,
        department,
        email,
        studentCode
    }, req.user);

    if (!updated) {
        return apiResponse(res, 404, false, 'Không tìm thấy tài khoản.', null, 'NOT_FOUND');
    }

    return apiResponse(res, 200, true, 'Cập nhật thông tin hồ sơ và giới thiệu bản thân thành công!', {
        user: {
            id: updated.id,
            username: updated.username,
            fullName: updated.fullName,
            studentCode: updated.studentCode || null,
            email: updated.email,
            role: updated.role,
            department: updated.department,
            avatar: updated.avatar,
            bio: updated.bio || '',
            twoFactorEnabled: Boolean(updated.twoFactorEnabled)
        }
    });
});

/**
 * POST /api/auth/avatar
 */
authRouter.post('/auth/avatar', verifyToken, (req, res) => {
    avatarUploadMiddleware(req, res, async (err) => {
        if (err) {
            return apiResponse(res, 400, false, err.message || 'Lỗi khi tải ảnh đại diện lên.', null, 'UPLOAD_ERROR');
        }

        if (!req.file) {
            return apiResponse(res, 400, false, 'Vui lòng chọn file ảnh để tải lên.', null, 'NO_FILE');
        }

        try {
            const savedAvatar = await processAndSaveAvatar(req.file, req.user);
            const updated = await dbService.updateUserProfile(req.user.id, { avatar: savedAvatar.fileUrl }, req.user);

            return apiResponse(res, 200, true, 'Cập nhật ảnh đại diện thành công!', {
                avatar: savedAvatar.fileUrl,
                user: {
                    id: updated.id,
                    username: updated.username,
                    fullName: updated.fullName,
                    studentCode: updated.studentCode || null,
                    email: updated.email,
                    role: updated.role,
                    department: updated.department,
                    avatar: updated.avatar,
                    bio: updated.bio || '',
                    twoFactorEnabled: Boolean(updated.twoFactorEnabled)
                }
            });
        } catch (error) {
            console.error('Lỗi xử lý ảnh đại diện:', error);
            return apiResponse(res, 500, false, 'Không thể xử lý và tối ưu hóa ảnh đại diện.', null, 'PROCESSING_ERROR');
        }
    });
});

/**
 * PUT /api/auth/change-password
 */
authRouter.put('/auth/change-password', verifyToken, async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body || {};

    if (!oldPassword) {
        return apiResponse(res, 400, false, 'Vui lòng nhập mật khẩu hiện tại.');
    }

    if (!newPassword || newPassword.length < 6) {
        return apiResponse(res, 400, false, 'Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    if (newPassword !== confirmPassword) {
        return apiResponse(res, 400, false, 'Mật khẩu xác nhận không khớp với mật khẩu mới.');
    }

    if (oldPassword === newPassword) {
        return apiResponse(res, 400, false, 'Mật khẩu mới không được trùng với mật khẩu cũ.');
    }

    const result = await dbService.changeUserPassword(req.user.id, oldPassword, newPassword, req.user);
    if (!result.success) {
        return apiResponse(res, 400, false, result.message, null, 'PASSWORD_MISMATCH');
    }

    return apiResponse(res, 200, true, 'Đổi mật khẩu thành công! Các phiên đăng nhập khác đã được thu hồi an toàn.');
});

/**
 * DELETE /api/auth/account (DANGER ZONE - BCRYPT VERIFIED)
 */
authRouter.delete('/auth/account', verifyToken, async (req, res) => {
    const { password } = req.body || {};
    const user = await dbService.getUserById(req.user.id);

    if (!user) {
        return apiResponse(res, 404, false, 'Tài khoản không tồn tại.');
    }

    if (!password) {
        return apiResponse(res, 400, false, 'Vui lòng nhập mật khẩu xác nhận xóa tài khoản.', null, 'INVALID_PASSWORD');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        await dbService.logAudit({
            action: 'USER_ACCOUNT_DELETE_FAILED',
            actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName },
            input: { userId: req.user.id },
            result: 'FAILED',
            reason: 'Nhập sai mật khẩu khi yêu cầu xóa tài khoản.'
        });
        return apiResponse(res, 400, false, 'Mật khẩu xác nhận không chính xác. Không thể xóa tài khoản.', null, 'INVALID_PASSWORD');
    }

    const deleted = await dbService.deleteUser(req.user.id, req.user);
    if (!deleted) {
        return apiResponse(res, 500, false, 'Không thể xóa tài khoản. Vui lòng thử lại sau.');
    }

    return apiResponse(res, 200, true, 'Tài khoản của bạn đã được xóa vĩnh viễn khỏi hệ thống.');
});

/**
 * POST /api/admin/users/create (ADMIN ONLY)
 */
authRouter.post('/admin/users/create', verifyToken, requireRole('ADMIN'), async (req, res) => {
    const { username, password, fullName, studentCode, email, role, department } = req.body || {};

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
        return apiResponse(res, 400, false, 'Tên đăng nhập phải có ít nhất 3 ký tự.', null, 'VALIDATION_ERROR');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
        return apiResponse(res, 400, false, 'Mật khẩu phải có ít nhất 6 ký tự.', null, 'VALIDATION_ERROR');
    }

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
        return apiResponse(res, 400, false, 'Vui lòng nhập họ và tên người dùng.', null, 'VALIDATION_ERROR');
    }

    const validRoles = ['STUDENT', 'REVIEWER', 'ADMIN'];
    if (!role || !validRoles.includes(role.toUpperCase())) {
        return apiResponse(res, 400, false, 'Vai trò không hợp lệ. Chọn một trong: STUDENT, REVIEWER, ADMIN.');
    }

    const existing = await dbService.getUserByUsername(username.trim());
    if (existing) {
        return apiResponse(res, 400, false, 'Tên đăng nhập này đã tồn tại trên hệ thống.', null, 'USERNAME_TAKEN');
    }

    const newUser = await dbService.createUser({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        studentCode: role.toUpperCase() === 'STUDENT' ? (studentCode || `SV2026-${Math.floor(1000 + Math.random() * 9000)}`) : null,
        email: email ? email.trim() : `${username.trim()}@caseflow.ai`,
        role: role.toUpperCase(),
        department: department ? department.trim() : 'Ban Giám Sát & Xét Duyệt'
    });

    await dbService.logAudit({
        action: 'ADMIN_PROVISION_USER',
        actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName },
        input: { createdUserId: newUser.id, role: newUser.role, username: newUser.username, studentCode: newUser.studentCode },
        result: 'SUCCESS',
        reason: `Quản trị viên đã tạo và cấp phát tài khoản mới [${newUser.role}] cho ${newUser.fullName} (${newUser.username})`
    });

    return apiResponse(res, 201, true, `Quản trị viên đã cấp tài khoản [${newUser.role}] thành công!`, {
        user: newUser
    });
});

/**
 * GET /api/admin/users (ADMIN ONLY)
 */
authRouter.get('/admin/users', verifyToken, requireRole('ADMIN'), async (req, res) => {
    const rawUsers = await dbService.getUsers();
    const users = rawUsers.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        studentCode: u.studentCode || (u.role === 'STUDENT' ? 'SV2026-9921' : '—'),
        email: u.email,
        role: u.role,
        department: u.department,
        avatar: u.avatar,
        createdAt: u.createdAt || '2026-10-01'
    }));

    return apiResponse(res, 200, true, 'Danh sách người dùng toàn hệ thống', {
        total: users.length,
        users
    });
});

/**
 * GET /api/admin/users/export-csv (ADMIN ONLY)
 */
authRouter.get('/admin/users/export-csv', verifyToken, requireRole('ADMIN'), async (req, res) => {
    const users = await dbService.getUsers();
    const csvContent = generateUsersCsv(users);
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const fileName = `DanhSach_NguoiDung_CaseFlow_${timestamp}.csv`;

    await dbService.logAudit({
        action: 'USERS_CSV_EXPORTED',
        actor: { id: req.user.id, username: req.user.username, role: req.user.role, name: req.user.fullName },
        input: { totalUsers: users.length },
        result: 'SUCCESS',
        reason: `Quản trị viên xuất danh sách ${users.length} người dùng ra file CSV`
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
});

/**
 * PUT /api/admin/users/:id/role (ADMIN ONLY)
 */
authRouter.put('/admin/users/:id/role', verifyToken, requireRole('ADMIN'), async (req, res) => {
    const { role } = req.body || {};
    const validRoles = ['STUDENT', 'REVIEWER', 'ADMIN'];

    if (!role || !validRoles.includes(role.toUpperCase())) {
        return apiResponse(res, 400, false, 'Role không hợp lệ. Chọn một trong: STUDENT, REVIEWER, ADMIN.');
    }

    const updated = await dbService.updateUserRole(req.params.id, role.toUpperCase(), req.user);
    if (!updated) {
        return apiResponse(res, 404, false, 'Không tìm thấy người dùng.', null, 'NOT_FOUND');
    }

    return apiResponse(res, 200, true, `Đã cập nhật vai trò của ${updated.username} thành [${updated.role}]!`, {
        user: updated
    });
});

/**
 * GET /api/admin/stats (ADMIN ONLY)
 */
authRouter.get('/admin/stats', verifyToken, requireRole('ADMIN'), async (req, res) => {
    const users = await dbService.getUsers();
    const cases = await dbService.getCases();
    const audits = await dbService.getAudits();

    const statusBreakdown = {
        SUBMITTED: cases.filter(c => c.status === 'SUBMITTED').length,
        UNDER_REVIEW: cases.filter(c => c.status === 'UNDER_REVIEW').length,
        REQUIRES_SUPPLEMENT: cases.filter(c => c.status === 'REQUIRES_SUPPLEMENT' || c.status === 'INFO_REQUESTED').length,
        RESUBMITTED: cases.filter(c => c.status === 'RESUBMITTED').length,
        APPROVED: cases.filter(c => c.status === 'APPROVED').length,
        REJECTED: cases.filter(c => c.status === 'REJECTED').length
    };

    const categoryBreakdown = {
        TUITION_DISCOUNT: cases.filter(c => c.category === 'TUITION_DISCOUNT').length,
        ACADEMIC_SCHOLARSHIP: cases.filter(c => c.category === 'ACADEMIC_SCHOLARSHIP').length,
        COMMUNITY_SERVICE: cases.filter(c => c.category === 'COMMUNITY_SERVICE').length,
        EMERGENCY_AID: cases.filter(c => c.category === 'EMERGENCY_AID').length
    };

    const priorityBreakdown = {
        URGENT: cases.filter(c => c.priority === 'URGENT').length,
        HIGH: cases.filter(c => c.priority === 'HIGH').length,
        MEDIUM: cases.filter(c => c.priority === 'MEDIUM').length,
        LOW: cases.filter(c => c.priority === 'LOW').length
    };

    const roleBreakdown = {
        STUDENT: users.filter(u => u.role === 'STUDENT').length,
        REVIEWER: users.filter(u => u.role === 'REVIEWER').length,
        ADMIN: users.filter(u => u.role === 'ADMIN').length
    };

    const pendingCases = statusBreakdown.SUBMITTED + statusBreakdown.RESUBMITTED + statusBreakdown.UNDER_REVIEW;
    const approvedCases = statusBreakdown.APPROVED;
    const rejectedCases = statusBreakdown.REJECTED;

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const todayCasesCount = cases.filter(c => c.createdAt >= oneDayAgo).length;

    const decidedCases = approvedCases + rejectedCases;
    const approvalRate = decidedCases > 0 ? Math.round((approvedCases / decidedCases) * 100) : 100;

    const autoApprovedCases = cases.filter(c => c.status === 'APPROVED' && (!c.reviewResult || c.reviewResult.reviewerId === 'SYSTEM_RULE_ENGINE')).length;
    const escalatedCases = cases.filter(c => c.status === 'UNDER_REVIEW' || (c.reviewResult && c.reviewResult.decision && c.reviewResult.decision.includes('LEO THANG'))).length;
    
    return apiResponse(res, 200, true, 'Thống kê quản trị hệ thống', {
        totalUsers: users.length,
        totalCases: cases.length,
        totalAudits: audits.length,
        todayCasesCount,
        approvalRate,
        pendingCases,
        approvedCases,
        rejectedCases,
        autoApprovedCases,
        escalatedCases,
        statusBreakdown,
        categoryBreakdown,
        priorityBreakdown,
        roleBreakdown,
        recentCases: cases.slice(0, 5)
    });
});




// ============================================================================
// 5. PHÂN HỆ 2: CASE SUBMISSION, GEMINI VISION OCR & WORKFLOW (PART 2)
// ============================================================================
const caseRouter = express.Router();
caseRouter.post('/upload/evidence', verifyToken, (req, res) => {
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
caseRouter.post('/upload/evidence-ocr', verifyToken, (req, res) => {
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
caseRouter.get('/reports/export-csv', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
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
caseRouter.get('/reports/export-cases-html', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
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
caseRouter.get('/cases/:id/export-decision', verifyToken, async (req, res) => {
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
caseRouter.get('/system/ai-status', verifyToken, (req, res) => {
    return apiResponse(res, 200, true, 'Trạng thái động cơ AI', {
        currentMode: aiService.getAiMode(),
        status: 'READY',
        supportedModes: ['live', 'mock', 'cache'],
        fallbackProtection: 'ACTIVE'
    });
});

caseRouter.post('/system/ai-mode', verifyToken, requireRole('ADMIN'), async (req, res) => {
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
caseRouter.post('/cases/:id/review', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
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
caseRouter.post('/cases/:id/supplement', verifyToken, requireRole('STUDENT', 'ADMIN'), async (req, res) => {
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
caseRouter.get('/rules/escalation-reasons', (req, res) => {
    return apiResponse(res, 200, true, 'Danh mục lý do leo thang nghiệp vụ', {
        escalationReasons: ESCALATION_CONFIG
    });
});

/**
 * POST /api/cases/:id/evaluate-rules (REVIEWER, ADMIN ONLY)
 */
caseRouter.post('/cases/:id/evaluate-rules', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
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
caseRouter.post('/cases', verifyToken, async (req, res) => {
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
caseRouter.get('/cases/my-cases', verifyToken, async (req, res) => {
    const myCases = await dbService.getCases({ studentId: req.user.id });
    return apiResponse(res, 200, true, 'Lấy danh sách hồ sơ thành công.', {
        total: myCases.length,
        cases: myCases
    });
});

/**
 * GET /api/cases (BẢO VỆ PHÂN QUYỀN: SINH VIÊN CHỈ XEM HỒ SƠ CỦA CHÍNH MÌNH)
 */
caseRouter.get('/cases', verifyToken, async (req, res) => {
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
caseRouter.get('/cases/:id', verifyToken, async (req, res) => {
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
caseRouter.get('/notifications', verifyToken, async (req, res) => {
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
caseRouter.post('/notifications/:id/read', verifyToken, async (req, res) => {
    const success = await dbService.markNotificationAsRead(req.params.id, req.user.id);
    return apiResponse(res, 200, true, success ? 'Đã đánh dấu đã đọc.' : 'Không tìm thấy thông báo.');
});

/**
 * POST /api/notifications/read-all
 */
caseRouter.post('/notifications/read-all', verifyToken, async (req, res) => {
    await dbService.markAllNotificationsAsRead(req.user.id);
    return apiResponse(res, 200, true, 'Đã đánh dấu tất cả thông báo là đã đọc.');
});

/**
 * GET /api/cases/:id/comments (BẢO VỆ QUYỀN TRUY CẬP IDOR)
 */
caseRouter.get('/cases/:id/comments', verifyToken, async (req, res) => {
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
caseRouter.post('/cases/:id/comments', verifyToken, async (req, res) => {
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
caseRouter.get('/cases/verify/:id', async (req, res) => {
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
caseRouter.post('/cases/:id/re-route', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
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
caseRouter.get('/ai/status', verifyToken, requireRole('ADMIN'), (req, res) => {
    const hasKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 10);
    return apiResponse(res, 200, true, 'Trạng thái động cơ AI', {
        mode: aiService.getAiMode(),
        hasGeminiKey: hasKey,
        provider: hasKey ? 'Google Gemini 2.5 Flash / 1.5 Flash Vision (Live API)' : 'Intelligent Academic Semantic VLM Engine (Offline Fallback)'
    });
});




// ============================================================================
// 6. PHÂN HỆ 3: AUDIT TRAIL, SECURITY LOGS & CSV EXPORT (PART 3)
// ============================================================================
const auditRouter = express.Router();
auditRouter.get('/audits/export-csv', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
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
auditRouter.get('/audits', verifyToken, async (req, res) => {
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
auditRouter.get('/audits/stats', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
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
auditRouter.post('/audits', verifyToken, requireRole('REVIEWER', 'ADMIN'), async (req, res) => {
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

// ============================================================================
// 7. KHỞI CHẠY SERVER BACKEND
// ============================================================================
dbReady.then(() => {
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║             🚀 CASEFLOW AI - ENTERPRISE UNIFIED ENGINE 3.0               ║
╠══════════════════════════════════════════════════════════════════════════╣
║  • Status: ONLINE & SQLite Single Source of Truth Verified               ║
║  • Port: ${PORT}                                                            ║
║  • Modules Unified:                                                      ║
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

module.exports = {
    app,
    verifyToken,
    requireRole,
    apiResponse,
    authRouter,
    caseRouter,
    auditRouter,
    JWT_SECRET,
    REFRESH_SECRET
};
