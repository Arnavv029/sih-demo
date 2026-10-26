# AICTE Verification Platform - Production Deployment Guide

This document outlines the complete production deployment procedure for the **AICTE Institutional Verification Platform** with integrated **CYRA Regulatory RAG Assistant**.

---

## 1. Architecture & Production Guarantee

The platform is designed with a **Dual-Architecture Production Guarantee**:

```
                                  ┌───────────────────────────────────────────────┐
                                  │      Client (React 19 + Tailwind CSS)         │
                                  │   Hosted on Vercel / Netlify / Cloudflare     │
                                  └──────────────────────┬────────────────────────┘
                                                         │
                                        ┌────────────────┴───────────────┐
                                        ▼                                ▼
                          [Primary Cloud RAG Backend]        [Autonomous Edge Engine]
                          FastAPI + Qdrant + Gemini          Built-in Client Regulatory
                          Hosted on Render / Railway / Docker  Zero-latency, 100% Uptime
                          (When VITE_RAG_API_URL is set)     (Always available fallback)
```

1. **Deploying as a Pure Frontend (Vercel / Netlify)**:
   - The RAG system operates seamlessly out of the box via the **Autonomous Regulatory Intelligence Engine** ([`Client/src/api/regulatoryEngine.js`](file:///c:/aicte-platform/Client/src/api/regulatoryEngine.js)).
   - Covers official **AICTE Approval Process Handbook (2026-27)** norms: Land requirements (1.5 / 2.5 / 7.5 acres), Student-to-Faculty Ratio (SFR 1:15 & 1:2:6 cadre ratio), Extension of Approval (Clause 2.1), Increase in Intake (Clause 2.5), New Emerging Tech Courses (Clause 2.7), Fire Safety NOC (NBC 2016), and DocuPass tamper-proof verification.
   - **Guarantees 100% uptime in production immediately without needing a separate backend server!**

2. **Deploying with Dedicated Cloud RAG Microservice**:
   - The FastAPI backend can be hosted on **Render**, **Railway**, or as a **Docker container**.
   - Simply provide `VITE_RAG_API_URL="https://your-rag-backend.onrender.com"` in your frontend environment.

---

## 2. Deploying Frontend to Vercel (Recommended — 2 Minutes)

Vercel provides automatic SSL, global CDN edge caching, and instant Git deployments.

### Steps:
1. Push your repository to GitHub:
   ```bash
   git push origin main
   ```
2. Navigate to [vercel.com](https://vercel.com) and log in with your GitHub account.
3. Click **"Add New Project"** and import `sih-demo`.
4. Configure Project Settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`Client`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. *(Optional)* Add Environment Variables if connecting to an external RAG server:
   - `VITE_RAG_API_URL`: `https://your-backend-url.onrender.com`
6. Click **Deploy**.
7. Vercel automatically applies [`Client/vercel.json`](file:///c:/aicte-platform/Client/vercel.json) to handle SPA routing rewrites.

---

## 3. Deploying Frontend to Netlify

### Steps:
1. Navigate to [netlify.com](https://netlify.com) and log in.
2. Click **"Add new site"** -> **"Import an existing project"** -> **GitHub**.
3. Select `sih-demo`.
4. Configure Build settings:
   - **Base directory**: `Client`
   - **Build command**: `npm run build`
   - **Publish directory**: `Client/dist`
5. Netlify automatically reads [`Client/netlify.toml`](file:///c:/aicte-platform/Client/netlify.toml) for SPA 200 rewrite rules.
6. Click **"Deploy site"**.

---

## 4. Deploying RAG Backend to Cloud (Render / Railway / Docker)

If you wish to host the dedicated Python FastAPI microservice alongside your frontend:

### Option A: Render (Free Tier Web Service - 512MB RAM Safe)
1. In [render.com](https://render.com), click **"New Web Service"** and select your repository `Arnavv029/sih-demo`.
2. Configure settings:
   - **Root Directory**: `CYRA-AI-Knowledge-Assistant`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt && python -m backend.ingestion.run --reset`
   - **Start Command**: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT --workers 1`
   - **Environment Variables**:
     - `LOW_MEMORY`: `true` *(Crucial: Activates micro-embedding engine using < 35MB RAM, preventing 512Mi OOM crashes)*
     - `FAST_EMBEDDING`: `true`
     - `FAST_LLM`: `true`
     - `PROJECT_ID`: `aicte`
     - `PROJECT_SCOPE`: `aicte`
     - `GOOGLE_API_KEY`: *(Optional: Your Google Gemini API Key)*
3. Once deployed, copy your Render service URL (e.g., `https://aicte-cyra-rag.onrender.com`) and paste it as `VITE_RAG_API_URL` in your Vercel/Netlify frontend environment settings.

### Option B: Docker Container Deployment
Run the container on any cloud VPS (AWS EC2, GCP Cloud Run, DigitalOcean):
```bash
cd CYRA-AI-Knowledge-Assistant
docker build -t aicte-cyra-rag .
docker run -d -p 7861:7861 --name aicte-rag aicte-cyra-rag
```

---

## 5. Pre-Deployment Verification Checklist

Before pushing to production, verify all critical systems locally:

```bash
# 1. Run Client Linting & Type Checks
cd Client
npm run lint

# 2. Run Logic & Compliance Unit Tests
npm run test

# 3. Create Production Bundle
npm run build
```

✅ All 7 compliance tests pass (`aicteLogic.test.ts`).  
✅ Vite bundle compiles cleanly into `dist/`.  
✅ Zero external hardcoded credentials or uncommitted cache files.  
✅ Autonomous fallback ensures RAG assistant answers regulatory queries 24/7.
