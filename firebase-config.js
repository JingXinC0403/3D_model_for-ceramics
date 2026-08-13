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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
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
