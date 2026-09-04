# PatchLine — Fix Generation

Covers `POST /api/scanner/generate-and-verify-fix` end to end
(`app/routers/scanner.py:generate_and_verify_fix`, `_generate_fix`). This
document is the "GPT-5.2 generates the patch" half of the pipeline; Codex
and the deterministic rescan are covered in
[`verification.md`](./verification.md).

## Preconditions (defense in depth)

Even though `main-service`'s `/approve-fix` is the only *intended* place a
human can move a finding out of `AWAITING_APPROVAL`, this endpoint is itself
directly reachable (it requires `require_auth`, not
`require_internal_service_token` at this layer — the internal-token gate is
on the Python-side `state_machine` router). Before doing any work, it
re-asserts the transition:

```python
from_status = state_machine.assert_transition(scan_doc, payload.findingId, "FIX_PROCESSING")
```

This refuses to (re-)generate a fix for a finding that's already verified,
already in flight, or out of retry budget — see
[`state-machines.md`](./state-machines.md) for the full transition table
(including the documented `AWAITING_APPROVAL → FIX_PROCESSING` edge that
only this service's copy of the machine allows, and why that's safe).

## The six steps

```
1. Look up the finding from the persisted scan (MongoDB scan_history)
2. Fetch that file's current content + blob sha from GitHub
3. Generate a corrected file with GPT-5.2 (_generate_fix)
4. Create a fix branch and commit the corrected file to GitHub
5. Independently verify: Codex, then (only if Codex passes) the
   deterministic scanner — see verification.md
6. Persist the fix outcome to scan_history and return it
```

Step 1 creates the fix branch (`fix/ai-vuln-{findingId}-{6 hex chars}`)
*before* the patch is generated — the branch exists even if generation or
verification later fails, so a failed attempt still leaves an inspectable
artifact.

## Building the fix prompt (Step 3)

The base prompt gives GPT-5.2:

```
Repository, File, Vulnerability title, Severity, Description,
Suggested fix (from the finding), Current file content (full)
```

Two augmentations are layered on top, in order:

### a) RAG "Remember" step (soft signal)

`memory_store.retrieve_similar(owner_id, finding, top_k=3)` — see
[`rag.md`](./rag.md) — returns up to 3 ranked prior-art items, each labeled
by provenance:

- `[VERIFIED SUCCESSFUL PATCH]` — adapt and build on this pattern.
- `[COMMUNITY PRIOR ART]` — use as general reference, adapt to this
  codebase.
- `[FAILED / UNVERIFIED ATTEMPT - AVOID REPEATING THIS STRATEGY]` — do not
  repeat.

This is explicitly a **soft** signal — text the model can (and sometimes
will) ignore.

### b) Negative-memory hard exclusion (hard block)

`excluded_strategies` — every prior *failed* strategy summary recorded for
**this exact finding** (fetched from `scan_doc.fixes[findingId]
.failedStrategies`, grown via MongoDB `$addToSet` on each failed attempt) —
is appended as an explicit "DO NOT REPEAT ANY OF THESE" block. Unlike the
RAG signal, this is enforced in code, not just in prose: after the model
responds, `core/fingerprint.py:find_duplicate_strategy` checks the new
summary's fingerprint against every excluded strategy. If it matches:

1. One bounded regeneration is attempted with an even more explicit
   directive (`_call_and_parse(retry_prompt)`) — bounded, not looped, so a
   stubborn model can't turn this into an unbounded retry loop.
2. If the regenerated summary *still* matches, the fix is marked
   `duplicateStrategyMatch` and Step 5 (verification) is skipped entirely —
   see [`verification.md`](./verification.md)'s `duplicate_strategy_blocked`
   path. No Codex call, no deterministic rescan is spent confirming what's
   already known to fail.

Fingerprinting is deliberately non-semantic (no embedding call, no LLM
judge): normalize text (lowercase, strip punctuation, drop stopwords),
compare as a token set so "parameterize the SQL query" and "use a
parameterized query instead of string concatenation" fingerprint as the same
strategy despite different wording. See
`core/fingerprint.py:DUPLICATE_STRATEGY_THRESHOLD = 0.6`, tuned against
paraphrased-but-identical vs. genuinely-different strategy pairs.

Scope: **per finding**, not global — a strategy that failed for one finding
can legitimately be correct for a different one. Cross-finding "prior art"
stays the RAG soft signal by design.

## Model call

`_generate_fix` routes through `model_router.chat_for_task("fix", ...)` —
GPT-5.2 (or Featherless's Qwen3-Coder-480B-A35B as primary, see
[`ai-pipeline.md`](./ai-pipeline.md)). The response must be a JSON object
with `fixedFileContent` and `summary`; a parse failure raises `502` rather
than silently returning a broken patch.

## Patch quality requirements (architecture rule #8)

Generated patches must be:

- Minimal
- Secure
- Focused
- Compatible with the project
- Root-cause fixes (not symptom suppression)
- Free from unrelated refactoring

**GPT-5.2's output is never automatically considered verified** — it always
proceeds to Step 5.

## Commit

`_commit_file_update` writes the fixed content to the fix branch via the
GitHub Contents API, using the blob `sha` fetched in Step 2 (so the commit
fails cleanly on a concurrent modification rather than silently
overwriting). `_unified_diff` (used both here for the Codex prompt and for
logging) is computed from original vs. fixed content, not requested from the
model — the model returns a full file, PatchLine computes the diff.