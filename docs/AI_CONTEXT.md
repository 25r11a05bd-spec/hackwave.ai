# HackWave AI (PatchLine) — AI Context & System Specification

> **Purpose:** This file is the primary machine-readable context specification for HackWave AI. Any AI model, LLM, or AI coding agent operating on this codebase **MUST** ingest this document as the system contract for architecture, security, API routing, data models, and deployment constraints.

---

## 0. AI Execution Protocol & Non-Negotiable Directives

```json
{
  "system_name": "HackWave AI (PatchLine)",
  "architecture_type": "Distributed Microservices (1 Next.js Frontend + 3 Express/FastAPI Backends)",
  "deployment_target": "Render.com (Render Web Services)",
  "ai_rules": [
    "1. Security decisions MUST be made on the backend. Frontend is strictly presentation.",
    "2. Never rely on client-side state for authorization, risk calculation, or vulnerability severity.",
    "3. LLM output MUST be treated as untrusted data and validated prior to code modification or PR creation.",
    "4. RS256 JWT key validation is local to each service via public key. NEVER call auth-service on the hot path.",
    "5. Express/FastAPI apps must bind dynamically to process.env.PORT / $PORT and listen on 0.0.0.0."
  ]
}
```

---

## 1. System Topology & Microservices Breakdown

```
+-----------------------------------------------------------------------------------+
|                                   RENDER.COM                                      |
|                                                                                   |
|  +-------------------------+            +--------------------------------------+  |
|  |    hackwave-frontend    |  HTTPS/JWT |        hackwave-main-service        |  |
|  |     (Next.js 16)        |----------->|         (Node.js / Express)          |  |
|  +-------------------------+            +--------------------------------------+  |
|                                                     |                |            |
|                                         JWT Verified|                |JWT Verified|
|                                         Locally     v                v Locally    |
|                                 +--------------------+      +------------------+  |
|                                 |hackwave-auth-service|     |hackwave-ai-service| |
|                                 | (Node.js / Express) |     | (Python /FastAPI)|  |
|                                 +--------------------+      +------------------+  |
|                                           |                          |            |
+-------------------------------------------|--------------------------|------------+
                                            v                          v
                                      MongoDB (Users)           MongoDB + Redis +
                                                                Elasticsearch + Blob
```

### Component Registry

| Component ID | Path | Runtime | Database Dependencies | Primary Responsibility |
|---|---|---|---|---|
| `frontend` | `frontend/` | Node 18 / Next.js 16 | None (Client State) | Dashboard UI, scanner console, fix approval UI |
| `auth-service` | `services/auth/` | Node 18 / Express | MongoDB, Redis | User registration, authentication, RS256 JWT signing, refresh token rotation |
| `main-service` | `services/main/` | Node 18 / Express | Supabase (Postgres), Redis | API Gateway, scan/fix queues (BullMQ), GitHub & Jira OAuth integrations |
| `ai-service` | `services/ai-service/` | Python 3.10 / FastAPI | MongoDB, Redis, Azure Blob, Elasticsearch, Chroma Vector DB | SAST scanning engine (Semgrep + Tree-sitter), LLM fix generator, RAG memory |

---

## 2. Authentication & Key Management Contract

### RS256 Asymmetric JWT Spec

```yaml
algorithm: RS256
access_token_ttl: 15m
refresh_token_ttl: 7d
signing_authority: auth-service (owns JWT_PRIVATE_KEY_BASE64)
verification_authority: main-service & ai-service (own JWT_PUBLIC_KEY_BASE64)

jwt_payload_schema:
  type: object
  required: [sub, email, iat, exp, kid]
  properties:
    sub:
      type: string
      description: User ID (MongoDB ObjectId string)
    email:
      type: string
      description: User email address
    role:
      type: string
      enum: [user, admin]
    kid:
      type: string
      description: Key ID for seamless key rotation
    iat:
      type: integer
      description: Issued at timestamp (seconds)
    exp:
      type: integer
      description: Expiration timestamp (seconds)
```

