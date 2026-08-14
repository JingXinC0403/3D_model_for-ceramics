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
  const dashboardUserEl = document.getElementById("dashboard-user");
  const editorTitleEl = document.getElementById("editor-title");
  const pageModeEl = document.getElementById("page-mode");
  const footerEl = document.getElementById("create-footer");

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

    try {
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

      // Keep older Firestore records compatible with the current editor.
      project.cameras = {
        ...CareStorage.blankProject().cameras,
        ...(project.cameras || {}),
      };
      project.climate = {
        ...CareStorage.blankProject().climate,
        ...(project.climate || {}),
      };
      project.artifact = {
        ...CareStorage.blankProject().artifact,
        ...(project.artifact || {}),
      };

      editorEl.style.display = "block";
      noProjectMessage.style.display = "none";

      if (editorTitleEl) {
        editorTitleEl.textContent = isEditing ? "Edit your artefact." : "Create a new artefact.";
      }
      if (pageModeEl) {
        pageModeEl.textContent = isEditing ? "Edit Artefact" : "Create Artefact";
      }

      populateForm();
      setupFooter();
      setupCoverUpload();
      setupCameraCards();
      refreshCameraDevices();
      setupArtifactFields();
      setupClimate();
      window.CareSensors = { receiveReading };

      if (dashboardUserEl && auth.currentUser) {
        dashboardUserEl.textContent = auth.currentUser.displayName || auth.currentUser.email || "Account";
      }

      if (window.CareBoot) window.CareBoot.ready();
    } catch (error) {
      console.error("CARE create page failed to initialise:", error);
      showNoProject("We couldn't load this artefact. Please refresh and try again.");
      if (window.CareBoot) window.CareBoot.ready();
    }
  }

  function showNoProject(message) {
    editorEl.style.display = "none";
    noProjectMessage.style.display = "block";
    const text = noProjectMessage.querySelector("p");
    if (text && message) text.textContent = message;
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
      const deviceSelect = card.querySelector(".camera-device-select");
      const urlInput = card.querySelector(".camera-url-input");
      typeSelect.value = camState.type || "webcam";
      urlInput.value = camState.url || "";
      urlInput.style.display = typeSelect.value === "ip" ? "block" : "none";
      if (deviceSelect) {
        deviceSelect.style.display = typeSelect.value === "webcam" ? "block" : "none";
        deviceSelect.value = camState.deviceId || "";
      }
    });
  }

  // ---------- Footer (submit / back / delete) ----------
  function setupFooter() {
    if (!footerEl) return;
    footerEl.innerHTML = "";

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
      deleteBtn.textContent = "Delete Artefact";
      deleteBtn.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Are you sure you want to delete "${project.name || "this artefact"}"?`
        );
        if (!confirmed) return;

        deleteBtn.disabled = true;
        try {
          await CareStorage.remove(project.id);
          window.location.href = "index.html";
        } catch (error) {
          console.error("Delete failed:", error);
          deleteBtn.disabled = false;
          setSaveState("Could not delete", "error");
        }
      });
      rightGroup.appendChild(deleteBtn);
    }

    const submitBtn = document.createElement("button");
    submitBtn.type = "button";
    submitBtn.className = "create-submit-btn";
    submitBtn.textContent = isEditing ? "Save Changes →" : "Create Artefact →";
    submitBtn.addEventListener("click", handleSubmit);
    rightGroup.appendChild(submitBtn);

    footerEl.appendChild(backLink);
    footerEl.appendChild(rightGroup);
  }

  async function handleSubmit() {
    const name = nameInput.value.trim();
    if (!name) {
      flashError(nameInput, "Please enter an artefact name before saving.");
      return;
    }

    // Read every visible field one last time before saving. This means the
    // Create button is a guaranteed full save, even if an input event has
    // not finished its autosave yet.
    project.name = name;
    project.artifact = project.artifact || {};
    Object.entries(fieldIds).forEach(([key, elId]) => {
      const el = document.getElementById(elId);
      if (el) project.artifact[key] = el.value;
    });

    document.querySelectorAll(".camera-card").forEach((card) => {
      const num = card.dataset.camera;
      if (!project.cameras[num]) project.cameras[num] = {};
      const type = card.querySelector(".camera-type-select");
      const device = card.querySelector(".camera-device-select");
      const url = card.querySelector(".camera-url-input");
      if (type) project.cameras[num].type = type.value;
      if (device) project.cameras[num].deviceId = device.value;
      if (url) project.cameras[num].url = url.value.trim();
    });

    setSaveState("Saving to cloud...", "saving");

    try {
      const { record } = await CareStorage.upsert(project);
      project = record;
      setSaveState("Saved ✓", "");

      // Firestore's realtime listener on index.html will receive this
      // document and render it on the dashboard. Only navigate after the
      // write has successfully completed.
      window.location.href = "index.html";
    } catch (error) {
      console.error("Save failed:", error);
      const reason = error && error.message ? error.message : "Unknown error";
      setSaveState("Save failed", "error");
      alert(`The artefact could not be saved.\n\n${reason}\n\nCheck that Firebase Firestore is enabled and its rules allow signed-in users to write to the artefacts collection.`);
    }
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
  let saveInProgress = false;

  function setSaveState(text, state = "") {
    if (!saveIndicator) return;
    saveIndicator.textContent = text;
    saveIndicator.classList.toggle("saving", state === "saving");
    saveIndicator.classList.toggle("error", state === "error");
  }

  function scheduleAutosave() {
    setSaveState("Saving...", "saving");

    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      if (!nameInput.value.trim() || saveInProgress) {
        if (!nameInput.value.trim()) setSaveState("All changes saved");
        return;
      }

      saveInProgress = true;
      project.name = nameInput.value.trim();

      try {
        const { record, isNew } = await CareStorage.upsert(project);
        project = record;
        if (isNew) {
          isEditing = true;
          if (editorTitleEl) editorTitleEl.textContent = "Edit your artefact.";
          if (pageModeEl) pageModeEl.textContent = "Edit Artefact";
        }
        setSaveState("All changes saved");
      } catch (error) {
        console.error("Autosave failed:", error);
        setSaveState("Couldn't save changes", "error");
      } finally {
        saveInProgress = false;
      }
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
      const deviceSelect = card.querySelector(".camera-device-select");
      const urlInput = card.querySelector(".camera-url-input");
      const connectBtn = card.querySelector(".camera-connect-btn");
      const video = card.querySelector(".camera-video");
      const img = card.querySelector(".camera-stream-img");
      const placeholder = card.querySelector(".camera-placeholder");
      const statusWrap = card.querySelector(".camera-status");
      const statusText = card.querySelector(".status-text");

      typeSelect.addEventListener("change", () => {
        urlInput.style.display = typeSelect.value === "ip" ? "block" : "none";
        if (deviceSelect) deviceSelect.style.display = typeSelect.value === "webcam" ? "block" : "none";
        resetCameraView(num, { video, img, placeholder, statusWrap, statusText, connectBtn });
        project.cameras[num].type = typeSelect.value;
        scheduleAutosave();
      });

      if (deviceSelect) {
        deviceSelect.addEventListener("change", () => {
          project.cameras[num].deviceId = deviceSelect.value;
          resetCameraView(num, { video, img, placeholder, statusWrap, statusText, connectBtn });
          scheduleAutosave();
        });
      }

      urlInput.addEventListener("input", () => {
        project.cameras[num].url = urlInput.value;
        scheduleAutosave();
      });

      connectBtn.addEventListener("click", () => {
        if (typeSelect.value === "webcam") {
          connectWebcam(num, {
            video, img, placeholder, statusWrap, statusText, connectBtn,
            deviceId: deviceSelect ? deviceSelect.value : ""
          });
        } else {
          connectIpCamera(num, urlInput.value.trim(), { video, img, placeholder, statusWrap, statusText, connectBtn });
        }
      });
    });
  }

  function resetCameraView(num, refs) {
    project.cameras[num] = project.cameras[num] || {
      type: "webcam",
      url: "",
      connected: false,
    };

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
    if (refs.connectBtn) {
      refs.connectBtn.classList.remove("connected");
      refs.connectBtn.textContent = "Connect Camera";
    }
    const card = document.querySelector(`.camera-card[data-camera="${num}"]`);
    const label = card && card.querySelector(".camera-status-label");
    if (label) label.textContent = "Not connected";
    project.cameras[num].connected = false;
  }

  async function refreshCameraDevices() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === "videoinput");

      document.querySelectorAll(".camera-device-select").forEach((select) => {
        const card = select.closest(".camera-card");
        const num = card ? card.dataset.camera : "";
        const saved = num && project.cameras[num] ? project.cameras[num].deviceId || "" : "";
        const current = select.value || saved;
        select.innerHTML = "";

        if (!cameras.length) {
          const option = document.createElement("option");
          option.value = "";
          option.textContent = "Default camera";
          select.appendChild(option);
          return;
        }

        cameras.forEach((device, index) => {
          const option = document.createElement("option");
          option.value = device.deviceId;
          option.textContent = device.label || `Camera ${index + 1}`;
          select.appendChild(option);
        });

        if (cameras.some(device => device.deviceId === current)) {
          select.value = current;
        }
      });
    } catch (error) {
      console.warn("Could not enumerate cameras:", error);
    }
  }

  async function connectWebcam(num, refs) {
    refs.statusText.textContent = "Connecting…";
    try {
      const videoConstraint = refs.deviceId
        ? { deviceId: { exact: refs.deviceId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint });
      activeStreams[num] = stream;
      project.cameras[num].deviceId = refs.deviceId || "";
      refs.video.srcObject = stream;
      refs.video.style.display = "block";
      refs.img.style.display = "none";
      refs.placeholder.style.display = "none";
      refs.statusWrap.classList.add("is-connected");
      refs.statusWrap.classList.remove("is-error");
      refs.statusText.textContent = "Connected (webcam)";
      refs.connectBtn.classList.add("connected");
      refs.connectBtn.textContent = "Reconnect";
      const card = document.querySelector(`.camera-card[data-camera="${num}"]`);
      const label = card && card.querySelector(".camera-status-label");
      if (label) label.textContent = "Connected";
      project.cameras[num].connected = true;
      scheduleAutosave();
      refreshCameraDevices();
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
      const card = document.querySelector(`.camera-card[data-camera="${num}"]`);
      const label = card && card.querySelector(".camera-status-label");
      if (label) label.textContent = "Connection failed";
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
      const card = document.querySelector(`.camera-card[data-camera="${num}"]`);
      const label = card && card.querySelector(".camera-status-label");
      if (label) label.textContent = "Unsupported stream";
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
      const card = document.querySelector(`.camera-card[data-camera="${num}"]`);
      const label = card && card.querySelector(".camera-status-label");
      if (label) label.textContent = "Connected";
      project.cameras[num].connected = true;
      scheduleAutosave();
    };
    refs.img.onerror = () => {
      refs.statusWrap.classList.add("is-error");
      refs.statusWrap.classList.remove("is-connected");
      refs.statusText.textContent = "Couldn't load stream from that URL.";
      const card = document.querySelector(`.camera-card[data-camera="${num}"]`);
      const label = card && card.querySelector(".camera-status-label");
      if (label) label.textContent = "Connection failed";
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