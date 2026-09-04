# PatchLine — AI Pipeline Overview

This is the top-level map of PatchLine's scan → fix pipeline. It ties together [`ai-routing.md`](./ai-routing.md), [`scanner.md`](./scanner.md), [`fix-generation.md`](./fix-generation.md), [`verification.md`](./verification.md), [`rag.md`](./rag.md), and [`risk-engine.md`](./risk-engine.md).

## The Pipeline Execution Order

```
Finding
   ↓
Analysis Pass (Qwen3-Coder-30B-A3B / gpt-4.1-mini)   (Contextual reasoning, root-cause analysis, FP reduction)
   ↓
RAG / ChromaDB                                        (Retrieve prior fixes — see rag.md)
   ↓
Rank Top 3 Candidates                                 (Deterministic composite scorer)
   ↓
Select Optimal Strategy
   ↓
Fix Patch Generation (Qwen3-Coder-480B-A35B / gpt-5.2) (Generate patch — see fix-generation.md)
   ↓
Adversarial Verification (DeepSeek-V4-Pro / gpt-5.3-codex) (Independent verification — see verification.md)
   ↓
Deterministic Security Scan                           (Semgrep + Tree-sitter + regex re-run)
   ↓
Final Verification Gate                               (Both gates must PASS)
   ↓
Risk Recalculation                                    (Deterministic math — see risk-engine.md)
   ↓
Elasticsearch Update & PR Creation
```

---

## Model Router Matrix (`model_router.py`)

Every routed AI task passes through a centralized model router (`app/services/model_router.py:chat_for_task`). The system attempts the **Primary (Featherless AI)** provider first and falls back to the **Fallback (OpenAI / Azure OpenAI)** provider if Featherless is unavailable or errors out.

| Task Key | Primary Model (Featherless) | Fallback Model (OpenAI / Azure) | Applied Location | Purpose |
|---|---|---|---|---|
| `analysis` | `Qwen3-Coder-30B-A3B` | `gpt-4.1-mini` | `scanner.py` | Supplementary SAST scan & finding enrichment |
| `rag_ranking` | `DeepSeek-V4-Flash` | `gpt-5.2` | Reserved | Prior-art candidate ranking (currently deterministic) |
| `fix` | `Qwen3-Coder-480B-A35B` | `gpt-5.2` | `scanner.py` | Code patch generation for vulnerable files |
| `verify` | `DeepSeek-V4-Pro` | `gpt-5.3-codex` | `scanner.py` | Independent adversarial review of generated diffs |
| `general` | `Qwen3-Coder-30B-A3B` | `gpt-4.1-mini` | `ai_service.py` | Backs `/api/ai/chat`, `/api/ai/generate`, `/api/ai/analyze` |

---

## Deployment Target

The entire microservice architecture (`frontend`, `services/auth_services`, `services/main`, `services/ai-service`) is configured for deployment on **Render.com** (Render Web Services) with environment variables managed in the Render dashboard or via `render.yaml`.
