# PatchLine — Configuration Reference

PatchLine is composed of four independently-configured services deployed on **Render.com** (Render Web Services). Each service loads environment variables from its environment or `.env` file.

---

## 1. AI Service Configuration (`services/ai-service`)

### AI Model Router (Featherless AI + OpenAI / Azure Fallback)

| Environment Variable | Default / Recommended Value | Description |
|---|---|---|
| `FEATHERLESS_ENABLED` | `true` | Enables Featherless AI as primary AI provider |
| `FEATHERLESS_API_KEY` | *(Secret)* | Featherless API key |
| `FEATHERLESS_BASE_URL` | `https://api.featherless.ai/v1` | Featherless API endpoint URL |
| `FEATHERLESS_MODEL_ANALYSIS` | `Qwen/Qwen3-Coder-30B-A3B-Instruct` | Primary model for `analysis` task |
| `FEATHERLESS_MODEL_RAG_RANKING` | `deepseek-ai/DeepSeek-V4-Flash` | Primary model for `rag_ranking` task |
| `FEATHERLESS_MODEL_FIX` | `Qwen/Qwen3-Coder-480B-A35B-Instruct` | Primary model for `fix` task |
| `FEATHERLESS_MODEL_VERIFY` | `deepseek-ai/DeepSeek-V4-Pro` | Primary model for `verify` task |
| `FEATHERLESS_MODEL_GENERAL` | `Qwen/Qwen3-Coder-30B-A3B-Instruct` | Primary model for `general` task |
| `FALLBACK_PROVIDER` | `openai` | Provider used on primary failure (`openai`/`azure_openai`) |
| `AI_PROVIDER` | `openai` | Active single-provider switch |
| `AI_API_KEY` | *(Secret)* | Fallback OpenAI API key |
| `FALLBACK_MODEL_ANALYSIS` | `gpt-4.1-mini` | Fallback model for `analysis` task |
| `FALLBACK_MODEL_RAG_RANKING` | `gpt-5.2` | Fallback model for `rag_ranking` task |
| `FALLBACK_MODEL_FIX` | `gpt-5.2` | Fallback model for `fix` task |
| `FALLBACK_MODEL_VERIFY` | `gpt-5.3-codex` | Fallback model for `verify` task |
| `FALLBACK_MODEL_GENERAL` | `gpt-4.1-mini` | Fallback model for `general` task |

---

## 2. Infrastructure & Microservice Envs

- **`services/auth_services`**: Node/Express (`PORT=10000`, `MONGODB_URI`, `REDIS_URL`, `JWT_PRIVATE_KEY_BASE64`, `JWT_PUBLIC_KEY_BASE64`, `CORS_ORIGINS`).
- **`services/main`**: Node/Express (`PORT=10000`, `SUPABASE_URL`, `SUPABASE_KEY`, `REDIS_URL`, `JWT_PUBLIC_KEY_BASE64`, `AUTH_SERVICE_URL`, `AI_SERVICE_URL`).
- **`services/ai-service`**: Python/FastAPI (`PORT=10000`, `MONGO_URI`, `REDIS_URL`, `AZURE_STORAGE_CONNECTION_STRING`, `ELASTICSEARCH_URL`, `JWT_PUBLIC_KEY_BASE64`).
- **`frontend`**: Next.js 16 (`PORT=10000`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_URL`).

---

## 3. Render Deployment Setup

All microservices are configured for **Render.com** using dynamic `$PORT` binding and can be provisioned automatically via [`render.yaml`](file:///c:/Users/hp/Desktop/hackwave%201th/hackwave.ai/render.yaml).
