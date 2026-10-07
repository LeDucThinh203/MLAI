/**
 * ============================================================================
 * CASEFLOW AI - UNIFIED BACKEND ENTRY: AUTHENTICATION MODULE (PART 1)
 * ============================================================================
 * @module auth
 * @description Toàn bộ mã nguồn logic của Phân hệ 1 (Part 1 - Auth, JWT, Bcrypt, 2FA)
 * đã được hợp nhất vào máy chủ duy nhất tại: Part1_JWT_Auth/backend/server.js.
 * Tệp này xuất khẩu router và middleware từ server.js nhằm đảm bảo tính tương thích.
 * ============================================================================
 */

const {
    authRouter,
    verifyToken,
    requireRole,
    apiResponse,
    JWT_SECRET,
    REFRESH_SECRET
} = require('./server');

module.exports = {
    router: authRouter,
    authRouter,
    verifyToken,
    requireRole,
    apiResponse,
    JWT_SECRET,
    REFRESH_SECRET
};
