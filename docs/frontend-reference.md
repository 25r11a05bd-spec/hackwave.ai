# PatchLine Frontend Reference

> **Purpose:** This document is the authoritative frontend reference for PatchLine.
> Any developer or AI modifying the frontend must follow these rules unless the backend API contract is explicitly changed.

---

# 1. Frontend Overview

PatchLine frontend is a **Next.js application** responsible for presenting the PatchLine security workflow to the user.

```text
GitHub
   │
   ▼
┌──────────────────────────────┐
│        Next.js Frontend      │
│           Vercel             │
│                              │
│ Dashboard                    │
│ Scanner                      │
│ Findings                     │
│ Fix Review                   │
│ Verification                 │
│ Pull Request                 │
│ Jira                         │
└──────────────┬───────────────┘
               │ HTTPS
               ▼
┌──────────────────────────────┐
│       Main Service           │
│        API Gateway           │
└──────────────┬───────────────┘
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
     Auth      AI      Data
```

### Core rule

The frontend is a **presentation and interaction layer**.

It does not own:

* security scanning
* vulnerability detection
* AI analysis
* fix generation
* verification
* risk calculation
* GitHub token handling
* Elasticsearch access
* MongoDB access
* Redis access
* database persistence

These belong to backend services.

---

# 2. Technology Stack

```text
Framework:       Next.js
UI:               React
Language:         TypeScript
Styling:          Tailwind CSS
Deployment:       Vercel
Authentication:   JWT + secure cookies
API:              Main Service
State:            React state / server state as appropriate
```

Use TypeScript throughout the frontend.

Avoid introducing JavaScript files for new application logic.

---

# 3. Frontend Directory Structure

Recommended structure:

```text
frontend/
│
├── app/
│   ├── page.tsx
│   │
│   ├── login/
│   │   └── page.tsx
│   │
│   ├── dashboard/
│   │   └── page.tsx
│   │
│   ├── scanner/
│   │   └── page.tsx
│   │
│   ├── findings/
│   │   └── page.tsx
│   │
│   ├── settings/
│   │   └── page.tsx
│   │
│   └── layout.tsx
│
├── components/
│   ├── dashboard/
│   ├── scanner/
│   ├── findings/
│   ├── github/
│   ├── jira/
│   ├── ui/
│   └── layout/
│
├── lib/
│   ├── api/
│   ├── auth/
│   ├── scanner/
│   ├── github/
│   └── utils/
│
├── hooks/
│   ├── useAuth.ts
│   ├── useScan.ts
│   ├── useFindings.ts
│   └── useProviderStatus.ts
│
├── types/
│   ├── auth.ts
│   ├── scanner.ts
│   ├── findings.ts
│   ├── github.ts
│   └── jira.ts
│
└── public/
```

The exact existing folder structure may differ, but new functionality should preserve the same separation of responsibilities.

---

# 4. Page Responsibilities

## `/`

Landing / entry page.

Responsibilities:

```text
- Product introduction
- Login / Get Started
- Basic PatchLine explanation
```

Do not perform scanning from this page.

---

# 5. `/login`

Authentication page.

Responsibilities:

```text
- Login
- Registration if supported
- GitHub authentication
- Authentication errors
- Loading states
```

The frontend must not directly manipulate JWT signing or token generation.

---

# 6. `/dashboard`

The dashboard provides a high-level view of the user's PatchLine activity.

It may display:

```text
Repositories
Recent scans
Security findings
Severity distribution
Fix status
Open PRs
Risk information
Jira tracking
AI provider status
```

Data must come from the backend.

Example:

```text
Frontend
   │
   ▼
GET /dashboard
   │
   ▼
Main Service
   │
   ├── Supabase
   ├── Elasticsearch
   └── other backend services
```

The frontend must **not query Elasticsearch directly**.

---

# 7. `/scanner`

The scanner is the primary PatchLine workflow interface.

It should represent the real backend state.

Expected workflow:

