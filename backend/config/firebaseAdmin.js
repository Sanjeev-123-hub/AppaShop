/**
 * config/firebaseAdmin.js
 *
 * Initialises the Firebase Admin SDK (server-side).
 * Admin SDK uses a service-account key — it is NEVER sent
 * to the browser and lives only in your .env file.
 *
 * HOW TO GET YOUR SERVICE-ACCOUNT KEY:
 *   Firebase Console → Project Settings → Service accounts
 *   → Generate new private key  → download JSON
 *   → paste the JSON path into FIREBASE_SERVICE_ACCOUNT_PATH in .env
 *   OR paste the whole JSON as FIREBASE_SERVICE_ACCOUNT_JSON in .env
 */

"use strict";

const admin = require("firebase-admin");

// Prevent re-initialising if already done (important in hot-reload dev)
if (!admin.apps.length) {
  let credential;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Option A: entire JSON stored as an environment variable (Vercel / Railway)
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    // Option B: local file path (development)
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    credential = admin.credential.cert(serviceAccount);
  } else {
    throw new Error(
      "❌  Firebase Admin credentials not found.\n" +
      "    Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in .env"
    );
  }

  admin.initializeApp({
    credential,
    databaseURL: process.env.FIREBASE_DATABASE_URL, // optional, only for Realtime DB
  });

  console.log("🔥  Firebase Admin SDK initialised");
}

// Export the Firestore instance — import this in controllers
const db = admin.firestore();

module.exports = { admin, db };