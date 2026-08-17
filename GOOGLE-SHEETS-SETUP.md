# CARE Google Sheets backend setup

The ZIP has been changed from Firebase Auth + Firestore to a Google Apps Script backend using the two Google Sheets supplied by you.

## Your two sheets

- Users: `1ipgnqXbUFZQtiWHWw4rp7sA-sBHOa4fQk4ivo8FLneY`
- Projects: `1qOpnMywYiM37ZHRlHCURI-n-BKCXpwSiEhnuQseql0k`

The Apps Script automatically creates the required header row in the **first tab** of each spreadsheet.

## 1. Create the backend

Create a Google Apps Script project. You can do this from either Google Sheet with **Extensions → Apps Script**. Paste the contents of `google-apps-script-Code.gs` into `Code.gs`.

The script must be able to edit both spreadsheets. If you created it from one of them, make sure the Google account running the web app has access to the other spreadsheet too.

## 2. Deploy it

In Apps Script:

1. Deploy → New deployment.
2. Select **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy.
6. Copy the URL ending in `/exec`.

Do not use the `/dev` test URL for the website.

## 3. Put the URL in CARE

Open `sheets-config.js` and replace:

`PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE`

with your `/exec` URL.

## 4. First test

Open the Apps Script web app `/exec` URL in a browser. It should return a small JSON response saying the service is online.

Then open CARE, create an account, and check the Users spreadsheet. A new row should appear.

Create an artefact and check the Projects spreadsheet. The project will be stored with the account's `userId`, so one user's projects are not returned to another user.

## Important security note

This is a school/demo backend. The script hashes passwords with a salt instead of storing plain-text passwords, and it uses signed session tokens. Nevertheless, Google Sheets is not a replacement for a production authentication/database service. For a public real-world application, use a dedicated auth/database service instead.
