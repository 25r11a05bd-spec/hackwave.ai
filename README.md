# HackWave AI (Patchline)

AI-reviewed vulnerability scanning with human-approved, tested pull requests. **1 Next.js frontend + 3 independent microservices**, wired together with JWT auth, Redis, Supabase, MongoDB, and Azure Blob Storage — fully configured for **Render.com** deployment.

```
Render Web App (frontend) ──► main-service (Render Web Service: Supabase + Redis)
                                    │                           │
                                    ▼                           ▼
                             auth-service (Render)    ai-service (Render: FastAPI + Mongo + ES)
                             (Issues RS256 JWTs)      (SAST Scanner & LLM Engine)
```

---

## 1. Architecture Overview

| Service | Tech Stack | Role | Render Deployment Type |
|---|---|---|---|
| [`frontend/`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/frontend) | Next.js 16, React 19, TypeScript, Tailwind v4 | Login/register UI, dashboard, vulnerability scanner console | **Render Web Service** (Node) |
| [`services/auth/`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/services/auth) | Node.js / Express, MongoDB, Redis | User authentication, issues RS256 signed JWTs | **Render Web Service** (Node) |
| [`services/main/`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/services/main) | Node.js / Express, Supabase, Redis | Core product API, gateway to AI service, GitHub/Jira OAuth integrations | **Render Web Service** (Node) |
| [`services/ai-service/`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/services/ai-service) | Python / FastAPI, MongoDB, Redis, Azure Blob, Elasticsearch | SAST scanning engine (Semgrep + Tree-sitter + Regex), LLM fix generator, RAG memory | **Render Web Service** (Python / Docker) |

> [!NOTE]
> **Core Authentication Design:** `services/auth` signs JWT tokens using an RS256 private key (`JWT_PRIVATE_KEY_BASE64`). `services/main` and `services/ai-service` hold only the matching public key (`JWT_PUBLIC_KEY_BASE64`) and verify every incoming JWT locally — eliminating network latency back to `auth` on API calls.

---

## 2. Repository Structure

```
hackwave.ai/
├── frontend/                  # Next.js 16 Web Application (Deploys on Render)
├── services/
│   ├── auth/                  # Authentication Service (Deploys on Render)
│   ├── main/                  # Core API & Gateway Service (Deploys on Render)
│   └── ai-service/            # SAST Scanner & AI Generation Engine (Deploys on Render)
├── docs/                      # Technical documentation & guides
├── render.yaml                # Render Blueprint infrastructure specification
└── README.md
```

---

## 3. Deploying to Render (Render.com)

You can deploy the entire HackWave AI architecture to Render using either **Automated Blueprint Deployment** (Recommended) or **Manual Web Service Setup**.

### Method A: Automated Deployment via Render Blueprint (`render.yaml`)

