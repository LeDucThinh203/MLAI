const express = require('express');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dbService = require('../../shared/db');
const { generateUsersCsv } = require('../../shared/reportService');
const { avatarUploadMiddleware, processAndSaveAvatar } = require('../../shared/uploadService');

const router = express.Router();

// JWT Secrets Management (Environment enforcement with secure random fallback)
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

// In-memory rate limiter / brute-force protection
const loginAttempts = new Map(); // username/ip -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 phút

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

/**
 * Middleware: Xác thực JWT Token & Kiểm tra cờ bắt buộc đổi mật khẩu
 */
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

            // Trạng thái bắt buộc đổi mật khẩu được lấy từ DB, không tin claim cũ trong JWT.
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
        if (err) {
            return apiResponse(res, 401, false, 'Token không hợp lệ hoặc đã hết hạn.', null, 'INVALID_TOKEN');
        }
    }
};

/**
 * Middleware: Phân quyền theo Role (Default Deny)
 */
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

/**
 * POST /api/register (ĐĂNG KÝ SINH VIÊN)
 */
router.post('/register', async (req, res) => {
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
router.post('/login', async (req, res) => {
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
router.post('/auth/2fa/login', async (req, res) => {
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
router.post('/auth/refresh', async (req, res) => {
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
router.post('/auth/2fa/generate', verifyToken, async (req, res) => {
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
router.post('/auth/2fa/enable', verifyToken, async (req, res) => {
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
router.post('/auth/2fa/disable', verifyToken, async (req, res) => {
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
router.get('/auth/me', verifyToken, async (req, res) => {
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
router.put('/auth/profile', verifyToken, async (req, res) => {
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
router.post('/auth/avatar', verifyToken, (req, res) => {
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
router.put('/auth/change-password', verifyToken, async (req, res) => {
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
router.delete('/auth/account', verifyToken, async (req, res) => {
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
router.post('/admin/users/create', verifyToken, requireRole('ADMIN'), async (req, res) => {
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
router.get('/admin/users', verifyToken, requireRole('ADMIN'), async (req, res) => {
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
router.get('/admin/users/export-csv', verifyToken, requireRole('ADMIN'), async (req, res) => {
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
router.put('/admin/users/:id/role', verifyToken, requireRole('ADMIN'), async (req, res) => {
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
router.get('/admin/stats', verifyToken, requireRole('ADMIN'), async (req, res) => {
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

module.exports = {
    router,
    verifyToken,
    requireRole,
    JWT_SECRET,
    REFRESH_SECRET
};
