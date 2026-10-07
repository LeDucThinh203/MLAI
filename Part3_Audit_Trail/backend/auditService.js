/**
 * ============================================================================
 * CASEFLOW AI - ENTERPRISE AUDIT TRAIL SERVICE (PART 3 BACKEND)
 * ============================================================================
 * @module auditService
 * @description Dịch vụ ghi nhận và truy xuất nhật ký kiểm toán hệ thống (Audit Trail).
 * Tích hợp chặt chẽ với cơ sở dữ liệu SQLite quan hệ (shared/db.js), ghi nhận
 * đầy đủ mọi thao tác đăng nhập, nộp hồ sơ, xử lý AI OCR, phê duyệt và ký số.
 * ============================================================================
 */

const dbService = require('../../shared/db');

/**
 * Ghi nhận một sự kiện kiểm toán mới vào hệ thống.
 * @async
 * @param {Object} params - Thông tin sự kiện kiểm toán
 * @param {string} params.action - Mã hành động (vd: AUTH_LOGIN, CASE_SUBMITTED, CASE_APPROVED)
 * @param {Object} [params.actor] - Thông tin người thực hiện { id, username, role, name }
 * @param {string} [params.caseId] - Mã hồ sơ liên quan (nếu có)
 * @param {Object} [params.input] - Dữ liệu đầu vào hoặc ngữ cảnh IP/User-Agent
 * @param {('SUCCESS'|'FAILED'|'REJECTED')} [params.result='SUCCESS'] - Kết quả thực thi
 * @param {string} [params.reason=''] - Lý giải nghiệp vụ / ghi chú chi tiết
 * @returns {Promise<Object>} Bản ghi audit đã được lưu trữ
 */
const logAudit = async ({ action, actor, caseId = null, input = {}, result = 'SUCCESS', reason = '' }) => {
    try {
        return await dbService.logAudit({
            action,
            actor,
            caseId,
            input,
            result,
            reason
        });
    } catch (err) {
        console.error('[AuditService] Ghi nhận Audit Log thất bại:', err.message);
        return null;
    }
};

/**
 * Truy xuất danh sách Audit Logs với bộ lọc linh hoạt.
 * @async
 * @param {Object} filter - Điều kiện lọc
 * @param {string} [filter.action] - Lọc theo mã hành động
 * @param {string} [filter.caseId] - Lọc theo mã hồ sơ
 * @param {string} [filter.actorRole] - Lọc theo vai trò người thực hiện
 * @param {string} [filter.date] - Lọc theo ngày (YYYY-MM-DD)
 * @param {Object} [filter.studentVisibleFor] - Bộ lọc bảo vệ quyền riêng tư sinh viên
 * @returns {Promise<Array<Object>>} Danh sách bản ghi audit đã định dạng
 */
const getAudits = async (filter = {}) => {
    try {
        return await dbService.getAudits(filter);
    } catch (err) {
        console.error('[AuditService] Lấy danh sách Audit Log thất bại:', err.message);
        return [];
    }
};

module.exports = {
    logAudit,
    getAudits
};
