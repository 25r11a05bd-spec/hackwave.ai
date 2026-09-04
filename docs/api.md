# PatchLine API Endpoints

PatchLine uses a backend-gateway architecture:

```text
Frontend (Next.js/Vercel)
        │
        │ HTTPS + JWT
        ▼
Main Service / API Gateway
        │
        ├── Auth Service
        ├── AI Scanner Service
        ├── GitHub API
        ├── Jira API
        ├── Elasticsearch
        ├── Supabase
        ├── MongoDB
        └── Redis / BullMQ
```

> **Important:** The frontend should normally communicate only with the **Main Service/API Gateway**. AI Scanner and other internal service endpoints must not be exposed directly to the browser.

---

## API Conventions

### Authentication

User-facing protected endpoints use:

```http
Authorization: Bearer <access_token>
```

Authentication endpoints manage the JWT access token and refresh-token lifecycle.

### Common response pattern

Successful responses generally use JSON.

Errors should follow:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description",
  "requestId": "request-id"
}
```

### HTTP status conventions

| Status | Meaning                         |
| ------ | ------------------------------- |
| `200`  | Successful request              |
| `201`  | Resource created                |
| `202`  | Asynchronous job accepted       |
| `400`  | Invalid request                 |
| `401`  | Missing/invalid authentication  |
| `403`  | Authenticated but not permitted |
| `404`  | Resource not found              |
| `409`  | Invalid workflow/state conflict |
| `429`  | Rate limited                    |
| `502`  | Upstream service unavailable    |
| `504`  | Upstream service timeout        |
| `500`  | Internal server error           |

---

# 1. Authentication Service

**Service:** `auth-service`

**Default port:** `4001`

The Auth Service owns user authentication, JWT issuance, refresh-token rotation, logout and GitHub login OAuth.

---

### `POST /auth/register`

Register a new PatchLine user.

**Authentication:** Public

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**

```json
{
  "user": {
    "id": "user-id",
    "email": "user@example.com"
  }
}
```

---

### `POST /auth/login`

Authenticate a user.

**Authentication:** Public

**Request:**

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**

```json
{
  "accessToken": "<jwt>",
  "user": {
    "id": "user-id",
    "email": "user@example.com"
  }
}
```

A refresh token is maintained using the secure refresh-token mechanism.

---

### `POST /auth/refresh`

Rotate the refresh token and issue a new access token.

**Authentication:** Refresh-token cookie

**Response:**

```json
{
  "accessToken": "<new-jwt>"
}
```

---

### `POST /auth/logout`

Logout the current user and invalidate/rotate the refresh-token session.

**Authentication:** Required

---

### `GET /auth/me`

Return the currently authenticated user.

**Authentication:** Required

**Response:**

```json
{
  "id": "user-id",
  "email": "user@example.com"
}
```

---

# 2. GitHub Authentication

GitHub OAuth is used to authenticate/connect the user's GitHub account.

---

### `GET /auth/github`

Start GitHub OAuth login.

**Authentication:** Public

Flow:

```text
PatchLine
   ↓
/auth/github
   ↓
GitHub OAuth
   ↓
/auth/github/callback
```

---

### `GET /auth/github/callback`

GitHub OAuth callback.

**Authentication:** OAuth callback

After successful authentication, PatchLine creates/updates the user and issues the PatchLine authentication credentials.

---

# 3. GitHub Repository API

**Service:** Main Service

These endpoints allow the frontend to retrieve repositories available to the authenticated GitHub user.

---

### `GET /github/repos`

List repositories accessible to the authenticated user.

**Authentication:** Required

**Response:**

```json
{
  "repositories": [
    {
      "id": 123456,
      "name": "my-project",
      "fullName": "username/my-project",
      "private": false,
      "defaultBranch": "main",
      "url": "https://github.com/username/my-project"
    }
  ]
}
```

The GitHub access token must remain server-side. It must never be sent to the frontend.

---

# 4. GitHub OAuth Connection

If GitHub account connection is separated from authentication:

### `GET /github/oauth/start`

Start GitHub account connection.

**Authentication:** Required

---

### `GET /github/oauth/callback`

Handle GitHub OAuth callback.

**Authentication:** OAuth callback

---

# 5. Scanner API

The Scanner API is the core PatchLine workflow.

```text
Repository
    ↓
Deterministic Scan
    ↓
AI Analysis
    ↓
Findings
    ↓
Human Approval
    ↓
AI Fix Generation
    ↓
AI Verification
    ↓
Deterministic Rescan
    ↓
