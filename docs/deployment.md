# PatchLine — Deployment Guide

## 1. Overview

PatchLine is an AI-powered GitHub repository security platform that performs:

```text
GitHub Repository
       │
       ▼
Frontend (Next.js / Vercel)
       │
       ▼
Main Service / API Gateway
       │
       ├──────────────► Auth Service
       │
       ├──────────────► AI + Storage Service
       │
       ├──────────────► Redis / BullMQ
       │
       ├──────────────► Supabase / PostgreSQL
       │
       ├──────────────► Elasticsearch
       │
       ├──────────────► GitHub API
       │
       └──────────────► Jira API
```

Production deployment consists of:

| Component            | Platform                   |
| -------------------- | -------------------------- |
| Frontend             | Vercel                     |
| Main Service         | Azure App Service          |
| Auth Service         | Azure App Service          |
| AI / Storage Service | Azure App Service          |
| PostgreSQL           | Supabase                   |
| MongoDB              | MongoDB Atlas              |
| Redis                | Azure Managed Redis        |
| Object Storage       | Azure Blob Storage         |
| Search / Dashboard   | Elasticsearch              |
| Vector Database      | ChromaDB Cloud             |
| AI                   | Azure OpenAI / Featherless |
| Source Control       | GitHub                     |
| Issue Tracking       | Jira                       |

---

# 2. Repository Structure

```text
patchline/
│
├── frontend/
│   └── Next.js application
│
├── services/
│   ├── auth-service/
│   │   └── Node.js + Express
│   │
│   ├── main-service/
│   │   └── Node.js + Express
│   │
│   └── ai-storage-service/
│       └── Python + FastAPI
│
├── k8s/
│   └── optional local infrastructure
│
├── docker-compose.yml
├── package.json
└── README.md
```

---

# 3. Production Architecture

```text
                         ┌─────────────────────┐
                         │       GitHub         │
                         │ Repositories / PRs  │
                         └──────────┬──────────┘
                                    │
                                    │ OAuth / API
                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                         VERCEL                              │
│                                                             │
│                    Next.js Frontend                         │
│                                                             │
│  Dashboard │ Scanner │ Findings │ Fix │ Verification │ PR  │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    AZURE APP SERVICE                        │
│                                                             │
│                    MAIN SERVICE                             │
│                                                             │
│  API Gateway                                                │
│  Authorization                                              │
│  Request Validation                                         │
│  Scan/Fix Orchestration                                     │
│  Redis/BullMQ Jobs                                          │
│  GitHub/Jira Integration                                    │
└───────┬─────────────┬──────────────┬──────────────┬─────────┘
        │             │              │              │
        ▼             ▼              ▼              ▼
   Auth Service   AI Service      Supabase       Redis
        │             │
        │             ├──── MongoDB
        │             ├──── Azure Blob
        │             ├──── ChromaDB
        │             └──── AI Provider
        │
        └──── MongoDB Atlas


                         Elasticsearch
                              ▲
                              │
                     Dashboard / Analytics
```

---

# 4. Deployment Order

Deploy services in this order:

```text
1. Supabase
2. MongoDB Atlas
3. Azure Redis
4. Azure Blob Storage
5. Elasticsearch
6. ChromaDB
7. Auth Service
8. AI + Storage Service
9. Main Service
10. Frontend
11. GitHub OAuth configuration
12. Jira OAuth configuration
13. Production smoke tests
```

The backend services must be available before deploying the frontend.

---

# 5. Required External Services

Create/configure the following services before deployment.

## 5.1 Supabase

Used for relational application data.

Required values:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

Never expose:

```text
SUPABASE_SERVICE_ROLE_KEY
```

to the browser.

---

## 5.2 MongoDB Atlas

Used by authentication and AI/storage components.

```env
MONGODB_URI=
MONGODB_DATABASE=
```

Configure:

* database user
* network access
* production IP/network rules
* TLS
* appropriate database permissions

Do not use unrestricted database access in production.

---

## 5.3 Azure Managed Redis

Used for:

* rate limiting
* temporary scan state
* job queues
* BullMQ
* workflow coordination
* caching

Example:

```env
REDIS_URL=
REDIS_HOST=
REDIS_PORT=
REDIS_PASSWORD=
```

