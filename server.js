const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploadRoutes = require('./routes/upload');
const scanRoutes = require('./routes/scan');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure required dirs exist
['uploads', 'output'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve output files (3D models)
app.use('/output', express.static(path.join(__dirname, 'output')));

// API routes
app.use('/api/upload', uploadRoutes);
app.use('/api/scan', scanRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n🔷 3D Scanner Server running at http://localhost:${PORT}`);
  console.log(`📁 Uploads: ${path.join(__dirname, 'uploads')}`);
  console.log(`📦 Output:  ${path.join(__dirname, 'output')}\n`);
});