```text
1. Select GitHub repository
2. Start scan
3. Scan queued
4. Scan running
5. Deterministic analysis
6. AI analysis
7. Findings generated
8. Review findings
9. Approve fix
10. Fix generation
11. AI verification
12. Deterministic rescan
13. Risk evaluation
14. PR creation
15. PR status
```

The UI must reflect the actual backend state.

---

# 8. Scanner State Machine

The frontend should treat the backend as the source of truth.

Example:

```text
QUEUED
  │
  ▼
SCANNING
  │
  ▼
ANALYZING
  │
  ▼
FINDINGS_READY
  │
  ▼
AWAITING_APPROVAL
  │
  ▼
FIXING
  │
  ▼
VERIFYING
  │
  ▼
DETERMINISTIC_RESCAN
  │
  ▼
RISK_EVALUATION
  │
  ▼
PR_CREATING
  │
  ▼
PR_OPEN
```

Possible terminal states:

```text
COMPLETED
FAILED
PARTIAL
CANCELLED
```

The exact enum returned by the backend is authoritative.

Do not create frontend-only states that contradict backend state.

---

# 9. Scan Creation

The frontend initiates a scan through the Main Service.

Conceptual request:

```http
POST /projects/:projectId/repositories/:repoId/scans
```

Expected response:

```json
{
  "jobId": "scan_123",
  "status": "QUEUED"
}
```

The frontend should immediately switch into the scan progress interface.

### Important

Do not keep the HTTP request open waiting for the scan to finish.

The scan is asynchronous.

---

# 10. Scan Status

The frontend periodically retrieves authoritative scan state.

Conceptual:

```http
GET /scans/:scanId
```

Example response:

```json
{
  "scanId": "scan_123",
  "status": "ANALYZING",
  "progress": 65,
  "currentStep": "AI_ANALYSIS",
  "findingsCount": 7
}
```

The frontend should render these values dynamically.

Never hard-code:

```text
65%
AI Analysis
7 findings
```

These are examples only.

---

# 11. Scanner Progress UI

The scanner should show meaningful backend workflow stages.

Example:

```text
✓ Repository Connected

✓ Repository Ingested

✓ Deterministic Scan

● AI Analysis

○ Finding Classification

○ Risk Evaluation

○ Ready for Review
```

The active/completed state must come from backend data.

Do not simply animate all steps regardless of actual backend progress.

---

# 12. AI Provider Status

PatchLine may use different AI providers.

For example:

```text
Featherless AI
Azure OpenAI
```

The frontend must display the **actual runtime provider/model status**.

Conceptual endpoint:

```http
GET /api-provider-status
```

Example:

```json
{
  "providers": {
    "azureOpenAI": {
      "available": true,
      "model": "..."
    },
    "featherless": {
      "available": false
    }
  },
  "activeProvider": "azureOpenAI"
}
```

The UI must not say:

```text
Azure OpenAI — Online
```

unless the backend actually reports it.

---

# 13. Findings

A finding represents a detected security issue.

Example:

```json
{
  "id": "finding_123",
  "severity": "HIGH",
  "category": "INJECTION",
  "title": "Potential SQL Injection",
  "file": "src/api/users.ts",
  "line": 42,
  "description": "...",
  "suggestedFix": "..."
}
```

Frontend responsibilities:

```text
- Display finding
- Display severity
- Display category
- Display location
- Display explanation
- Display available remediation
- Allow user approval/rejection
```

Frontend must not independently determine whether the finding is actually vulnerable.

---

# 14. Finding Severity

Severity should be rendered from backend data.

Typical levels:

```text
CRITICAL
HIGH
MEDIUM
LOW
INFO
```

Do not infer severity from title text.

Bad:

```ts
if (title.includes("SQL")) severity = "HIGH";
```

Correct:

```ts
severity = finding.severity;
```

---

# 15. Finding Details

A finding detail view can contain:

```text
Finding title
Severity
Category
File
Line
Code context
Explanation
Impact
Suggested remediation
AI reasoning
Fix status
Verification status
Risk information
```

The frontend should only display information supplied by the backend.

---

# 16. Fix Approval

Fix generation requires explicit user approval.

Example:

```http
POST /findings/:findingId/approve
```

