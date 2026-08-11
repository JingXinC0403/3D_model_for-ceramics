/* ============================================================
   storage.js
   ------------------------------------------------------------
   Shared localStorage layer for CARE projects.
   Used by home.js (list/delete) and create.js (create/edit).
   ============================================================ */

const CareStorage = (function () {
  const STORAGE_KEY = "care_projects";

  function nowISO() {
    return new Date().toISOString();
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "care-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  }

  function getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("CareStorage: failed to read projects", err);
      return [];
    }
  }

  function saveAll(projects) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      return true;
    } catch (err) {
      console.error("CareStorage: failed to save projects", err);
      return false;
    }
  }

  function getById(id) {
    return getAll().find((p) => p.id === id) || null;
  }

  function blankProject() {
    return {
      id: null,
      name: "",
      coverImage: "",
      cameras: {
        1: { type: "webcam", url: "", connected: false },
        2: { type: "webcam", url: "", connected: false },
      },
      climate: {
        temperature: null,
        humidity: null,
        status: "Simulated",
      },
      artifact: {
        description: "",
        period: "",
        material: "",
        location: "",
        condition: "",
        notes: "",
      },
      createdAt: null,
      updatedAt: null,
    };
  }

  function upsert(projectData) {
    const projects = getAll();
    const id = projectData.id || generateId();
    const timestamp = nowISO();

    const record = {
      ...blankProject(),
      ...projectData,
      id,
      createdAt: projectData.createdAt || timestamp,
      updatedAt: timestamp,
    };

    const idx = projects.findIndex((p) => p.id === id);
    const isNew = idx < 0;
    if (idx >= 0) {
      projects[idx] = record;
    } else {
      projects.push(record);
    }

    saveAll(projects);
    return { record, isNew };
  }

  function remove(id) {
    const projects = getAll().filter((p) => p.id !== id);
    saveAll(projects);
  }

  return {
    generateId,
    getAll,
    saveAll,
    getById,
    blankProject,
    upsert,
    remove,
  };
})();
