# PatchLine — Verification (Adversarial Review + Deterministic Gate)

Step 5 of `generate_and_verify_fix` (`app/routers/scanner.py`). This is the non-negotiable core of PatchLine: **The generated patch is never self-approved.**

## Verification Sequence

```
Generated Patch (Qwen3-Coder-480B-A35B / gpt-5.2)
   │
   ▼
Duplicate-Strategy Hard Block Check ──YES──► REJECTED (duplicate_strategy_blocked)
   │ NO
   ▼
Adversarial Verification Model Call (Task: "verify" -> DeepSeek-V4-Pro / gpt-5.3-codex)
   │
   ├─ callFailed / unparseable JSON ──► REJECTED (codex_call_failed)
   ├─ verified == false              ──► REJECTED (codex_rejected)
   │
   ▼ verified == true
Deterministic Security Rescan (Semgrep + Tree-sitter + Regex)
   │
   ├─ Rule still matches   ──► REJECTED (codex_pass_deterministic_fail)
   ├─ Rule no longer match ──► VERIFIED (codex_pass_deterministic_pass)
   └─ AI-sourced finding   ──► VERIFIED (Codex / DeepSeek review alone is authoritative)
```

---

## Decision Table

| Adversarial Model (DeepSeek-V4-Pro / Codex) | Deterministic Rescan | Final Result |
|---|---|---|
| PASS | PASS | **VERIFIED** |
| PASS | FAIL | **REJECTED** |
| FAIL | Not Run | **REJECTED** |
| Infrastructure Failure | Not Run | **REJECTED** (Fail-Closed) |
| Duplicate Strategy Match | Not Run | **REJECTED** |

---

## Adversarial Verification Call (`_codex_review_fix`)

The verification stage uses `model_router.chat_for_task("verify", ...)`:
- **Primary Model**: `DeepSeek-V4-Pro` (via Featherless)
- **Fallback Model**: `gpt-5.3-codex` (via OpenAI / Azure OpenAI)

The model performs an isolated review of the unified diff and full patched file to detect remaining security flaws, regressions, or bypasses.

### Server-Side Fail-Safe Re-Derivation
The verification verdict is **never trusted verbatim**. The server re-evaluates:

```python
verified = parsed["verified"] and vulnerability_resolved and not bypasses and regression_risk != "HIGH"
```

If the review model outputs `verified: true` but also lists a security bypass or `HIGH` regression risk, the server overrides the result to **REJECTED**.