Use TLS in production.

---

## 5.4 Azure Blob Storage

Used for repository/file artifacts and generated data where required.

```env
AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=
```

Production storage should not be publicly writable.

---

## 5.5 Elasticsearch

Used for dashboard/search/analytics data.

Example:

```env
ELASTICSEARCH_URL=
ELASTICSEARCH_API_KEY=
ELASTICSEARCH_INDEX=
```

The frontend must **not** directly access Elasticsearch.

Correct flow:

```text
Frontend
   ↓
Main Service
   ↓
Elasticsearch
```

---

## 5.6 ChromaDB Cloud

Used for vector/RAG retrieval.

```env
CHROMA_API_KEY=
CHROMA_TENANT=
CHROMA_DATABASE=
CHROMA_HOST=
```

The browser must never receive the ChromaDB credentials.

---

# 6. Azure Deployment

PatchLine uses separate Azure App Services.

Recommended structure:

```text
Azure
│
├── patchline-auth
│
├── patchline-main
│
└── patchline-ai
```

Each service should have its own deployment configuration and environment variables.

---

# 7. Auth Service Deployment

## Runtime

```text
Node.js
Express
MongoDB
Redis
```

Deploy:

```text
services/auth-service/
```

Example Azure configuration:

```text
Runtime Stack:
Node.js 20 LTS

Operating System:
Linux

Startup Command:
npm start
```

Install dependencies:

```bash
cd services/auth-service
npm install
```

Build if required:

```bash
npm run build
```

Start:

```bash
npm start
```

---

# 8. Auth Service Environment Variables

Configure these in Azure App Service → Environment Variables.

```env
NODE_ENV=production
PORT=4001

MONGODB_URI=
MONGODB_DATABASE=

REDIS_URL=

JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=

JWT_ACCESS_EXPIRES=
JWT_REFRESH_EXPIRES=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=

INTERNAL_SERVICE_SECRET=
```

### JWT Security

The Auth Service owns the private signing key.

```text
Auth Service
     │
     ├── JWT_PRIVATE_KEY
     │
     └── JWT_PUBLIC_KEY
```

Other services should only need the public key for verification.

Never expose the private key to:

* frontend
* GitHub
* browser
* client-side JavaScript
* logs

---

# 9. AI + Storage Service Deployment

Deploy:

```text
services/ai-storage-service/
```

Runtime:

```text
Python
FastAPI
```

Example startup command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Azure should expose the service through HTTPS.

---

# 10. AI Service Environment Variables

Example:

```env
ENVIRONMENT=production
PORT=8000

MONGODB_URI=
MONGODB_DATABASE=

REDIS_URL=

AZURE_STORAGE_CONNECTION_STRING=
AZURE_STORAGE_CONTAINER=

AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=

AZURE_OPENAI_API_VERSION=

CHROMA_API_KEY=
CHROMA_TENANT=
CHROMA_DATABASE=
CHROMA_HOST=

MAIN_SERVICE_URL=

GITHUB_PAT=

INTERNAL_SERVICE_SECRET=
```

If Featherless is enabled:

```env
FEATHERLESS_API_KEY=
FEATHERLESS_BASE_URL=
```

Do not hard-code API keys inside Python source code.

---

# 11. Main Service Deployment

Deploy:

```text
services/main-service/
```

Runtime:

```text
Node.js
Express
```

Startup:

```bash
npm start
```

The Main Service is the primary backend API gateway.

The browser should communicate with:

```text
Frontend → Main Service
```

rather than directly calling:

```text
Frontend → AI Service
Frontend → Elasticsearch
Frontend → MongoDB
Frontend → Redis
```

---

# 12. Main Service Environment Variables

```env
NODE_ENV=production
PORT=4000

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

REDIS_URL=

AUTH_SERVICE_URL=
AI_SERVICE_URL=

GITHUB_PAT=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=

ATLASSIAN_CLIENT_ID=
ATLASSIAN_CLIENT_SECRET=
JIRA_CALLBACK_URL=

JIRA_WEBHOOK_SECRET=

INTERNAL_SERVICE_SECRET=

ELASTICSEARCH_URL=
ELASTICSEARCH_API_KEY=
ELASTICSEARCH_INDEX=
```

