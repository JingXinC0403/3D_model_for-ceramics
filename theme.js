/* ============================================================
   theme.js
   ------------------------------------------------------------
   Shared dark/light mode toggle. Matches the behaviour already
   used on the dashboard (index.html / home.js): toggles a
   `dark-mode` class on <body> and remembers the choice in
   localStorage under "care-theme" so it stays in sync across
   every CARE page.

   Include this with a `defer` attribute, after the page's own
   CSS, and make sure the page has a button with id="theme-toggle"
   somewhere in its top-actions bar:

     <button id="theme-toggle" class="theme-toggle" type="button"
             aria-label="Toggle dark mode">☾</button>

     <script defer src="theme.js"></script>
   ============================================================ */

(function () {
  // Apply the saved theme as early as possible to avoid a flash
  // of the wrong theme.
  if (localStorage.getItem("care-theme") === "dark") {
    document.body.classList.add("dark-mode");
  }

  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return;

  function updateThemeButton() {
    const dark = document.body.classList.contains("dark-mode");
    themeToggle.textContent = dark ? "☀" : "☾";
    themeToggle.setAttribute(
      "aria-label",
      dark ? "Switch to light mode" : "Switch to dark mode"
    );
  }

  updateThemeButton();

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const dark = document.body.classList.contains("dark-mode");
    localStorage.setItem("care-theme", dark ? "dark" : "light");
    updateThemeButton();
  });
})();
