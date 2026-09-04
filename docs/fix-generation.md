# PatchLine — Fix Generation

Covers `POST /api/scanner/generate-and-verify-fix` end to end (`app/routers/scanner.py:generate_and_verify_fix`, `_generate_fix`). This document details the patch generation stage where the AI fix model builds the corrected code.

## Preconditions (Defense in Depth)

Before generating a fix, the endpoint re-asserts the finding's state transition:

```python
from_status = state_machine.assert_transition(scan_doc, payload.findingId, "FIX_PROCESSING")
```

This prevents duplicate or out-of-order execution for findings that are already verified or out of retry budget.

---

## The Six Fix Generation Steps

```
1. Look up finding from persisted scan (MongoDB scan_history)
2. Fetch file's current content + blob SHA from GitHub
3. Generate corrected file via Model Router (Task: "fix" -> Qwen3-Coder-480B-A35B / gpt-5.2)
4. Create a fix branch and commit the corrected file to GitHub
5. Independently verify: Adversarial Review (DeepSeek-V4-Pro / gpt-5.3-codex), then Deterministic Rescan
6. Persist fix outcome to scan_history and return result
```

---

## Model Call (`_generate_fix`)

`_generate_fix` routes through `model_router.chat_for_task("fix", ...)`:
- **Primary Model**: `Qwen3-Coder-480B-A35B` (via Featherless)
- **Fallback Model**: `gpt-5.2` (via OpenAI / Azure OpenAI)

The model response is parsed into a structured JSON object containing `fixedFileContent` and `summary`. A JSON parse failure triggers an `HTTP 502 Bad Gateway` response to prevent broken code from being processed.

---

## RAG & Negative-Memory Augmentation

1. **RAG Prior Art Recall (Soft Signal)**:
   `memory_store.retrieve_similar(owner_id, finding, top_k=3)` injects up to 3 prior-art examples labeled as `[VERIFIED SUCCESSFUL PATCH]`, `[COMMUNITY PRIOR ART]`, or `[FAILED / UNVERIFIED ATTEMPT - AVOID REPEATING THIS STRATEGY]`.

2. **Negative-Memory Hard Exclusion (Hard Block)**:
   Prior failed strategy fingerprints for this exact finding (`scan_doc.fixes[findingId].failedStrategies`) are appended to the prompt as strict negative constraints. If the generated strategy matches an excluded fingerprint:
   - A single regeneration attempt is made with an explicit retry prompt.
   - If it matches a second time, the attempt is marked `duplicateStrategyMatch` and skipped before spending verification calls.
