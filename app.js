/**
 * SCAN3D — Frontend Application
 * Handles camera capture, upload, processing pipeline polling,
 * and 3D model rendering via Three.js.
 */

const API = 'http://localhost:3000';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  sessionId:   null,
  jobId:       null,
  stream:      null,
  capturing:   false,
  captureTimer: null,
  framesCaptured: 0,
  framesTotal: 12,
  interval:    1000,
  modelUrls:   {},
  pollInterval: null,
};

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const video         = $('video');
const overlay       = $('overlay');
const ctx           = overlay.getContext('2d');
const noCameraMsg   = $('noCameraMsg');
const btnStartCamera= $('btnStartCamera');
const btnCapture    = $('btnCapture');
const btnReset      = $('btnReset');
const frameCountSlider = $('frameCount');
const frameCountVal = $('frameCountVal');
const intervalSlider= $('interval');
const intervalVal   = $('intervalVal');
const captureProgress= $('captureProgress');
const captureBar    = $('captureBar');
const captureLabel  = $('captureLabel');
const captureCount  = $('captureCount');
const frameStrip    = $('frameStrip');
const hudResolution = $('hudResolution');
const hudFrameCount = $('hudFrameCount');
const panelProcess  = $('panelProcess');
const panelViewer   = $('panelViewer');
const processBar    = $('processBar');
const procStage     = $('procStage');
const procPct       = $('procPct');
const procJobId     = $('procJobId');
const procFrames    = $('procFrames');
const pipelineStages= $('pipelineStages');
const terminal      = $('terminal');
const threeCanvas   = $('threeCanvas');
const viewerStats   = $('viewerStats');
const btnDownloadOBJ= $('btnDownloadOBJ');
const btnDownloadGLB= $('btnDownloadGLB');
const btnNewScan    = $('btnNewScan');

// ─── Toasts ───────────────────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Terminal ─────────────────────────────────────────────────────────────────
function log(msg) {
  const line = document.createElement('div');
  line.className = 'terminal-line new';
  line.textContent = `$ ${msg}`;
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
  setTimeout(() => line.classList.remove('new'), 1000);
}

// ─── Server Health Check ──────────────────────────────────────────────────────
async function checkServer() {
  try {
    const r = await fetch(`${API}/api/health`);
    if (r.ok) {
      $('serverDot').className = 'status-dot ok';
      $('serverStatus').textContent = 'Server online';
      return true;
    }
  } catch {
    $('serverDot').className = 'status-dot err';
    $('serverStatus').textContent = 'Server offline';
    toast('Backend server is not running. Start it with: npm start', 'error');
    return false;
  }
}

// ─── Camera ───────────────────────────────────────────────────────────────────
async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'environment' },
      audio: false
    });
    video.srcObject = state.stream;
    video.onloadedmetadata = () => {
      overlay.width  = video.videoWidth;
      overlay.height = video.videoHeight;
      hudResolution.textContent = `${video.videoWidth}×${video.videoHeight}`;
    };
    noCameraMsg.classList.add('hidden');
    btnCapture.disabled = false;
    toast('Camera ready');
  } catch (err) {
    toast(`Camera error: ${err.message}`, 'error');
  }
}

// ─── Session ID ───────────────────────────────────────────────────────────────
function genSessionId() {
  return 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
}