The UI should clearly communicate:

```text
Approve Fix
```

before triggering remediation.

The frontend must not automatically approve findings.

---

# 17. Batch Approval

PatchLine may support approving multiple findings.

Conceptual:

```http
POST /batch-approve-fix
```

Example UI:

```text
[ ] SQL Injection
[ ] Hardcoded Secret
[ ] Weak Authentication

        Approve Selected Fixes
```

The backend remains responsible for processing and validating the request.

---

# 18. Fix Generation

After approval:

```text
APPROVED
   ↓
FIXING
   ↓
GENERATED
   ↓
VERIFYING
```

The frontend should show:

```text
Generating remediation...
```

then:

```text
Verifying remediation...
```

then:

```text
Deterministic rescan...
```

The UI must not claim success before backend confirmation.

---

# 19. Diff Display

The diff viewer must display the actual generated patch.

If no patch exists:

```text
No generated patch available yet.
```

Do **not** generate a fake fallback diff.

Never display an invented remediation merely to make the interface look complete.

---

# 20. Verification

PatchLine performs AI verification and deterministic verification.

The frontend should distinguish them.

Example:

```text
AI Verification
✓ Passed

Deterministic Rescan
✓ Passed

Risk Evaluation
✓ Reduced
```

If verification fails:

```text
AI Verification
✕ Failed
```

Do not display:

```text
Fix Verified
```

until the backend confirms verification.

---

# 21. Regression / Verification Messaging

Avoid misleading claims such as:

```text
0 Regressions Certified
```

unless the backend has actually produced that exact verified metric.

Preferred:

```text
Fix Verified
```

If a real risk reduction is available:

```text
Fix Verified
Risk ↓ 42%
```

The percentage must come from backend data.

---

# 22. Risk Evaluation

Risk is calculated by the backend.

Frontend may display:

```text
Risk Before
Risk After
Risk Reduction
Risk Level
```

Example:

```text
Risk Reduction

↓ 42%

Before     HIGH
After      MEDIUM
```

Never calculate or fabricate the security risk in the frontend.

---

# 23. Pull Request Status

After verification, PatchLine can create a GitHub PR.

Conceptual:

```http
GET /pr-status/:scanId
```

Possible states:

```text
CREATING
OPEN
MERGED
REJECTED
FAILED
```

Example:

```text
✓ Fix generated
✓ Verification passed
✓ Deterministic rescan passed
✓ Risk evaluated
✓ Pull Request opened
```

---

# 24. PR Retry

If a PR operation fails or is rejected, the frontend may expose retry functionality.

Conceptual:

```http
POST /retry-pr
```

The frontend should never retry indefinitely.

Backend retry limits are authoritative.

---

# 25. GitHub Repository Selection

Repository data comes from the backend.

Conceptual:

```http
GET /github/repos
```

Flow:

```text
Frontend
   ↓
Main Service
   ↓
Auth Service
   ↓
GitHub
```

GitHub access tokens must not be exposed to the frontend.

---

# 26. GitHub OAuth

OAuth should be initiated through the backend.

Example:

```text
Frontend
   ↓
Auth Service
   ↓
GitHub
   ↓
OAuth Callback
   ↓
Auth Service
```

The frontend should never receive or store the GitHub OAuth client secret.

---

# 27. Jira

Jira functionality should also be routed through the backend.

Possible frontend operations:

```text
Connect Jira
View issues
Create issue
View issue details
Link finding to issue
```

Conceptual endpoints:

```http
GET  /jira/oauth/start
GET  /jira/oauth/callback
GET  /api/jira/issues
POST /api/jira/issues
GET  /api/jira/issues/:issueId
```

The exact backend contract is authoritative.

---

# 28. API Architecture

All frontend API requests should use a centralized API client.

Recommended:

```text
lib/api/client.ts
```

Example conceptual structure:

```ts
api.get(...)
api.post(...)
api.put(...)
api.delete(...)
```

Do not scatter raw `fetch()` implementations across dozens of components.

Bad:

```ts
fetch("https://some-service.azurewebsites.net/...")
```

Correct:

