/**
 * photogrammetry.js
 *
 * Simulates a photogrammetry pipeline with realistic stages.
 * Generates a valid OBJ/MTL/GLB output from the uploaded frames.
 *
 * In production, replace `runRealPipeline` with calls to:
 *   - OpenMVG + OpenMVS
 *   - COLMAP
 *   - AliceVision/Meshroom
 *   - Or a cloud API (Polycam, RealityCapture, etc.)
 */

const fs = require('fs');
const path = require('path');

// Pipeline stages with simulated durations (ms)
const STAGES = [
  { name: 'Analyzing frames',          pct: 5,  duration: 800  },
  { name: 'Feature detection (SIFT)',  pct: 15, duration: 1200 },
  { name: 'Feature matching',          pct: 30, duration: 1500 },
  { name: 'Structure from Motion',     pct: 50, duration: 2000 },
  { name: 'Dense point cloud',         pct: 65, duration: 1800 },
  { name: 'Surface reconstruction',    pct: 78, duration: 1500 },
  { name: 'Mesh optimization',         pct: 88, duration: 1000 },
  { name: 'Texture mapping',           pct: 95, duration: 800  },
  { name: 'Exporting model files',     pct: 99, duration: 600  },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Update job state in the shared jobs Map
 */
function updateJob(jobs, jobId, patch) {
  const job = jobs.get(jobId);
  if (job) jobs.set(jobId, { ...job, ...patch });
}

/**
 * Generate a procedural 3D mesh (OBJ) from frame metadata.
 * This produces a realistic-looking scanned object geometry
 * using a displaced sphere as a stand-in for real photogrammetry output.
 */
function generateOBJ(frameCount, outputDir) {
  // Sphere parameters — complexity scales with frame count
  const latBands  = Math.min(8 + frameCount * 2, 64);
  const longBands = Math.min(8 + frameCount * 2, 64);
  const radius    = 1.0;

  const vertices  = [];
  const normals   = [];
  const uvs       = [];
  const faces     = [];

  // Deterministic pseudo-random displacement seed
  function noise(lat, lon) {
    const s = Math.sin(lat * 3.7 + lon * 2.1) * 0.5 +
              Math.cos(lat * 1.9 - lon * 4.3) * 0.3 +
              Math.sin(lat * 5.1 + lon * 0.7) * 0.2;
    return 1 + s * 0.12; // ±12% displacement
  }

  for (let lat = 0; lat <= latBands; lat++) {
    const theta    = (lat * Math.PI) / latBands;
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= longBands; lon++) {
      const phi    = (lon * 2 * Math.PI) / longBands;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const r = radius * noise(theta, phi);
      const x = r * cosPhi * sinTheta;
      const y = r * cosTheta;
      const z = r * sinPhi * sinTheta;

      const nx = cosPhi * sinTheta;
      const ny = cosTheta;
      const nz = sinPhi * sinTheta;

      const u = 1 - (lon / longBands);
      const v = 1 - (lat / latBands);

      vertices.push(`v  ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
      normals.push(`vn ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}`);
      uvs.push(`vt ${u.toFixed(6)} ${v.toFixed(6)}`);
    }
  }

  // Faces (1-indexed)
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < longBands; lon++) {
      const a = lat * (longBands + 1) + lon + 1;
      const b = a + longBands + 1;
      const c = a + 1;
      const d = b + 1;

      // Two triangles per quad
      faces.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`);
      faces.push(`f ${b}/${b}/${b} ${d}/${d}/${d} ${c}/${c}/${c}`);
    }
  }

  const obj = [
    '# 3D Scanner — Generated OBJ',
    `# Frames used: ${frameCount}`,
    `# Vertices: ${vertices.length}`,
    `# Faces: ${faces.length}`,
    '',
    'mtllib model.mtl',
    'o ScannedObject',
    '',
    ...vertices,
    '',
    ...uvs,
    '',
    ...normals,
    '',
    'usemtl ScannedMaterial',
    's 1',
    '',
    ...faces,
  ].join('\n');

  fs.writeFileSync(path.join(outputDir, 'model.obj'), obj);
}

/**
 * Generate MTL material file
 */
function generateMTL(outputDir) {
  const mtl = [
    '# 3D Scanner — Material Library',
    '',
    'newmtl ScannedMaterial',
    'Ka 0.2 0.2 0.2',
    'Kd 0.8 0.75 0.7',
    'Ks 0.1 0.1 0.1',
    'Ns 32.0',
    'd 1.0',
    'illum 2',
    'map_Kd texture.jpg',
  ].join('\n');

  fs.writeFileSync(path.join(outputDir, 'model.mtl'), mtl);
}

/**
 * Generate a procedural texture (PPM → JPG via sharp if available)
 * Falls back to a placeholder JPEG if sharp is unavailable.
 */
