/* ============================================================
   storage.js — Google Sheets project storage
   ------------------------------------------------------------
   Keeps the existing CareStorage API so create.js, home.js and
   project.js do not need to be rewritten around a new database.
   ============================================================ */

const CareStorage = (function () {
  function blankProject() {
    return {
      id: null,
      name: "",
      coverImage: "",
      cameras: {
        1: { type: "webcam", url: "", deviceId: "", connected: false },
        2: { type: "webcam", url: "", deviceId: "", connected: false },
      },
      climate: { temperature: null, humidity: null, status: "Simulated" },
      artifact: { description: "", period: "", material: "", location: "", condition: "", notes: "" },
      createdAt: null,
      updatedAt: null,
      createdBy: null,
      createdByUid: null,
      updatedBy: null,
      updatedByUid: null,
    };
  }

  async function getAll() {
    const result = await CareAuth.request("getProjects");
    return result.projects || [];
  }

  async function getById(id) {
    if (!id) return null;
    const result = await CareAuth.request("getProject", { id });
    return result.project || null;
  }

  async function upsert(projectData) {
    const result = await CareAuth.request("saveProject", { project: projectData });
    return { record: result.project, isNew: !!result.isNew };
  }

  async function remove(id) {
    if (!id) return;
    await CareAuth.request("deleteProject", { id });
  }

  // Sheets does not provide Firestore-style realtime listeners. Polling keeps
  // the dashboard reasonably live while preserving the existing API.
  function subscribe(callback, onError) {
    let stopped = false;
    let timer = null;

    async function refresh() {
      if (stopped) return;
      try {
        callback(await getAll());
      } catch (error) {
        console.error("CARE dashboard sync failed:", error);
        if (typeof onError === "function") onError(error);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 5000);
      }
    }

    refresh();
    return function unsubscribe() {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }

  return { getAll, getById, blankProject, upsert, remove, subscribe };
})();
