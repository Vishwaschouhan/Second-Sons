import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');

if (!admin.apps.length) {
  if (existsSync(serviceAccountPath)) {
    // Option 1: Use service account JSON file
    console.log('[Firebase] Initializing with service account key file');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    // Option 2: Use service account JSON from environment variable
    console.log('[Firebase] Initializing with service account from env var');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Option 3: Use project ID with Application Default Credentials (for local dev with gcloud auth)
    console.log('[Firebase] Initializing with project ID + ADC:', process.env.FIREBASE_PROJECT_ID);
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    } catch (err) {
      console.error('[Firebase] Failed to initialize with ADC. Trying project-only init...');
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
    }
  } else {
    console.error('[Firebase] ⚠ WARNING: No Firebase credentials found!');
    console.error('[Firebase] Please do ONE of the following:');
    console.error('[Firebase]   1. Place serviceAccountKey.json in backend/ directory');
    console.error('[Firebase]   2. Set FIREBASE_SERVICE_ACCOUNT_JSON env var');
    console.error('[Firebase]   3. Set FIREBASE_PROJECT_ID and run "gcloud auth application-default login"');
    // Initialize with minimal config — Firestore operations will fail with clear errors
    admin.initializeApp({
      projectId: 'unknown-project',
    });
  }
}

export const adminDb = admin.firestore();
export default admin;
