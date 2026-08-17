/* ============================================================
   auth.js — Google Sheets / Apps Script authentication
   ------------------------------------------------------------
   Passwords are hashed by the Apps Script backend. The browser
   stores only a short-lived signed session token, never the password.
   ============================================================ */

const CareAuth = (function () {
  const SESSION_KEY = "care_session";
  const USER_KEY = "care_user";

  function apiError(message, code) {
    const err = new Error(message || "Something went wrong. Please try again.");
    err.code = code || "care/error";
    return err;
  }

  async function request(action, data = {}, includeSession = true) {
    if (!CARE_API_URL || CARE_API_URL.includes("PASTE_YOUR_")) {
      throw apiError("Google Apps Script URL has not been added yet.", "care/config");
    }

    const body = { action, ...data };
    if (includeSession) body.token = localStorage.getItem(SESSION_KEY) || "";

    const response = await fetch(CARE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch (_) {
      throw apiError("The Google Sheets backend returned an invalid response.", "care/bad-response");
    }

    if (!result.success) {
      throw apiError(result.message || "Request failed.", result.code || "care/error");
    }

    return result;
  }

  function saveSession(result) {
    localStorage.setItem(SESSION_KEY, result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function cachedUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch (_) {
      return null;
    }
  }

  async function signUp(name, email, password) {
    if (!name || !email || !password) throw apiError("Please complete all fields.");
    if (password.length < 6) throw apiError("Password should be at least 6 characters.", "auth/weak-password");
    const result = await request("signup", { name, email, password }, false);
    saveSession(result);
    return result.user;
  }

  async function logIn(email, password) {
    const result = await request("login", { email, password }, false);
    saveSession(result);
    return result.user;
  }

  async function logOut() {
    clearSession();
    window.location.href = "login.html";
  }

  async function currentUser() {
    const token = localStorage.getItem(SESSION_KEY);
    if (!token) return null;

    try {
      const result = await request("session", {}, true);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      return result.user;
    } catch (err) {
      clearSession();
      return null;
    }
  }

  function friendlyError(err) {
    const map = {
      "auth/email-already-in-use": "That email is already registered — try logging in instead.",
      "auth/invalid-email": "That doesn't look like a valid email address.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/user-not-found": "No account found with that email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts — please wait a moment and try again.",
      "care/config": "The Google Apps Script URL hasn't been added to sheets-config.js yet.",
      "care/backend": "The Google Sheets backend could not be reached. Check the Apps Script deployment.",
    };
    return map[err && err.code] || (err && err.message) || "Something went wrong. Please try again.";
  }

  return { signUp, logIn, logOut, currentUser, friendlyError, request, cachedUser };
})();
