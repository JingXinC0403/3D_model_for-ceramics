javascript
/* ============================================================
   login.js
   ------------------------------------------------------------
   Handles login + signup.
   After a successful NEW signup, the user is sent to welcome.html
   so the introduction video can play.
   ============================================================ */

(function () {

  const tabs = document.querySelectorAll(".login-tab");

  const forms = {
    login: document.getElementById("login-form"),
    signup: document.getElementById("signup-form")
  };

  const blurb = document.getElementById("login-blurb");

  const blurbText = {
    login:
      "Log in to see your museum's artefacts — everyone on your account sees the same live data.",

    signup:
      "Create an account so your team can share one live view of every artefact."
  };


  /* ---------------- TAB SWITCHING ---------------- */

  tabs.forEach((tab) => {

    tab.addEventListener("click", () => {

      tabs.forEach((t) => t.classList.remove("active"));

      tab.classList.add("active");

      Object.values(forms).forEach((form) => {
        form.classList.remove("active-form");
      });

      forms[tab.dataset.tab].classList.add("active-form");

      blurb.textContent = blurbText[tab.dataset.tab];

    });

  });


  /* ---------------- BUTTON LOADING ---------------- */

  function setBusy(form, busy) {

    const button = form.querySelector(".auth-submit-btn");

    if (button) {
      button.disabled = busy;
    }

  }


  /* ---------------- LOGIN ---------------- */

  forms.login.addEventListener("submit", async (e) => {

    e.preventDefault();

    const errorEl = document.getElementById("login-error");

    errorEl.textContent = "";

    const email =
      document.getElementById("login-email").value.trim();

    const password =
      document.getElementById("login-password").value;


    /* Check fields BEFORE calling backend */

    if (!email || !password) {

      errorEl.textContent =
        "Please enter your email and password.";

      return;

    }


    setBusy(forms.login, true);


    try {

      await CareAuth.logIn(email, password);

      /* Existing users go directly to dashboard */

      window.location.href = "index.html";

    }

    catch (err) {

      errorEl.textContent =
        CareAuth.friendlyError(err);

      setBusy(forms.login, false);

    }

  });


  /* ---------------- SIGN UP ---------------- */

  forms.signup.addEventListener("submit", async (e) => {

    e.preventDefault();

    const errorEl =
      document.getElementById("signup-error");

    errorEl.textContent = "";


    /* Get the THREE signup fields */

    const name =
      document.getElementById("signup-name").value.trim();

    const email =
      document.getElementById("signup-email").value.trim();

    const password =
      document.getElementById("signup-password").value;


    /* IMPORTANT:
       Do not let an empty field reach CareAuth */

    if (!name || !email || !password) {

      errorEl.textContent =
        "Please complete all fields.";

      return;

    }


    if (password.length < 6) {

      errorEl.textContent =
        "Password should be at least 6 characters.";

      return;

    }


    setBusy(forms.signup, true);


    try {

      /* Create account */

      await CareAuth.signUp(
        name,
        email,
        password
      );


      /*
       * NEW USER:
       * Show the introduction video.
       */

      window.location.href = "welcome.html";

    }

    catch (err) {

      errorEl.textContent =
        CareAuth.friendlyError(err);

      setBusy(forms.signup, false);

    }

  });


})();

