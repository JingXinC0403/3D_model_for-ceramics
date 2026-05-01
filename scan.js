const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const photogrammetry = require('../lib/photogrammetry');

const router = express.Router();

// In-memory job store (use Redis/DB in production)
const jobs = new Map();

// POST /api/scan/process — kick off 3D reconstruction
router.post('/process', async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const uploadDir = path.join(__dirname, '..', 'uploads', sessionId);
  if (!fs.existsSync(uploadDir)) {
    return res.status(404).json({ error: 'Session not found. Upload frames first.' });
  }

  const frames = fs.readdirSync(uploadDir).filter(f => f.endsWith('.jpg'));
  if (frames.length < 3) {
    return res.status(400).json({ error: `Need at least 3 frames, got ${frames.length}` });
  }

  const jobId = uuidv4();
  const outputDir = path.join(__dirname, '..', 'output', jobId);
  fs.mkdirSync(outputDir, { recursive: true });

  // Initialize job state
  jobs.set(jobId, {
    id: jobId,
    sessionId,
    status: 'queued',
    progress: 0,
    stage: 'Queued',
    frameCount: frames.length,
    createdAt: new Date().toISOString(),
    outputDir
  });

  // Run pipeline async
  photogrammetry.run(jobId, uploadDir, outputDir, frames, jobs).catch(err => {
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = err.message;
    }
    console.error('Pipeline error:', err);
  });

  res.json({ jobId, status: 'queued', frameCount: frames.length });
});

// GET /api/scan/status/:jobId — poll job progress
router.get('/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const response = {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    frameCount: job.frameCount,
    createdAt: job.createdAt
  };

  if (job.status === 'complete') {
    response.modelUrl = `/output/${job.id}/model.obj`;
    response.mtlUrl = `/output/${job.id}/model.mtl`;
    response.textureUrl = `/output/${job.id}/texture.jpg`;
    response.glbUrl = `/output/${job.id}/model.glb`;
    response.statsUrl = `/output/${job.id}/stats.json`;
  }

  if (job.status === 'failed') {
    response.error = job.error;
  }

  res.json(response);
});

// GET /api/scan/jobs — list all jobs
router.get('/jobs', (req, res) => {
  const list = Array.from(jobs.values()).map(j => ({
    jobId: j.id,
    sessionId: j.sessionId,
    status: j.status,
    progress: j.progress,
    frameCount: j.frameCount,
    createdAt: j.createdAt
  }));
  res.json({ jobs: list.reverse() });
});

// DELETE /api/scan/job/:jobId — clean up
router.delete('/job/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Remove output files
  const outputDir = path.join(__dirname, '..', 'output', req.params.jobId);
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }

  jobs.delete(req.params.jobId);
  res.json({ deleted: true });
});

module.exports = router;
