/* ============================================================
   home.js
   ------------------------------------------------------------
   Renders the project dashboard (index.html) from CareStorage.
   ============================================================ */

(function () {
  const container = document.getElementById("project-container");
  const emptyState = document.getElementById("empty-state");
  const addLink = document.getElementById("add-link");

  // Rotating accent palette for gradient placeholders / accents,
  // pulled from the shared CSS variables so it matches both themes.
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
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    return ACCENT_PAIRS[hash % ACCENT_PAIRS.length];
  }

  function cameraCount(project) {
    const cams = project.cameras || {};
    return Object.values(cams).filter((c) => c && c.connected).length;
  }

  function formatTemp(project) {
    const t = project.climate && project.climate.temperature;
    return t === null || t === undefined ? "--" : `${t}°C`;
  }

  function buildCard(project) {
    const card = document.createElement("div");
    card.className = "project-card";
    card.dataset.id = project.id;

    // Image or gradient placeholder
    const media = document.createElement("div");
    media.className = "project-card-media";

    if (project.coverImage) {
      media.style.backgroundImage = `url("${project.coverImage}")`;
    } else {
      const [from, to] = accentFor(project.id);
      media.classList.add("no-image");
      media.style.background = `linear-gradient(135deg, var(${from}), var(${to}))`;
      const initials = (project.name || "?").trim().charAt(0).toUpperCase();
      media.innerHTML = `<span class="placeholder-initial">${initials}</span>`;
    }

    const gradient = document.createElement("div");
    gradient.className = "project-card-gradient";
    media.appendChild(gradient);

    // Delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "icon-btn project-delete-btn";
    deleteBtn.title = "Delete project";
    deleteBtn.setAttribute("aria-label", "Delete project");
    deleteBtn.textContent = "🗑";
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      handleDelete(project);
    });

    const actions = document.createElement("div");
    actions.className = "project-actions";
    actions.appendChild(deleteBtn);
    media.appendChild(actions);

    // Info overlay
    const info = document.createElement("div");
    info.className = "project-card-info";

    const name = document.createElement("h3");
    name.className = "project-card-name";
    name.textContent = project.name || "Untitled Project";

    const meta = document.createElement("p");
    meta.className = "project-card-meta";
    const metaBits = [];
    if (project.artifact && project.artifact.material) metaBits.push(project.artifact.material);
    if (project.artifact && project.artifact.condition) metaBits.push(project.artifact.condition);
    meta.textContent = metaBits.length ? metaBits.join(" · ") : "No artifact details yet";

    const stats = document.createElement("div");
    stats.className = "project-card-stats";
    stats.innerHTML = `
      <span class="stat">📷 ${cameraCount(project)}</span>
      <span class="stat">🌡 ${formatTemp(project)}</span>
    `;

    const openLabel = document.createElement("span");
    openLabel.className = "project-card-open";
    openLabel.textContent = "Open Project →";

    info.appendChild(name);
    info.appendChild(meta);
    info.appendChild(stats);
    info.appendChild(openLabel);

    card.appendChild(media);
    card.appendChild(info);

    card.addEventListener("click", () => {
      window.location.href = `create.html?id=${encodeURIComponent(project.id)}`;
    });

    return card;
  }

  function handleDelete(project) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name || "this project"}"?`
    );
    if (!confirmed) return;
    CareStorage.remove(project.id);
    render();
  }

  function render() {
    const projects = CareStorage.getAll().sort((a, b) => {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

    // Clear only rendered project cards, keep the add-project card anchor.
    container.querySelectorAll(".project-card:not(.add-project-card)").forEach((el) => el.remove());

    emptyState.style.display = projects.length === 0 ? "block" : "none";

    projects.forEach((project) => {
      const card = buildCard(project);
      container.insertBefore(card, addLink);
    });
  }

  document.addEventListener("DOMContentLoaded", render);
})();