Use the actual Azure URLs after the App Services are deployed.

Example:

```env
AUTH_SERVICE_URL=https://patchline-auth.azurewebsites.net
AI_SERVICE_URL=https://patchline-ai.azurewebsites.net
```

---

# 13. Frontend Deployment

PatchLine frontend is deployed to Vercel.

Directory:

```text
frontend/
```

Framework:

```text
Next.js
React
```

Build:

```bash
npm install
npm run build
```

Vercel should automatically execute the production build.

---

# 14. Frontend Environment Variables

Only variables required by the browser should use the `NEXT_PUBLIC_` prefix.

Example:

```env
NEXT_PUBLIC_API_URL=https://<main-service-domain>
NEXT_PUBLIC_APP_URL=https://<frontend-domain>
```

Do NOT put secrets into:

```env
NEXT_PUBLIC_*
```

Never expose:

```text
JWT_PRIVATE_KEY
SUPABASE_SERVICE_ROLE_KEY
MONGODB_URI
REDIS_PASSWORD
GITHUB_PAT
AZURE_OPENAI_API_KEY
CHROMA_API_KEY
FEATHERLESS_API_KEY
INTERNAL_SERVICE_SECRET
```

---

# 15. Production Request Flow

A normal scanner request should follow:

```text
Browser
   │
   │ POST /projects/:id/repositories/:repoId/scans
   ▼
Main Service
   │
   ├── Authenticate user
   ├── Authorize project/repository
   ├── Validate request
   ├── Create scan record
   ├── Queue background job
   │
   ▼
Redis / BullMQ
   │
   ▼
AI Worker
   │
   ├── GitHub repository
   ├── Deterministic scanner
   ├── AI analysis
   ├── Finding normalization
   ├── RAG retrieval
   └── Risk evaluation
```

The API should immediately return:

```http
202 Accepted
```

Example:

```json
{
  "jobId": "scan_123",
  "status": "QUEUED"
}
```

The frontend then polls/subscribes to the scan state.

---

# 16. Fix and Verification Flow

```text
User approves finding
          │
          ▼
Main Service
          │
          ▼
BullMQ
          │
          ▼
Fix Worker
          │
          ├── Retrieve finding
          ├── Retrieve Top-3 RAG candidates
          ├── Select optimal remediation
          ├── Generate patch
          ├── AI verification
          ├── Deterministic rescan
          └── Risk evaluation
                    │
                    ▼
              Verified Fix
                    │
                    ▼
              GitHub Branch
                    │
                    ▼
              Pull Request
```

AI must never directly modify `main` or `master`.

---

# 17. GitHub OAuth Configuration

GitHub OAuth requires:

```text
Client ID
Client Secret
Callback URL
```

Development callback:

```text
http://localhost:4001/auth/github/callback
```

Production callback should point to the deployed Auth Service:

```text
https://<auth-service-domain>/auth/github/callback
```

The OAuth flow is:

```text
Frontend
   │
   ▼
Auth Service
   │
   ▼
GitHub
   │
   ▼
OAuth Callback
   │
   ▼
Auth Service
   │
   ▼
Secure Session / Tokens
```

GitHub access tokens must never be returned unnecessarily to the browser.

---

# 18. Jira OAuth Configuration

Configure Jira OAuth credentials:

```env
ATLASSIAN_CLIENT_ID=
ATLASSIAN_CLIENT_SECRET=
JIRA_CALLBACK_URL=
JIRA_WEBHOOK_SECRET=
```

Production callback:

```text
https://<main-service-domain>/jira/oauth/callback
```

Flow:

```text
Frontend
   ↓
Main Service
   ↓
Atlassian
   ↓
OAuth Callback
   ↓
Main Service
   ↓
Jira API
```

---

# 19. CORS Configuration

Production CORS must allow only the deployed frontend.

Example:

```env
FRONTEND_URL=https://<patchline-vercel-domain>
```

Do not use:

```text
Access-Control-Allow-Origin: *
```

when authentication cookies are involved.

Production:

```text
Frontend: HTTPS
Backend:  HTTPS
Cookies:  Secure
```

For cross-site authentication cookies:

```text
Secure=true
SameSite=None
HttpOnly=true
```

