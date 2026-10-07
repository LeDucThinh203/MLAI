const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const crypto = require('crypto');
const dbService = require('./db');

const BASE_DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');
const UPLOAD_DIR = path.join(BASE_DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Kiểm tra Magic Bytes & Kiểm tra cấu trúc nội dung file chuyên sâu
function validateFileBuffer(buffer) {
  if (!buffer || buffer.length < 8) return { valid: false, detectedType: null, error: 'Tệp rỗng hoặc kích thước quá nhỏ.' };

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { valid: true, detectedType: 'image/png', isImage: true };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, detectedType: 'image/jpeg', isImage: true };
  }

  // WebP: RIFF .... WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { valid: true, detectedType: 'image/webp', isImage: true };
  }

  // PDF: %PDF- (25 50 44 46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    // Kiểm tra cấu trúc PDF: Phải có %%EOF ở cuối tệp
    const tailChunk = buffer.subarray(Math.max(0, buffer.length - 1024)).toString('ascii');
    if (!tailChunk.includes('%%EOF')) {
      return { valid: false, detectedType: 'application/pdf', error: 'Tệp PDF bị hỏng hoặc thiếu thẻ kết thúc %%EOF.' };
    }

    // Quét phát hiện mã thực thi độc hại nhúng trong PDF
    const fullContentAscii = buffer.toString('ascii');
    if (fullContentAscii.includes('/JavaScript') || fullContentAscii.includes('/Launch') || fullContentAscii.includes('<script')) {
      return { valid: false, detectedType: 'application/pdf', error: 'Tệp PDF chứa mã lệnh không an toàn (/JavaScript hoặc /Launch).' };
    }

    return { valid: true, detectedType: 'application/pdf', isImage: false };
  }

  return { valid: false, detectedType: null, error: 'Chữ ký nhị phân không khớp với định dạng tài liệu được hỗ trợ.' };
}

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`Định dạng file ${ext} không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP, PDF.`));
  }
  cb(null, true);
};

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
  fileFilter
}).single('evidence');

const avatarUploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      return cb(new Error(`Định dạng ảnh đại diện ${ext} không hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP.`));
    }
    cb(null, true);
  }
}).single('avatar');

/**
 * Xử lý lưu file minh chứng & kiểm tra Magic Bytes chặt chẽ
 */
const processAndSaveFile = async (file, actor) => {
  // 1. Kiểm tra Magic Bytes
  const magicCheck = validateFileBuffer(file.buffer);
  if (!magicCheck.valid) {
    throw new Error('Nội dung file bị hỏng hoặc không đúng định dạng chuẩn (Giả mạo phần mở rộng).');
  }

  const randomHash = crypto.randomBytes(16).toString('hex');
  const ext = path.extname(file.originalname).toLowerCase();
  const isImage = magicCheck.isImage;
  
  let finalFileName = '';
  let finalFilePath = '';
  let metadata = {
    originalName: file.originalname,
    originalSize: file.size,
    compressedSize: file.size,
    mimeType: magicCheck.detectedType,
    isOptimized: false,
    dimensions: null
  };

  if (isImage) {
    finalFileName = `evidence-${randomHash}.webp`;
    finalFilePath = path.join(UPLOAD_DIR, finalFileName);

    const sharpInstance = sharp(file.buffer)
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 });

    const buffer = await sharpInstance.toBuffer();
    const imageInfo = await sharp(buffer).metadata();

    fs.writeFileSync(finalFilePath, buffer);

    metadata.compressedSize = buffer.length;
    metadata.mimeType = 'image/webp';
    metadata.isOptimized = true;
    metadata.dimensions = { width: imageInfo.width, height: imageInfo.height };
    metadata.savings = `${Math.round((1 - buffer.length / file.size) * 100)}%`;
  } else {
    finalFileName = `doc-${randomHash}.pdf`;
    finalFilePath = path.join(UPLOAD_DIR, finalFileName);
    fs.writeFileSync(finalFilePath, file.buffer);
  }

  const resultData = {
    fileName: finalFileName,
    fileUrl: `/api/evidence/${finalFileName}`,
    metadata
  };

  await dbService.logAudit({
    action: 'EVIDENCE_UPLOADED',
    actor: { id: actor.id, username: actor.username, role: actor.role, name: actor.fullName || actor.username },
    input: { originalName: file.originalname, originalSize: file.size },
    result: 'SUCCESS',
    reason: `Tải lên minh chứng ${file.originalname} thành công (Magic bytes: ${magicCheck.detectedType})`
  });

  return resultData;
};

/**
 * Xử lý lưu avatar
 */
const processAndSaveAvatar = async (file, actor) => {
  const magicCheck = validateFileBuffer(file.buffer);
  if (!magicCheck.valid || !magicCheck.isImage) {
    throw new Error('Ảnh đại diện không hợp lệ.');
  }

  const randomHash = crypto.randomBytes(16).toString('hex');
  const finalFileName = `avatar-${randomHash}.webp`;
  const finalFilePath = path.join(UPLOAD_DIR, finalFileName);

  const buffer = await sharp(file.buffer)
    .resize({ width: 300, height: 300, fit: 'cover', position: 'center' })
    .webp({ quality: 85 })
    .toBuffer();

  fs.writeFileSync(finalFilePath, buffer);

  const fileUrl = `/api/avatar/${finalFileName}`;

  await dbService.logAudit({
    action: 'AVATAR_UPLOADED',
    actor: { id: actor.id, username: actor.username, role: actor.role, name: actor.fullName || actor.username },
    input: { originalName: file.originalname, originalSize: file.size, compressedSize: buffer.length },
    result: 'SUCCESS',
    reason: `Tải lên và tối ưu hóa ảnh đại diện (${file.originalname}) thành công`
  });

  return {
    fileName: finalFileName,
    fileUrl
  };
};

module.exports = {
  UPLOAD_DIR,
  validateFileBuffer,
  uploadMiddleware,
  avatarUploadMiddleware,
  processAndSaveFile,
  processAndSaveAvatar
};