```ts
api.get("/scans/123")
```

The API client knows the Main Service base URL.

---

# 29. Backend Boundary

Correct:

```text
Browser
   │
   ▼
Main Service
   │
   ├── Auth
   ├── AI
   ├── GitHub
   ├── Jira
   ├── Elasticsearch
   └── Databases
```

Incorrect:

```text
Browser
 ├──→ Elasticsearch
 ├──→ MongoDB
 ├──→ Redis
 ├──→ AI Service
 └──→ GitHub using PAT
```

The frontend should not bypass the Main Service.

---

# 30. Environment Variables

Frontend environment variables should contain only frontend-safe configuration.

Example:

```env
NEXT_PUBLIC_API_URL=https://<main-service-domain>
NEXT_PUBLIC_APP_URL=https://<frontend-domain>
```

Never expose:

```text
MONGODB_URI
REDIS_PASSWORD
GITHUB_PAT
AZURE_OPENAI_API_KEY
FEATHERLESS_API_KEY
CHROMA_API_KEY
SUPABASE_SERVICE_ROLE_KEY
JWT_PRIVATE_KEY
INTERNAL_SERVICE_SECRET
```

Anything beginning with:

```text
NEXT_PUBLIC_
```

must be considered publicly visible.

---

# 31. Authentication

Frontend requests requiring authentication should include credentials.

Example:

```ts
fetch(url, {
  credentials: "include"
});
```

Authentication cookies should be handled by the browser.

The frontend should not store sensitive refresh tokens in:

```text
localStorage
sessionStorage
```

Production cookies should use appropriate:

```text
HttpOnly
Secure
SameSite
```

settings.

---

# 32. Authentication Refresh

When an access token expires:

```text
Request
   ↓
401
   ↓
Refresh
   ↓
Retry request
```

The refresh operation belongs to the authentication layer.

The UI should not randomly redirect to login because of a temporary backend/network failure.

Distinguish:

```text
401 Unauthorized
```

from:

```text
502 Upstream unavailable
504 Gateway timeout
```

---

# 33. Error Handling

Frontend errors should be meaningful.

Example:

```text
Unable to start scan.
The PatchLine backend is currently unavailable.
```

Instead of:

```text
Something went wrong.
```

For backend errors:

```text
400 → Invalid request
401 → Authentication required
403 → Not authorized
404 → Resource not found
409 → Conflict
429 → Rate limited
500 → Internal server error
502 → Upstream service unavailable
504 → Gateway timeout
```

Do not expose stack traces to users.

---

# 34. Loading States

Every asynchronous operation needs a loading state.

Examples:

```text
Loading repositories...
Starting scan...
Scanning repository...
Generating fix...
Verifying fix...
Creating pull request...
Loading Jira issues...
```

Avoid blank screens during network operations.

---

# 35. Empty States

Every data-driven page should have an intentional empty state.

Examples:

```text
No repositories connected yet.

No security findings detected.

No pull requests created yet.

No Jira issues linked to this project.
```

Empty state ≠ error state.

---

# 36. Scanner UI Honesty Rules

The scanner must follow these rules:

```text
1. Never fabricate findings.
2. Never fabricate patches.
3. Never fabricate verification.
4. Never fabricate risk reduction.
5. Never fabricate provider status.
6. Never show completed steps before backend confirmation.
7. Never show a PR before backend confirmation.
8. Never show a fake progress percentage.
9. Never hard-code security metrics.
10. Never hide a failed backend state.
```

The backend is the source of truth.

---

# 37. Real-Time Workflow

The frontend should update scanner state using the supported backend mechanism.

Possible implementations:

```text
Polling
Server-Sent Events
WebSocket
```

If polling is used:

```text
GET /scans/:scanId
```

at a controlled interval.

Example:

```text
2–5 seconds
```

Do not create aggressive polling loops that overload the backend.

Stop polling when the scan reaches a terminal state.

---

# 38. State Management

Separate:

```text
Server state
UI state
Form state
```

### Server state

Examples:

```text
scan
findings
repositories
PR status
provider status
Jira issues
```

### UI state

