/* ============================================================
   project.js
   ------------------------------------------------------------
   Powers the View Project page (project.html).
   ============================================================ */

(function () {

  // ---------- Elements ----------

  const noProjectMessage = document.getElementById("no-project-message");
  const viewEl = document.getElementById("project-view");
  const dashboardUserEl = document.getElementById("dashboard-user");
  const breadcrumbTitleEl = document.getElementById("breadcrumb-title");

  function getProjectId() {
    return new URLSearchParams(window.location.search).get("id");
  }

  // ---------- Init ----------

  document.addEventListener("DOMContentLoaded", async () => {
    const user = await CareAuth.currentUser();
    if (!user) return;

    if (dashboardUserEl) {
      dashboardUserEl.textContent = user.name || user.email || "Account";
    }

    loadProject();
  });

  async function loadProject() {
    const projectId = getProjectId();

    if (!projectId) {
      showNoProject("Artefact not found", "No artefact was selected.");
      if (window.CareBoot) window.CareBoot.ready();
      return;
    }

    let project;

    try {
      project = await CareStorage.getById(projectId);
    } catch (error) {
      console.error("Could not load project:", error);
      if (window.CareBoot) {
        window.CareBoot.showFatal(
          "Signed in, but couldn't load this artefact from Google Sheets.",
          (error && error.message) || String(error)
        );
      }
      return;
    }

    if (!project) {
      showNoProject("Artefact not found", "This artefact doesn't exist or was removed.");
      if (window.CareBoot) window.CareBoot.ready();
      return;
    }

    displayProject(project);
    if (window.CareBoot) window.CareBoot.ready();
  }

  function showNoProject(heading, message) {
    if (viewEl) viewEl.style.display = "none";
    if (noProjectMessage) {
      noProjectMessage.style.display = "block";
      const headingEl = document.getElementById("empty-state-heading");
      const textEl = document.getElementById("empty-state-text");
      if (headingEl && heading) headingEl.textContent = heading;
      if (textEl && message) textEl.textContent = message;
    }
  }

  // ---------- Display ----------

  function displayProject(project) {
    if (viewEl) viewEl.style.display = "block";
    if (noProjectMessage) noProjectMessage.style.display = "none";

    /* ---------- TITLE ---------- */

    document.title = `CARE — ${project.name || "Project"}`;

    document.getElementById("project-title").textContent = project.name || "Untitled Project";

    if (breadcrumbTitleEl) {
      breadcrumbTitleEl.textContent = project.name || "Artefact";
    }

    /* ---------- EDIT BUTTON ---------- */

    document.getElementById("edit-project-btn").href =
      `create.html?id=${encodeURIComponent(project.id)}`;

    /* ---------- DESCRIPTION ---------- */

    const artifact = project.artifact || {};

    document.getElementById("project-description").textContent =
      artifact.description || "No project description provided.";

    document.getElementById("artifact-description").textContent =
      artifact.description || "No description provided.";

    /* ---------- ARTIFACT ---------- */

    document.getElementById("artifact-period").textContent = artifact.period || "—";
    document.getElementById("artifact-material").textContent = artifact.material || "—";
    document.getElementById("artifact-location").textContent = artifact.location || "—";
    document.getElementById("artifact-condition").textContent = artifact.condition || "—";
    document.getElementById("artifact-notes").textContent = artifact.notes || "No additional notes.";

    /* ---------- CLIMATE ---------- */

    displayClimate(project);

    /* ---------- CAMERAS ---------- */

    displayCameras(project);
  }

  // ---------- Temperature / humidity ----------

  function displayClimate(project) {
    const climate = project.climate || {};

    const temperature = document.getElementById("temperature-value");
    const humidity = document.getElementById("humidity-value");
    const status = document.getElementById("sensor-status");
    const lastUpdated = document.getElementById("sensor-last-updated");

    temperature.textContent =
      climate.temperature !== null && climate.temperature !== undefined
        ? `${Number(climate.temperature).toFixed(1)}°C`
        : "--";

    humidity.textContent =
      climate.humidity !== null && climate.humidity !== undefined
        ? `${Number(climate.humidity).toFixed(1)}%`
        : "--";

    if (climate.status === "Live" || climate.status === "Connected") {
      status.textContent = "Live";
    } else {
      status.textContent = "Disconnected";
    }

    if (climate.lastUpdated) {
      const date = new Date(climate.lastUpdated);
      lastUpdated.textContent = `Last updated: ${date.toLocaleString()}`;
    } else {
      lastUpdated.textContent = "No live sensor reading yet.";
    }
  }

  // ---------- Cameras ----------

  function displayCameras(project) {
    const cameras = project.cameras || {};
    setupCamera(1, cameras[1]);
    setupCamera(2, cameras[2]);
  }

  function setupCamera(number, camera) {
    if (!camera) {
      setCameraOffline(number);
      return;
    }

    if (camera.type === "webcam" && camera.connected) {
      startWebcam(number);
      return;
    }

    if (camera.type === "ip" && camera.url) {
      showIPCamera(number, camera.url);
      return;
    }

    setCameraOffline(number);
  }

  function cameraElements(number) {
    return {
      video: document.getElementById(`camera-${number}-video`),
      image: document.getElementById(`camera-${number}-img`),
      placeholder: document.getElementById(`camera-${number}-placeholder`),
      statusRow: document.getElementById(`camera-${number}-status-row`),
      statusText: document.getElementById(`camera-${number}-status-text`),
      statusLabel: document.getElementById(`camera-${number}-status-label`),
    };
  }

  function setCameraLive(number, label) {
    const el = cameraElements(number);
    if (el.statusRow) {
      el.statusRow.classList.add("is-connected");
      el.statusRow.classList.remove("is-error");
    }
    if (el.statusText) el.statusText.textContent = label;
    if (el.statusLabel) el.statusLabel.textContent = label;
  }

  function setCameraError(number, label) {
    const el = cameraElements(number);
    if (el.statusRow) {
      el.statusRow.classList.add("is-error");
      el.statusRow.classList.remove("is-connected");
    }
    if (el.statusText) el.statusText.textContent = label;
    if (el.statusLabel) el.statusLabel.textContent = label;
  }

  // ---------- Webcam ----------

  async function startWebcam(number) {
    const { video, placeholder } = cameraElements(number);
    if (!video) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });

      video.srcObject = stream;
      video.style.display = "block";
      placeholder.style.display = "none";

      setCameraLive(number, "Live");
    } catch (error) {
      console.error("Camera error:", error);
      setCameraOffline(number, "Camera permission denied");
    }
  }

  // ---------- IP camera ----------

  function showIPCamera(number, url) {
    const { image, placeholder } = cameraElements(number);

    /*
     * This works for browser-compatible MJPEG / HTTP camera streams.
     * RTSP generally cannot be displayed directly by a normal browser.
     */

    image.src = url;

    image.onload = () => {
      image.style.display = "block";
      placeholder.style.display = "none";
      setCameraLive(number, "Live");
    };

    image.onerror = () => {
      image.style.display = "none";
      placeholder.style.display = "flex";
      setCameraError(number, "Offline");
    };
  }

  // ---------- Offline ----------

  function setCameraOffline(number, message = "Not connected") {
    const { video, image, placeholder, statusRow, statusText, statusLabel } = cameraElements(number);

    if (video) {
      video.style.display = "none";
      video.srcObject = null;
    }

    if (image) image.style.display = "none";

    if (placeholder) {
      placeholder.style.display = "flex";
      const span = placeholder.querySelector("span");
      if (span) span.textContent = `Camera ${number} not connected`;
    }

    if (statusRow) {
      statusRow.classList.remove("is-connected", "is-error");
    }

    if (statusText) statusText.textContent = message;
    if (statusLabel) statusLabel.textContent = message;
  }

})();
