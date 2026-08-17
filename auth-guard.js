/* ============================================================
   auth-guard.js
   ------------------------------------------------------------
   Protects dashboard/create/project pages using the Apps Script
   session token managed by CareAuth.
   ============================================================ */

(function () {
  document.addEventListener("DOMContentLoaded", async () => {
    const user = await CareAuth.currentUser();
    if (!user) {
      const here = window.location.pathname.split("/").pop() || "index.html";
      window.location.href = `login.html?redirect=${encodeURIComponent(here)}`;
      return;
    }
    injectAccountControl(user);
  });

  function injectAccountControl(user) {
    const label = user.name || user.email || "Account";

    const mainMenu = document.querySelector("nav ul.main-menu");
    if (mainMenu && !mainMenu.querySelector(".account-chip")) {
      const li = document.createElement("li");
      li.className = "account-chip hideOnMobile";
      li.innerHTML = `
        <span class="account-email" title="${escapeHtml(user.email || "")}">${escapeHtml(label)}</span>
        <button type="button" class="logout-btn">Log out</button>
      `;
      li.querySelector(".logout-btn").addEventListener("click", () => CareAuth.logOut());
      const themeToggle = mainMenu.querySelector(".theme-toggle");
      if (themeToggle) mainMenu.insertBefore(li, themeToggle);
      else mainMenu.appendChild(li);
    }

    const sidebar = document.querySelector("nav ul.sidebar");
    if (sidebar && !sidebar.querySelector(".account-chip")) {
      const li = document.createElement("li");
      li.className = "account-chip";
      li.innerHTML = `<span class="account-email">${escapeHtml(label)}</span><button type="button" class="logout-btn">Log out</button>`;
      li.querySelector(".logout-btn").addEventListener("click", () => CareAuth.logOut());
      sidebar.appendChild(li);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
