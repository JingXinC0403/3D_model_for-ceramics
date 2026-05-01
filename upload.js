const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Storage: each scan session gets its own folder
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = req.headers['x-session-id'] || uuidv4();
    const dir = path.join(__dirname, '..', 'uploads', sessionId);
    fs.mkdirSync(dir, { recursive: true });
    req.sessionId = sessionId;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const index = req.headers['x-frame-index'] || Date.now();
    cb(null, `frame_${String(index).padStart(4, '0')}.jpg`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per image
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// POST /api/upload/frame — upload a single captured frame
router.post('/frame', upload.single('frame'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received' });

  const sessionId = req.sessionId || req.headers['x-session-id'];
  console.log(`📷 Frame saved: ${req.file.filename} | Session: ${sessionId}`);

  res.json({
    success: true,
    sessionId,
    filename: req.file.filename,
    size: req.file.size,
    path: req.file.path
  });
});

// POST /api/upload/batch — upload all frames at once
router.post('/batch', upload.array('frames', 50), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files received' });
  }

  const sessionId = req.sessionId || req.headers['x-session-id'];
  console.log(`📦 Batch upload: ${req.files.length} frames | Session: ${sessionId}`);

  res.json({
    success: true,
    sessionId,
    count: req.files.length,
    files: req.files.map(f => f.filename)
  });
});

// GET /api/upload/session/:id — list frames for a session
router.get('/session/:id', (req, res) => {
  const dir = path.join(__dirname, '..', 'uploads', req.params.id);
  if (!fs.existsSync(dir)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg'));
  res.json({ sessionId: req.params.id, frameCount: files.length, files });
});

module.exports = router;
