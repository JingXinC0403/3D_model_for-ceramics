
(function () {
  const navEl = document.querySelector("nav");
  if (!navEl) return;

  let isHovering = false;
  let hideTimer = null;
  const HIDE_DELAY = 1200;

  const isMobile = () => window.innerWidth <= 800;

  function showNav() {
    navEl.classList.remove("nav-hidden");
  }

  function scheduleHide() {
    clearTimeout(hideTimer);

    if (isMobile()) {
      showNav();
      return;
    }

    hideTimer = setTimeout(() => {
      if (!isHovering) {
        navEl.classList.add("nav-hidden");
      }
    }, HIDE_DELAY);
  }

  window.addEventListener(
    "scroll",
    () => {
      showNav();
      scheduleHide();
    },
    { passive: true }
  );

  navEl.addEventListener("mouseenter", () => {
    if (isMobile()) return;
    isHovering = true;
    clearTimeout(hideTimer);
    showNav();
  });

  navEl.addEventListener("mouseleave", () => {
    if (isMobile()) return;
    isHovering = false;
    scheduleHide();
  });

  const HOVER_ZONE_HEIGHT = 12;

  document.addEventListener(
    "mousemove",
    (e) => {
      if (isMobile()) return;

      if (e.clientY <= navEl.offsetHeight + HOVER_ZONE_HEIGHT) {
        isHovering = true;
        clearTimeout(hideTimer);
        showNav();
      } else if (isHovering) {
        isHovering = false;
        scheduleHide();
      }
    },
    { passive: true }
  );

  navEl.addEventListener("touchstart", () => {
    if (isMobile()) return;
    isHovering = true;
    clearTimeout(hideTimer);
    showNav();
  });

  if (isMobile()) {
    showNav();
  } else {
    scheduleHide();
  }
})();

// Sidebar
function showSidebar() {
  document.querySelector(".sidebar").style.display = "flex";
}

function hideSidebar() {
  document.querySelector(".sidebar").style.display = "none";
}

// Theme
const themeToggleBtn = document.querySelector(".theme-toggle");
const themeIcon = document.getElementById("theme-icon");

// Load saved theme
window.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
    themeIcon.textContent = "🌙";
  } else {
    document.body.classList.remove("dark-theme");
    themeIcon.textContent = "☀️";
  }
});

function toggleTheme() {
  themeToggleBtn.classList.add("flip");

  setTimeout(() => {
    if (document.body.classList.contains("dark-theme")) {
      document.body.classList.remove("dark-theme");
      themeIcon.textContent = "☀️";
      localStorage.setItem("theme", "light");
    } else {
      document.body.classList.add("dark-theme");
      themeIcon.textContent = "🌙";
      localStorage.setItem("theme", "dark");
    }
  }, 200);

  setTimeout(() => {
    themeToggleBtn.classList.remove("flip");
  }, 400);
}

// Live Clock
function updateClock() {
    const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

    const desktopClock = document.getElementById("live-clock");
    const mobileClock = document.getElementById("live-clock-mobile");

    if (desktopClock) desktopClock.textContent = time;
    if (mobileClock) mobileClock.textContent = time;
}

updateClock();
setInterval(updateClock, 1000);


// -------------------- Active navigation link --------------------

document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll("nav a[href]").forEach(link => {
    const linkPage = link.getAttribute("href").split("/").pop();

    if (linkPage === currentPage) {
      link.classList.add("active");
    }
  });
});
document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll("nav .main-menu a").forEach((link) => {
    const linkPage = link.getAttribute("href");

    if (linkPage === currentPage) {
      link.classList.add("active");
    }
  });
});