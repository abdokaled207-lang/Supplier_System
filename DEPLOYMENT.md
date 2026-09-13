# Deploying Roti Chani System

This document covers deploying the two services:

- **Backend** (Express + Prisma + MySQL) → **Railway**
- **Frontend** (React / Vite) → **Vercel**

Both services are in subdirectories of this repository (`backend/` and `frontend/`).
This is **not** an npm workspace — treat each directory as its own project.

---

## Backend — Railway

### Before you start on Railway

1. Fork/push this repo to your GitHub account.
2. Create a **Railway project** at https://railway.com.
3. Provision a **MySQL** database instance. Railway automatically
   provides a `DATABASE_URL` connection string.
4. Add a **persistent volume** for invoice PDF storage (see below).

### Adding the service

1. In the Railway project dashboard, click **New Service** → 
   **Deploy from GitHub repo**.
2. Select this repo. Railway will auto-detect the Dockerfile in
   `backend/` — but the repository ships with `backend/railway.toml`
   that **forces the Railpack builder** and explicit commands. This is
   intentional and overrides the Dockerfile.
3. Set the **Root Directory** to `backend/`.
4. Railway reads `backend/railway.toml` and will:

   | Phase | Command |
   |---|---|
   | Install | `npm ci` (runs `postinstall` → `prisma generate`) |
   | Build | `npm run db:generate && npm run build` |
   | Pre-deploy | `npm run db:migrate` (`prisma migrate deploy`) |
   | Start | `node dist/index.js` |
   | Health check | `GET /health` (300s timeout, retries forever) |

### Environment variables (Railway)

Set these in the Railway dashboard under **Variables**:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | **Yes** | Supplied by Railway MySQL; may need `?sslaccept=STRICT` appended for SSL. |
| `JWT_SECRET` | **Yes** | Random ≥32 chars. Weak defaults are rejected in production. |
| `JWT_EXPIRES_IN` | No | Default `7d` |
| `CORS_ORIGIN` | **Yes** | The Vercel frontend URL, e.g. `https://your-app.vercel.app`. Comma-separated for multiple origins. |
| `INVOICES_DIR` | See note | If using a persistent volume, point here, e.g. `INVOICES_DIR=/data/invoices` (volume mount = `/data/invoices`). |

The `PORT` variable is **injected automatically** by Railway — do not
set it manually.

### Persistent volume for invoice PDFs

⚠️ **Critical.** The default `INVOICES_DIR` is `backend/storage/invoices/`
inside the container. Railway's container filesystem is **ephemeral** —
invoices vanish on every redeploy. To preserve them:

1. In the Railway service settings, add a **Volume**.
2. Give it a name (e.g. `invoices`) and mount path (e.g. `/data/invoices`).
3. Set `INVOICES_DIR=/data/invoices` in the environment variables.

Volume sizes start at 1 GB (free tier).

### Health check

Railway is configured to hit `GET /health`. The backend responds
`{"status":"ok"}` at that path (no DB query — bare Express route).
The `/api/health` endpoint also verifies the DB connection:
`{"status":"ok","db":"connected"}`.

---

## Frontend — Vercel

### vercel.json

The frontend already ships `frontend/vercel.json` with:

| Setting | Value |
|---|---|
| `framework` | `vite` |
| `buildCommand` | `npm run build` |
| `installCommand` | `npm install` |
| SPA rewrites | All routes → `/index.html` |

### Environment variables (Vercel)

Set these in the Vercel project dashboard (Settings → Environment Variables):

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | **Yes** | Absolute URL of the Railway backend, e.g. `https://your-backend.up.railway.app/api`. **Baked into the bundle at build time** — changing it requires a rebuild. |
| `VITE_PUBLIC_URL` | No | Your Vercel frontend origin, e.g. `https://your-app.vercel.app`. Used for generating absolute links. Leave unset to use `window.location.origin`. |
| `NODE_ENV` | Auto | Vercel sets this to `production` for production builds. |

The `VITE_API_URL` **must** be the full Railway URL. Because
`vercel.json` rewrites every route to `index.html`, a relative `/api`
would serve the HTML shell instead of reaching the backend.

### Adding the project on Vercel

1. Open https://vercel.com and click **Add New** → **Project**.
2. Import your GitHub repository.
3. Set **Root Directory** to `frontend/`.
4. Vercel auto-detects the `vercel.json` and Vite framework.
5. Set the environment variables (see above).
6. Deploy.

### CORS

The backend will reject requests from origins not in its
`CORS_ORIGIN` list when `NODE_ENV=production`. Make sure
`CORS_ORIGIN` on Railway includes the exact Vercel origin, e.g.
`https://your-app.vercel.app`.

---

## Local production simulation

To verify the backend's production path locally (against a running
Docker MySQL or local MySQL80):

```bash
cd backend
npm run build           # tsc -p tsconfig.build.json → dist/
npm start               # prisma migrate deploy && node dist/index.js
curl http://localhost:4000/health
curl http://localhost:4000/api/health
```

For the frontend:

```bash
cd frontend
npm run build           # tsc --noEmit && vite build → dist/
npx vite preview        # serves dist/ locally
```

---

## Troubleshooting

**Backend fails to start: "Weak JWT_SECRET"**
→ `JWT_SECRET` must be ≥32 random characters in production.
Set a strong value in Railway variables.

**Backend fails to start: "CORS_ORIGIN is required in production"**
→ The `CORS_ORIGIN` env var must be set to the Vercel frontend URL.

**"Cannot find module '.../dist/app'" after build**
→ This should not happen. The build outputs `dist/` with `.js`
extensions on all relative imports (Node ESM requirement). If you
see this, the pre-built `dist/` may be stale — run `npm run build`
and try again.

**Invoice PDFs missing after redeploy**
→ No persistent volume configured, or `INVOICES_DIR` points to the
ephemeral container path. See volume instructions above.