async function generateTexture(outputDir) {
  try {
    const sharp = require('sharp');
    const size  = 512;
    const pixels = Buffer.alloc(size * size * 3);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 3;
        const nx = x / size;
        const ny = y / size;

        // Organic stone-like texture
        const n1 = Math.sin(nx * 23.7 + ny * 17.3) * 0.5 + 0.5;
        const n2 = Math.cos(nx * 11.1 - ny * 29.9) * 0.5 + 0.5;
        const n3 = Math.sin((nx + ny) * 41.3) * 0.5 + 0.5;

        const base = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
        const r = Math.floor(160 + base * 60);
        const g = Math.floor(140 + base * 55);
        const b = Math.floor(120 + base * 50);

        pixels[i]     = Math.min(255, r);
        pixels[i + 1] = Math.min(255, g);
        pixels[i + 2] = Math.min(255, b);
      }
    }

    await sharp(pixels, { raw: { width: size, height: size, channels: 3 } })
      .jpeg({ quality: 85 })
      .toFile(path.join(outputDir, 'texture.jpg'));

  } catch (e) {
    // Fallback: write a minimal valid JPEG (1×1 grey pixel)
    const minJpeg = Buffer.from([
      0xff,0xd8,0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0x00,0x01,
      0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xff,0xdb,0x00,0x43,
      0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,0x07,0x07,0x07,0x09,
      0x09,0x08,0x0a,0x0c,0x14,0x0d,0x0c,0x0b,0x0b,0x0c,0x19,0x12,
      0x13,0x0f,0x14,0x1d,0x1a,0x1f,0x1e,0x1d,0x1a,0x1c,0x1c,0x20,
      0x24,0x2e,0x27,0x20,0x22,0x2c,0x23,0x1c,0x1c,0x28,0x37,0x29,
      0x2c,0x30,0x31,0x34,0x34,0x34,0x1f,0x27,0x39,0x3d,0x38,0x32,
      0x3c,0x2e,0x33,0x34,0x32,0xff,0xc0,0x00,0x0b,0x08,0x00,0x01,
      0x00,0x01,0x01,0x01,0x11,0x00,0xff,0xc4,0x00,0x1f,0x00,0x00,
      0x01,0x05,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,
      0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,
      0x09,0x0a,0x0b,0xff,0xc4,0x00,0xb5,0x10,0x00,0x02,0x01,0x03,
      0x03,0x02,0x04,0x03,0x05,0x05,0x04,0x04,0x00,0x00,0x01,0x7d,
      0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,
      0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,
      0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,0x24,0x33,0x62,0x72,
      0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,
      0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,
      0x46,0x47,0x48,0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,
      0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,
      0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,
      0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,
      0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,
      0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,
      0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,
      0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,
      0xf5,0xf6,0xf7,0xf8,0xf9,0xfa,0xff,0xda,0x00,0x08,0x01,0x01,
      0x00,0x00,0x3f,0x00,0xfb,0xd7,0xff,0xd9
    ]);
    fs.writeFileSync(path.join(outputDir, 'texture.jpg'), minJpeg);
  }
}

/**
 * Generate a minimal GLB (binary glTF) file.
 * This is a valid GLB containing the same sphere mesh,
 * so Three.js GLTFLoader can load it directly.
 */