Risk Evaluation
    ↓
GitHub PR
```

---

## Start Scan

### `POST /projects/:projectId/repositories/:repoId/scans`

Start a repository security scan.

**Authentication:** Required

**Path parameters:**

```text
projectId
repoId
```

**Request:**

```json
{
  "branch": "main"
}
```

**Response:**

```json
{
  "jobId": "scan-12345",
  "scanId": "scan-12345",
  "status": "QUEUED"
}
```

**Expected HTTP status:**

```http
202 Accepted
```

The scan is asynchronous.

The API must not keep the HTTP request open while cloning, scanning or analyzing the repository.

---

# 6. Scan Status

### `GET /scans/:scanId`

Return the authoritative state of a scan.

**Authentication:** Required

**Response:**

```json
{
  "scanId": "scan-12345",
  "status": "PROCESSING",
  "stage": "AI_ANALYSIS",
  "progress": 72,
  "provider": "azure_openai",
  "model": "gpt-4.1-mini",
  "findingsCount": 5
}
```

Possible workflow stages include:

```text
QUEUED
CLONING
DETERMINISTIC_SCAN
AI_ANALYSIS
FINDINGS_READY
AWAITING_APPROVAL
FIX_PROCESSING
FIX_GENERATED
AI_VERIFICATION
DETERMINISTIC_RESCAN
RISK_EVALUATION
PR_CREATING
COMPLETED
FAILED
PARTIAL
```

The frontend must use this endpoint to display the actual backend workflow state.

Do not hardcode progress in the frontend.

---

# 7. Scan Findings

### `GET /scans/:scanId/findings`

Return all findings generated by a scan.

**Authentication:** Required

**Response:**

```json
{
  "scanId": "scan-12345",
  "findings": [
    {
      "id": "DET-001",
      "severity": "HIGH",
      "category": "INJECTION",
      "title": "Potential SQL Injection",
      "description": "User-controlled input reaches a SQL query.",
      "file": "src/db.js",
      "line": 42,
      "status": "AWAITING_APPROVAL",
      "suggestedFix": null
    }
  ]
}
```

---

### `GET /findings/:findingId`

Return a single finding.

**Authentication:** Required

**Response:**

```json
{
  "id": "DET-001",
  "scanId": "scan-12345",
  "severity": "HIGH",
  "category": "INJECTION",
  "title": "Potential SQL Injection",
  "description": "...",
  "file": "src/db.js",
  "line": 42,
  "status": "AWAITING_APPROVAL"
}
```

---

# 8. Finding Approval

### `POST /findings/:findingId/approve`

Approve a finding for AI remediation.

**Authentication:** Required

**Purpose:**

```text
AWAITING_APPROVAL
       ↓
FIX_PROCESSING
```

The backend must enforce the approval requirement.

AI must never bypass this state transition.

**Response:**

```json
{
  "findingId": "DET-001",
  "status": "FIX_PROCESSING",
  "jobId": "fix-12345"
}
```

Expected status:

```http
202 Accepted
```

---

# 9. Finding Rejection

### `POST /findings/:findingId/reject`

Reject/dismiss a finding.

**Authentication:** Required

**Request:**

```json
{
  "reason": "False positive"
}
```

**Response:**

```json
{
  "findingId": "DET-001",
  "status": "REJECTED"
}
```

A rejected finding must not enter the remediation pipeline.

---

# 10. Batch Remediation

### `POST /batch-approve-fix`

Approve and remediate multiple findings from a scan.

**Authentication:** Required

**Request:**

```json
{
  "scanId": "scan-12345",
  "findingIds": [
    "DET-001",
    "DET-002",
    "DET-003"
  ]
}
```

**Response:**

```json
{
  "scanId": "scan-12345",
  "status": "QUEUED",
  "jobId": "fix-batch-12345",
  "findingCount": 3
}
```

For multi-finding remediation:

```text
Multiple findings
       ↓
One remediation workflow
       ↓
All findings verified?
       ↓
