(function () {
  let allProjects = [];
  let unsubscribe = null;

  const $ = (id) => document.getElementById(id);

  function cameraCount(project) {
    return Object.values(project.cameras || {}).filter(c => c && c.connected).length;
  }

  function isLive(project) {
    const status = project.climate && project.climate.status;
    return status === "Live" || status === "Connected";
  }

  function needsAttention(project) {
    const condition = String(project.artifact?.condition || "").toLowerCase();
    const status = String(project.climate?.status || "").toLowerCase();
    return ["poor", "damaged", "critical", "unstable", "needs attention"].some(x => condition.includes(x)) || status === "offline";
  }

  function formatDate(value) {
    if (!value) return "Just created";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Recently updated";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }

  function renderStats(projects) {
    const total = projects.length;
    const live = projects.filter(isLive).length;
    const cameras = projects.reduce((sum, p) => sum + cameraCount(p), 0);
    const attention = projects.filter(needsAttention).length;

    $("stat-total").textContent = total;
    $("stat-live").textContent = live;
    $("stat-cameras").textContent = cameras;
    $("stat-attention").textContent = attention;

    const percent = total ? Math.round((live / total) * 100) : 0;
    $("progress-number").textContent = `${percent}%`;
    $("progress-live").textContent = live;
    $("progress-other").textContent = total - live;
    $("progress-number").parentElement.style.setProperty("--progress", `${percent}%`);
  }

  function renderRecent(projects) {
    const list = $("recent-list");
    const empty = $("recent-empty");
    list.innerHTML = "";

    const sorted = [...projects]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
      .slice(0, 12);

    empty.style.display = sorted.length ? "none" : "block";

    sorted.forEach(project => {
      const item = document.createElement("div");
      item.className = "recent-item";
      item.dataset.name = String(project.name || "").toLowerCase();
      item.title = "Open artefact";
      item.innerHTML = `
        <div class="artifact-thumb"></div>
        <div>
          <b></b>
          <small>${formatDate(project.updatedAt || project.createdAt)} · ${project.artifact?.material || "No material"}</small>
        </div>
        <span class="recent-status">${isLive(project) ? "LIVE" : "SAVED"}</span>
      `;

      const thumb = item.querySelector(".artifact-thumb");
      if (project.coverImage) {
        thumb.style.backgroundImage = `url("${String(project.coverImage).replace(/"/g, '%22')}")`;
      } else {
        thumb.textContent = (project.name || "?").trim().charAt(0).toUpperCase();
      }

      item.querySelector("b").textContent = project.name || "Untitled Artefact";
      item.addEventListener("click", () => {
        window.location.href = `project.html?id=${encodeURIComponent(project.id)}`;
      });
      list.appendChild(item);
    });
  }

  function renderSensors(projects) {
    const list = $("sensor-list");
    const empty = $("sensor-empty");
    list.innerHTML = "";

    const rows = projects.slice(0, 7);
    empty.style.display = rows.length ? "none" : "block";

    rows.forEach(project => {
      const temp = project.climate?.temperature;
      const humidity = project.climate?.humidity;
      const hasReading = (temp !== null && temp !== undefined) || (humidity !== null && humidity !== undefined);
      const row = document.createElement("div");
      row.className = "sensor-row";
      row.innerHTML = `
        <div class="sensor-name"><span></span><small>${cameraCount(project)} camera${cameraCount(project) === 1 ? "" : "s"}</small></div>
        <div class="sensor-value">${hasReading ? `${temp ?? "--"}°C · ${humidity ?? "--"}%` : "--"}</div>
        <div class="${isLive(project) ? "sensor-live" : "sensor-offline"}">${isLive(project) ? "● LIVE" : "○ OFFLINE"}</div>
      `;
      row.querySelector(".sensor-name span").textContent = project.name || "Untitled";
      list.appendChild(row);
    });
  }

  function render(projects) {
    allProjects = projects || [];
    renderStats(allProjects);
    renderRecent(allProjects);
    renderSensors(allProjects);
  }

  function setupSearch() {
    const input = $("dashboard-search");
    if (!input) return;
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      document.querySelectorAll(".recent-item").forEach(item => {
        item.style.display = !q || item.dataset.name.includes(q) ? "grid" : "none";
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setupSearch();

    CareAuth.currentUser().then(async (user) => {
      if (!user) return;
      $("dashboard-user").textContent = user.name || user.email || "Account";

      if (unsubscribe) unsubscribe();

      try {
        // Load once immediately so the dashboard does not wait for a
        // realtime event. The listener below then keeps it updated.
        render(await CareStorage.getAll());
        if (window.CareBoot) window.CareBoot.ready();
      } catch (error) {
        console.error("Could not load CARE artefacts:", error);
        if (window.CareBoot) {
          window.CareBoot.showFatal(
            "Signed in, but couldn't load your artefacts from Firestore.",
            (error && error.message) || String(error)
          );
        }
      }

      unsubscribe = CareStorage.subscribe(
        render,
        (error) => {
          console.error("Dashboard realtime sync failed:", error);
        }
      );
    });
  });
})();
