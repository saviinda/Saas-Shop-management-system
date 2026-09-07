# 🔺 Vercel Deployment Guide

This guide walks you through deploying the **SaaS Administrative Web Application (`@saas/admin-web`)** to **Vercel**.

---

## 🚀 Method 1: Deploy via Vercel Dashboard (Recommended with Git)

If your project is pushed to **GitHub**, **GitLab**, or **Bitbucket**:

1. **Go to [Vercel Dashboard](https://vercel.com/new)** and click **"Add New Project"**.
2. **Import your Git repository**.
3. In the **Configure Project** screen:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click *Edit* and select:
     ```
     apps/admin-web
     ```
   - **Build & Development Settings**:
     - *Build Command*: Leave default or enter `npm run build`
     - *Output Directory*: Leave default (`.next`)
     - *Install Command*: `npm install`
4. **Environment Variables**:
   - Add your live backend API URL:
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: `https://your-backend-api-domain.com/api/v1`
5. Click **Deploy**.

---

## ⚡ Method 2: Deploy via Vercel CLI (Instant from Terminal)

You can deploy directly from your local terminal using the pre-configured scripts:

### Step 1: Log in to Vercel
```bash
npm run vercel:login
```
*(Or `npx vercel login`)* — Follow the browser instructions to authenticate.

### Step 2: Deploy Preview
```bash
npm run vercel:deploy
```
- Set up and deploy? **Y**
- Which scope? Select your account / team.
- Link to existing project? **N** (if first time)
- Project name? e.g. `saas-shop-management`
- In which directory is your code located? `./`
- Want to modify settings? **N**

### Step 3: Deploy to Production
```bash
npm run vercel:deploy:prod
```

---

## 🌐 Connecting your Backend API (`apps/api`)

The Next.js frontend connects to your backend API via `NEXT_PUBLIC_API_URL`.

1. Host `apps/api` on your preferred backend service:
   - **Google Cloud Run**
   - **Render / Railway / Fly.io / DigitalOcean / VPS**
2. In your Vercel Project Settings $\rightarrow$ **Environment Variables**:
   - Set `NEXT_PUBLIC_API_URL` to your production backend URL (e.g. `https://api.yourdomain.com/api/v1`).
3. Trigger a redeploy on Vercel to apply the updated environment variable.

---

## 📁 Related Configuration Files

- [vercel.json](file:///g:/Codezela/SaaS-based%20Communication%20and%20Shop%20Management%20System/vercel.json): Vercel monorepo configuration with workspace build commands.
- [apps/admin-web/next.config.js](file:///g:/Codezela/SaaS-based%20Communication%20and%20Shop%20Management%20System/apps/admin-web/next.config.js): Optimized for both Vercel native deployment and edge environments.
