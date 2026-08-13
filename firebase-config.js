/* ============================================================
   firebase-config.js
   ------------------------------------------------------------
   Central Firebase setup, shared by every page.

   1. Go to https://console.firebase.google.com → create a project
      (free "Spark" plan is enough for this).
   2. Project settings → General → "Your apps" → add a Web app →
      copy the config object it gives you into firebaseConfig below.
   3. Build → Authentication → Sign-in method → enable "Email/Password".
   4. Build → Firestore Database → Create database → start in
      **test mode** while developing (see the security-rules note
      at the bottom of this file before you go live).
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDKENANx2rV7imPNsp5_tYRE5evsRzk4nM",
  authDomain: "care-8ae9e.firebaseapp.com",
  projectId: "care-8ae9e",
  storageBucket: "care-8ae9e.firebasestorage.app",
  messagingSenderId: "285081077754",
  appId: "1:285081077754:web:18de91105b6f9ef3e84643",
  measurementId: "G-0ZZQGT17MD"
};

firebase.initializeApp(firebaseConfig);

// Exposed globally so auth.js / storage.js / auth-guard.js can use them
// without any module/import setup — matches the plain-script style of
// the rest of the site.
const auth = firebase.auth();
const db = firebase.firestore();

/* ============================================================
   FIRESTORE SECURITY RULES (set these in the Firebase console
   under Firestore Database → Rules — don't skip this before
   sharing the site publicly, "test mode" allows anyone to read
   and write):

   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artefacts/{docId} {
         allow read, write: if request.auth != null;
       }
     }
   }

   This allows any signed-in user to read and write any artefact —
   matching "everyone sees the same info" from the brief. If you
   later want each artefact locked to its creator, change the write
   rule to check request.auth.uid == resource.data.createdBy.
   ============================================================ */