// ─── Capture a single frame ───────────────────────────────────────────────────
async function captureFrame(index) {
  const cvs = document.createElement('canvas');
  cvs.width  = video.videoWidth;
  cvs.height = video.videoHeight;
  const c = cvs.getContext('2d');
  c.drawImage(video, 0, 0);

  // Flash effect on overlay
  ctx.fillStyle = 'rgba(0,212,170,0.15)';
  ctx.fillRect(0, 0, overlay.width, overlay.height);
  setTimeout(() => ctx.clearRect(0, 0, overlay.width, overlay.height), 120);

  // Add thumb to strip
  const thumb = document.createElement('img');
  thumb.className = 'frame-thumb capturing';
  thumb.src = cvs.toDataURL('image/jpeg', 0.5);
  frameStrip.appendChild(thumb);
  setTimeout(() => thumb.classList.remove('capturing'), 400);

  // Convert to blob and upload
  return new Promise(resolve => {
    cvs.toBlob(async blob => {
      try {
        const fd = new FormData();
        fd.append('frame', blob, `frame_${String(index).padStart(4,'0')}.jpg`);
        const r = await fetch(`${API}/api/upload/frame`, {
          method: 'POST',
          headers: {
            'x-session-id':   state.sessionId,
            'x-frame-index':  index
          },
          body: fd
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        resolve(data);
      } catch (err) {
        toast(`Frame upload failed: ${err.message}`, 'error');
        resolve(null);
      }
    }, 'image/jpeg', 0.85);
  });
}

// ─── Start Capture Sequence ───────────────────────────────────────────────────
async function startCapture() {
  const online = await checkServer();
  if (!online) return;

  state.sessionId     = genSessionId();
  state.framesCaptured= 0;
  state.framesTotal   = parseInt(frameCountSlider.value);
  state.interval      = parseInt(intervalSlider.value);
  state.capturing     = true;

  // Reset UI
  frameStrip.innerHTML = '';
  captureProgress.style.display = 'block';
  btnCapture.disabled  = true;
  btnReset.style.display = 'inline-flex';
  frameCountSlider.disabled = true;
  intervalSlider.disabled   = true;

  // Build pipeline stages bar
  buildPipelineStages();

  toast(`Starting scan: ${state.framesTotal} frames`);

  const captureNext = async () => {
    if (!state.capturing || state.framesCaptured >= state.framesTotal) {
      if (state.framesCaptured >= state.framesTotal) {
        finishCapture();
      }
      return;
    }

    const idx = state.framesCaptured;
    captureLabel.textContent = `Capturing frame ${idx + 1}…`;
    captureCount.textContent = `${idx + 1} / ${state.framesTotal}`;
    captureBar.style.width   = `${((idx + 1) / state.framesTotal) * 100}%`;
    hudFrameCount.textContent= `${idx + 1} frames`;

    await captureFrame(idx);
    state.framesCaptured++;

    if (state.framesCaptured < state.framesTotal) {
      state.captureTimer = setTimeout(captureNext, state.interval);
    } else {
      finishCapture();
    }
  };

  captureNext();
}

function finishCapture() {
  state.capturing = false;
  captureLabel.textContent = `✓ ${state.framesTotal} frames captured`;
  captureBar.style.width   = '100%';
  toast(`${state.framesTotal} frames uploaded`, 'success');
  setTimeout(() => startProcessing(), 800);
}

// ─── Processing ───────────────────────────────────────────────────────────────
function buildPipelineStages() {
  const stages = [
    'Frame analysis', 'Feature detection', 'Feature matching',
    'Structure from Motion', 'Dense cloud', 'Mesh reconstruction',
    'Optimization', 'Texture mapping', 'Export'
  ];
  pipelineStages.innerHTML = '';
  stages.forEach((_, i) => {
    const b = document.createElement('div');
    b.className = 'stage-block';
    b.id = `stage_${i}`;
    b.title = stages[i];
    pipelineStages.appendChild(b);
  });
}

async function startProcessing() {
  panelProcess.style.display = 'block';
  panelProcess.scrollIntoView({ behavior: 'smooth' });
  log('Submitting job to photogrammetry pipeline…');

  try {
    const r = await fetch(`${API}/api/scan/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: state.sessionId })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);

    state.jobId = data.jobId;
    procJobId.textContent  = data.jobId.slice(0, 8) + '…';
    procFrames.textContent = `${data.frameCount} frames`;
    log(`Job queued: ${data.jobId}`);
    toast('Processing started');

    pollProcessing();
  } catch (err) {
    toast(`Processing error: ${err.message}`, 'error');
    log(`Error: ${err.message}`);
  }
}

function pollProcessing() {
  let lastStage = '';
  let stageIdx  = 0;

  state.pollInterval = setInterval(async () => {
    try {
      const r = await fetch(`${API}/api/scan/status/${state.jobId}`);
      const data = await r.json();

      processBar.style.width = `${data.progress}%`;
      procStage.textContent  = data.stage || '…';
      procPct.textContent    = `${data.progress}%`;

      if (data.stage !== lastStage) {
        lastStage = data.stage;
        log(data.stage);

        // Update stage blocks
        stageIdx = Math.floor((data.progress / 100) * 9);
        document.querySelectorAll('.stage-block').forEach((b, i) => {
          if (i < stageIdx)    b.className = 'stage-block done';
          else if (i === stageIdx) b.className = 'stage-block active';
          else                 b.className = 'stage-block';
        });
      }

      if (data.status === 'complete') {
        clearInterval(state.pollInterval);
        document.querySelectorAll('.stage-block').forEach(b => b.className = 'stage-block done');
        state.modelUrls = {
          obj:  API + data.modelUrl,
          glb:  API + data.glbUrl,
          mtl:  API + data.mtlUrl,
          stats: API + data.statsUrl
        };
        log('Reconstruction complete!');
        toast('3D model ready!', 'success');
        setTimeout(() => showViewer(), 600);
      }

      if (data.status === 'failed') {
        clearInterval(state.pollInterval);
        toast(`Processing failed: ${data.error}`, 'error');
        log(`FAILED: ${data.error}`);
      }
    } catch (err) {
      // Server blip — continue polling
    }
  }, 600);
}

// ─── 3D Viewer ────────────────────────────────────────────────────────────────
async function showViewer() {
  panelViewer.style.display = 'block';
  panelViewer.scrollIntoView({ behavior: 'smooth' });

  // Load stats
  try {
    const r = await fetch(state.modelUrls.stats);
    const stats = await r.json();
    viewerStats.innerHTML = [
      `<div class="stat-line">${stats.vertexCount.toLocaleString()} vertices</div>`,
      `<div class="stat-line">${stats.faceCount.toLocaleString()} faces</div>`,
      `<div class="stat-line">${stats.textureSize} texture</div>`,
      `<div class="stat-line">${stats.frameCount} frames used</div>`,
    ].join('');
  } catch {}

  // Setup download buttons
  btnDownloadOBJ.onclick = () => downloadFile(state.modelUrls.obj,  'model.obj');
  btnDownloadGLB.onclick = () => downloadFile(state.modelUrls.glb,  'model.glb');

  initThreeViewer(state.modelUrls.glb);
}

function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

// ─── Three.js GLB Viewer ──────────────────────────────────────────────────────
function initThreeViewer(glbUrl) {
  const wrap = threeCanvas.parentElement;
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;

  // Scene
  const scene    = new THREE.Scene();
  scene.background = new THREE.Color(0x050709);
  scene.fog        = new THREE.FogExp2(0x050709, 0.15);

  // Grid
  const grid = new THREE.GridHelper(6, 20, 0x1e2530, 0x1e2530);
  grid.position.y = -1.2;
  scene.add(grid);

  // Camera
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.01, 100);
  camera.position.set(0, 0.5, 3);

  // Renderer
  const renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Lights
  const ambient = new THREE.AmbientLight(0x223344, 0.6);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0x00d4aa, 1.8);
  key.position.set(2, 3, 2);
  key.castShadow = true;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x0066ff, 0.8);
  fill.position.set(-2, 1, -2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.4);
  rim.position.set(0, -2, -3);
  scene.add(rim);

  // Load GLB using manual binary parsing (no GLTFLoader in r128 without imports)
  // We parse the GLB we generated and build the mesh manually
  loadGLBManually(glbUrl, scene);

  // Orbit Controls (manual implementation)
  let isPointerDown = false;
  let isRightDown   = false;
  let lastX = 0, lastY = 0;
  let rotX = 0, rotY = 0;
  let panX = 0, panY = 0;
  let zoom = 3;

  threeCanvas.addEventListener('pointerdown', e => {
    isPointerDown = true;
    isRightDown   = e.button === 2;
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  });

  window.addEventListener('pointermove', e => {
    if (!isPointerDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (isRightDown) {
      panX += dx * 0.003;
      panY -= dy * 0.003;
    } else {
      rotY += dx * 0.4;
      rotX += dy * 0.4;
      rotX = Math.max(-80, Math.min(80, rotX));
    }
  });

  window.addEventListener('pointerup',    () => isPointerDown = false);
  threeCanvas.addEventListener('contextmenu', e => e.preventDefault());

  threeCanvas.addEventListener('wheel', e => {
    zoom += e.deltaY * 0.005;
    zoom = Math.max(0.5, Math.min(8, zoom));
  }, { passive: true });

  // Resize
  window.addEventListener('resize', () => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Animate
  let auto = true;
  let autoRot = 0;
  threeCanvas.addEventListener('pointerdown', () => auto = false);

  function animate() {
    requestAnimationFrame(animate);
    if (auto) autoRot += 0.3;

    const totalRotY = (rotY + autoRot) * Math.PI / 180;
    const totalRotX = rotX * Math.PI / 180;

    camera.position.x = Math.sin(totalRotY) * Math.cos(totalRotX) * zoom + panX;
    camera.position.y = Math.sin(totalRotX) * zoom + panY;
    camera.position.z = Math.cos(totalRotY) * Math.cos(totalRotX) * zoom;
    camera.lookAt(panX, panY, 0);

    renderer.render(scene, camera);
  }
  animate();
}

/**
 * Parse GLB binary and build Three.js mesh manually.
 * Supports POSITION (VEC3 float32), NORMAL (VEC3 float32), TEXCOORD_0 (VEC2 float32),
 * and indices (SCALAR uint16) — exactly what our generator produces.
 */
async function loadGLBManually(url, scene) {
  try {
    const resp = await fetch(url);
    const ab   = await resp.arrayBuffer();
    const view = new DataView(ab);

    // GLB header
    const magic   = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    if (magic !== 0x46546C67) throw new Error('Not a GLB file');

    let offset = 12;
    let jsonStr = '', binData = null;

    while (offset < ab.byteLength) {
      const chunkLen  = view.getUint32(offset, true);  offset += 4;
      const chunkType = view.getUint32(offset, true);  offset += 4;
      if (chunkType === 0x4E4F534A) {
        jsonStr = new TextDecoder().decode(new Uint8Array(ab, offset, chunkLen));
      } else if (chunkType === 0x004E4942) {
        binData = ab.slice(offset, offset + chunkLen);
      }
      offset += chunkLen;
    }

    const gltf = JSON.parse(jsonStr);
    const prim = gltf.meshes[0].primitives[0];
    const mat  = gltf.materials[0].pbrMetallicRoughness;

    function getAccessorData(idx) {
      const acc = gltf.accessors[idx];
      const bv  = gltf.bufferViews[acc.bufferView];
      const componentSize = { 5126: 4, 5123: 2 }[acc.componentType];
      const numComponents = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[acc.type];
      const TypedArray    = { 5126: Float32Array, 5123: Uint16Array }[acc.componentType];
      return new TypedArray(binData, bv.byteOffset, acc.count * numComponents);
    }

    const positions = getAccessorData(prim.attributes.POSITION);
    const normals   = getAccessorData(prim.attributes.NORMAL);
    const uvs       = getAccessorData(prim.attributes.TEXCOORD_0);
    const indices   = getAccessorData(prim.indices);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(normals,   3));
    geo.setAttribute('uv',       new THREE.BufferAttribute(uvs,       2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    const baseColor = mat.baseColorFactor || [0.8, 0.75, 0.7, 1.0];
    const material  = new THREE.MeshStandardMaterial({
      color:     new THREE.Color(baseColor[0], baseColor[1], baseColor[2]),
      metalness: mat.metallicFactor  || 0,
      roughness: mat.roughnessFactor || 0.7,
      side:      THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = mesh.receiveShadow = true;

    // Center mesh
    geo.computeBoundingBox();
    const box    = geo.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    mesh.position.sub(center);

    // Scale to unit size
    const size   = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    mesh.scale.setScalar(2 / maxDim);

    scene.add(mesh);
    toast('3D model loaded!', 'success');
  } catch (err) {
    toast(`Model load error: ${err.message}`, 'error');
    console.error('GLB load error:', err);

    // Fallback: show a displaced sphere so user sees something
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const noise = 1 + (Math.sin(pos.getX(i)*5+pos.getY(i)*3) * 0.08);
      pos.setX(i, pos.getX(i) * noise);
      pos.setY(i, pos.getY(i) * noise);
      pos.setZ(i, pos.getZ(i) * noise);
    }
    geo.computeVertexNormals();
    const mat  = new THREE.MeshStandardMaterial({ color: 0x00d4aa, metalness: 0, roughness: 0.5, wireframe: false });
    scene.add(new THREE.Mesh(geo, mat));
  }
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetAll() {
  if (state.captureTimer)  clearTimeout(state.captureTimer);
  if (state.pollInterval)  clearInterval(state.pollInterval);

  state.sessionId     = null;
  state.jobId         = null;
  state.capturing     = false;
  state.framesCaptured= 0;

  frameStrip.innerHTML  = '';
  captureProgress.style.display = 'none';
  captureBar.style.width        = '0%';
  panelProcess.style.display    = 'none';
  panelViewer.style.display     = 'none';
  processBar.style.width        = '0%';
  terminal.innerHTML = '<div class="terminal-line">$ Ready for new scan…</div>';

  btnCapture.disabled    = !state.stream;
  btnReset.style.display = 'none';
  frameCountSlider.disabled = false;
  intervalSlider.disabled   = false;
  hudFrameCount.textContent = '0 frames';
}

// ─── Slider updates ───────────────────────────────────────────────────────────
frameCountSlider.addEventListener('input', () => {
  frameCountVal.textContent = frameCountSlider.value;
});
intervalSlider.addEventListener('input', () => {
  const ms = parseInt(intervalSlider.value);
  intervalVal.textContent = `${(ms/1000).toFixed(1)}s`;
});

// ─── Event listeners ──────────────────────────────────────────────────────────
btnStartCamera.addEventListener('click', startCamera);
btnCapture.addEventListener('click', startCapture);
btnReset.addEventListener('click', resetAll);
btnNewScan.addEventListener('click', () => {
  resetAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(async () => {
  await checkServer();
  // Auto-request camera
  try {
    await startCamera();
  } catch {
    // user will click the button
  }
})();
