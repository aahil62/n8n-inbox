# Test Report — AI Inbox and Business Operations Command Center

**Status:** `live_smoke_passed`. The representative normal reply-required email completed through Airtable, AI triage, Gmail draft creation, Asana task creation, and the final Airtable state update.

## End-to-end scenarios

| Test ID | Scenario | Fixture path | Expected result | Actual result | n8n execution | External evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| P2-E2E-001 | Urgent client request | `fixtures/valid/P2-E2E-001.json` | High priority, immediate alert, draft, and one Asana task | — | — | — | `not_run_live` | Bind Gmail + OpenAI + Asana + Slack; verify draft (not sent) + Asana task + Slack alert |
| P2-E2E-002 | Normal reply-required email | `fixtures/valid/P2-E2E-002.json` | Reviewable draft; no urgent alert | Classified `client_request`, medium, confidence 0.95; draft and task created; alert false; same event row finalized | parent 56; children 57/58 | Airtable `[sanitized Airtable record]`; Gmail draft `r-749732788612655813`; Asana task `[sanitized Asana task]` | `passed` | Verified after correcting Airtable v2.2 record-ID matching |
| P2-E2E-003 | Informational email | `fixtures/valid/P2-E2E-003.json` | Summary stored; no draft or task | — | — | — | `not_run_live` | internal/low; no side effects |
| P2-E2E-004 | Newsletter/promotion | `fixtures/valid/P2-E2E-004.json` | Deterministic low-priority route; no task or reply | — | — | — | `not_run_live` | Deterministic rules apply newsletter label |
| P2-E2E-005 | Duplicate IMAP/Gmail delivery | `fixtures/edge-cases/P2-E2E-005.json` | No duplicate draft, task, or alert | — | — | — | `not_run_live` | Send same messageId twice; idempotency_key dedup |
| P2-E2E-006 | Malicious prompt inside email | `fixtures/edge-cases/P2-E2E-006.json` | No policy change or external tool action; review or safe triage | — | — | — | `not_run_live` | Body treated as data; blocked sender audited or review |
| P2-E2E-007 | Sensitive legal/refund request | `fixtures/edge-cases/P2-E2E-007.json` | Human review required; no auto-send | — | — | — | `not_run_live` | sensitive=true → review_queue; no draft/task auto-created |
| P2-E2E-008 | Malformed HTML/missing sender name | `fixtures/edge-cases/P2-E2E-008.json` | Safe normalization or explicit reject path | — | — | — | `not_run_live` | scripts/styles stripped; quoted history removed |
| P2-E2E-009 | Attachment present | `fixtures/valid/P2-E2E-009.json` | Metadata recorded; unsupported content not silently parsed | — | — | — | `not_run_live` | attachment_metadata stored; no file parsing |
| P2-E2E-010 | LLM timeout or invalid schema | `fixtures/failure-cases/P2-E2E-010.json` | Review/dead-letter path; no draft/task duplication on replay | — | — | — | `not_run_live` | continueOnFail → gate → review_required |
| P2-E2E-011 | Asana API failure | `fixtures/failure-cases/P2-E2E-011.json` | Draft state preserved; task marked failed and replayable | — | — | — | `not_run_live` | dead_letter retryable=true; draft_id retained |
| P2-E2E-012 | Daily brief delivery failure | `fixtures/failure-cases/P2-E2E-012.json` | Items remain unreported and appear on successful retry exactly once | — | — | — | `not_run_live` | reported_at not written on failure; retry reports once |
| P2-E2E-013 | Timezone boundary | `fixtures/valid/P2-E2E-013.json` | Due date and daily schedule match configured business timezone | — | — | — | `not_run_live` | Asia/Kolkata; 08:30 brief; due_on in IST |
| P2-E2E-014 | Thread follow-up | `fixtures/valid/P2-E2E-014.json` | Existing thread context linked without creating an unrelated task | — | — | — | `not_run_live` | Same threadId; reply draft; no new task |
| P2-E2E-015 | Retention sweep | `fixtures/valid/P2-E2E-015.json` | Expired raw body removed; audit metadata retained as documented | — | — | — | `not_run_live` | text_body cleared; retention_status=redacted; health report |

## Summary

- **Total scenarios:** 15
- **Passed:** 1
- **Failed:** 0
- **Not run live:** 14
- **Runtime evidence captured:** n8n executions 56/57/58 plus Airtable, Gmail, and Asana IDs

## 40-message evaluation reporting plan

**Status:** `not_run_live`. The evaluation set (`fixtures/valid/p2-evaluation-set.json`) contains 40 human-labeled messages (`P2-EVAL-001`..`P2-EVAL-040`). The `predicted` field in each entry is empty until the live run.

### Coverage
- Categories: client_request (8), sales (6), billing (5), meeting (5), internal (5), newsletter (5), other (3), prompt-injection (3).
- Sensitive cases (6): legal (005), account access (007), refund (017), payroll (027), security (039), medical (040).
- Malicious prompt-injection (3): 038, 039, 040.

### Reporting method (per field, not a single accuracy score)

| Field | Precision | Recall | Notes |
|---|---|---|---|
| `category` | — | — | 7-class (client_request/sales/billing/meeting/internal/newsletter/other) |
| `importance` | — | — | 3-class (high/medium/low) |
| `needs_reply` | — | — | boolean |
| `needs_task` | — | — | boolean |
| `sensitive` | — | — | boolean — **safety-critical: recall must be 1.0** (no sensitive message may be missed) |

### Safety-critical gate
All 6 seeded sensitive cases (EVAL-005, 007, 017, 027, 039, 040) must have `sensitive = true` correctly predicted before publication. Any safety-critical route that misses a sensitive case blocks publication regardless of other metrics.

This report intentionally claims no runtime results. All runtime cells are empty and every row is `not_run_live` until the live-finish pass executes the scenarios and evaluation, then attaches sanitized execution screenshots, Airtable/Gmail/Asana/Slack evidence, and the per-field precision/recall numbers.
