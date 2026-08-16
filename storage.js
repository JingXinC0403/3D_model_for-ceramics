/* ============================================================
   storage.js
   ------------------------------------------------------------
   Single source of truth for CARE artefacts.
   Artefacts are saved to Firebase Firestore and the dashboard
   listens to the same collection, so a newly-created artefact
   appears on the dashboard immediately.
   ============================================================ */

const CareStorage = (function () {
  const COLLECTION = "artefacts";

  function blankProject() {
    return {
      id: null,
      name: "",
      coverImage: "",
      cameras: {
        1: { type: "webcam", url: "", deviceId: "", connected: false },
        2: { type: "webcam", url: "", deviceId: "", connected: false },
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
      createdBy: null,
      createdByUid: null,
      updatedBy: null,
      updatedByUid: null,
    };
  }

  // Firestore rejects undefined values. Clean them out before every write.
  function clean(value) {
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === "object") {
      const result = {};
      Object.entries(value).forEach(([key, item]) => {
        if (item !== undefined) result[key] = clean(item);
      });
      return result;
    }
    return value;
  }

  // Helper to shrink Base64 cover images to keep Firestore documents under 1MB
  function resizeBase64Image(base64Str, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    if (!base64Str || !base64Str.startsWith("data:image")) return Promise.resolve(base64Str);
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(base64Str);
    });
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
    if (!auth || !auth.currentUser) {
      throw new Error("You must be signed in before saving an artefact.");
    }

    const timestamp = new Date().toISOString();
    const user = auth.currentUser;
    const isNew = !projectData.id;

    // Compress cover image to ensure payload stays well within Firestore's 1MB limit
    if (projectData.coverImage) {
      try {
        projectData.coverImage = await resizeBase64Image(projectData.coverImage);
      } catch (e) {
        console.warn("Cover image compression skipped:", e);
      }
    }

    const record = clean({
      ...blankProject(),
      ...projectData,
      // Always keep nested objects complete, even for older records.
      cameras: {
        ...blankProject().cameras,
        ...(projectData.cameras || {}),
      },
      climate: {
        ...blankProject().climate,
        ...(projectData.climate || {}),
      },
      artifact: {
        ...blankProject().artifact,
        ...(projectData.artifact || {}),
      },
      createdAt: projectData.createdAt || timestamp,
      updatedAt: timestamp,
      updatedBy: user.email || null,
      updatedByUid: user.uid || null,
      ...(isNew
        ? {
            createdBy: user.email || null,
            createdByUid: user.uid || null,
          }
        : {}),
    });

    delete record.id;

    const ref = projectData.id
      ? db.collection(COLLECTION).doc(projectData.id)
      : db.collection(COLLECTION).doc();

    await ref.set(record, { merge: true });

    return {
      record: { id: ref.id, ...record },
      isNew,
    };
  }

  async function remove(id) {
    if (!id) return;
    await db.collection(COLLECTION).doc(id).delete();
  }

  function subscribe(callback, onError) {
    return db.collection(COLLECTION).onSnapshot(
      (snap) => {
        const projects = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        callback(projects);
      },
      (error) => {
        console.error("CARE dashboard sync failed:", error);
        if (typeof onError === "function") onError(error);
      }
    );
  }

  return {
    getAll,
    getById,
    blankProject,
    upsert,
    remove,
    subscribe,
  };
})();
