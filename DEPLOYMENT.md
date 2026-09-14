# HostelGrievance Production Deployment Guide

This guide provides simple, step-by-step instructions for deploying **HostelGrievance** using **Vercel** for the frontend and **Render** (or Railway) for the persistent backend.

---

## Why this Architecture?

1. **Frontend on Vercel**:
   - Vercel is designed for Vite + React single-page applications. It serves static assets globally via CDN with automatic HTTPS, instant rollbacks, and fast builds.
2. **Backend on Render / Railway**:
   - The backend uses **Hono**, **SQLite (`better-sqlite3`)**, and local file attachments (`uploads/`).
   - Serverless platforms like Vercel Functions have read-only, ephemeral filesystems that wipe local files on every cold start. A persistent container host (like Render or Railway) keeps your database and uploaded images safe and intact.
3. **Seamless Integration (Zero CORS)**:
   - When requests go through Vercel's rewrite proxy or use `VITE_API_URL`, the browser communicates seamlessly, and CSRF protection and HTTP-only session cookies work out of the box.

---

## Part 1: Deploy Backend (Render.com)

Render offers a free tier for Node.js web services.

1. Push your code to your GitHub repository:
   ```bash
   git add .
   git commit -m "Configure Vercel and Render deployment"
   git push origin main
   ```
2. Go to [dashboard.render.com](https://dashboard.render.com/) and log in.
3. Click **New +** → **Web Service**.
4. Select **Build and deploy from a Git repository** and pick your `Techie_Dominators_learnathon5.0` repository.
5. Fill in the following settings:
   - **Name**: `hostel-grievance-api`
   - **Language**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
6. Under **Environment Variables**, add:
   - `NODE_ENV` = `production`
   - `TRUST_PROXY` = `true`
   - `HOSTEL_ALLOWED_ORIGINS` = `*`
7. Click **Create Web Service**.
8. Wait for the deploy to finish. Copy your backend service URL (e.g. `https://hostel-grievance-api.onrender.com`).
   - You can test it by visiting: `https://hostel-grievance-api.onrender.com/api/health` — it will return `{ "ok": true, "database": "up" }`.

---

## Part 2: Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com/) and log in with your GitHub account.
2. Click **Add New...** → **Project**.
3. Import your `Techie_Dominators_learnathon5.0` repository.
4. Vercel will automatically detect **Vite**:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. **Connect to Backend** (Choose Option A or Option B):

### Option A (Recommended — Vercel Proxy):
In your project's [`vercel.json`](file:///d:/PROJECTS/Hostel%20Grievence/vercel.json), set your backend destination:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "cleanUrls": true,
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend-name.onrender.com/api/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
Commit and push. Vercel will automatically redeploy!

### Option B (Environment Variable):
In the Vercel project deployment screen:
- Expand **Environment Variables**.
- Add:
  - Key: `VITE_API_URL`
  - Value: `https://your-backend-name.onrender.com`
- Click **Deploy**.

---

## Part 3: Test Your Deployed Site

Once Vercel finishes building, you will get a URL like `https://hostel-grievance.vercel.app`.

1. Open the URL in your browser.
2. Log in using any default pre-seeded credentials:
   - **Student**: `stu-1@hostel.edu` / `password123456`
   - **Warden**: `war-1@hostel.edu` / `password123456`
   - **Admin**: `adm-1@hostel.edu` / `password123456`
3. Try filing a grievance, uploading an image, changing grievance status, or viewing notices.
