/* ============================================================
   create.js
   ------------------------------------------------------------
   Powers the Create / Edit Project page (create.html).
   ============================================================ */

(function () {
  // ---------- Elements ----------
  const noProjectMessage = document.getElementById("no-project-message");
  const editorEl = document.getElementById("project-editor");
  const saveIndicator = document.getElementById("save-indicator");
 
  const coverInput = document.getElementById("cover-image-input");
  const coverPreviewImg = document.getElementById("cover-preview-img");
  const coverPreviewPlaceholder = document.getElementById("cover-preview-placeholder");
  const nameInput = document.getElementById("project-name-input");

  const tempValueEl = document.getElementById("temperature-value");
  const humidityValueEl = document.getElementById("humidity-value");
  const statusValueEl = document.getElementById("sensor-status-value");

  const fieldIds = {
    description: "artifact-description",
    period: "artifact-period",
    material: "artifact-material",
    location: "artifact-location",
    condition: "artifact-condition",
    notes: "artifact-notes",
  };

  // ---------- State ----------
  let project = CareStorage.blankProject();
  let isEditing = false;
  let simulationTimer = null;
  let liveDataReceived = false;
  const activeStreams = { 1: null, 2: null };

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // ---------- Init ----------
  async function init() {
    const id = getParam("id");

    if (id) {
      const existing = await CareStorage.getById(id);
      if (!existing) {
        showNoProject();
        return;
      }
      project = JSON.parse(JSON.stringify(existing));
      isEditing = true;
    } else {
      project = CareStorage.blankProject();
      isEditing = false;
    }

    editorEl.style.display = "block";
    noProjectMessage.style.display = "none";

    populateForm();
    setupFooter();
    setupCoverUpload();
    setupCameraCards();
    setupArtifactFields();
    setupClimate();
    window.CareSensors = { receiveReading };
  }

  function showNoProject() {
    editorEl.style.display = "none";
    noProjectMessage.style.display = "block";
  }

  // ---------- Populate ----------
  function populateForm() {
    nameInput.value = project.name || "";

    if (project.coverImage) {
      coverPreviewImg.src = project.coverImage;
      coverPreviewImg.style.display = "block";
      coverPreviewPlaceholder.style.display = "none";
    }

    Object.entries(fieldIds).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (el) el.value = (project.artifact && project.artifact[key]) || "";
    });

    if (project.climate) {
      if (project.climate.temperature !== null && project.climate.temperature !== undefined) {
        tempValueEl.textContent = `${project.climate.temperature}°C`;
      }
      if (project.climate.humidity !== null && project.climate.humidity !== undefined) {
        humidityValueEl.textContent = `${project.climate.humidity}%`;
      }
      statusValueEl.textContent = project.climate.status || "Simulated";
    }

    [1, 2].forEach((num) => {
      const camState = (project.cameras && project.cameras[num]) || { type: "webcam", url: "", connected: false };
      const card = document.querySelector(`.camera-card[data-camera="${num}"]`);
      if (!card) return;
      const typeSelect = card.querySelector(".camera-type-select");
      const urlInput = card.querySelector(".camera-url-input");
      typeSelect.value = camState.type || "webcam";
      urlInput.value = camState.url || "";
      urlInput.style.display = typeSelect.value === "ip" ? "block" : "none";
    });
  }

  // ---------- Footer (submit / back / delete) ----------
  function setupFooter() {
    const footer = document.createElement("div");
    footer.className = "create-footer";

    const backLink = document.createElement("a");
    backLink.href = "index.html";
    backLink.className = "back-link-btn";
    backLink.textContent = "← Back to Dashboard";

    const rightGroup = document.createElement("div");
    rightGroup.className = "create-footer-right";

    if (isEditing) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-project-btn";
      deleteBtn.textContent = "Delete Project";
      deleteBtn.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Are you sure you want to delete "${project.name || "this project"}"?`
        );
        if (!confirmed) return;
        await CareStorage.remove(project.id);
        window.location.href = "index.html";
      });
      rightGroup.appendChild(deleteBtn);
    }

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "create-submit-btn";
    submitBtn.textContent = isEditing ? "Save Changes →" : "Create Project →";
    submitBtn.addEventListener("click", handleSubmit);
    rightGroup.appendChild(submitBtn);

    footer.appendChild(backLink);
    footer.appendChild(rightGroup);
    editorEl.appendChild(footer);
  }

  async function handleSubmit() {
    const name = nameInput.value.trim();
    if (!name) {
      flashError(nameInput, "Please enter a project name before saving.");
      return;
    }

    project.name = name;

    const { record } = await CareStorage.upsert(project);
    project = record;
    window.location.href = "index.html";
  }

  function flashError(inputEl, message) {
    inputEl.focus();
    inputEl.classList.add("input-error");

    let hint = inputEl.parentElement.querySelector(".error-hint");
    if (!hint) {
      hint = document.createElement("p");
      hint.className = "error-hint";
      inputEl.parentElement.appendChild(hint);
    }
    hint.textContent = message;

    setTimeout(() => inputEl.classList.remove("input-error"), 1600);
  }

  // ---------- Autosave indicator ----------
  let autosaveTimer = null;
  function scheduleAutosave() {
    saveIndicator.textContent = "Saving...";
    saveIndicator.classList.add("saving");

    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      // Only persist a draft automatically once a project already has
      // a name — avoids littering storage with untitled drafts.
      if (nameInput.value.trim()) {
        project.name = nameInput.value.trim();
        const { record, isNew } = await CareStorage.upsert(project);
        project = record;
        if (isNew) isEditing = true;
      }
      saveIndicator.textContent = "All changes saved";
      saveIndicator.classList.remove("saving");
    }, 800);
  }

  // ---------- Cover image ----------
  function setupCoverUpload() {
    coverInput.addEventListener("change", () => {
      const file = coverInput.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        project.coverImage = reader.result;
        coverPreviewImg.src = reader.result;
        coverPreviewImg.style.display = "block";
        coverPreviewPlaceholder.style.display = "none";
        scheduleAutosave();
      };
      reader.readAsDataURL(file);
    });

    nameInput.addEventListener("input", scheduleAutosave);
  }

  // ---------- Artifact fields ----------
  function setupArtifactFields() {
    Object.entries(fieldIds).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (!el) return;
      el.addEventListener("input", () => {
        project.artifact = project.artifact || {};
        project.artifact[key] = el.value;
        scheduleAutosave();
      });
    });
  }

  // ---------- Cameras ----------
  function setupCameraCards() {
    document.querySelectorAll(".camera-card").forEach((card) => {
      const num = card.dataset.camera;
      const typeSelect = card.querySelector(".camera-type-select");
      const urlInput = card.querySelector(".camera-url-input");
      const connectBtn = card.querySelector(".camera-connect-btn");
      const video = card.querySelector(".camera-video");
      const img = card.querySelector(".camera-stream-img");
      const placeholder = card.querySelector(".camera-placeholder");
      const statusWrap = card.querySelector(".camera-status");
      const statusText = card.querySelector(".status-text");

      typeSelect.addEventListener("change", () => {
        urlInput.style.display = typeSelect.value === "ip" ? "block" : "none";
        resetCameraView(num, { video, img, placeholder, statusWrap, statusText });
        project.cameras[num].type = typeSelect.value;
        scheduleAutosave();
      });

      urlInput.addEventListener("input", () => {
        project.cameras[num].url = urlInput.value;
        scheduleAutosave();
      });

      connectBtn.addEventListener("click", () => {
        if (typeSelect.value === "webcam") {
          connectWebcam(num, { video, img, placeholder, statusWrap, statusText, connectBtn });
        } else {
          connectIpCamera(num, urlInput.value.trim(), { video, img, placeholder, statusWrap, statusText, connectBtn });
        }
      });
    });
  }

  function resetCameraView(num, refs) {
    if (activeStreams[num]) {
      activeStreams[num].getTracks().forEach((t) => t.stop());
      activeStreams[num] = null;
    }
    refs.video.style.display = "none";
    refs.video.srcObject = null;
    refs.img.style.display = "none";
    refs.img.removeAttribute("src");
    refs.placeholder.style.display = "block";
    refs.placeholder.textContent = "No feed";
    refs.statusWrap.classList.remove("is-connected", "is-error");
    refs.statusText.textContent = "Not connected";
    project.cameras[num].connected = false;
  }

  async function connectWebcam(num, refs) {
    refs.statusText.textContent = "Connecting…";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      activeStreams[num] = stream;
      refs.video.srcObject = stream;
      refs.video.style.display = "block";
      refs.img.style.display = "none";
      refs.placeholder.style.display = "none";
      refs.statusWrap.classList.add("is-connected");
      refs.statusWrap.classList.remove("is-error");
      refs.statusText.textContent = "Connected (webcam)";
      refs.connectBtn.classList.add("connected");
      refs.connectBtn.textContent = "Reconnect";
      project.cameras[num].connected = true;
      scheduleAutosave();
    } catch (err) {
      refs.statusWrap.classList.add("is-error");
      refs.statusWrap.classList.remove("is-connected");
      let message = "Could not access camera.";
      if (err && err.name === "NotAllowedError") {
        message = "Camera permission denied.";
      } else if (err && err.name === "NotFoundError") {
        message = "No camera device found.";
      }
      refs.statusText.textContent = message;
      refs.placeholder.textContent = message;
      project.cameras[num].connected = false;
    }
  }

  function connectIpCamera(num, url, refs) {
    if (!url) {
      refs.statusText.textContent = "Enter a stream URL first.";
      refs.statusWrap.classList.add("is-error");
      return;
    }

    // Browsers cannot natively decode RTSP streams. Only MJPEG / plain
    // image streams work in a normal <img> tag — anything else needs a
    // server-side relay (e.g. transcoding to HLS or WebRTC).
    if (url.trim().toLowerCase().startsWith("rtsp://")) {
      refs.statusWrap.classList.add("is-error");
      refs.statusWrap.classList.remove("is-connected");
      refs.statusText.textContent = "RTSP can't play directly in a browser.";
      refs.placeholder.style.display = "block";
      refs.placeholder.textContent =
        "RTSP streams aren't supported by browsers directly. Use a relay/transcoder (e.g. an RTSP-to-HLS or MJPEG bridge) and enter that URL instead.";
      refs.video.style.display = "none";
      refs.img.style.display = "none";
      project.cameras[num].connected = false;
      scheduleAutosave();
      return;
    }

    refs.statusText.textContent = "Connecting…";
    refs.img.onload = () => {
      refs.img.style.display = "block";
      refs.video.style.display = "none";
      refs.placeholder.style.display = "none";
      refs.statusWrap.classList.add("is-connected");
      refs.statusWrap.classList.remove("is-error");
      refs.statusText.textContent = "Connected (stream)";
      refs.connectBtn.classList.add("connected");
      project.cameras[num].connected = true;
      scheduleAutosave();
    };
    refs.img.onerror = () => {
      refs.statusWrap.classList.add("is-error");
      refs.statusWrap.classList.remove("is-connected");
      refs.statusText.textContent = "Couldn't load stream from that URL.";
      refs.placeholder.style.display = "block";
      refs.placeholder.textContent = "Couldn't load stream — check the URL, CORS, or that it's a browser-playable format (e.g. MJPEG).";
      refs.img.style.display = "none";
      project.cameras[num].connected = false;
      scheduleAutosave();
    };
    refs.img.src = url;
    project.cameras[num].url = url;
  }

  // ---------- Climate (simulated, with live-data hook) ----------
  function setupClimate() {
    if (project.climate && project.climate.temperature !== null && project.climate.temperature !== undefined) {
      // Existing project: keep last known reading as the starting point.
    } else {
      project.climate = project.climate || {};
      project.climate.temperature = 22.5;
      project.climate.humidity = 55;
    }

    renderClimate();
    simulationTimer = setInterval(() => {
      if (liveDataReceived) return; // stop faking once real data arrives
      const temp = +(project.climate.temperature + (Math.random() - 0.5) * 0.6).toFixed(1);
      const humidity = Math.round(project.climate.humidity + (Math.random() - 0.5) * 2);
      project.climate.temperature = temp;
      project.climate.humidity = Math.min(100, Math.max(0, humidity));
      project.climate.status = "Simulated";
      renderClimate();
    }, 4000);
  }

  function renderClimate() {
    tempValueEl.textContent = `${project.climate.temperature}°C`;
    humidityValueEl.textContent = `${project.climate.humidity}%`;
    statusValueEl.textContent = project.climate.status || "Simulated";
  }

  // Integration point for a real ESP32 / DHT22 sensor.
  // Call CareSensors.receiveReading({ temperature, humidity }) to push
  // a live reading into the UI — this immediately overrides the
  // simulated values and stops the simulation loop.
  function receiveReading(reading) {
    if (!reading || typeof reading.temperature !== "number" || typeof reading.humidity !== "number") {
      console.warn("CareSensors.receiveReading: expected { temperature, humidity }");
      return;
    }
    liveDataReceived = true;
    project.climate.temperature = reading.temperature;
    project.climate.humidity = reading.humidity;
    project.climate.status = "Live";
    renderClimate();
    scheduleAutosave();
  }

  window.addEventListener("beforeunload", () => {
    Object.values(activeStreams).forEach((s) => s && s.getTracks().forEach((t) => t.stop()));
    if (simulationTimer) clearInterval(simulationTimer);
  });

  document.addEventListener("DOMContentLoaded", () => {
    auth.onAuthStateChanged((user) => {
      if (user) init();
    });
  });
})();