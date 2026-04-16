const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'images');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['.jpg', '.jpeg', '.png', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型，仅允许 jpg/jpeg/png/gif'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/image', verifyToken, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: { code: 'FILE_TOO_LARGE', message: '文件大小不能超过5MB' }
        });
      }
      return res.status(400).json({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: err.message }
      });
    }
    if (err) {
      if (err.message.includes('不支持的文件类型')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_FILE_TYPE', message: err.message }
        });
      }
      console.error('[Upload] 上传失败:', err.message);
      return res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' }
      });
    }
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_FILE', message: '请选择要上传的文件' }
      });
    }
    const url = `/uploads/images/${req.file.filename}`;
    res.json({
      success: true,
      data: { url }
    });
  });
});

module.exports = router;
