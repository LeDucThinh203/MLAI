const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const BASE_DATA_DIR = process.env.DATA_DIR || __dirname;
if (!fs.existsSync(BASE_DATA_DIR)) {
  fs.mkdirSync(BASE_DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(BASE_DATA_DIR, 'caseflow.sqlite');
const DATA_JSON_PATH = path.join(__dirname, 'data.json');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Lỗi kết nối SQLite database:', err);
  } else {
    console.log(`[Database] SQLite Database kết nối thành công tại: ${DB_PATH}`);
  }
});

// Chạy query dạng Promise
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Khởi tạo bảng Relational Schemas & Migrate mật khẩu an toàn
async function initDatabase() {
  await runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      studentCode TEXT,
      email TEXT,
      role TEXT NOT NULL,
      department TEXT,
      avatar TEXT,
      bio TEXT,
      twoFactorEnabled INTEGER DEFAULT 0,
      twoFactorSecret TEXT,
      mustChangePassword INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  try { await runAsync(`ALTER TABLE users ADD COLUMN bio TEXT`); } catch {}
  try { await runAsync(`ALTER TABLE users ADD COLUMN mustChangePassword INTEGER DEFAULT 0`); } catch {}

  await runAsync(`
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      studentId TEXT NOT NULL,
      studentName TEXT NOT NULL,
      studentCode TEXT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT DEFAULT 'MEDIUM',
      description TEXT,
      status TEXT NOT NULL,
      reviewResult TEXT,
      supplementHistory TEXT,
      aiExtraction TEXT,
      evidenceFiles TEXT,
      deadline TEXT,
      assignedDepartment TEXT,
      digitalSignature TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (studentId) REFERENCES users(id)
    )
  `);

  try { await runAsync(`ALTER TABLE cases ADD COLUMN deadline TEXT`); } catch {}
  try { await runAsync(`ALTER TABLE cases ADD COLUMN assignedDepartment TEXT`); } catch {}
  try { await runAsync(`ALTER TABLE cases ADD COLUMN digitalSignature TEXT`); } catch {}

  await runAsync(`
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      caseId TEXT,
      actorId TEXT,
      actorName TEXT,
      actorRole TEXT,
      actorUsername TEXT,
      reason TEXT,
      timestamp TEXT
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      caseId TEXT NOT NULL,
      authorId TEXT NOT NULL,
      authorName TEXT NOT NULL,
      authorRole TEXT NOT NULL,
      authorAvatar TEXT,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (caseId) REFERENCES cases(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO',
      caseId TEXT,
      isRead INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS evidence_uploads (
      fileName TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL,
      metadata TEXT NOT NULL,
      ocrData TEXT,
      ocrProvider TEXT,
      ocrIsLive INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (ownerId) REFERENCES users(id)
    )
  `);

  // Migrate dữ liệu ban đầu nếu SQLite chưa có users
  const userCount = await getAsync('SELECT COUNT(*) as count FROM users');
  const isProd = process.env.NODE_ENV === 'production';

  if (userCount.count === 0) {
    if (isProd) {
      // Trong môi trường PRODUCTION: TUYỆT ĐỐI KHÔNG SEED TÀI KHOẢN DEMO
      const initialAdminPassword = crypto.randomBytes(12).toString('hex');
      const hashedAdminPassword = bcrypt.hashSync(initialAdminPassword, 10);
      const adminId = `admin-root-${Date.now()}`;
      const nowIso = new Date().toISOString();

      await runAsync(
        `INSERT INTO users (id, username, password, fullName, studentCode, email, role, department, avatar, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adminId,
          'admin',
          hashedAdminPassword,
          'Super Administrator',
          null,
          'admin@caseflow.ai',
          'ADMIN',
          'Ban Giám Hiệu & Quản Trị Hệ Thống',
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          0,
          null,
          1, // Bắt buộc đổi mật khẩu ngay lần đăng nhập đầu tiên
          nowIso,
          nowIso
        ]
      );

      console.log(`
╔══════════════════════════════════════════════════════════════════════════╗
║  🔑 INITIAL ADMIN CREDENTIALS GENERATED (PRODUCTION SECURE MODE)         ║
╠══════════════════════════════════════════════════════════════════════════╣
║  • Username : admin                                                      ║
║  • Password : ${initialAdminPassword}                               ║
║  • Notice   : Cờ mustChangePassword=1 đã được kích hoạt.                ║
║               Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên!     ║
╚══════════════════════════════════════════════════════════════════════════╝
`);
    } else if (fs.existsSync(DATA_JSON_PATH)) {
      try {
        const raw = JSON.parse(fs.readFileSync(DATA_JSON_PATH, 'utf-8'));

        if (raw.users) {
          for (const u of raw.users) {
            const rawPass = u.password || 'password123';
            const hashedPassword = rawPass.startsWith('$2a$') || rawPass.startsWith('$2b$')
              ? rawPass
              : bcrypt.hashSync(rawPass, 10);

            await runAsync(
              `INSERT OR REPLACE INTO users (id, username, password, fullName, studentCode, email, role, department, avatar, twoFactorEnabled, twoFactorSecret, mustChangePassword, createdAt, updatedAt) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                u.id,
                u.username,
                hashedPassword,
                u.fullName,
                u.studentCode || null,
                u.email || `${u.username}@caseflow.ai`,
                u.role,
                u.department || 'Trường Đại Học',
                u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                u.twoFactorEnabled ? 1 : 0,
                u.twoFactorSecret || null,
                0,
                u.createdAt || new Date().toISOString(),
                u.updatedAt || new Date().toISOString()
              ]
            );
          }
        }

        if (raw.cases) {
          for (const c of raw.cases) {
            await runAsync(
              `INSERT OR REPLACE INTO cases (id, studentId, studentName, studentCode, title, category, priority, description, status, reviewResult, supplementHistory, aiExtraction, evidenceFiles, deadline, assignedDepartment, digitalSignature, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                c.id,
                c.studentId,
                c.studentName,
                c.studentCode || null,
                c.title,
                c.category,
                c.priority || 'MEDIUM',
                c.description || '',
                c.status,
                c.reviewResult ? JSON.stringify(c.reviewResult) : null,
                c.supplementHistory ? JSON.stringify(c.supplementHistory) : null,
                c.aiExtraction ? JSON.stringify(c.aiExtraction) : null,
                c.evidenceFiles ? JSON.stringify(c.evidenceFiles) : null,
                c.deadline || null,
                c.assignedDepartment || null,
                c.digitalSignature || null,
                c.createdAt || new Date().toISOString(),
                c.updatedAt || new Date().toISOString()
              ]
            );
          }
        }

        if (raw.audits) {
          for (const a of raw.audits) {
            await runAsync(
              `INSERT OR REPLACE INTO audits (id, action, caseId, actorId, actorName, actorRole, actorUsername, reason, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                a.id || `aud_${Date.now()}_${Math.random()}`,
                a.action,
                a.caseId || null,
                a.actor?.id || null,
                a.actor?.name || null,
                a.actor?.role || null,
                a.actor?.username || null,
                a.reason || '',
                a.timestamp || new Date().toISOString()
              ]
            );
          }
        }

        console.log('[Database Migration] Hoàn tất nạp dữ liệu môi trường phát triển thành công!');
      } catch (migErr) {
        console.error('[Database Migration] Lỗi nghiêm trọng khi di chuyển dữ liệu:', migErr);
        throw migErr;
      }
    }
  }

  // Quét và băm bcrypt toàn bộ mật khẩu dạng văn bản thô còn sót trong bảng users
  const allUsers = await allAsync('SELECT id, password FROM users');
  for (const u of allUsers) {
    if (u.password && !u.password.startsWith('$2a$') && !u.password.startsWith('$2b$')) {
      const hashed = bcrypt.hashSync(u.password, 10);
      await runAsync('UPDATE users SET password = ? WHERE id = ?', [hashed, u.id]);
    }
  }

  // Migrate ownership for existing evidence referenced by cases. Historical OCR is
  // intentionally discarded so client-originated metadata cannot qualify as live OCR.
  const uploadDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..'), 'uploads');
  const existingCases = await allAsync('SELECT studentId, evidenceFiles FROM cases');
  for (const c of existingCases) {
    let evidenceFiles = [];
    try {
      evidenceFiles = JSON.parse(c.evidenceFiles || '[]');
    } catch {
      continue;
    }
    for (const file of evidenceFiles) {
      const fileName = path.basename(String(file?.fileName || (file?.fileUrl ? file.fileUrl.split('?')[0].split('/').pop() : '')));
      if (!fileName || !fs.existsSync(path.join(uploadDir, fileName))) continue;
      await runAsync(
        `INSERT OR IGNORE INTO evidence_uploads (fileName, ownerId, metadata, ocrData, ocrProvider, ocrIsLive, createdAt)
         VALUES (?, ?, ?, NULL, NULL, 0, ?)`,
        [fileName, c.studentId, JSON.stringify(file.metadata || {}), new Date().toISOString()]
      );
    }
  }
}

// Khởi tạo Promise không nuốt lỗi để server.js có thể dừng tiến trình ngay khi có lỗi
const dbReady = initDatabase();

module.exports = {
  db,
  runAsync,
  getAsync,
  allAsync,
  initDatabase,
  dbReady
};