YES → One PR
NO  → PARTIAL / FAILED, no PR
```

PatchLine must not create one PR per finding when processing a multi-finding remediation batch.

---

# 11. AI Provider Status

### `GET /api-provider-status`

Return the actual runtime health and active AI provider/model.

**Authentication:** Required

**Response:**

```json
{
  "activeProvider": "azure_openai",
  "activeModel": "gpt-5.2",
  "providers": {
    "azure_openai": {
      "status": "HEALTHY"
    },
    "featherless": {
      "status": "UNAVAILABLE"
    }
  }
}
```

The frontend must use this response to display the actual provider/model.

Do not hardcode provider names or health status in the UI.

---

# 12. Pull Request Status

### `GET /pr-status/:scanId`

Return the current GitHub PR status for a remediation workflow.

**Authentication:** Required

**Response:**

```json
{
  "scanId": "scan-12345",
  "status": "OPEN",
  "number": 14,
  "url": "https://github.com/org/repo/pull/14",
  "branch": "patchline/remediate-scan-12345"
}
```

Possible PR states:

```text
OPEN
MERGED
REJECTED
CLOSED
NOT_CREATED
```

The endpoint should query GitHub for the authoritative PR state rather than relying only on stale local state.

---

# 13. Retry PR / Remediation

### `POST /retry-pr`

Retry a failed or rejected remediation workflow.

**Authentication:** Required

**Request:**

```json
{
  "scanId": "scan-12345"
}
```

**Response:**

```json
{
  "scanId": "scan-12345",
  "status": "QUEUED",
  "jobId": "retry-12345"
}
```

Retries must remain bounded.

PatchLine should not repeatedly generate identical fixes indefinitely.

---

# 14. Dashboard API

The frontend must access dashboard data through Main Service.

The frontend should **not directly query Elasticsearch**.

---

### `GET /dashboard`

Return the dashboard's aggregated metrics.

**Authentication:** Required

**Response:**

```json
{
  "summary": {
    "totalScans": 120,
    "totalFindings": 483,
    "criticalFindings": 12,
    "highFindings": 67,
    "fixedFindings": 321
  },
  "severity": {},
  "categories": {},
  "riskTrends": [],
  "modelAttribution": {},
  "recentScans": []
}
```

The Main Service retrieves/aggregates the data from the appropriate backend stores, including Elasticsearch where applicable.

---

# 15. Jira OAuth

Jira is an optional workflow integration for creating/tracking remediation tickets.

---

### `GET /jira/oauth/start`

Start Jira OAuth 2.0 authorization.

**Authentication:** Required

Returns/initiates the Atlassian authorization URL.

---

### `GET /jira/oauth/callback`

Handle Atlassian OAuth callback.

**Authentication:** OAuth callback

The resulting Jira connection is associated with the authenticated PatchLine user.

---

# 16. Jira Issues

### `GET /api/jira/issues`

List Jira issues accessible through the connected Jira account.

**Authentication:** Required

---

### `POST /api/jira/issues`

Create a Jira issue.

**Authentication:** Required

**Request example:**

```json
{
  "summary": "Fix SQL Injection in src/db.js",
  "description": "PatchLine detected a high-severity SQL injection.",
  "issueType": "Bug"
}
```

**Response:**

```json
{
  "id": "10001",
  "key": "SEC-123",
  "url": "https://jira.example.com/browse/SEC-123"
}
```

---

### `GET /api/jira/issues/:issueId`

Retrieve a specific Jira issue.

**Authentication:** Required

---

# 17. GitHub Webhook

### `POST /github/webhook`

Receive GitHub webhook events.

**Authentication:**

GitHub webhook signature verification.

**Purpose:**

Used to detect repository/PR events such as:

```text
pull_request.opened
pull_request.closed
pull_request.merged
push
```

Webhook requests must not be trusted solely because they originate from GitHub.

---

# 18. Internal AI Scanner Service

**Service:** `ai-scanner-service`

**Default port:** `4002`

These endpoints are **internal service-to-service APIs**.

They must not be exposed directly to the public internet/frontend.

---

### `POST /api/v1/scanner/scan`

Execute the scanner workflow.

**Access:** Internal only

**Caller:**

```text
Main Service / Worker
        ↓
AI Scanner Service
```

**Purpose:**

```text
Clone repository
      ↓
Deterministic scanner
      ↓
AI analysis
      ↓
Finding normalization
      ↓
Persist findings
```

---

### `POST /api/v1/scanner/generate-and-verify-fix`

Generate and verify a remediation.

**Access:** Internal only

**Purpose:**

```text
Approved Finding
      ↓
RAG retrieval
      ↓
Top-3 fix ranking
      ↓
Optimal fix strategy
      ↓
AI patch generation
      ↓
AI verification
      ↓
Deterministic rescan
      ↓
Risk evaluation
```

---

### `GET /api/v1/notifications`

Return internal notification/job events.

**Access:** Internal/service authenticated.

---

# 19. Internal Sandbox / Execution API

If enabled in the deployment, this endpoint is internal only.

### `POST /internal/sandbox/execute`

Execute controlled verification work.

**Authentication:** Internal service token

**Access:**

```text
Internal Worker
      ↓
