# Why the Create page looked broken, and what was changed

## What was actually happening

`create.html` (and `index.html` / `project.html`) start with the whole
content area hidden (`display:none`) until Firebase finishes signing you
in. If Firebase ever fails to load or initialise — a blocked script, no
internet, an ad-blocker, or a Firestore database that hasn't been created
yet — every script on the page throws on its very first line and nothing
ever un-hides the content. You just get a **blank page**, with no error
message, which looks exactly like "the page isn't working."

I confirmed this is the failure mode by simulating a blocked Firebase load
against the actual site code.

## What I changed

Added `boot.js`, loaded first on `index.html`, `create.html`, and
`project.html`, before the Firebase scripts. It:

- Shows a "Loading…" spinner immediately, so the page is never blank.
- Listens for script-load failures and Firebase-related runtime errors.
- After ~9 seconds with no result, or immediately on a caught error, shows
  a plain-language panel explaining likely causes plus a "Try again"
  button — instead of staying blank forever.
- Is dismissed automatically by `create.js` / `home.js` / `project.js` the
  moment the real page content is ready.

No other logic was changed — the editor, autosave, camera connection, and
Firestore save/edit/delete code was already correct and was verified by
running it in a headless simulation (name entry → autosave → Firestore
write → navigation all completed with zero runtime errors).

## If you still see the diagnostic panel after this fix

That means Firebase genuinely isn't connecting, and the panel will tell
you which of these it is. Most common causes, in order of likelihood:

1. **Firestore Database was never created.** Having Authentication enabled
   is not the same as having Firestore enabled. In the
   [Firebase console](https://console.firebase.google.com) → your project
   → *Build → Firestore Database* → **Create database** (test mode is
   fine to start).
2. **Security rules block writes.** Under *Firestore Database → Rules*,
   make sure they match `firestore.rules` in this folder:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /artefacts/{artefactId} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
3. **An ad-blocker or privacy extension** is blocking
   `gstatic.com`/`googleapis.com` scripts. Try disabling it for this site,
   or open in a private window with extensions off.
4. **Opened via `file://` instead of a server.** Some browsers restrict
   Firebase's networking on the `file://` origin. Serve the folder locally
   instead, e.g. `npx serve CARE` or `python3 -m http.server` from inside
   the `CARE` folder, then open `http://localhost:...`.
