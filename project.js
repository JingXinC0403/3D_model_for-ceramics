/* =====================================================
   CARE PROJECT PAGE
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

  auth.onAuthStateChanged((user) => {
    if (user) loadProject();
  });

});


/* =====================================================
   GET PROJECT ID
===================================================== */

function getProjectId() {

  const params =
    new URLSearchParams(window.location.search);

  return params.get("id");

}


/* =====================================================
   LOAD PROJECT
===================================================== */

async function loadProject() {

  const projectId =
    getProjectId();


  if (!projectId) {

    showError(
      "No project was selected."
    );

    return;

  }


  const project =
    await CareStorage.getById(projectId);


  if (!project) {

    showError(
      "Project could not be found."
    );

    return;

  }


  displayProject(project);

}


/* =====================================================
   DISPLAY PROJECT
===================================================== */

function displayProject(project) {

  /* ---------- TITLE ---------- */

  document.title =
    `CARE — ${project.name || "Project"}`;


  document.getElementById(
    "project-title"
  ).textContent =
    project.name || "Untitled Project";


  /* ---------- EDIT BUTTON ---------- */

  document.getElementById(
    "edit-project-btn"
  ).href =
    `create.html?id=${encodeURIComponent(project.id)}`;


  /* ---------- DESCRIPTION ---------- */

  const artifact =
    project.artifact || {};


  document.getElementById(
    "project-description"
  ).textContent =
    artifact.description ||
    "No project description provided.";


  document.getElementById(
    "artifact-description"
  ).textContent =
    artifact.description ||
    "No description provided.";


  /* ---------- ARTIFACT ---------- */

  document.getElementById(
    "artifact-period"
  ).textContent =
    artifact.period || "—";


  document.getElementById(
    "artifact-material"
  ).textContent =
    artifact.material || "—";


  document.getElementById(
    "artifact-location"
  ).textContent =
    artifact.location || "—";


  document.getElementById(
    "artifact-condition"
  ).textContent =
    artifact.condition || "—";


  document.getElementById(
    "artifact-notes"
  ).textContent =
    artifact.notes ||
    "No additional notes.";


  /* ---------- CLIMATE ---------- */

  displayClimate(
    project
  );


  /* ---------- CAMERAS ---------- */

  displayCameras(
    project
  );

}


/* =====================================================
   TEMPERATURE / HUMIDITY
===================================================== */

function displayClimate(project) {

  const climate =
    project.climate || {};


  const temperature =
    document.getElementById(
      "temperature-value"
    );

  const humidity =
    document.getElementById(
      "humidity-value"
    );

  const status =
    document.getElementById(
      "sensor-status"
    );


  if (
    climate.temperature !== null &&
    climate.temperature !== undefined
  ) {

    temperature.textContent =
      Number(climate.temperature)
        .toFixed(1);

  } else {

    temperature.textContent =
      "--";

  }


  if (
    climate.humidity !== null &&
    climate.humidity !== undefined
  ) {

    humidity.textContent =
      Number(climate.humidity)
        .toFixed(1);

  } else {

    humidity.textContent =
      "--";

  }


  if (
    climate.status === "Live" ||
    climate.status === "Connected"
  ) {

    status.textContent =
      "● LIVE";

    status.style.opacity =
      "1";

  } else {

    status.textContent =
      "● Disconnected";

  }


  const lastUpdated =
    document.getElementById(
      "sensor-last-updated"
    );


  if (climate.lastUpdated) {

    const date =
      new Date(
        climate.lastUpdated
      );

    lastUpdated.textContent =
      `Last updated: ${date.toLocaleString()}`;

  } else {

    lastUpdated.textContent =
      "No live sensor reading yet.";

  }

}


/* =====================================================
   CAMERAS
===================================================== */

function displayCameras(project) {

  const cameras =
    project.cameras || {};


  setupCamera(
    1,
    cameras[1]
  );

  setupCamera(
    2,
    cameras[2]
  );

}


function setupCamera(
  number,
  camera
) {

  if (!camera) {

    setCameraOffline(
      number
    );

    return;

  }


  /*
   * WEBCAM
   */

  if (
    camera.type === "webcam" &&
    camera.connected
  ) {

    startWebcam(
      number
    );

    return;

  }


  /*
   * IP CAMERA
   */

  if (
    camera.type === "ip" &&
    camera.url
  ) {

    showIPCamera(
      number,
      camera.url
    );

    return;

  }


  setCameraOffline(
    number
  );

}


/* =====================================================
   WEBCAM
===================================================== */

async function startWebcam(
  number
) {

  const video =
    document.getElementById(
      `camera-${number}-video`
    );

  const placeholder =
    document.getElementById(
      `camera-${number}-placeholder`
    );

  const status =
    document.getElementById(
      `camera-${number}-status`
    );


  if (!video) return;


  try {

    const stream =
      await navigator.mediaDevices
        .getUserMedia({

          video: true,

          audio: false

        });


    video.srcObject =
      stream;

    video.style.display =
      "block";

    placeholder.style.display =
      "none";

    status.textContent =
      "● LIVE";

    status.style.opacity =
      "1";


  } catch (error) {

    console.error(
      "Camera error:",
      error
    );

    setCameraOffline(
      number,
      "Camera permission denied"
    );

  }

}


/* =====================================================
   IP CAMERA
===================================================== */

function showIPCamera(
  number,
  url
) {

  const image =
    document.getElementById(
      `camera-${number}-img`
    );

  const placeholder =
    document.getElementById(
      `camera-${number}-placeholder`
    );

  const status =
    document.getElementById(
      `camera-${number}-status`
    );


  /*
   * This works for browser-compatible
   * MJPEG / HTTP camera streams.
   *
   * RTSP generally cannot be displayed
   * directly by a normal browser.
   */

  image.src =
    url;


  image.onload = () => {

    image.style.display =
      "block";

    placeholder.style.display =
      "none";

    status.textContent =
      "● LIVE";

  };


  image.onerror = () => {

    image.style.display =
      "none";

    placeholder.style.display =
      "flex";

    status.textContent =
      "Offline";

  };

}


/* =====================================================
   OFFLINE CAMERA
===================================================== */

function setCameraOffline(
  number,
  message = "Camera not connected"
) {

  const video =
    document.getElementById(
      `camera-${number}-video`
    );

  const image =
    document.getElementById(
      `camera-${number}-img`
    );

  const placeholder =
    document.getElementById(
      `camera-${number}-placeholder`
    );

  const status =
    document.getElementById(
      `camera-${number}-status`
    );


  if (video) {

    video.style.display =
      "none";

    video.srcObject =
      null;

  }


  if (image) {

    image.style.display =
      "none";

  }


  if (placeholder) {

    placeholder.style.display =
      "flex";

    placeholder.querySelector(
      "span"
    ).textContent =
      message;

  }


  if (status) {

    status.textContent =
      "Offline";

  }

}


/* =====================================================
   ERROR
===================================================== */

function showError(
  message
) {

  document.getElementById(
    "project-page"
  ).innerHTML = `

    <div style="
      text-align:center;
      padding:120px 20px;
    ">

      <h1>
        ${message}
      </h1>

      <a
        href="index.html"
        class="back-button"
      >
        ← Back to Dashboard
      </a>

    </div>

  `;

}