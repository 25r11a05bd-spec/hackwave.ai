# PatchLine — AI Routing Specification (`model_router.py`)

`services/ai-service/app/services/model_router.py` is the single source of truth for AI provider selection and model routing in PatchLine. No component picks an AI provider or model directly; all requests route through `chat_for_task()`.

---

## 1. Per-Task Model Routing Matrix

Every AI task in PatchLine is configured with a **Primary (Featherless AI)** model and a **Fallback (OpenAI / Azure OpenAI)** model.

| Task Key | Primary Model (Featherless) | Fallback Model (OpenAI / Azure) | Applied Location | Purpose |
|---|---|---|---|---|
| `analysis` | `Qwen3-Coder-30B-A3B` | `gpt-4.1-mini` | `scanner.py` (`_enrich_deterministic_findings`, `_ai_supplemental_scan`) | Contextual reasoning, root-cause enrichment, business logic SAST pass |
| `rag_ranking` | `DeepSeek-V4-Flash` | `gpt-5.2` | Configured for future LLM tie-breaking | Reserved for candidate ranking (currently deterministic composite scoring) |
| `fix` | `Qwen3-Coder-480B-A35B` | `gpt-5.2` | `scanner.py` (`_generate_fix`) | Patch generation for vulnerable code files |
| `verify` | `DeepSeek-V4-Pro` | `gpt-5.3-codex` | `scanner.py` (`_codex_review_fix`) | Independent, adversarial code review of generated diffs |
| `general` | `Qwen3-Coder-30B-A3B` | `gpt-4.1-mini` | `ai_service.py` (`run_chat`) | Backs `/api/ai/chat`, `/api/ai/generate`, `/api/ai/analyze` free-form endpoints |

---

## 2. Why `rag_ranking` is Deterministic

RAG candidate ranking (`app/core/memory_store.py: _composite_score`) is intentionally **deterministic** — adhering to the principle that financial risk and candidate scoring must be reproducible and explainable. Candidates are scored by vector similarity + category match + language match + severity match + historical verified outcome.

The `rag_ranking` task configuration exists so an LLM tie-break mechanism can be added without code refactoring or config migration.

---

## 3. How Routing & Fallback Execution Works

```
                        chat_for_task(task, messages, fallback_provider, fallback_model)
                                           │
                         FEATHERLESS_ENABLED=true AND
                          FEATHERLESS_API_KEY set?
                             │                    │
                            yes                   no
                             │                    │
                     call Featherless      call fallback_provider
                     with task model       (caller-supplied provider/model)
                             │
                       succeeded?
                       │        │
                      yes       no (timeout/5xx/auth error)
                       │        │
                   return    log + call fallback_provider
```

### Key Execution Rules
- **Caller-Supplied Fallback**: Every caller resolves its own fallback provider/model from settings. If `FEATHERLESS_ENABLED=false`, the router passes through directly to `AI_PROVIDER` (`openai`/`azure_openai`/`mock`).
- **Infrastructure-Only Fallback**: Only provider-level failures (timeout, connection refused, HTTP 500) trigger the fallback model. Content-level outcomes (Codex rejecting a patch, invalid JSON) are handled by verification logic, NOT by triggering model fallbacks.

---

## 4. Environment Variables & Render Configuration

Configured via environment variables on **Render.com**:

```bash
# Primary Provider (Featherless AI)
FEATHERLESS_ENABLED=true
FEATHERLESS_API_KEY=your_featherless_api_key
FEATHERLESS_BASE_URL=https://api.featherless.ai/v1

FEATHERLESS_MODEL_ANALYSIS=Qwen/Qwen3-Coder-30B-A3B-Instruct
FEATHERLESS_MODEL_FIX=Qwen/Qwen3-Coder-480B-A35B-Instruct
FEATHERLESS_MODEL_VERIFY=deepseek-ai/DeepSeek-V4-Pro
FEATHERLESS_MODEL_RAG_RANKING=deepseek-ai/DeepSeek-V4-Flash
FEATHERLESS_MODEL_GENERAL=Qwen/Qwen3-Coder-30B-A3B-Instruct

# Fallback Provider (OpenAI / Azure OpenAI)
FALLBACK_PROVIDER=openai
AI_PROVIDER=openai
AI_API_KEY=your_openai_api_key

FALLBACK_MODEL_ANALYSIS=gpt-4.1-mini
FALLBACK_MODEL_FIX=gpt-5.2
FALLBACK_MODEL_VERIFY=gpt-5.3-codex
FALLBACK_MODEL_RAG_RANKING=gpt-5.2
FALLBACK_MODEL_GENERAL=gpt-4.1-mini
```

---

## 5. Observability & Logging

Every routed request emits structured JSON logs:

- **`ai_router_call`**: Emitted on success. Includes `task`, `provider`, `model`, `fallback_used`, and `log_context`.
- **`ai_router_primary_failed_falling_back`**: Emitted when Featherless fails prior to attempting fallback.
- **`ai_router_all_providers_failed`**: Emitted when both primary and fallback calls fail.
