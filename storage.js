/* ============================================================
   storage.js
   ------------------------------------------------------------
   Shared data layer for CARE projects, backed by Firestore so
   every signed-in user sees the same artefacts (this replaces
   the old localStorage version, which was per-browser only).

   Same method names as before (getAll, getById, upsert, remove,
   blankProject), but they now return Promises — call sites use
   await. Also adds subscribe(), used by home.js to keep the
   dashboard live in real time as other users add/edit/delete.
   ============================================================ */

const CareStorage = (function () {
  const COLLECTION = "artefacts";

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

  async function getAll() {
    const snap = await db.collection(COLLECTION).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async function getById(id) {
    if (!id) return null;
    const doc = await db.collection(COLLECTION).doc(id).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async function upsert(projectData) {
    const timestamp = new Date().toISOString();
    const user = auth.currentUser;
    const isNew = !projectData.id;

    const record = {
      ...blankProject(),
      ...projectData,
      createdAt: projectData.createdAt || timestamp,
      updatedAt: timestamp,
      updatedBy: (user && user.email) || null,
      ...(isNew ? { createdBy: (user && user.email) || null } : {}),
    };
    delete record.id; // id is the doc key, not a field

    const ref = projectData.id
      ? db.collection(COLLECTION).doc(projectData.id)
      : db.collection(COLLECTION).doc();

    await ref.set(record, { merge: true });
    return { record: { id: ref.id, ...record }, isNew };
  }

  async function remove(id) {
    if (!id) return;
    await db.collection(COLLECTION).doc(id).delete();
  }

  // Live updates: fires callback immediately with the current list,
  // then again every time any signed-in user adds/edits/deletes an
  // artefact — this is what makes "everyone sees the same info" true
  // in real time rather than only on page refresh.
  // Returns an unsubscribe function.
  function subscribe(callback) {
    return db.collection(COLLECTION).onSnapshot(
      (snap) => {
        callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      },
      (err) => {
        console.error("CareStorage.subscribe error:", err);
      }
    );
  }

  return { getAll, getById, blankProject, upsert, remove, subscribe };
})();