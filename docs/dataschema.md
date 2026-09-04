# PatchLine — Database & Storage Schema

PatchLine deliberately uses **five** storage systems, each for what it is
actually good at, per the project's general rule: *"do not create a second
risk analytics database," "do not add unnecessary services."* Every system
below is already load-bearing; nothing here is proposed.

| Store | Owner service | Used for |
|---|---|---|
| Redis (`redis-main`) | `main-service` + `worker` | Scan/fix state machine, BullMQ queues, HTTP cache, rate limiting, OAuth CSRF state |
| Redis (`redis-shared`) | `auth-service`, `ai-storage-service` | Auth rate limiting; live pipeline-stage checkpoints (`scan:stage:*`) |
| MongoDB (`ai_storage_db`) | `ai-storage-service` | `scan_history` (durable scan archive), `file_assets`, `conversations` |
| MongoDB (`auth` db) | `auth-service` | `User`, `RefreshToken` |
| Supabase / Postgres | `main-service` | `github_connections`, `jira_connections`, watched repos |
| Elasticsearch | `ai-storage-service` (indexer), frontend (via APIs) | Dashboard analytics, full-text finding search, risk trends |
| Chroma Cloud | `ai-storage-service` | `finding_memory` vector collection (RAG) |

Per the project rule *"do not create a second dashboard when Elasticsearch
already powers the existing dashboard"* — Elasticsearch is the **only**
analytics/dashboard data layer. Risk Engine output is computed once
(deterministically) and indexed into Elasticsearch; nothing else serves
dashboard queries.

## 1. Redis — `redis-main`

| Key pattern | Written by | TTL | Notes |
|---|---|---|---|
| `scan:record:{scanId}` | `scanStore.js` | 24h | The scan record — see `data-model.md` §1 |
| BullMQ queue keys (`bull:*`) | `config/queue.js`, `workers/scannerWorkers.js` | queue-managed | Scan job + fix job queues |
| HTTP cache keys | `middleware/cache.js` | per-route | |
| `rl:general:*`, `rl:strict:*` | `middleware/rateLimiter.js` | window-based | `rate-limit-redis` counters |
| OAuth `state` values | `utils/oauthState.js` | 5 min | CSRF binding for GitHub/Jira OAuth start/callback |

## 2. Redis — `redis-shared`

| Key pattern | Written by | Read by | TTL |
|---|---|---|---|
| `scan:stage:{scanId}` | `ai-storage-service` (`app/services/scan_progress.py`) | `main-service` (`scanStore.getScanStage`, via `sharedRedis` client) | 15 min |
| auth rate-limit counters | `auth-service` | `auth-service` | window-based |

`SHARED_REDIS_URL` is optional — unset, it falls back to `REDIS_URL`, so a
single-Redis deployment behaves identically to the split topology. A
`redis-shared` outage degrades stage reporting to `stage: null`; it never
fails a scan or a fix, because the actual status/results record
(`scan:record:{scanId}`) lives entirely on `redis-main`.

## 3. MongoDB — `ai_storage_db` (ai-storage-service)

Indexes are created by `app/core/db.py:ensure_indexes()`:

| Collection | Key fields | Indexes |
|---|---|---|
| `scan_history` | `scanId`, `repo`, `ownerId`, `scannedAt`, `findings[]`, `fixes{}` | `scanId` (unique), `repo`, `(ownerId, scannedAt desc)` compound, `scannedAt desc` |
| `file_assets` | `owner_id`, `blob_name` | `owner_id`, `blob_name` (unique) |
| `conversations` | `owner_id` | `owner_id` |

The `(ownerId, scannedAt)` compound index exists specifically because every
user-scoped `scan_history` read (dashboard stats, scan-history list) filters
by `ownerId` and sorts by `scannedAt` — without it, both did a full
collection scan across every user's scans on every request.

RAG memory does **not** have a MongoDB collection: as of the Chroma Cloud
migration, finding embeddings + metadata live entirely in Chroma (see §6);
there is no `finding_memory` Mongo index to maintain.

## 4. MongoDB — auth-service database

| Collection | Key fields | Notes |
|---|---|---|
| `User` | email, password hash (`bcryptjs`, cost 12), `tokenVersion` | `tokenVersion` bump invalidates all sessions (`POST /api/auth/logout-all`) |
| `RefreshToken` | token hash, userId, expiry, rotation chain | 7-day expiry, rotated on every use; reuse of a rotated token triggers immediate session invalidation |

## 5. Supabase / Postgres (main-service)

| Table | Purpose | Notes |
|---|---|---|
| `github_connections` | Per-user GitHub OAuth token + installation metadata | OAuth token encrypted at rest (AES-256-GCM, `OAUTH_TOKEN_ENCRYPTION_KEY_BASE64`) — see `githubTokenStore.js` |
| `jira_connections` | Per-user Jira OAuth token + cloud id | Same encryption; refreshed on expiry (`jiraService.js`), unlike GitHub's non-expiring classic OAuth tokens |
| watched-repo rows | Repos configured for scan triggers | Consumed by `services/scanTriggerService.js` |

`SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security and, per
`docs/security.md`, must exist only in `main-service`'s environment — never
copied to `ai-storage-service` or the frontend.

## 6. Chroma Cloud — `finding_memory` collection

One collection, `hnsw:space: cosine` (matches the pipeline's prior
brute-force cosine-similarity behavior — Chroma's HNSW index otherwise
defaults to `l2`, which would silently change what "similar" means). Point
shape is documented in [`data-model.md`](./data-model.md) §4. Managed by
`app/core/chroma_client.py` (lazy singleton, `asyncio.to_thread` since the
Chroma Python SDK has no native async client) and queried/written through
`app/core/memory_store.py`.

## 7. Elasticsearch

Indexed by `ai-storage-service` after Risk Recalculation; queried by both
`ai-storage-service` (`app/core/es_client.py`, powers `GET /api/v1/search`)
and the frontend's dashboard. Falls back to a MongoDB regex scan on
`scan_history` if Elasticsearch is disabled — search degrades, it never
hard-fails. Per the project's non-negotiable rules, the frontend never
computes EAL/VaR/riskScore/exploitability/assetCriticality itself; it only
displays what's indexed here.

## Why not one database?

Each store is chosen for a property the others don't have:
- **Redis** — sub-millisecond read/write for a hot, frequently-mutated state
  machine and queue, with TTL-based natural cleanup.
- **MongoDB** — durable, flexible-schema archive of a scan's full findings
  array (irregular shape: deterministic vs AI findings, arbitrary fix
  history) plus file blobs' metadata.
- **Postgres/Supabase** — relational integrity for user-owned OAuth
  connections, where Row Level Security matters.
- **Elasticsearch** — full-text + aggregation query engine the dashboard is
  already built on; a second dashboard datastore is explicitly prohibited.
- **Chroma** — purpose-built ANN vector index; nothing else in the stack
  does approximate nearest-neighbor search over embeddings.