/* ============================================================
   auth.js
   ------------------------------------------------------------
   Thin wrapper around Firebase Auth. Used by login.html (sign up
   / log in forms) and auth-guard.js (checking session state on
   the protected pages).
   ============================================================ */

const CareAuth = (function () {
  function friendlyError(err) {
    const map = {
      "auth/email-already-in-use": "That email is already registered — try logging in instead.",
      "auth/invalid-email": "That doesn't look like a valid email address.",
      "auth/weak-password": "Password should be at least 6 characters.",
      "auth/user-not-found": "No account found with that email.",
      "auth/wrong-password": "Incorrect password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts — please wait a moment and try again.",
    };
    return (err && map[err.code]) || (err && err.message) || "Something went wrong. Please try again.";
  }

  async function signUp(name, email, password) {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    if (name) {
      await cred.user.updateProfile({ displayName: name });
    }
    return cred.user;
  }

  async function logIn(email, password) {
    const cred = await auth.signInWithEmailAndPassword(email, password);
    return cred.user;
  }

  async function logOut() {
    await auth.signOut();
  }

  // Resolves once with the current user (or null) instead of firing
  // repeatedly like onAuthStateChanged — convenient for a one-time
  // "am I logged in?" check on page load.
  function currentUser() {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  return { signUp, logIn, logOut, currentUser, friendlyError };
})();