---

## 3. Master API Endpoint Specification

### 3.1 Auth Service Endpoints (`services/auth`)

```json
[
  {
    "method": "POST",
    "path": "/auth/register",
    "auth_required": false,
    "request_body": {
      "email": "string (email)",
      "password": "string (min 8 chars)"
    },
    "response_success": {
      "code": 201,
      "body": { "user": { "id": "string", "email": "string" } }
    }
  },
  {
    "method": "POST",
    "path": "/auth/login",
    "auth_required": false,
    "request_body": {
      "email": "string",
      "password": "string"
    },
    "response_success": {
      "code": 200,
      "body": { "accessToken": "string (JWT)", "user": { "id": "string", "email": "string" } }
    }
  },
  {
    "method": "POST",
    "path": "/auth/refresh",
    "auth_required": "Refresh Token Cookie",
    "response_success": {
      "code": 200,
      "body": { "accessToken": "string (JWT)" }
    }
  }
]
```

### 3.2 Main API Service Endpoints (`services/main`)

```json
[
  {
    "method": "POST",
    "path": "/api/scanner/scan",
    "auth_required": true,
    "request_body": {
      "repositoryUrl": "string (https URL)",
      "branch": "string (default: main)"
    },
    "response_success": {
      "code": 202,
      "body": { "scanId": "string (UUID)", "status": "QUEUED" }
    }
  },
  {
    "method": "GET",
    "path": "/api/scanner/status/:scanId",
    "auth_required": true,
    "response_success": {
      "code": 200,
      "body": { "scanId": "string", "status": "COMPLETED|RUNNING|FAILED", "stage": "string", "progress": 85 }
    }
  },
  {
    "method": "GET",
    "path": "/api/findings",
    "auth_required": true,
    "query_params": { "scanId": "string", "severity": "CRITICAL|HIGH|MEDIUM|LOW" },
    "response_success": {
      "code": 200,
      "body": { "findings": "array of Finding objects", "total": 12 }
    }
  },
  {
    "method": "POST",
    "path": "/api/fixes/generate",
    "auth_required": true,
    "request_body": { "findingId": "string" },
    "response_success": {
      "code": 202,
      "body": { "fixId": "string", "status": "GENERATING" }
    }
  }
]
```

### 3.3 AI Scanning Service Endpoints (`services/ai-service`)

```json
[
  {
    "method": "POST",
    "path": "/api/v1/scan/execute",
    "auth_required": "Internal Bearer JWT",
    "request_body": {
      "scan_id": "string",
      "repo_url": "string",
      "branch": "string"
    },
    "response_success": {
      "code": 200,
      "body": { "scan_id": "string", "findings_count": 5, "report_url": "string" }
    }
  },
  {
    "method": "POST",
    "path": "/api/v1/fix/generate",
    "auth_required": "Internal Bearer JWT",
    "request_body": {
      "finding_id": "string",
      "cwe": "string",
      "code_snippet": "string",
      "file_path": "string"
    },
    "response_success": {
      "code": 200,
      "body": { "fix_id": "string", "diff": "string", "explanation": "string", "rag_prior_art": true }
    }
  }
]
```

---

## 4. The 8-Stage SAST Pipeline State Machine

```
[Stage 1: QUEUED] ──► [Stage 2: REPO_FETCH] ──► [Stage 3: AST_PARSING] ──► [Stage 4: DETERMINISTIC_SAST]
                                                                                      │
[Stage 8: AWAITING_APPROVAL] ◄── [Stage 7: SEVERITY_TRIAGE] ◄── [Stage 6: RAG_MEMORY] ◄── [Stage 5: AI_SUPPLEMENTARY]
```

### Pipeline Execution Contract