---

# 20. Authentication Cookie Flow

PatchLine uses access/refresh token authentication.

```text
Browser
   │
   ├── access_token
   │
   └── refresh_token
          │
          ▼
     Auth Service
```

Refresh token should be:

```text
HttpOnly
Secure
SameSite=None
```

in the production cross-origin deployment.

The browser must send credentials:

```text
credentials: include
```

---

# 21. Service-to-Service Security

Internal services must not be publicly callable without authentication.

Use:

```env
INTERNAL_SERVICE_SECRET=
```

Example:

```text
Main Service
     │
     │ X-Internal-Service-Token
     ▼
AI Service
```

The secret must be stored in Azure App Service configuration.

Never commit it to Git.

---

# 22. Health Checks

Each backend should expose a health endpoint.

Example:

```http
GET /health
```

Expected response:

```json
{
  "status": "ok"
}
```

Use health checks to verify:

```text
Azure App Service
        │
        ├── Application running
        ├── Database reachable
        ├── Redis reachable
        └── AI provider reachable
```

A health endpoint should not expose credentials or sensitive configuration.

---

# 23. Deployment Verification

After deploying all services, test in this order.

### 1. Auth

```http
GET /health
```

Then:

```text
Register
   ↓
Login
   ↓
Refresh
   ↓
Me
   ↓
Logout
```

### 2. GitHub

```text
Connect GitHub
   ↓
OAuth callback
   ↓
Repository list
   ↓
Select repository
```

### 3. Scanner

```text
Create scan
   ↓
202 QUEUED
   ↓
Worker starts
   ↓
Scan progresses
   ↓
Findings appear
```

### 4. Fix

```text
Approve finding
   ↓
Fix job
   ↓
Patch generation
   ↓
AI verification
   ↓
Deterministic rescan
   ↓
Risk evaluation
```

### 5. GitHub PR

```text
Verified
   ↓
Create branch
   ↓
Commit fix
   ↓
Create PR
   ↓
Display PR status
```

---

# 24. Production Smoke Test

Run:

```bash
curl https://<main-service-domain>/health
```

Expected:

```json
{
  "status": "ok"
}
```

Test frontend:

```text
https://<frontend-domain>
```

Then verify:

```text
[ ] Login works
[ ] Refresh works
[ ] GitHub OAuth works
[ ] Repositories load
[ ] Repository scan starts
[ ] Scan status updates
[ ] Findings appear
[ ] Finding approval works
[ ] Fix generation works
[ ] Verification works
[ ] Deterministic rescan works
[ ] Risk evaluation works
[ ] GitHub PR is created
[ ] PR status updates
[ ] Jira integration works
```

---

# 25. Common Deployment Problems

## 401 — Missing Refresh Token

Usually caused by authentication cookies not being sent.

Check:

```text
Secure=true
SameSite=None
credentials: include
```

Also verify the frontend and backend are both using HTTPS.

---

## CORS Error

Check:

```env
FRONTEND_URL=https://<actual-vercel-domain>
```

Do not use:

```text
*
```

with credentialed requests.

---

## 502 Bad Gateway

Usually means Main Service cannot reach an upstream service.

Check:

```env
AUTH_SERVICE_URL=
AI_SERVICE_URL=
```

Then verify:

```bash
curl https://<auth-service>/health
curl https://<ai-service>/health
```

---

## 504 Gateway Timeout

Usually means an upstream operation is taking too long.

Long-running operations such as:

```text
repository scanning
AI fix generation
AI verification
```

should run asynchronously through Redis/BullMQ rather than keeping an HTTP request open indefinitely.

---

## AI Provider Not Working

Check:

```env
AZURE_OPENAI_API_KEY=
AZURE_OPENAI_ENDPOINT=
```

and/or:

```env
FEATHERLESS_API_KEY=
FEATHERLESS_BASE_URL=
```

The UI should report the **actual provider/model status**, not a hard-coded value.

---

## Redis Connection Failure

Verify:

```env
REDIS_URL=
```

and confirm TLS configuration for Azure Managed Redis.

Redis is required for:

```text
BullMQ
rate limiting
scan state
job coordination
```

---

# 26. Secrets Management

Never commit:

