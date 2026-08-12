/* ============================================================
   storage.js
   ------------------------------------------------------------
   CARE project storage using Supabase.
   Projects belong to the currently logged-in user.
   ============================================================ */

const CareStorage = (function () {

  function generateId() {

    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      "care-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 9)
    );
  }


  function blankProject() {

    return {
      id: null,

      name: "",

      coverImage: "",

      cameras: {
        1: {
          type: "webcam",
          url: "",
          connected: false
        },

        2: {
          type: "webcam",
          url: "",
          connected: false
        }
      },

      climate: {
        temperature: null,
        humidity: null,
        status: "Simulated"
      },

      artifact: {
        description: "",
        period: "",
        material: "",
        location: "",
        condition: "",
        notes: ""
      },

      createdAt: null,
      updatedAt: null
    };
  }


  // ============================================================
  // CURRENT USER
  // ============================================================

  async function getCurrentUser() {

    const {
      data,
      error
    } = await supabaseClient.auth.getUser();


    if (error) {
      console.error(
        "CareStorage: unable to get user",
        error
      );

      return null;
    }


    return data.user || null;
  }


  // ============================================================
  // GET ALL PROJECTS
  // ============================================================

  async function getAll() {

    const user =
      await getCurrentUser();


    if (!user) {
      return [];
    }


    const {
      data,
      error
    } = await supabaseClient
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order(
        "updated_at",
        {
          ascending: false
        }
      );


    if (error) {

      console.error(
        "CareStorage: failed to load projects",
        error
      );

      return [];
    }


    return data.map(
      convertFromDatabase
    );
  }


  // ============================================================
  // GET PROJECT BY ID
  // ============================================================

  async function getById(id) {

    const user =
      await getCurrentUser();


    if (!user) {
      return null;
    }


    const {
      data,
      error
    } = await supabaseClient
      .from("projects")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();


    if (error) {

      console.error(
        "CareStorage: failed to get project",
        error
      );

      return null;
    }


    if (!data) {
      return null;
    }


    return convertFromDatabase(
      data
    );
  }


  // ============================================================
  // SAVE PROJECT
  // ============================================================

  async function upsert(projectData) {

    const user =
      await getCurrentUser();


    if (!user) {

      throw new Error(
        "You must be logged in to save a project."
      );
    }


    const existing =
      projectData.id
        ? await getById(projectData.id)
        : null;


    const now =
      new Date().toISOString();


    const project =
      {
        ...blankProject(),
        ...projectData,

        id:
          projectData.id ||
          generateId(),

        createdAt:
          existing?.createdAt ||
          projectData.createdAt ||
          now,

        updatedAt:
          now
      };


    const databaseRecord = {

      id:
        project.id,

      user_id:
        user.id,

      name:
        project.name,

      cover_image:
        project.coverImage,

      cameras:
        project.cameras,

      climate:
        project.climate,

      artifact:
        project.artifact,

      created_at:
        project.createdAt,

      updated_at:
        project.updatedAt
    };


    const {
      data,
      error
    } = await supabaseClient
      .from("projects")
      .upsert(
        databaseRecord,
        {
          onConflict: "id"
        }
      )
      .select()
      .single();


    if (error) {

      console.error(
        "CareStorage: failed to save project",
        error
      );

      throw error;
    }


    return {
      record:
        convertFromDatabase(data),

      isNew:
        !existing
    };
  }


  // ============================================================
  // DELETE
  // ============================================================

  async function remove(id) {

    const user =
      await getCurrentUser();


    if (!user) {
      return false;
    }


    const {
      error
    } = await supabaseClient
      .from("projects")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);


    if (error) {

      console.error(
        "CareStorage: failed to delete project",
        error
      );

      return false;
    }


    return true;
  }


  // ============================================================
  // DATABASE → CARE FORMAT
  // ============================================================

  function convertFromDatabase(row) {

    return {

      id:
        row.id,

      name:
        row.name || "",

      coverImage:
        row.cover_image || "",

      cameras:
        row.cameras || blankProject().cameras,

      climate:
        row.climate || blankProject().climate,

      artifact:
        row.artifact || blankProject().artifact,

      createdAt:
        row.created_at,

      updatedAt:
        row.updated_at
    };
  }


  return {

    generateId,

    getCurrentUser,

    getAll,

    getById,

    blankProject,

    upsert,

    remove

  };

})();