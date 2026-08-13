/* ============================================================
   home.js
   ------------------------------------------------------------
   Renders the project dashboard (index.html) from CareStorage.
   Clicking a project opens project.html
   Editing a project opens create.html
   ============================================================ */

(function () {

  const container = document.getElementById("project-container");
  const emptyState = document.getElementById("empty-state");
  const addLink = document.getElementById("add-link");


  // ============================================================
  // ACCENT COLOURS
  // ============================================================

  const ACCENT_PAIRS = [
    ["--purple", "--pink"],
    ["--vibrant-blue", "--purple"],
    ["--orange", "--pink"],
    ["--green", "--vibrant-blue"],
    ["--pink", "--orange"],
  ];


  function accentFor(id) {

    let hash = 0;

    for (let i = 0; i < id.length; i++) {
      hash =
        (hash * 31 + id.charCodeAt(i)) >>> 0;
    }

    return ACCENT_PAIRS[
      hash % ACCENT_PAIRS.length
    ];
  }


  // ============================================================
  // CAMERA COUNT
  // ============================================================

  function cameraCount(project) {

    const cams =
      project.cameras || {};

    return Object.values(cams)
      .filter(
        (c) => c && c.connected
      ).length;
  }


  // ============================================================
  // TEMPERATURE
  // ============================================================

  function formatTemp(project) {

    const t =
      project.climate &&
      project.climate.temperature;

    return (
      t === null ||
      t === undefined
    )
      ? "--"
      : `${t}°C`;
  }


  // ============================================================
  // HUMIDITY
  // ============================================================

  function formatHumidity(project) {

    const h =
      project.climate &&
      project.climate.humidity;

    return (
      h === null ||
      h === undefined
    )
      ? "--"
      : `${h}%`;
  }


  // ============================================================
  // SENSOR STATUS
  // ============================================================

  function sensorStatus(project) {

    const climate =
      project.climate || {};

    if (
      climate.status === "Live" ||
      climate.status === "Connected"
    ) {
      return "● LIVE";
    }

    return "○ Offline";
  }


  // ============================================================
  // BUILD PROJECT CARD
  // ============================================================

  function buildCard(project) {

    const card =
      document.createElement("div");

    card.className =
      "project-card";

    card.dataset.id =
      project.id;


    // ========================================================
    // IMAGE / PLACEHOLDER
    // ========================================================

    const media =
      document.createElement("div");

    media.className =
      "project-card-media";


    if (project.coverImage) {

      media.style.backgroundImage =
        `url("${project.coverImage}")`;

    } else {

      const [from, to] =
        accentFor(project.id);

      media.classList.add(
        "no-image"
      );

      media.style.background =
        `linear-gradient(
          135deg,
          var(${from}),
          var(${to})
        )`;


      const initials =
        (
          project.name || "?"
        )
        .trim()
        .charAt(0)
        .toUpperCase();


      media.innerHTML = `
        <span class="placeholder-initial">
          ${initials}
        </span>
      `;

    }


    // ========================================================
    // GRADIENT OVERLAY
    // ========================================================

    const gradient =
      document.createElement("div");

    gradient.className =
      "project-card-gradient";

    media.appendChild(
      gradient
    );


    // ========================================================
    // ACTIONS
    // ========================================================

    const actions =
      document.createElement("div");

    actions.className =
      "project-actions";


    // ========================================================
    // EDIT BUTTON
    // ========================================================

    const editBtn =
      document.createElement("button");

    editBtn.type =
      "button";

    editBtn.className =
      "icon-btn project-edit-btn";

    editBtn.title =
      "Edit project";

    editBtn.setAttribute(
      "aria-label",
      "Edit project"
    );

    editBtn.textContent =
      "✎";


    editBtn.addEventListener(
      "click",
      (e) => {

        e.stopPropagation();

        e.preventDefault();


        window.location.href =
          `create.html?id=${encodeURIComponent(
            project.id
          )}`;

      }
    );


    // ========================================================
    // DELETE BUTTON
    // ========================================================

    const deleteBtn =
      document.createElement("button");

    deleteBtn.type =
      "button";

    deleteBtn.className =
      "icon-btn project-delete-btn";

    deleteBtn.title =
      "Delete project";

    deleteBtn.setAttribute(
      "aria-label",
      "Delete project"
    );

    deleteBtn.textContent =
      "🗑";


    deleteBtn.addEventListener(
      "click",
      (e) => {

        e.stopPropagation();

        e.preventDefault();

        handleDelete(
          project
        );

      }
    );


    actions.appendChild(
      editBtn
    );

    actions.appendChild(
      deleteBtn
    );

    media.appendChild(
      actions
    );


    // ========================================================
    // INFO
    // ========================================================

    const info =
      document.createElement("div");

    info.className =
      "project-card-info";


    // Project name

    const name =
      document.createElement("h3");

    name.className =
      "project-card-name";

    name.textContent =
      project.name ||
      "Untitled Project";


    // Artifact information

    const meta =
      document.createElement("p");

    meta.className =
      "project-card-meta";


    const metaBits = [];


    if (
      project.artifact &&
      project.artifact.material
    ) {

      metaBits.push(
        project.artifact.material
      );

    }


    if (
      project.artifact &&
      project.artifact.condition
    ) {

      metaBits.push(
        project.artifact.condition
      );

    }


    meta.textContent =
      metaBits.length
        ? metaBits.join(" · ")
        : "No artifact details yet";


    // ========================================================
    // STATS
    // ========================================================

    const stats =
      document.createElement("div");

    stats.className =
      "project-card-stats";


    stats.innerHTML = `

      <span class="stat">
        📷 ${cameraCount(project)}
      </span>

      <span class="stat">
        🌡 ${formatTemp(project)}
      </span>

      <span class="stat">
        💧 ${formatHumidity(project)}
      </span>

    `;


    // ========================================================
    // SENSOR STATUS
    // ========================================================

    const sensor =
      document.createElement("span");

    sensor.className =
      "project-card-sensor";

    sensor.textContent =
      sensorStatus(project);


    // ========================================================
    // OPEN PROJECT LABEL
    // ========================================================

    const openLabel =
      document.createElement("span");

    openLabel.className =
      "project-card-open";

    openLabel.textContent =
      "Open Project →";


    // ========================================================
    // ADD INFO TO CARD
    // ========================================================

    info.appendChild(
      name
    );

    info.appendChild(
      meta
    );

    info.appendChild(
      stats
    );

    info.appendChild(
      sensor
    );

    info.appendChild(
      openLabel
    );


    // ========================================================
    // ADD EVERYTHING TO CARD
    // ========================================================

    card.appendChild(
      media
    );

    card.appendChild(
      info
    );


    // ========================================================
    // CLICK PROJECT
    // ========================================================

    card.addEventListener(
      "click",
      () => {

        window.location.href =
          `project.html?id=${encodeURIComponent(
            project.id
          )}`;

      }
    );


    return card;
  }


  // ============================================================
  // DELETE PROJECT
  // ============================================================

  function handleDelete(project) {

    const confirmed =
      window.confirm(
        `Are you sure you want to delete "${project.name || "this project"}"?`
      );


    if (!confirmed) {
      return;
    }


    // The live subscribe() listener re-renders automatically once
    // the delete lands — no need to call render() here.
    CareStorage.remove(
      project.id
    );

  }


  // ============================================================
  // RENDER
  // ============================================================

  function render(projects) {

    const sorted =
      projects.slice().sort(
        (a, b) => {

          return (
            new Date(
              b.updatedAt || 0
            ) -
            new Date(
              a.updatedAt || 0
            )
          );

        }
      );


    // Remove existing cards

    container
      .querySelectorAll(
        ".project-card:not(.add-project-card)"
      )
      .forEach(
        (el) => el.remove()
      );


    // Empty state

    emptyState.style.display =
      sorted.length === 0
        ? "block"
        : "none";


    // Create cards

    sorted.forEach(
      (project) => {

        const card =
          buildCard(
            project
          );


        container.insertBefore(
          card,
          addLink
        );

      }
    );

  }


  // ============================================================
  // START
  // ============================================================

  // Subscribes to the shared "artefacts" collection — the dashboard
  // re-renders automatically whenever any signed-in user adds, edits,
  // or deletes an artefact, so everyone stays in sync live.
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      auth.onAuthStateChanged((user) => {
        if (user) CareStorage.subscribe(render);
      });
    }
  );

})();