```text
.env
.env.local
.env.production
*.pem
*.key
credentials.json
```

Add them to `.gitignore`.

Use:

```text
Azure App Service → Environment Variables
Vercel → Environment Variables
GitHub Secrets
```

for production secrets.

Rotate immediately if a secret is accidentally committed.

---

# 27. Production Security Rules

PatchLine production must follow these rules:

```text
1. HTTPS everywhere
2. No secrets in frontend
3. No secrets in Git
4. HttpOnly authentication cookies
5. Secure cookies in production
6. Restricted CORS
7. Internal service authentication
8. GitHub tokens never exposed unnecessarily
9. AI service not directly exposed to browser
10. Elasticsearch not directly exposed to browser
11. Redis not exposed publicly
12. MongoDB not exposed publicly
13. Database least-privilege access
14. Rate limiting enabled
15. Request validation enabled
16. Centralized error handling
17. Structured logging
18. AI remediation requires user approval
19. AI cannot merge PRs
20. Fixes must pass verification/rescan before PR creation
```

---

# 28. Deployment Environment Separation

Maintain separate environments:

```text
Development
     │
     ├── localhost
     ├── development databases
     └── development credentials

Staging
     │
     ├── staging frontend
     ├── staging backend
     └── staging databases

Production
     │
     ├── Vercel
     ├── Azure App Services
     ├── production databases
     └── production credentials
```

Never use production credentials during local development.

---

# 29. Recommended Production Domains

Example:

```text
Frontend:
https://app.patchline.dev

Main API:
https://api.patchline.dev

Auth:
https://auth.patchline.dev

AI:
https://ai.patchline.dev
```

The actual domains can be different.

Recommended public exposure:

```text
Internet
   │
   ├── Frontend
   └── Main API
          │
          ├── Auth Service
          └── AI Service
```

Auth and AI services should preferably not be directly exposed to arbitrary browser clients.

---

# 30. Deployment Checklist

## Infrastructure

```text
[ ] Supabase configured
[ ] MongoDB Atlas configured
[ ] Azure Redis configured
[ ] Azure Blob configured
[ ] Elasticsearch configured
[ ] ChromaDB configured
```

## Backend

```text
[ ] Auth Service deployed
[ ] AI Service deployed
[ ] Main Service deployed
[ ] Environment variables configured
[ ] Internal service authentication configured
[ ] Health checks working
```

## Frontend

```text
[ ] Vercel project configured
[ ] Production API URL configured
[ ] Production frontend URL configured
[ ] Build succeeds
[ ] HTTPS enabled
```

## Authentication

```text
[ ] GitHub OAuth configured
[ ] Callback URL correct
[ ] Cookies Secure
[ ] Cookies HttpOnly
[ ] SameSite configured
[ ] CORS configured
```

## PatchLine Workflow

```text
[ ] GitHub connection works
[ ] Repository listing works
[ ] Scan creation works
[ ] Background job works
[ ] Findings appear
[ ] Approval works
[ ] Fix generation works
[ ] AI verification works
[ ] Deterministic rescan works
[ ] Risk evaluation works
[ ] PR creation works
[ ] PR status works
[ ] Jira integration works
```

---

# 31. Final Production Flow

The complete deployed system should operate as:

```text
                    USER
                      │
                      ▼
              ┌───────────────┐
              │ Vercel / Next │
              │   Frontend    │
              └───────┬───────┘
                      │ HTTPS
                      ▼
              ┌───────────────┐
              │ Main Service  │
              │ API Gateway   │
              └───────┬───────┘
                      │
        ┌─────────────┼──────────────┐
        │             │              │
        ▼             ▼              ▼
   Auth Service    Redis/BullMQ   AI Service
        │             │              │
        ▼             │       ┌──────┼──────┐
    MongoDB           │       ▼      ▼      ▼
                      │    Azure   Mongo  Chroma
                      │    Blob    DB     DB
                      │
                      ▼
                    Worker
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
       GitHub       Jira      Elasticsearch
          │
          ▼
      Verified PR
```

**Deployment principle:** the frontend is only the client. **Main Service is the controlled backend entry point**, while Auth, AI, databases, Redis, Elasticsearch, GitHub, and Jira remain behind the appropriate service boundaries.
