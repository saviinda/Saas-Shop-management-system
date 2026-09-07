# 🚀 Firebase Hosting & Deployment Guide

This guide details how to deploy the **Multi-Tenant SaaS Communication & Shop Management System** to **Firebase**.

---

## 📋 Prerequisites

1. **Firebase Account & Project**:
   - Go to [Firebase Console](https://console.firebase.google.com/) and create or select a project (e.g., `my-saas-platform`).
   - Enable **Firestore Database** in Native Mode.
   - Enable **Firebase Storage**.
   - (Optional) Enable **Authentication**.

---

## ⚡ Quick Deployment Steps

### Step 1: Login to Firebase CLI
Run the following command in the project root:
```bash
npm run firebase:login
```
*(Or `npx firebase login`)* — this opens your browser to authenticate.

---

### Step 2: Connect Your Firebase Project
Link your Firebase project to this repository:
```bash
npx firebase use --add
```
Select your Firebase project from the list and give it an alias (e.g., `default`).

Alternatively, replace `"your-firebase-project-id"` in `.firebaserc` with your actual Firebase Project ID:
```json
{
  "projects": {
    "default": "your-actual-firebase-project-id"
  }
}
```

---

### Step 3: Configure Environment Variables
Before building for production, set your production backend API URL:

In `apps/admin-web/.env.local` (or `apps/admin-web/.env.production`):
```env
NEXT_PUBLIC_API_URL=https://your-backend-api-domain.com/api/v1
```

---

### Step 4: Build & Deploy

To build the optimized Next.js static bundle and deploy everything (Hosting + Firestore Rules + Storage Rules):
```bash
npm run deploy
```

#### Individual Deployment Commands:
| Command | Action |
| :--- | :--- |
| `npm run deploy:hosting` | Build & deploy Next.js Web Admin Panels only |
| `npm run deploy:firestore` | Deploy Firestore security rules and index definitions |
| `npm run deploy:storage` | Deploy Cloud Storage security rules |

---

## 🌐 Hosting the Backend API (`apps/api`)

The Node.js Express API (`apps/api`) can be hosted using any of the following options:

### Option A: Google Cloud Run (Recommended for Node.js Express)
Cloud Run runs your Express container directly alongside Firebase Hosting.
1. Build and deploy to Cloud Run:
   ```bash
   gcloud run deploy saas-api --source apps/api --platform managed --allow-unauthenticated
   ```
2. Copy the resulting Cloud Run service URL and paste it as `NEXT_PUBLIC_API_URL` in `apps/admin-web/.env.local`.

### Option B: Node.js Cloud Hosting (Render, Railway, DigitalOcean, VPS)
1. Deploy `apps/api` with environment variables (`PORT`, `JWT_SECRET`, `FIREBASE_PROJECT_ID`, etc.).
2. Point `NEXT_PUBLIC_API_URL` in `apps/admin-web` to the live backend URL.

---

## 📁 File Structure Overview

- [firebase.json](file:///g:/Codezela/SaaS-based%20Communication%20and%20Shop%20Management%20System/firebase.json): Configures Hosting public directory (`apps/admin-web/out`), URL rewrites, and security rules paths.
- [.firebaserc](file:///g:/Codezela/SaaS-based%20Communication%20and%20Shop%20Management%20System/.firebaserc): Connects the local repository to your Firebase project ID.
- [firestore.rules](file:///g:/Codezela/SaaS-based%20Communication%20and%20Shop%20Management%20System/firestore.rules): Security rules for Cloud Firestore.
- [storage.rules](file:///g:/Codezela/SaaS-based%20Communication%20and%20Shop%20Management%20System/storage.rules): Security rules for Cloud Storage (bank slips, images, receipts).
- [apps/admin-web/next.config.js](file:///g:/Codezela/SaaS-based%20Communication%20and%20Shop%20Management%20System/apps/admin-web/next.config.js): Configured with `output: 'export'` for fast, static Firebase CDN hosting.
