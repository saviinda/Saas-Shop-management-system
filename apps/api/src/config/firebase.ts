import * as admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';
import { config } from './env';

let isFirebaseInitialized = false;

// Check for local serviceAccountKey.json file first (preferred & immune to escaping issues)
const localKeyPaths = [
  config.firebase.serviceAccountPath ? path.resolve(config.firebase.serviceAccountPath) : null,
  path.resolve(process.cwd(), 'serviceAccountKey.json'),
  path.resolve(__dirname, '../../serviceAccountKey.json'),
].filter(Boolean) as string[];

const foundKeyFile = localKeyPaths.find(p => fs.existsSync(p));

if (foundKeyFile) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(foundKeyFile, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: config.firebase.storageBucket || `${serviceAccount.project_id}.appspot.com`,
    });
    isFirebaseInitialized = true;
    console.log(`Firebase Admin SDK initialized successfully using service account file: ${foundKeyFile}`);
  } catch (error) {
    console.error('Failed to initialize Firebase from serviceAccountKey.json:', error);
  }
} else if (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
      storageBucket: config.firebase.storageBucket,
    });
    isFirebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully using environment variables.');
  } catch (error) {
    console.warn('Firebase Admin SDK initialization failed:', error);
  }
} else {
  console.log('Firebase credentials not supplied in env. Operating with built-in storage engine.');
}

const firestoreInstance = isFirebaseInitialized ? admin.firestore() : null;
if (firestoreInstance) {
  try {
    firestoreInstance.settings({ ignoreUndefinedProperties: true });
  } catch (e) {
    console.warn('Could not apply ignoreUndefinedProperties settings on Firestore:', e);
  }
}

export const firebaseAdmin = isFirebaseInitialized ? admin : null;
export const firestore = firestoreInstance;
export const firebaseAuth = isFirebaseInitialized ? admin.auth() : null;