1. Push this repository to your GitHub or GitLab account.
2. Log into your [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** → **Blueprint**.
4. Connect your repository. Render will automatically detect [`render.yaml`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/render.yaml) and create the 4 Web Services:
   - `hackwave-auth-service`
   - `hackwave-main-service`
   - `hackwave-ai-service`
   - `hackwave-frontend`
5. In the Render Dashboard, fill in the secret environment variables (`MONGO_URI`, `REDIS_URL`, `SUPABASE_URL`, `JWT_PRIVATE_KEY_BASE64`, `JWT_PUBLIC_KEY_BASE64`) under each service's **Environment** tab.
6. Click **Apply** to trigger simultaneous automated builds.

---

### Method B: Manual Web Service Deployment on Render

If creating services manually in the Render UI:

#### 1. Auth Service (`services/auth`)
- **Service Type:** Web Service
- **Environment:** Node
- **Root Directory:** `services/auth`
- **Build Command:** `npm install`
- **Start Command:** `npm start` (or `node index.js`)
- **Required Environment Variables:**
  - `PORT`: `10000` (or leave default `$PORT`)
  - `MONGO_URI`: `mongodb+srv://...`
  - `REDIS_URL`: `rediss://...`
  - `JWT_PRIVATE_KEY_BASE64`: `<base64-encoded-rs256-private-key>`
  - `JWT_PUBLIC_KEY_BASE64`: `<base64-encoded-rs256-public-key>`

#### 2. Main Service (`services/main`)
- **Service Type:** Web Service
- **Environment:** Node
- **Root Directory:** `services/main`
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Required Environment Variables:**
  - `PORT`: `10000`
  - `SUPABASE_URL`: `https://your-project.supabase.co`
  - `SUPABASE_KEY`: `<your-supabase-anon-or-service-role-key>`
  - `REDIS_URL`: `rediss://...`
  - `JWT_PUBLIC_KEY_BASE64`: `<base64-encoded-rs256-public-key>`
  - `AUTH_SERVICE_URL`: `https://hackwave-auth-service.onrender.com`
  - `AI_SERVICE_URL`: `https://hackwave-ai-service.onrender.com`

#### 3. AI Scanning Service (`services/ai-service`)
- **Service Type:** Web Service
- **Environment:** Python 3 (or Docker)
- **Root Directory:** `services/ai-service`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Required Environment Variables:**
  - `PORT`: `10000`
  - `MONGO_URI`: `mongodb+srv://...`
  - `REDIS_URL`: `rediss://...`
  - `AZURE_STORAGE_CONNECTION_STRING`: `<azure-blob-connection-string>`
  - `ELASTICSEARCH_URL`: `https://...`
  - `JWT_PUBLIC_KEY_BASE64`: `<base64-encoded-rs256-public-key>`

#### 4. Frontend Web App (`frontend`)
- **Service Type:** Web Service
- **Environment:** Node
- **Root Directory:** `frontend`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start`
- **Required Environment Variables:**
  - `PORT`: `10000`
  - `NEXT_PUBLIC_API_URL`: `https://hackwave-main-service.onrender.com`
  - `NEXT_PUBLIC_AUTH_URL`: `https://hackwave-auth-service.onrender.com`

---

## 4. Local Development Setup

**Prerequisites:** Node.js (v18+), Python (v3.10+), Docker (optional for databases).

```bash
# 1. Clone repository
git clone https://github.com/25r11a05bd-spec/hackwave.ai.git
cd hackwave.ai

# 2. Install dependencies across all projects
npm run install:all

# 3. Generate RS256 Auth Keypair
npm run generate-keys
```

### Running Services

```bash
# Option A: Run locally with Docker Compose
docker compose up --build

# Option B: Run locally in dev mode
npm run dev
```

Local Endpoint Access:
- **Frontend UI:** `http://localhost:3000`
- **Auth Service:** `http://localhost:5000`
- **Main API Service:** `http://localhost:5001`
- **AI Scanning Engine:** `http://localhost:5002` (Docs: `http://localhost:5002/docs`)

---

## 5. Environment Variables Reference

| Variable Name | Description | Used By Service |
|---|---|---|
| `PORT` | Web server listening port (Render provides automatically via `$PORT`) | All Services |
| `JWT_PRIVATE_KEY_BASE64` | Base64-encoded RS256 Private Key for token signing | `services/auth` |
| `JWT_PUBLIC_KEY_BASE64` | Base64-encoded RS256 Public Key for JWT verification | `auth`, `main`, `ai-service` |
| `MONGO_URI` | MongoDB connection string | `auth`, `ai-service` |
| `REDIS_URL` | Redis connection URL for queues & caching | `auth`, `main`, `ai-service` |
| `SUPABASE_URL` | Supabase project URL | `services/main` |
| `SUPABASE_KEY` | Supabase API Key | `services/main` |
| `AUTH_SERVICE_URL` | Render URL of auth service | `main`, `frontend` |
| `AI_SERVICE_URL` | Render URL of AI service | `main` |
| `NEXT_PUBLIC_API_URL` | Render URL of main service | `frontend` |

---

## 6. Render Configuration & Deployment Tips

> [!TIP]
> **Dynamic Port Binding:** Render automatically passes a `PORT` environment variable to your container or app. Ensure your Express / FastAPI apps bind to `process.env.PORT` or `$PORT` and `0.0.0.0` rather than `localhost`.

> [!IMPORTANT]
> **CORS Settings:** When deployed to Render, update your backend CORS configurations to allow requests from your Render frontend domain (`https://hackwave-frontend.onrender.com`).

> [!NOTE]
> **Free Tier Sleep Behavior:** Render free Web Services spin down after 15 minutes of inactivity. For production performance, consider upgrading to Starter instances or setting up ping monitors.

---

## 7. Documentation Index

- [`docs/architecture.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/architecture.md) — Architectural overview, request flows, and security model.
- [`docs/api.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/api.md) — Comprehensive REST & WebSocket API specification.
- [`docs/deployment.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/deployment.md) — Render deployment checklist, CI/CD pipeline, and domain configuration.