Examples:

```text
selected finding
selected repository
open modal
expanded diff
active tab
```

### Form state

Examples:

```text
login form
scan configuration
Jira issue creation
```

Do not duplicate server state unnecessarily in multiple components.

---

# 39. Type Safety

Define backend response types.

Example:

```ts
interface ScanStatus {
  scanId: string;
  status: string;
  progress?: number;
  currentStep?: string;
}
```

Use shared/centralized types where practical.

Avoid:

```ts
const data: any = await response.json();
```

Prefer explicit types.

---

# 40. Component Rules

Components should have one clear responsibility.

Good:

```text
ScannerProgress
FindingCard
FindingDetails
FixDiffViewer
VerificationStatus
RiskSummary
PRStatus
ProviderStatus
RepositorySelector
```

Avoid one enormous component containing:

```text
API calls
authentication
scan state
finding state
diff rendering
PR state
modals
routing
```

Break complex pages into focused components.

---

# 41. Scanner Component Architecture

Recommended:

```text
ScannerPage
│
├── RepositorySelector
│
├── ScanHeader
│
├── ScanProgress
│   ├── ScanStep
│   └── ProviderStatus
│
├── FindingsPanel
│   └── FindingCard
│
├── FindingDetails
│
├── FixPanel
│   ├── ApprovalControl
│   ├── DiffViewer
│   ├── VerificationStatus
│   └── RiskSummary
│
└── PRStatus
```

---

# 42. Security UI

Security-sensitive operations should require deliberate user interaction.

Examples:

```text
Approve Fix
Create Remediation
Retry PR
Connect GitHub
Connect Jira
```

Use confirmation UI where an operation can modify external resources.

---

# 43. GitHub PR Safety

Frontend must never provide controls that imply PatchLine can:

```text
Directly modify main
Directly modify master
Merge PR automatically
Bypass verification
Skip deterministic rescan
Skip approval
```

The PatchLine workflow is:

```text
Finding
   ↓
Human Approval
   ↓
AI Fix
   ↓
Verification
   ↓
Deterministic Rescan
   ↓
Risk Evaluation
   ↓
Pull Request
```

---

# 44. PR Naming

PR names should come from backend-generated deterministic naming.

Frontend should not invent different PR names.

If backend returns:

```json
{
  "title": "PatchLine: Remediate scan_123"
}
```

display that value.

---

# 45. Notifications

Notifications are backend data.

Conceptual:

```http
GET /api/v1/notifications
```

Example:

```text
Scan completed
Fix verified
Pull request created
Jira issue created
Scan failed
```

Do not generate fake notifications based only on frontend events.

---

# 46. Dashboard Data

Dashboard metrics must be sourced from backend data.

Examples:

```text
Total Scans
Open Findings
Critical Findings
Verified Fixes
Open PRs
Risk Reduction
```

Do not hard-code demo numbers in production.

For demo mode, clearly separate mock/demo data from production data.

---

# 47. Performance

Avoid unnecessary:

```text
API requests
re-renders
large client components
duplicate data fetching
```

Prefer:

```text
Server Components
where appropriate
```

and Client Components only where interactivity requires them.

---

# 48. Responsive Design

The application should support:

```text
Desktop
Laptop
Tablet
Mobile
```

The primary judge/demo experience is desktop, but important functionality should not break on smaller screens.

---

# 49. Accessibility

Interactive controls should have:

```text
Accessible labels
Keyboard navigation
Visible focus state
Meaningful button names
Error messages
Semantic HTML
```

Avoid icon-only buttons without accessible labels.

---

# 50. Frontend Logging

Do not log secrets.

Never log:

```text
JWT
refresh token
GitHub token
API key
password
cookie contents
```

Development logs may include:

```text
scan ID
finding ID
request ID
status
operation
```

Production logging should remain controlled.

---

# 51. API Request Correlation

When supported by the backend, preserve the request ID.

Example:

```text
Frontend
   │
   │ X-Request-ID
   ▼
Main Service
   │
   ▼
AI Service
```

This makes debugging scanner failures much easier.

---

# 52. Deployment

