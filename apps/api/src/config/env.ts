import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

function parsePrivateKey(key?: string): string | undefined {
  if (!key) return undefined;
  
  // Remove wrapping quotes if present
  let cleanKey = key.trim();
  if ((cleanKey.startsWith('"') && cleanKey.endsWith('"')) || (cleanKey.startsWith("'") && cleanKey.endsWith("'"))) {
    cleanKey = cleanKey.slice(1, -1);
  }

  // Replace literal '\n' string with actual newline characters
  cleanKey = cleanKey.replace(/\\n/g, '\n');

  // Normalize Windows line endings
  cleanKey = cleanKey.replace(/\r\n/g, '\n');

  return cleanKey;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super_secret_jwt_key_for_saas_comm_shop_management_2026',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  firebase: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  }
};