Sandbox
```

It must not be exposed to normal frontend clients.

---

# 20. Service Health Endpoints

Every backend service should expose operational health endpoints.

### `GET /health`

Basic liveness check.

Example:

```json
{
  "status": "ok"
}
```

---

### `GET /ready`

Readiness check.

This should verify required dependencies are available enough for the service to accept traffic.

Example:

```json
{
  "status": "ready"
}
```

---

### `GET /metrics`

Expose service metrics for monitoring/load testing.

**Access:** Internal/monitoring only.

---

# Complete Endpoint Summary

## Public/User-facing API

```text
AUTH
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
GET    /auth/me

GITHUB
GET    /auth/github
GET    /auth/github/callback
GET    /github/repos
GET    /github/oauth/start
GET    /github/oauth/callback
POST   /github/webhook

SCANNING
POST   /projects/:projectId/repositories/:repoId/scans
GET    /scans/:scanId
GET    /scans/:scanId/findings

FINDINGS
GET    /findings/:findingId
POST   /findings/:findingId/approve
POST   /findings/:findingId/reject

REMEDIATION
POST   /batch-approve-fix
GET    /api-provider-status

PULL REQUEST
GET    /pr-status/:scanId
POST   /retry-pr

DASHBOARD
GET    /dashboard

JIRA
GET    /jira/oauth/start
GET    /jira/oauth/callback
GET    /api/jira/issues
POST   /api/jira/issues
GET    /api/jira/issues/:issueId

SYSTEM
GET    /health
GET    /ready
GET    /metrics
```

---

# Internal API

```text
AI SCANNER
POST   /api/v1/scanner/scan
POST   /api/v1/scanner/generate-and-verify-fix
GET    /api/v1/notifications

SANDBOX
POST   /internal/sandbox/execute

INTERNAL SERVICE APIs
POST   /internal/scan
POST   /internal/fix
POST   /internal/verify
POST   /internal/rescan
POST   /internal/risk
POST   /internal/github/pr
GET    /internal/provider-status
```

---

# Endpoint Ownership

| Endpoint Group         | Owner             | Frontend Access   |
| ---------------------- | ----------------- | ----------------- |
| `/auth/*`              | Auth Service      | Yes               |
| `/github/*`            | Main Service      | Yes               |
| `/projects/*/scans`    | Main Service      | Yes               |
| `/scans/*`             | Main Service      | Yes               |
| `/findings/*`          | Main Service      | Yes               |
| `/batch-approve-fix`   | Main Service      | Yes               |
| `/api-provider-status` | Main Service      | Yes               |
| `/pr-status/*`         | Main Service      | Yes               |
| `/retry-pr`            | Main Service      | Yes               |
| `/dashboard`           | Main Service      | Yes               |
| `/jira/*`              | Main Service      | Yes               |
| `/api/jira/*`          | Main Service      | Yes               |
| `/api/v1/scanner/*`    | AI Scanner        | **No — internal** |
| `/internal/*`          | Internal services | **No — internal** |
| `/health`              | Each service      | Monitoring        |
| `/ready`               | Each service      | Monitoring        |
| `/metrics`             | Each service      | Monitoring        |

---

# PatchLine Golden Rule

```text
                 ┌─────────────────┐
                 │    FRONTEND     │
                 └────────┬────────┘
                          │
                          │ ONLY PUBLIC API
                          ▼
                 ┌─────────────────┐
                 │  MAIN SERVICE   │
                 │ API GATEWAY     │
                 └────────┬────────┘
                          │
             ┌────────────┼─────────────┐
             ▼            ▼             ▼
        AUTH SERVICE  AI SCANNER     INTEGRATIONS
                         │             │
                         ▼             ├── GitHub
                    Redis/BullMQ       ├── Jira
                         │             └── Elasticsearch
                         ▼
                       Worker
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
             AI       Verify       Risk
                         │
                         ▼
                       GitHub
                         │
                         ▼
                         PR
```

**Never do this:**

```text
Frontend → AI Scanner directly
Frontend → Elasticsearch directly
Frontend → MongoDB directly
Frontend → Redis directly
Frontend → GitHub with server credentials
```

**Correct:**

```text
Frontend
   ↓
Main Service
   ↓
Internal Services / Databases / External APIs
```

This keeps authorization, state transitions, rate limiting, request IDs, error handling and workflow orchestration centralized in Main Service.