Frontend deployment target:

```text
Vercel
```

Production flow:

```text
GitHub
   ↓
Vercel Build
   ↓
Next.js Production
   ↓
HTTPS
   ↓
Main Service
```

Build:

```bash
npm install
npm run build
```

Local production test:

```bash
npm run build
npm run start
```

---

# 53. Frontend Production Configuration

Production configuration should point to the deployed Main Service.

Example:

```env
NEXT_PUBLIC_API_URL=https://api.<your-domain>
NEXT_PUBLIC_APP_URL=https://app.<your-domain>
```

Do not point production frontend to:

```text
localhost
127.0.0.1
development services
```

---

# 54. Deployment Verification

After Vercel deployment:

```text
[ ] Frontend loads
[ ] Login works
[ ] Authentication persists
[ ] GitHub OAuth works
[ ] Repository list loads
[ ] Scan starts
[ ] Scan status updates
[ ] Findings appear
[ ] Finding details work
[ ] Approval works
[ ] Fix status updates
[ ] Diff displays actual patch
[ ] Verification status is accurate
[ ] Risk information is accurate
[ ] PR status appears
[ ] Jira works
[ ] Error states work
```

---

# 55. AI Modification Rules

Any AI coding agent modifying the frontend must follow:

```text
1. Inspect existing code before modifying it.
2. Do not invent backend endpoints.
3. Do not invent response fields.
4. Do not fabricate UI data.
5. Reuse existing API clients.
6. Reuse existing types.
7. Preserve authentication behavior.
8. Preserve Main Service as the backend boundary.
9. Do not expose secrets.
10. Do not bypass approval.
11. Do not hard-code provider status.
12. Do not hard-code scan progress.
13. Do not hard-code security metrics.
14. Do not fabricate diffs.
15. Do not claim verification without backend confirmation.
16. Do not break existing routes.
17. Do not silently swallow API errors.
18. Keep components modular.
19. Keep TypeScript strict.
20. Test the complete user flow after major changes.
```

---

# 56. Critical Frontend Principle

PatchLine's frontend should visualize the following truth:

```text
              BACKEND
                 │
                 │ authoritative state
                 ▼
          ┌───────────────┐
          │    FRONTEND   │
          │               │
          │ visualizes    │
          │ real state    │
          └───────────────┘
```

Not:

```text
              FRONTEND
                 │
                 │ assumptions
                 ▼
          Fake progress
          Fake findings
          Fake fixes
          Fake verification
          Fake risk
```

---

# 57. Golden Rule

> **The frontend never decides whether PatchLine succeeded. The backend does.**

The frontend's job is to:

```text
Request
   ↓
Observe
   ↓
Display
   ↓
Allow user action
   ↓
Observe updated backend state
```

This rule applies to:

```text
Scanning
AI analysis
Fix generation
Verification
Risk evaluation
PR creation
Jira integration
AI provider status
```

---

# 58. Final Frontend Architecture

```text
                         USER
                           │
                           ▼
                ┌─────────────────────┐
                │   Next.js Frontend   │
                │       Vercel         │
                └──────────┬──────────┘
                           │
                           │ HTTPS
                           ▼
                ┌─────────────────────┐
                │    Main Service     │
                │     API Gateway     │
                └──────────┬──────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    Auth Service      AI Service         Data Layer
         │                 │                 │
         ▼                 ▼                 ├── Supabase
      MongoDB          AI Providers           ├── Elasticsearch
                           │                  ├── Redis
                           │                  ├── MongoDB
                           │                  └── Blob
                           │
                           ▼
                      GitHub / Jira
```

### Frontend responsibility

```text
UI
UX
Routing
Authentication interaction
API interaction
State visualization
User approval
Progress display
Finding review
Diff display
Verification display
PR display
```

### Backend responsibility

```text
Authentication
Authorization
Scanning
AI analysis
Fix generation
Verification
Deterministic rescan
Risk engine
GitHub operations
Jira operations
Persistence
Queues
Elasticsearch
Secrets
```

**Never move backend security logic into the frontend simply because it is easier to implement.**
