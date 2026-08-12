/* ============================================================
   auth.js
   ------------------------------------------------------------
   Shared Supabase Auth helper for CARE.
   Used by login.html / signup.html (forms) and by index.html,
   create.html, project.html (session guard + logout).
   Requires supabase-js CDN + supabase.js to be loaded first.
   ============================================================ */

const CareAuth = (function () {

  async function getSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      console.error("CareAuth: failed to read session", error);
      return null;
    }
    return data.session;
  }

  // Call on pages that require a logged-in user (home, create, project).
  // Redirects to login.html and returns null if nobody is signed in.
  async function requireSession(redirectTo = "login.html") {
    const session = await getSession();
    if (!session) {
      window.location.href = redirectTo;
      return null;
    }
    return session.user;
  }

  // Call on login.html / signup.html so an already-logged-in user
  // skips straight past the form.
  async function redirectIfLoggedIn(redirectTo = "index.html") {
    const session = await getSession();
    if (session) {
      window.location.href = redirectTo;
    }
  }

  async function signUp(email, password) {
    return supabaseClient.auth.signUp({ email, password });
  }

  async function signIn(email, password) {
    return supabaseClient.auth.signInWithPassword({ email, password });
  }

  async function signOut() {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
  }

  // Adds a "Log out" control to the shared nav (desktop + mobile
  // sidebar) once we know who's logged in. Safe to call on every
  // protected page — nav.html markup itself is untouched.
  function injectNavAuthLinks(user) {
    const desktopMenu = document.querySelector("nav ul.main-menu");
    const mobileMenu = document.querySelector("nav ul.sidebar");

    if (desktopMenu && !desktopMenu.querySelector(".logout-link")) {
      const li = document.createElement("li");
      li.className = "hideOnMobile";
      const a = document.createElement("a");
      a.href = "#";
      a.className = "logout-link";
      a.textContent = "Log out";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        signOut();
      });
      li.appendChild(a);
      desktopMenu.appendChild(li);
    }

    if (mobileMenu && !mobileMenu.querySelector(".logout-link")) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = "#";
      a.className = "logout-link";
      a.textContent = "Log out";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        signOut();
      });
      li.appendChild(a);
      mobileMenu.appendChild(li);
    }
  }

  return {
    getSession,
    requireSession,
    redirectIfLoggedIn,
    signUp,
    signIn,
    signOut,
    injectNavAuthLinks,
  };
})();

/* ============================================================
   Page-specific form wiring.
   Only attaches if the relevant elements exist, so this file can
   be safely included on every page (login, signup, and the
   protected pages that just need the logout button / guard).
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const signupForm = document.getElementById("signup-form");

  function showMessage(el, text, type) {
    el.textContent = text;
    el.classList.remove("is-error", "is-success");
    el.classList.add(type === "error" ? "is-error" : "is-success");
  }

  if (loginForm) {
    CareAuth.redirectIfLoggedIn("index.html");

    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("login-email").value.trim();
      const password = document.getElementById("login-password").value;
      const submitBtn = document.getElementById("login-submit-btn");
      const messageEl = document.getElementById("login-message");

      submitBtn.disabled = true;
      submitBtn.textContent = "Logging in…";

      const { error } = await CareAuth.signIn(email, password);

      if (error) {
        showMessage(messageEl, error.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Log In →";
        return;
      }

      window.location.href = "index.html";
    });
  }

  if (signupForm) {
    CareAuth.redirectIfLoggedIn("index.html");

    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = document.getElementById("signup-email").value.trim();
      const password = document.getElementById("signup-password").value;
      const submitBtn = document.getElementById("signup-submit-btn");
      const messageEl = document.getElementById("signup-message");

      submitBtn.disabled = true;
      submitBtn.textContent = "Signing up…";

      const { data, error } = await CareAuth.signUp(email, password);

      if (error) {
        showMessage(messageEl, error.message, "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign Up →";
        return;
      }

      // If email confirmation is enabled in Supabase, there won't be a
      // session yet — tell the user to check their inbox. Otherwise
      // they're signed in immediately and we can go straight to Home.
      if (data.session) {
        window.location.href = "index.html";
      } else {
        showMessage(
          messageEl,
          "Account created! Check your email to confirm before logging in.",
          "success"
        );
        submitBtn.disabled = false;
        submitBtn.textContent = "Sign Up →";
      }
    });
  }
});
