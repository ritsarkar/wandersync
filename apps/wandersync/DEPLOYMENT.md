# WanderSync Vercel & Production Deployment Guide

## 1. Vercel Architecture Overview
WanderSync is configured for zero-friction Vercel hosting:
- **Frontend**: Vite React SPA hosted on Vercel's global Edge Network.
- **REST APIs**: Express endpoints (`/api/groups`, `/api/routes`, `/api/places`) run automatically via Vercel Serverless Functions ([`api/index.js`](file:///e:/aiscraper/apps/wandersync/api/index.js)).
- **Real-Time WebSockets (Socket.IO)**:
  - Vercel functions are stateless and ephemeral.
  - To support live multi-user real-time convoy streaming, point `VITE_SOCKET_URL` to your persistent backend (Railway, Render, Fly.io, or Docker host).
  - If `VITE_SOCKET_URL` is omitted, it defaults to `window.location.origin`.

---

## 2. Option A: Deploy via GitHub & Vercel Dashboard (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Configure WanderSync for Vercel deployment"
   git push origin main
   ```

2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and select your repository.
   - Set **Root Directory** to: `apps/wandersync`
   - Framework Preset: **Vite** (detected automatically).

3. **Configure Environment Variables**:
   - `VITE_GOOGLE_MAPS_API_KEY`: Your Google Maps JavaScript & Routes API key.
   - `VITE_SOCKET_URL`: *(Optional)* Your persistent WebSocket backend URL if hosted separately.

4. Click **Deploy**.

---

## 3. Option B: Deploy via Vercel CLI

1. **Log in to Vercel**:
   ```bash
   npx vercel login
   ```
   *(Follow the browser authentication prompt)*

2. **Deploy WanderSync**:
   ```bash
   cd apps/wandersync
   npx vercel --prod
   ```

3. **Add Environment Variables**:
   ```bash
   npx vercel env add VITE_GOOGLE_MAPS_API_KEY production
   ```

---

## 4. Configuration Files Reference
- [`apps/wandersync/vercel.json`](file:///e:/aiscraper/apps/wandersync/vercel.json): Rewrites for API routes and SPA routing.
- [`apps/wandersync/api/index.js`](file:///e:/aiscraper/apps/wandersync/api/index.js): Serverless entry point wrapping the Express API.
- [`apps/wandersync/src/services/socket.ts`](file:///e:/aiscraper/apps/wandersync/src/services/socket.ts): Connection handling supporting both same-origin and external WebSocket servers.
