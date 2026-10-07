const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const sqlite = require('./database');

const DEPARTMENT_MAP = {
  TUITION_DISCOUNT: 'Phòng Kế hoạch - Tài chính',
  ACADEMIC_SCHOLARSHIP: 'Phòng Công tác Sinh viên',
  GRADE_APPEAL: 'Phòng Quản lý Đào tạo',
  COMMUNITY_SERVICE: 'Văn phòng Đoàn - Hội Sinh viên',
  GENERAL: 'Phòng Công tác Sinh viên'
};

// Helper: Lấy khóa chữ ký số HMAC-SHA256 (bắt buộc cấu hình trong môi trường Production)
function getSignatureKey() {
  const key = process.env.SIGNATURE_KEY;
  if (!key || key.trim().length < 16) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: Biến môi trường SIGNATURE_KEY chưa được cấu hình hoặc quá ngắn (tối thiểu 16 ký tự) trong môi trường Production.');
    }
    return 'caseflow_university_dev_sign_key_2026_x889';
  }
  return key.trim();
}

function parseJsonField(val, fallback = null) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function formatCaseRow(row) {
  if (!row) return null;
  const aiExt = parseJsonField(row.aiExtraction, null);
  return {
    ...row,
    priority: row.priority || 'MEDIUM',
    evidenceFiles: parseJsonField(row.evidenceFiles, []),
    reviewResult: parseJsonField(row.reviewResult, null),
    supplementHistory: parseJsonField(row.supplementHistory, null),
    aiExtraction: aiExt,
    escalation: aiExt?.escalation || null,
    ruleEngine: aiExt?.ruleEngine || null
  };
}

function formatAuditRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    action: row.action,
    caseId: row.caseId,
    actor: {
      id: row.actorId,
      name: row.actorName,
      role: row.actorRole,
      username: row.actorUsername
    },
    reason: row.reason,
    timestamp: row.timestamp
  };
}

