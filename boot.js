/* ============================================================
   boot.js
   ------------------------------------------------------------
   Load this FIRST, before the backend scripts, on every
   page that depends on Google Sheets backend (index.html, create.html,
   project.html, login.html).

   Problem this solves: if Google Sheets backend fails to load or initialise
   for any reason (blocked by an ad-blocker/firewall, wrong API
   key, Firestore not enabled yet, offline, etc.) the rest of the
   page's scripts throw on their very first line ("auth is not
   defined") and everything downstream silently never runs. The
   user just sees a blank page with no explanation.

   This script shows a lightweight "Loading…" overlay immediately,
   listens for load/runtime errors on the Google Sheets backend scripts, and —
   if nothing has marked the page ready within a few seconds —
   swaps the overlay for a plain-language diagnostic panel instead
   of leaving the screen blank.

   Pages call `window.CareBoot.ready()` once real content is on
   screen (e.g. after auth resolves and the editor/dashboard is
   shown) to dismiss the overlay early.
   ============================================================ */

(function () {
  var TIMEOUT_MS = 9000;
  var dismissed = false;
  var overlay = null;
  var fatalReasons = [];

  function injectStyles() {
    var style = document.createElement("style");
    style.textContent =
      "#care-boot-overlay{position:fixed;inset:0;z-index:99999;display:flex;" +
      "align-items:center;justify-content:center;background:#f5f6f8;" +
      "font-family:'Atkinson Hyperlegible',sans-serif;padding:24px;}" +
      "#care-boot-overlay .care-boot-card{max-width:440px;text-align:center;}" +
      "#care-boot-overlay .care-boot-spinner{width:34px;height:34px;margin:0 auto 18px;" +
      "border:3px solid rgba(3,214,108,0.25);border-top-color:#03d66c;border-radius:50%;" +
      "animation:care-boot-spin 0.8s linear infinite;}" +
      "@keyframes care-boot-spin{to{transform:rotate(360deg);}}" +
      "#care-boot-overlay h2{font-size:18px;color:#1a2376;margin-bottom:8px;}" +
      "#care-boot-overlay p{font-size:14px;color:#4a4f6b;line-height:1.5;margin-bottom:6px;}" +
      "#care-boot-overlay ul{text-align:left;font-size:13px;color:#4a4f6b;margin:14px 0;" +
      "padding-left:20px;line-height:1.6;}" +
      "#care-boot-overlay .care-boot-error{font-size:12px;color:#b23b3b;background:#fdeceb;" +
      "border-radius:8px;padding:8px 10px;margin-top:10px;text-align:left;word-break:break-word;" +
      "display:none;}" +
      "#care-boot-overlay button{margin-top:16px;padding:10px 18px;border-radius:10px;" +
      "border:none;background:#03d66c;color:#fff;font-weight:700;font-size:14px;cursor:pointer;" +
      "font-family:inherit;}";
    document.head.appendChild(style);
  }

  function buildOverlay() {
    overlay = document.createElement("div");
    overlay.id = "care-boot-overlay";
    overlay.innerHTML =
      '<div class="care-boot-card">' +
      '<div class="care-boot-spinner"></div>' +
      '<h2 id="care-boot-heading">Loading C.A.R.E.…</h2>' +
      '<p id="care-boot-message">Connecting to your artefact collection.</p>' +
      "<ul hidden id=\"care-boot-checklist\">" +
      "<li>Check your internet connection.</li>" +
      "<li>Disable ad-blockers or privacy extensions for this site — they sometimes block Google Sheets backend/Google scripts.</li>" +
      "<li>Confirm Google Sheets backend is created (not just Authentication) in the Google Sheets backend console for this project.</li>" +
      "<li>Confirm the Firestore security rules allow signed-in users to read/write.</li>" +
      "</ul>" +
      '<div class="care-boot-error" id="care-boot-error"></div>' +
      "<button type=\"button\" id=\"care-boot-reload\">Try again</button>" +
      "</div>";
    document.body.appendChild(overlay);
    document.getElementById("care-boot-reload").addEventListener("click", function () {
      window.location.reload();
    });
  }

  function showFatal(message, detail) {
    if (dismissed) return;
    if (!overlay) return;
    document.getElementById("care-boot-heading").textContent = "Something's not connecting";
    document.getElementById("care-boot-message").textContent = message;
    document.getElementById("care-boot-checklist").hidden = false;
    var spinner = overlay.querySelector(".care-boot-spinner");
    if (spinner) spinner.style.display = "none";
    if (detail) {
      var errEl = document.getElementById("care-boot-error");
      errEl.style.display = "block";
      errEl.textContent = detail;
    }
  }

  function ready() {
    dismissed = true;
    clearTimeout(timer);
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }

  // Catch script-load failures (e.g. Google Sheets backend CDN blocked) and runtime
  // errors that happen before the page marks itself ready.
  window.addEventListener(
    "error",
    function (e) {
      if (dismissed) return;

      // Script failed to load entirely (network/ad-blocker block).
      if (e.target && e.target.tagName === "SCRIPT") {
        var src = e.target.src || "a required script";
        fatalReasons.push("Failed to load: " + src);
        showFatal(
          "A required script failed to load — likely blocked by an ad-blocker, firewall, or you're offline.",
          fatalReasons.join("\n")
        );
        return;
      }

      // Runtime error referencing Google Sheets backend globals almost always means
      // sheets-config.js never ran (see block above).
      var msg = (e.message || "") + "";
      if (/CARE_API_URL|CareStorage|CareAuth/i.test(msg)) {
        fatalReasons.push(msg);
        showFatal(
          "The app couldn't finish starting up, likely because Google Sheets backend didn't load or initialise correctly.",
          fatalReasons.join("\n")
        );
      }
    },
    true
  );

  var timer = setTimeout(function () {
    if (dismissed) return;
    showFatal(
      "This is taking much longer than expected, which usually means Google Sheets backend never finished connecting.",
      fatalReasons.length ? fatalReasons.join("\n") : "No error was reported — this can happen when Google Sheets backend hasn't been created yet in the Google Sheets backend console."
    );
  }, TIMEOUT_MS);

  injectStyles();
  document.addEventListener("DOMContentLoaded", buildOverlay);

  window.CareBoot = { ready: ready, showFatal: showFatal };
})();
