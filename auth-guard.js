/* ============================================================
   auth-guard.js
   ------------------------------------------------------------
   Include on every page that should require a logged-in user
   (index.html, create.html, project.html). Do NOT include on
   login.html — that page needs to be reachable while signed out.

   - Redirects to login.html if nobody is signed in.
   - Injects an account chip (email + Log out) into the nav once
     a user is confirmed, so you don't have to hand-edit the nav
     markup on every page.
   ============================================================ */

(function () {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      const here = window.location.pathname.split("/").pop();
      window.location.href = `login.html?redirect=${encodeURIComponent(here)}`;
      return;
    }
    injectAccountControl(user);
  });

  function injectAccountControl(user) {
    const label = user.displayName || user.email || "Account";

    // Desktop nav
    const mainMenu = document.querySelector("nav ul.main-menu");
    if (mainMenu && !mainMenu.querySelector(".account-chip")) {
      const li = document.createElement("li");
      li.className = "account-chip hideOnMobile";
      li.innerHTML = `
        <span class="account-email" title="${escapeHtml(user.email || "")}">${escapeHtml(label)}</span>
        <button type="button" class="logout-btn" onclick="CareAuth.logOut()">Log out</button>
      `;
      const themeToggle = mainMenu.querySelector(".theme-toggle");
      if (themeToggle) mainMenu.insertBefore(li, themeToggle);
      else mainMenu.appendChild(li);
    }

    // Mobile sidebar
    const sidebar = document.querySelector("nav ul.sidebar");
    if (sidebar && !sidebar.querySelector(".account-chip")) {
      const li = document.createElement("li");
      li.className = "account-chip";
      li.innerHTML = `
        <span class="account-email">${escapeHtml(label)}</span>
        <button type="button" class="logout-btn" onclick="CareAuth.logOut()">Log out</button>
      `;
      sidebar.appendChild(li);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();