const dbService = {
  // ================= USERS =================
  getUsers: async () => {
    const rows = await sqlite.allAsync('SELECT * FROM users ORDER BY createdAt DESC');
    return rows.map(u => ({ ...u, twoFactorEnabled: Boolean(u.twoFactorEnabled), mustChangePassword: Boolean(u.mustChangePassword) }));
  },

  getUserByUsername: async (username) => {
    if (!username) return null;
    const row = await sqlite.getAsync('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username.trim()]);
    if (!row) return null;
    return { ...row, twoFactorEnabled: Boolean(row.twoFactorEnabled), mustChangePassword: Boolean(row.mustChangePassword) };
  },

  getUserById: async (id) => {
    if (!id) return null;
    const row = await sqlite.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    if (!row) return null;
    return { ...row, twoFactorEnabled: Boolean(row.twoFactorEnabled), mustChangePassword: Boolean(row.mustChangePassword) };
  },

  createUser: async ({ username, password, fullName, email, role, department, studentCode, mustChangePassword = false }) => {
    const isStudent = (role || '').toUpperCase() === 'STUDENT';
    const id = `usr_${(role || 'usr').toLowerCase()}_${Date.now().toString().slice(-4)}_${crypto.randomBytes(2).toString('hex')}`;
    const hashedPassword = (password && (password.startsWith('$2a$') || password.startsWith('$2b$')))
      ? password
      : bcrypt.hashSync(password || 'password123', 10);

    const newUser = {
      id,
      username: username.trim(),
      password: hashedPassword,
      fullName: (fullName || username).trim(),
      studentCode: isStudent ? (studentCode ? studentCode.trim().toUpperCase() : `SV2026-${Math.floor(1000 + Math.random() * 9000)}`) : null,
      email: email ? email.trim() : `${username.trim()}@caseflow.ai`,
      role: (role || 'STUDENT').toUpperCase(),
      department: department ? department.trim() : 'Khoa Công Nghệ Thông Tin',
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`,
      bio: 'Người dùng hệ thống CaseFlow AI.',
      twoFactorEnabled: 0,
      twoFactorSecret: null,
      mustChangePassword: mustChangePassword ? 1 : 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await sqlite.runAsync(
      `INSERT INTO users (id, username, password, fullName, studentCode, email, role, department, avatar, bio, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUser.id, newUser.username, newUser.password, newUser.fullName, newUser.studentCode,
        newUser.email, newUser.role, newUser.department, newUser.avatar, newUser.bio,
        newUser.twoFactorEnabled, newUser.twoFactorSecret, newUser.mustChangePassword, newUser.createdAt, newUser.updatedAt
      ]
    );

    await dbService.logAudit({
      action: 'AUTH_REGISTER',
      actor: { id: newUser.id, username: newUser.username, role: newUser.role, name: newUser.fullName },
      input: { username: newUser.username, role: newUser.role, studentCode: newUser.studentCode, department: newUser.department },
      result: 'SUCCESS',
      reason: `Đăng ký tài khoản mới thành công với vai trò ${newUser.role}${newUser.studentCode ? ` (MSSV: ${newUser.studentCode})` : ''}`
    });

    return { ...newUser, twoFactorEnabled: false, mustChangePassword: Boolean(mustChangePassword) };
  },

  updateUserRole: async (userId, newRole, actor) => {
    const targetUser = await dbService.getUserById(userId);
    if (!targetUser) return null;

    const oldRole = targetUser.role;
    const updatedAt = new Date().toISOString();

    await sqlite.runAsync('UPDATE users SET role = ?, updatedAt = ? WHERE id = ?', [newRole, updatedAt, userId]);
    targetUser.role = newRole;
    targetUser.updatedAt = updatedAt;

    await dbService.logAudit({
      action: 'ADMIN_ROLE_UPDATED',
      actor: { id: actor.id, username: actor.username, role: actor.role, name: actor.fullName },
      input: { userId, oldRole, newRole },
      result: 'SUCCESS',
      reason: `Quản trị viên đã thay đổi quyền của tài khoản ${targetUser.username} từ ${oldRole} thành ${newRole}`
    });

    return targetUser;
  },

  updateUserProfile: async (userId, { fullName, bio, avatar, department, email, studentCode }, actor) => {
    const targetUser = await dbService.getUserById(userId);
    if (!targetUser) return null;

    const updatedFullName = fullName !== undefined && fullName.trim() ? fullName.trim() : targetUser.fullName;
    const updatedBio = bio !== undefined ? bio.trim() : (targetUser.bio || '');
    const updatedAvatar = avatar !== undefined && avatar.trim() ? avatar.trim() : targetUser.avatar;
    const updatedDept = department !== undefined && department.trim() ? department.trim() : targetUser.department;
    const updatedEmail = email !== undefined && email.trim() ? email.trim() : targetUser.email;
    const updatedStudentCode = (studentCode !== undefined && targetUser.role === 'STUDENT')
      ? studentCode.trim().toUpperCase()
      : targetUser.studentCode;
    const updatedAt = new Date().toISOString();

    await sqlite.runAsync(
      `UPDATE users SET fullName = ?, bio = ?, avatar = ?, department = ?, email = ?, studentCode = ?, updatedAt = ? WHERE id = ?`,
      [updatedFullName, updatedBio, updatedAvatar, updatedDept, updatedEmail, updatedStudentCode, updatedAt, userId]
    );

    await dbService.logAudit({
      action: 'USER_PROFILE_UPDATED',
      actor: { id: actor.id, username: actor.username, role: actor.role, name: updatedFullName },
      input: { userId, fullName: updatedFullName, email: updatedEmail, bio: updatedBio },
      result: 'SUCCESS',
      reason: `Người dùng ${targetUser.username} đã cập nhật thông tin hồ sơ cá nhân và giới thiệu bản thân.`
    });

    return await dbService.getUserById(userId);
  },

  changeUserPassword: async (userId, oldPassword, newPassword, actor) => {
    const targetUser = await dbService.getUserById(userId);
    if (!targetUser) return { success: false, message: 'Người dùng không tồn tại.' };

    const isMatch = await bcrypt.compare(oldPassword, targetUser.password);
    if (!isMatch) {
      await dbService.logAudit({
        action: 'USER_PASSWORD_CHANGE_FAILED',
        actor: { id: actor.id, username: actor.username, role: actor.role, name: actor.fullName },
        input: { userId },
        result: 'FAILED',
        reason: 'Nhập sai mật khẩu hiện tại khi thực hiện đổi mật khẩu.'
      });
      return { success: false, message: 'Mật khẩu hiện tại không chính xác. Vui lòng thử lại.' };
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return { success: false, message: 'Mật khẩu mới phải có độ dài từ 6 ký tự trở lên.' };
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    const updatedAt = new Date().toISOString();

    await sqlite.runAsync('UPDATE users SET password = ?, mustChangePassword = 0, updatedAt = ? WHERE id = ?', [hashedNewPassword, updatedAt, userId]);

    // Thu hồi toàn bộ refresh token của tài khoản khi đổi mật khẩu để bảo đảm an toàn
    await dbService.revokeAllUserRefreshTokens(userId);

    await dbService.logAudit({
      action: 'USER_PASSWORD_CHANGED',
      actor: { id: actor.id, username: actor.username, role: actor.role, name: actor.fullName },
      input: { userId },
      result: 'SUCCESS',
      reason: `Người dùng ${targetUser.username} đã thay đổi mật khẩu thành công. Các phiên đăng nhập khác đã được thu hồi an toàn.`
    });

    return { success: true, user: await dbService.getUserById(userId) };
  },

  deleteUser: async (userId, actor) => {
    const targetUser = await dbService.getUserById(userId);
    if (!targetUser) return false;

    await sqlite.runAsync('DELETE FROM users WHERE id = ?', [userId]);
    await dbService.revokeAllUserRefreshTokens(userId);

    await dbService.logAudit({
      action: 'USER_ACCOUNT_DELETED',
      actor: { id: actor.id, username: actor.username, role: actor.role, name: actor.fullName },
      input: { deletedUserId: userId, username: targetUser.username },
      result: 'SUCCESS',
      reason: `Tài khoản người dùng ${targetUser.username} (${targetUser.fullName}) đã bị xóa khỏi hệ thống.`
    });

    return true;
  },

  // ================= 2FA =================
  save2FASecret: async (userId, secret) => {
    await sqlite.runAsync('UPDATE users SET twoFactorSecret = ? WHERE id = ?', [secret, userId]);
    return await dbService.getUserById(userId);
  },

  set2FAStatus: async (userId, enabled) => {
    const targetUser = await dbService.getUserById(userId);
    if (!targetUser) return null;

    const secretValue = enabled ? targetUser.twoFactorSecret : null;
    await sqlite.runAsync('UPDATE users SET twoFactorEnabled = ?, twoFactorSecret = ? WHERE id = ?', [enabled ? 1 : 0, secretValue, userId]);

    await dbService.logAudit({
      action: enabled ? '2FA_ENABLED' : '2FA_DISABLED',
      actor: { id: targetUser.id, username: targetUser.username, role: targetUser.role, name: targetUser.fullName },
      input: { twoFactorEnabled: enabled },
      result: 'SUCCESS',
      reason: enabled ? 'Bật bảo mật xác thực 2 bước (2FA Google Authenticator) thành công' : 'Đã tắt xác thực 2 bước'
    });

    return await dbService.getUserById(userId);
  },

  // ================= REFRESH TOKENS =================
  saveRefreshToken: async (userId, token, expiresAt) => {
    const id = `rt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString();
    await sqlite.runAsync(
      `INSERT INTO refresh_tokens (id, userId, token, expiresAt, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [id, userId, token, expiresAt, createdAt]
    );
  },

  findRefreshToken: async (token) => {
    return await sqlite.getAsync('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
  },

  deleteRefreshToken: async (token) => {
    return await sqlite.runAsync('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  },

  revokeAllUserRefreshTokens: async (userId) => {
    return await sqlite.runAsync('DELETE FROM refresh_tokens WHERE userId = ?', [userId]);
  },

  // Server-owned evidence records bind uploaded files and OCR results to their uploader.
  saveEvidenceUpload: async ({ fileName, ownerId, metadata, ocrData = null, ocrProvider = null, ocrIsLive = false }) => {
    const createdAt = new Date().toISOString();
    await sqlite.runAsync(
      `INSERT INTO evidence_uploads (fileName, ownerId, metadata, ocrData, ocrProvider, ocrIsLive, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(fileName) DO UPDATE SET metadata = excluded.metadata, ocrData = excluded.ocrData,
       ocrProvider = excluded.ocrProvider, ocrIsLive = excluded.ocrIsLive
       WHERE evidence_uploads.ownerId = excluded.ownerId`,
      [fileName, ownerId, JSON.stringify(metadata || {}), ocrData ? JSON.stringify(ocrData) : null, ocrProvider, ocrIsLive ? 1 : 0, createdAt]
    );
    return dbService.getEvidenceUpload(fileName, ownerId);
  },

  getEvidenceUpload: async (fileName, ownerId) => {
    const row = await sqlite.getAsync(
      'SELECT * FROM evidence_uploads WHERE fileName = ? AND ownerId = ?',
      [fileName, ownerId]
    );
    if (!row) return null;
    return {
      ...row,
      metadata: parseJsonField(row.metadata, {}),
      ocrData: parseJsonField(row.ocrData, null),
      ocrIsLive: Boolean(row.ocrIsLive)
    };
  },

  // ================= CASES =================
  getCases: async (filter = {}) => {
    let sql = 'SELECT * FROM cases WHERE 1=1';
    const params = [];

    if (filter.studentId) {
      sql += ' AND studentId = ?';
      params.push(filter.studentId);
    }
    if (filter.status && filter.status !== 'ALL') {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.category && filter.category !== 'ALL') {
      sql += ' AND category = ?';
      params.push(filter.category);
    }
    if (filter.department && filter.department !== 'ALL') {
      sql += ' AND assignedDepartment = ?';
      params.push(filter.department);
    }

    sql += ' ORDER BY createdAt DESC';
    const rows = await sqlite.allAsync(sql, params);
    return rows.map(formatCaseRow);
  },

  getCaseById: async (id) => {
    if (!id) return null;
    const row = await sqlite.getAsync('SELECT * FROM cases WHERE id = ?', [id]);
    return formatCaseRow(row);
  },

  createCase: async (caseData, actor) => {
    const studentUser = await dbService.getUserById(actor.id);
    const studentCode = actor.studentCode || studentUser?.studentCode || 'SV2026-9921';
    const assignedDept = caseData.assignedDepartment || DEPARTMENT_MAP[caseData.category] || 'Phòng Công tác Sinh viên';
    const deadlineDate = caseData.deadline || new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    
    // Sinh ID ngẫu nhiên an toàn chống race condition khi nhiều request tạo đồng thời
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const caseId = `CASE-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${randomSuffix}`;
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;

    let digitalSignature = null;
    if (caseData.status === 'APPROVED') {
      digitalSignature = crypto
        .createHmac('sha256', getSignatureKey())
        .update(`${caseId}:${studentCode}:${actor.fullName || actor.username}:APPROVED:${createdAt}`)
        .digest('hex');
    }

    const aiPayload = {
      ...(caseData.aiExtraction || {}),
      ruleEngine: caseData.ruleEngine || null,
      escalation: caseData.escalation || null
    };

    await sqlite.runAsync(
      `INSERT INTO cases (id, studentId, studentName, studentCode, title, category, priority, assignedDepartment, deadline, digitalSignature, description, status, reviewResult, supplementHistory, aiExtraction, evidenceFiles, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseId,
        actor.id,
        actor.fullName || actor.username,
        studentCode,
        caseData.title,
        caseData.category || 'GENERAL',
        caseData.priority || 'MEDIUM',
        assignedDept,
        deadlineDate,
        digitalSignature,
        caseData.description || '',
        caseData.status || 'SUBMITTED',
        caseData.reviewResult ? JSON.stringify(caseData.reviewResult) : null,
        null,
        JSON.stringify(aiPayload),
        JSON.stringify(caseData.evidenceFiles || []),
        createdAt,
        updatedAt
      ]
    );

    const createdCase = await dbService.getCaseById(caseId);

    await dbService.logAudit({
      action: createdCase.status === 'APPROVED' ? 'CASE_AUTO_APPROVED' : (caseData.escalation ? 'CASE_ESCALATED' : 'CASE_SUBMITTED'),
      actor: { id: actor.id, username: actor.username, role: actor.role, name: actor.fullName || actor.username },
      caseId: createdCase.id,
      input: { title: createdCase.title, category: createdCase.category, priority: createdCase.priority, status: createdCase.status, escalationReason: caseData.escalation?.reason, assignedDepartment: createdCase.assignedDepartment },
      result: 'SUCCESS',
      reason: createdCase.status === 'APPROVED' 
        ? `[Rule Engine] Tự động phê duyệt hồ sơ #${createdCase.id} theo Quy chế Đào tạo` 
        : (caseData.escalation ? `[Rule Engine] Leo thang xét duyệt hồ sơ #${createdCase.id} do [${caseData.escalation.reason}]: ${caseData.escalation.explanation}` : `Sinh viên đã tạo mới hồ sơ #${createdCase.id} (Điều phối: ${createdCase.assignedDepartment})`)
    });

    // Tạo thông báo cho Reviewers / Admins
    const staffUsers = await sqlite.allAsync("SELECT id FROM users WHERE role IN ('REVIEWER', 'ADMIN')");
    for (const staff of staffUsers) {
      await dbService.createNotification({
        userId: staff.id,
        title: `Hồ sơ mới #${createdCase.id} cần thẩm định`,
        message: `Sinh viên ${createdCase.studentName} đã nộp: "${createdCase.title}" (${createdCase.assignedDepartment}).`,
        type: createdCase.priority === 'HIGH' || createdCase.priority === 'URGENT' ? 'WARNING' : 'INFO',
        caseId: createdCase.id
      });
    }

    return createdCase;
  },

  updateCaseStatus: async (caseId, status, actor, reason = '', extraFields = {}) => {
    const targetCase = await dbService.getCaseById(caseId);
    if (!targetCase) return null;

    const oldStatus = targetCase.status;
    const updatedAt = new Date().toISOString();

    const reviewResult = extraFields.reviewResult !== undefined ? extraFields.reviewResult : targetCase.reviewResult;
    const supplementHistory = extraFields.supplementHistory !== undefined ? extraFields.supplementHistory : targetCase.supplementHistory;
    const evidenceFiles = extraFields.evidenceFiles !== undefined ? extraFields.evidenceFiles : targetCase.evidenceFiles;
    const assignedDepartment = extraFields.assignedDepartment || targetCase.assignedDepartment;

    let digitalSignature = targetCase.digitalSignature;
    if (status === 'APPROVED') {
      digitalSignature = crypto
        .createHmac('sha256', getSignatureKey())
        .update(`${targetCase.id}:${targetCase.studentCode}:${targetCase.studentName}:APPROVED:${updatedAt}`)
        .digest('hex');
    }

    await sqlite.runAsync(
      `UPDATE cases SET status = ?, reviewResult = ?, supplementHistory = ?, evidenceFiles = ?, assignedDepartment = ?, digitalSignature = ?, updatedAt = ? WHERE id = ?`,
      [
        status,
        reviewResult ? JSON.stringify(reviewResult) : null,
        supplementHistory ? JSON.stringify(supplementHistory) : null,
        evidenceFiles ? JSON.stringify(evidenceFiles) : null,
        assignedDepartment || null,
        digitalSignature || null,
        updatedAt,
        caseId
      ]
    );

    const updatedCase = await dbService.getCaseById(caseId);

    await dbService.logAudit({
      action: `CASE_STATUS_${status}`,
      actor: { id: actor.id, username: actor.username, role: actor.role, name: actor.fullName || actor.username },
      caseId: targetCase.id,
      input: { previousStatus: oldStatus, newStatus: status, assignedDepartment: updatedCase.assignedDepartment },
      result: 'SUCCESS',
      reason: reason || `Cập nhật trạng thái hồ sơ từ ${oldStatus} sang ${status}`
    });

    // Gửi thông báo đến sinh viên
    if (targetCase.studentId) {
      const statusTitleMap = {
        APPROVED: '✅ Hồ sơ đã được PHÊ DUYỆT',
        REJECTED: '❌ Hồ sơ đã bị TỪ CHỐI',
        REQUIRES_SUPPLEMENT: '⚠️ Yêu cầu BỔ SUNG MINH CHỨNG',
        UNDER_REVIEW: '🔍 Hồ sơ đang được xử lý'
      };
      await dbService.createNotification({
        userId: targetCase.studentId,
        title: statusTitleMap[status] || `Cập nhật hồ sơ #${targetCase.id}`,
        message: reason ? `Ghi chú cán bộ: "${reason}"` : `Trạng thái hồ sơ của bạn hiện là ${status}.`,
        type: status === 'APPROVED' ? 'SUCCESS' : (status === 'REJECTED' ? 'ERROR' : 'WARNING'),
        caseId: targetCase.id
      });
    }

    return updatedCase;
  },

  // ================= VERIFICATION =================
  getCaseForVerification: async (caseId) => {
    const c = await dbService.getCaseById(caseId);
    if (!c) return null;
    const hasStoredSignature = typeof c.digitalSignature === 'string' && /^[a-f\d]{64}$/i.test(c.digitalSignature);
    const expectedSignature = hasStoredSignature && c.status === 'APPROVED'
      ? crypto.createHmac('sha256', getSignatureKey())
        .update(`${c.id}:${c.studentCode}:${c.studentName}:APPROVED:${c.updatedAt}`)
        .digest()
      : null;
    const storedSignature = hasStoredSignature ? Buffer.from(c.digitalSignature, 'hex') : null;
    const verified = Boolean(
      c.status === 'APPROVED' && expectedSignature && storedSignature &&
      expectedSignature.length === storedSignature.length &&
      crypto.timingSafeEqual(expectedSignature, storedSignature)
    );
    return {
      verified,
      caseId: c.id,
      studentName: c.studentName,
      studentCode: c.studentCode,
      title: c.title,
      category: c.category,
      status: c.status,
      assignedDepartment: c.assignedDepartment || DEPARTMENT_MAP[c.category] || 'Trường Đại Học',
      submittedAt: c.createdAt,
      reviewedAt: c.reviewResult?.reviewedAt || c.updatedAt,
      reviewerName: c.reviewResult?.reviewerName || 'Hội đồng Thẩm định Tự động',
      reviewerRole: c.reviewResult?.reviewerRole || 'SYSTEM_VERIFIED',
      reviewerDepartment: c.reviewResult?.reviewerDepartment || c.assignedDepartment,
      digitalSignature: hasStoredSignature ? c.digitalSignature : null,
      decisionNote: verified
        ? (c.reviewResult?.reason || 'Chữ ký quyết định được xác thực hợp lệ.')
        : 'Không xác thực được chứng nhận: hồ sơ chưa được duyệt hoặc chữ ký số không hợp lệ.'
    };
  },

  // ================= COMMENTS =================
  getComments: async (caseId) => {
    const rows = await sqlite.allAsync('SELECT * FROM comments WHERE caseId = ? ORDER BY createdAt ASC', [caseId]);
    return rows;
  },

  addComment: async ({ caseId, author, content }) => {
    const targetCase = await dbService.getCaseById(caseId);
    if (!targetCase) return null;

    const newComment = {
      id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      caseId,
      authorId: author.id,
      authorName: author.fullName || author.username,
      authorRole: author.role,
      authorAvatar: author.avatar || null,
      content: content.trim(),
      createdAt: new Date().toISOString()
    };

    await sqlite.runAsync(
      `INSERT INTO comments (id, caseId, authorId, authorName, authorRole, authorAvatar, content, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newComment.id, newComment.caseId, newComment.authorId, newComment.authorName, newComment.authorRole, newComment.authorAvatar, newComment.content, newComment.createdAt]
    );

    await dbService.logAudit({
      action: 'CASE_COMMENT_ADDED',
      actor: { id: author.id, username: author.username, role: author.role, name: newComment.authorName },
      caseId,
      input: { commentId: newComment.id, preview: content.slice(0, 50) },
      result: 'SUCCESS',
      reason: `${newComment.authorName} (${author.role}) đã bình luận trên hồ sơ #${caseId}`
    });

    if (author.role === 'STUDENT') {
      const staffUsers = await sqlite.allAsync("SELECT id FROM users WHERE role IN ('REVIEWER', 'ADMIN')");
      for (const staff of staffUsers) {
        await dbService.createNotification({
          userId: staff.id,
          title: `💬 Bình luận mới trên #${caseId}`,
          message: `Sinh viên ${newComment.authorName}: "${content.slice(0, 80)}"`,
          type: 'INFO',
          caseId
        });
      }
    } else {
      if (targetCase.studentId && targetCase.studentId !== author.id) {
        await dbService.createNotification({
          userId: targetCase.studentId,
          title: `💬 Cán bộ đã phản hồi trên hồ sơ #${caseId}`,
          message: `${newComment.authorName} (${author.role}): "${content.slice(0, 80)}"`,
          type: 'INFO',
          caseId
        });
      }
    }

    return newComment;
  },

  // ================= NOTIFICATIONS =================
  getNotifications: async (userId) => {
    const rows = await sqlite.allAsync('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC', [userId]);
    return rows;
  },

  createNotification: async ({ userId, title, message, type = 'INFO', caseId = null }) => {
    const newNotif = {
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      userId,
      title,
      message,
      type,
      caseId,
      isRead: 0,
      createdAt: new Date().toISOString()
    };

    await sqlite.runAsync(
      `INSERT INTO notifications (id, userId, title, message, type, caseId, isRead, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newNotif.id, newNotif.userId, newNotif.title, newNotif.message, newNotif.type, newNotif.caseId, 0, newNotif.createdAt]
    );

    return newNotif;
  },

  markNotificationAsRead: async (id, userId) => {
    const result = await sqlite.runAsync('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?', [id, userId]);
    return result.changes > 0;
  },

  markAllNotificationsAsRead: async (userId) => {
    await sqlite.runAsync('UPDATE notifications SET isRead = 1 WHERE userId = ?', [userId]);
    return true;
  },

  // ================= AUDITS =================
  getAudits: async (filter = {}) => {
    let sql = 'SELECT * FROM audits WHERE 1=1';
    const params = [];

    if (filter.action && filter.action !== 'ALL') {
      sql += ' AND action = ?';
      params.push(filter.action);
    }
    if (filter.caseId) {
      sql += ' AND caseId = ?';
      params.push(filter.caseId);
    }
    if (filter.actorRole && filter.actorRole !== 'ALL') {
      sql += ' AND actorRole = ?';
      params.push(filter.actorRole);
    }
    if (filter.studentVisibleFor) {
      const studentId = filter.studentVisibleFor.studentId;
      const caseIds = filter.studentVisibleFor.caseIds || [];
      if (caseIds.length > 0) {
        const placeholders = caseIds.map(() => '?').join(', ');
        sql += ` AND (actorId = ? OR caseId IN (${placeholders}))`;
        params.push(studentId, ...caseIds);
      } else {
        sql += ' AND actorId = ?';
        params.push(studentId);
      }
    } else {
      if (filter.actorId) {
        sql += ' AND actorId = ?';
        params.push(filter.actorId);
      }
    }

    if (filter.date) {
      sql += ' AND timestamp LIKE ?';
      params.push(`${filter.date}%`);
    }

    sql += ' ORDER BY timestamp DESC';
    const rows = await sqlite.allAsync(sql, params);
    return rows.map(formatAuditRow);
  },

  logAudit: async ({ action, actor, caseId = null, input = {}, result = 'SUCCESS', reason = '' }) => {
    const countRow = await sqlite.getAsync('SELECT COUNT(*) as cnt FROM audits');
    const id = `AUDIT-${String((countRow?.cnt || 0) + 1001)}`;
    const timestamp = new Date().toISOString();
    const safeActor = actor || { id: 'ANONYMOUS', username: 'guest', role: 'GUEST', name: 'Khách vãng lai' };

    await sqlite.runAsync(
      `INSERT INTO audits (id, action, caseId, actorId, actorName, actorRole, actorUsername, reason, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, action, caseId,
        safeActor.id || null, safeActor.name || null,
        safeActor.role || null, safeActor.username || null,
        reason, timestamp
      ]
    );

    return {
      id,
      timestamp,
      action,
      actor: safeActor,
      caseId,
      input,
      result,
      reason
    };
  }
};

module.exports = dbService;