1. **Stage 1 (QUEUED):** BullMQ job created on `redis-main`.
2. **Stage 2 (REPO_FETCH):** GitHub API Git tree fetch (no local arbitrary command execution).
3. **Stage 3 (AST_PARSING):** Tree-sitter & Semgrep AST building for JavaScript, TypeScript, Python, Go.
4. **Stage 4 (DETERMINISTIC_SAST):** 248+ Semgrep rules + secret regex patterns executed.
5. **Stage 5 (AI_SUPPLEMENTARY):** LLM (GPT-4.1 mini) checks false positives & complex logic flaws.
6. **Stage 6 (RAG_MEMORY):** Embeds finding vector (`text-embedding-3-small`) and queries Chroma Cloud (`finding_memory`, threshold `0.35`).
7. **Stage 7 (SEVERITY_TRIAGE):** Deduplication and risk score calculation:
   $$\text{RiskScore} = \text{CVSS Base} \times 0.6 + \text{Exposure Multiplier} \times 0.25 + \text{RAG History Factor} \times 0.15$$
8. **Stage 8 (AWAITING_APPROVAL):** Report uploaded to Azure Blob Storage; finding stored in MongoDB; approval gate armed for human review.

---

## 5. Database & Storage Schema Spec

```json
{
  "databases": {
    "mongodb": {
      "collections": [
        { "name": "users", "primary_key": "_id", "indexes": ["email"] },
        { "name": "refresh_tokens", "primary_key": "_id", "indexes": ["token_hash", "user_id"] },
        { "name": "scans", "primary_key": "_id", "indexes": ["user_id", "repository_url", "created_at"] },
        { "name": "findings", "primary_key": "_id", "indexes": ["scan_id", "cwe", "severity"] }
      ]
    },
    "redis": {
      "redis_main": "BullMQ job queues, main API http cache, user session rate limiting",
      "redis_shared": "Scan progress checkpoints (key namespace: scan:stage:{scanId}), auth rate limits"
    },
    "chroma_cloud": {
      "collections": [
        {
          "name": "finding_memory",
          "distance_metric": "cosine",
          "embedding_model": "text-embedding-3-small",
          "metadata_fields": ["cwe", "hasFix", "ownerId", "verified"]
        }
      ]
    }
  }
}
```

---

## 6. Environment & Render Deployment Specification

```yaml
render_deployments:
  hackwave-auth-service:
    type: web_service
    env: node
    root_dir: services/auth
    build_command: npm install
    start_command: npm start
    port: 10000

  hackwave-main-service:
    type: web_service
    env: node
    root_dir: services/main
    build_command: npm install
    start_command: npm start
    port: 10000

  hackwave-ai-service:
    type: web_service
    env: python
    root_dir: services/ai-service
    build_command: pip install -r requirements.txt
    start_command: uvicorn main:app --host 0.0.0.0 --port $PORT
    port: 10000

  hackwave-frontend:
    type: web_service
    env: node
    root_dir: frontend
    build_command: npm install && npm run build
    start_command: npm run start
    port: 10000
```

---

## 7. AI Diagnostic & Troubleshooting Decision Tree

| Issue / Error | Root Cause | AI Remediation Protocol |
|---|---|---|
| `401 Unauthorized` across services | `JWT_PUBLIC_KEY_BASE64` mismatch | Ensure `services/auth` signed key matches the public key present in `services/main` and `services/ai-service`. |
| CORS failure on browser requests | Missing origins | Add `https://hackwave-frontend.onrender.com` to Express `cors({ origin: [...] })` options. |
| Scan status stuck at `UNKNOWN` stage | Shared Redis key read error | Verify `SHARED_REDIS_URL` in `services/main` points to `redis-shared` instance writing `scan:stage:{scanId}`. |
| LLM Fix generation fails verification | Hallucinated syntax or unvalidated patch | Inspect AI service verification log in `services/ai-service/app/services/ai_verifier.py`. Enforce deterministic AST check. |
