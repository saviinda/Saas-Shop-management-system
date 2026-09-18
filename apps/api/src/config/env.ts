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
  },
  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    senderEmail: process.env.BREVO_SENDER_EMAIL || process.env.BREVO_SENDER || '',
    senderName: process.env.BREVO_SENDER_NAME || 'SaaS Platform Admin',
  },
  email: {
    host: process.env.SMTP_HOST || (process.env.BREVO_SMTP_KEY ? 'smtp-relay.brevo.com' : undefined),
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: process.env.BREVO_SMTP_USER || process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || '',
    pass: process.env.BREVO_SMTP_KEY || process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASSWORD || '',
    from: process.env.SMTP_FROM || process.env.EMAIL_FROM || '"SaaS Platform Admin" <noreply@saasplatform.com>',
  },
};
