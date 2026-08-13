/* ============================================================
   login.js
   ------------------------------------------------------------
   Powers login.html: tab switching between Log in / Sign up,
   and wires both forms to CareAuth (auth.js).
   ============================================================ */

(function () {
  const tabs = document.querySelectorAll(".login-tab");
  const forms = {
    login: document.getElementById("login-form"),
    signup: document.getElementById("signup-form"),
  };
  const blurb = document.getElementById("login-blurb");
  const blurbText = {
    login: "Log in to see your museum's artefacts — everyone on your account sees the same live data.",
    signup: "Create an account so your team can share one live view of every artefact.",
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      Object.values(forms).forEach((f) => f.classList.remove("active-form"));
      forms[tab.dataset.tab].classList.add("active-form");
      blurb.textContent = blurbText[tab.dataset.tab];
    });
  });

  function redirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("redirect");
    // Only ever redirect to a same-site page, never an external URL.
    const safe = target && /^[a-zA-Z0-9_-]+\.html$/.test(target);
    return safe ? target : "index.html";
  }

  function setBusy(form, busy) {
    form.querySelector(".auth-submit-btn").disabled = busy;
  }

  // If already logged in, skip straight past this page.
  CareAuth.currentUser().then((user) => {
    if (user) window.location.href = redirectTarget();
  });

  // ---------------- Log in ----------------
  forms.login.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("login-error");
    errorEl.textContent = "";
    setBusy(forms.login, true);
    try {
      await CareAuth.logIn(
        document.getElementById("login-email").value.trim(),
        document.getElementById("login-password").value
      );
      window.location.href = redirectTarget();
    } catch (err) {
      errorEl.textContent = CareAuth.friendlyError(err);
      setBusy(forms.login, false);
    }
  });

  // ---------------- Sign up ----------------
  forms.signup.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("signup-error");
    errorEl.textContent = "";
    setBusy(forms.signup, true);
    try {
      await CareAuth.signUp(
        document.getElementById("signup-name").value.trim(),
        document.getElementById("signup-email").value.trim(),
        document.getElementById("signup-password").value
      );
      window.location.href = redirectTarget();
    } catch (err) {
      errorEl.textContent = CareAuth.friendlyError(err);
      setBusy(forms.signup, false);
    }
  });
})();