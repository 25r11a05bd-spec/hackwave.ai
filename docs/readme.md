# HackWave AI — Documentation Directory & AI Index

Welcome to the documentation suite for **HackWave AI (PatchLine)**.

> 🤖 **FOR AI AGENTS & LLMs:**
> If you are an AI assistant or automated agent reading this repository, your primary reference document is **[`docs/AI_CONTEXT.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/AI_CONTEXT.md)**.
> It contains the complete machine-readable specification, microservices topology, JSON schemas, API endpoint contracts, pipeline state machines, and security rules.

---

## Documentation Index

| Document | Targeted Audience | Purpose |
|---|---|---|
| 🤖 **[`docs/AI_CONTEXT.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/AI_CONTEXT.md)** | **AI Agents & LLMs** | Machine-readable API contracts, state machines, database schemas, and AI execution protocols. |
| 🏗️ **[`docs/architecture.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/architecture.md)** | Developers & Architects | High-level system architecture, microservices separation, Redis topology, and RAG memory details. |
| 🔌 **[`docs/api.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/api.md)** | Backend & Frontend Engineers | Full REST & WebSocket API reference for `auth`, `main`, and `ai-service`. |
| 🔒 **[`docs/security.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/security.md)** | Security & Core Developers | Security philosophy, trust boundaries, RS256 JWT key rotation, and OAuth configurations. |
| 🚀 **[`docs/deployment.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/deployment.md)** | DevOps & Engineers | Render.com deployment setup, environment variables guide, and production readiness checklist. |
| 💻 **[`docs/frontend-reference.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/docs/frontend-reference.md)** | Frontend Engineers | Next.js 16 app structure, routes, API clients, and state management rules. |

---

## System Quick Reference

- **Repository Root:** [`README.md`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/README.md)
- **Render Blueprint:** [`render.yaml`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/render.yaml)
- **Frontend App:** [`frontend/`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/frontend) (Next.js 16, React 19)
- **Auth Service:** [`services/auth/`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/services/auth) (Node/Express, MongoDB)
- **Main API Service:** [`services/main/`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/services/main) (Node/Express, Supabase, Redis)
- **AI Scanning Engine:** [`services/ai-service/`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/services/ai-service) (Python/FastAPI, Semgrep, Chroma Vector DB)