function generateGLB(frameCount, outputDir) {
  // Build a compact sphere for GLB (fewer vertices for binary compactness)
  const bands  = Math.min(16 + frameCount, 48);
  const verts  = [];
  const norms  = [];
  const uvsArr = [];
  const idx    = [];

  function noise(t, p) {
    return 1 + (Math.sin(t * 3.7 + p * 2.1) * 0.5 + Math.cos(t * 1.9 - p * 4.3) * 0.3) * 0.1;
  }

  for (let lat = 0; lat <= bands; lat++) {
    const theta = (lat * Math.PI) / bands;
    const st = Math.sin(theta), ct = Math.cos(theta);
    for (let lon = 0; lon <= bands; lon++) {
      const phi = (lon * 2 * Math.PI) / bands;
      const sp = Math.sin(phi), cp = Math.cos(phi);
      const r = noise(theta, phi);
      verts.push(r * cp * st, r * ct, r * sp * st);
      norms.push(cp * st, ct, sp * st);
      uvsArr.push(1 - lon / bands, 1 - lat / bands);
    }
  }

  for (let lat = 0; lat < bands; lat++) {
    for (let lon = 0; lon < bands; lon++) {
      const a = lat * (bands + 1) + lon;
      const b = a + bands + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  // Build binary buffers
  const vertBuf  = Buffer.alloc(verts.length  * 4);
  const normBuf  = Buffer.alloc(norms.length  * 4);
  const uvBuf    = Buffer.alloc(uvsArr.length * 4);
  const idxBuf   = Buffer.alloc(idx.length    * 2);

  verts.forEach((v, i)  => vertBuf.writeFloatLE(v, i * 4));
  norms.forEach((n, i)  => normBuf.writeFloatLE(n, i * 4));
  uvsArr.forEach((u, i) => uvBuf.writeFloatLE(u, i * 4));
  idx.forEach((x, i)    => idxBuf.writeUInt16LE(x, i * 2));

  // Pad to 4-byte alignment
  function pad4(buf) {
    const rem = buf.length % 4;
    if (rem === 0) return buf;
    return Buffer.concat([buf, Buffer.alloc(4 - rem)]);
  }

  const vP  = pad4(vertBuf);
  const nP  = pad4(normBuf);
  const uvP = pad4(uvBuf);
  const iP  = pad4(idxBuf);

  // Compute byte offsets
  const o0 = 0;
  const o1 = o0 + vP.length;
  const o2 = o1 + nP.length;
  const o3 = o2 + uvP.length;
  const binBuffer = Buffer.concat([vP, nP, uvP, iP]);

  // Min/max for positions
  let minPos = [Infinity, Infinity, Infinity], maxPos = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < verts.length; i += 3) {
    for (let j = 0; j < 3; j++) {
      minPos[j] = Math.min(minPos[j], verts[i + j]);
      maxPos[j] = Math.max(maxPos[j], verts[i + j]);
    }
  }

  const gltf = {
    asset: { version: '2.0', generator: '3D-Scanner-App' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'ScannedObject' }],
    meshes: [{
      name: 'ScannedMesh',
      primitives: [{
        attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
        indices: 3,
        material: 0
      }]
    }],
    materials: [{
      name: 'ScannedMaterial',
      pbrMetallicRoughness: {
        baseColorFactor: [0.8, 0.75, 0.7, 1.0],
        metallicFactor: 0.0,
        roughnessFactor: 0.7
      },
      doubleSided: true
    }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: verts.length / 3,  type: 'VEC3', min: minPos, max: maxPos },
      { bufferView: 1, componentType: 5126, count: norms.length / 3,  type: 'VEC3' },
      { bufferView: 2, componentType: 5126, count: uvsArr.length / 2, type: 'VEC2' },
      { bufferView: 3, componentType: 5123, count: idx.length,        type: 'SCALAR' }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: o0, byteLength: vP.length,  target: 34962 },
      { buffer: 0, byteOffset: o1, byteLength: nP.length,  target: 34962 },
      { buffer: 0, byteOffset: o2, byteLength: uvP.length, target: 34962 },
      { buffer: 0, byteOffset: o3, byteLength: iP.length,  target: 34963 }
    ],
    buffers: [{ byteLength: binBuffer.length }]
  };

  const jsonStr  = JSON.stringify(gltf);
  const jsonBuf  = Buffer.from(jsonStr, 'utf8');
  const jsonPad  = pad4(jsonBuf);
  const jsonLen  = jsonPad.length;
  const binLen   = binBuffer.length;
  const totalLen = 12 + 8 + jsonLen + 8 + binLen;

  const glb = Buffer.alloc(totalLen);
  let offset = 0;

  // GLB header
  glb.writeUInt32LE(0x46546C67, offset); offset += 4; // magic "glTF"
  glb.writeUInt32LE(2,          offset); offset += 4; // version
  glb.writeUInt32LE(totalLen,   offset); offset += 4; // length

  // JSON chunk
  glb.writeUInt32LE(jsonLen,    offset); offset += 4;
  glb.writeUInt32LE(0x4E4F534A, offset); offset += 4; // "JSON"
  jsonPad.copy(glb, offset);             offset += jsonLen;

  // BIN chunk
  glb.writeUInt32LE(binLen,     offset); offset += 4;
  glb.writeUInt32LE(0x004E4942, offset); offset += 4; // "BIN\0"
  binBuffer.copy(glb, offset);

  fs.writeFileSync(path.join(outputDir, 'model.glb'), glb);
}

/**
 * Write reconstruction stats for the UI to display
 */
function generateStats(jobId, sessionId, frameCount, outputDir) {
  const stats = {
    jobId,
    sessionId,
    frameCount,
    vertexCount:   Math.floor(800 + frameCount * 120),
    faceCount:     Math.floor(600 + frameCount * 80),
    textureSize:   '512×512',
    processingMs:  STAGES.reduce((a, s) => a + s.duration, 0),
    completedAt:   new Date().toISOString(),
    pipeline:      'Simulated OpenMVG+OpenMVS',
    modelFormats:  ['OBJ', 'GLB']
  };
  fs.writeFileSync(path.join(outputDir, 'stats.json'), JSON.stringify(stats, null, 2));
}

/**
 * Main pipeline runner
 */
async function run(jobId, uploadDir, outputDir, frames, jobs) {
  console.log(`\n🔬 Starting pipeline | Job: ${jobId} | Frames: ${frames.length}`);
  updateJob(jobs, jobId, { status: 'processing' });

  for (const stage of STAGES) {
    updateJob(jobs, jobId, { stage: stage.name, progress: stage.pct });
    console.log(`  [${stage.pct}%] ${stage.name}`);
    await sleep(stage.duration);
  }

  // Generate all output artifacts
  updateJob(jobs, jobId, { stage: 'Generating OBJ mesh…', progress: 99 });
  generateOBJ(frames.length, outputDir);
  generateMTL(outputDir);
  await generateTexture(outputDir);
  generateGLB(frames.length, outputDir);

  const job = jobs.get(jobId);
  generateStats(jobId, job?.sessionId, frames.length, outputDir);

  updateJob(jobs, jobId, { status: 'complete', progress: 100, stage: 'Done' });
  console.log(`✅ Pipeline complete | Job: ${jobId}`);
}

module.exports = { run };
