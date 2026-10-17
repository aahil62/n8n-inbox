# Test Report — AI Inbox and Business Operations Command Center

**Status:** `controlled_e2e_paths_passed`. Normal processing, duplicate replay,
and sensitive/prompt-injection review routing passed against live Airtable,
Gmail, Asana, AI, and n8n integrations on 24–25 July 2026. On 17 October 2026
the urgent-request and LLM-failure scenarios passed, and after fixes to the
newsletter rule and the handoff replay, the newsletter and Asana-failure scenarios
passed on re-test. A regression run of the normal-email scenario was rated high
priority once and sent an alert, so that scenario is now partial (see notes). This
is not the full 15-scenario or 40-message production gate.

## End-to-end scenarios

| Test ID | Scenario | Fixture path | Expected result | Actual result | n8n execution | External evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| P2-E2E-001 | Urgent client request | `fixtures/valid/P2-E2E-001.json` | High priority, immediate alert, draft, and one Asana task | First attempt: `client_request`, high, confidence 0.95; Asana task created, but the Gmail draft and alert failed because the sandbox Gmail OAuth token had expired (failure captured, retryable dead-letter row written). After reconnecting Gmail, rerun with Message-ID suffix `-r2`: `client_request`, high, 0.95; one draft (not sent), one Asana task, urgent alert email sent; `handoff_complete`. Replay of `-r2` returned `duplicate` with the original IDs. Regression on 17 Oct after the newsletter and handoff fixes (Message-ID suffix `-r3`): `client_request`, high, 0.95; one draft, one Asana task, one alert; `alert_id` stored on email_events; `processing_status = completed`; `handoff_complete` | First attempt 244; children 245/246/247. Rerun 258; children 259/260/261. Replay 262/263. Regression 358; children 359/360/361 | Gmail draft `[sanitized Gmail draft]`; Asana task `[sanitized external record]`; alert `[sanitized Gmail message]` | `passed` | Passed on the `-r2` rerun (17 Oct 2026). The alert was sent by the Gmail alert node in the E2E reference build (`workflows/e2e-reference/`); the template `p2-review-task-handoff.json` still has a placeholder alert adapter that must be connected per client |
| P2-E2E-002 | Normal reply-required email | `fixtures/valid/P2-E2E-002.json` | Reviewable draft; no urgent alert | `client_request`, medium, confidence 0.95; one draft and one task; `handoff_complete`; repeated through the corrected live Gmail adapter. Regression on 17 Oct after the fixes: run `-r3` was rated `high` (0.9) instead of medium, so an urgent alert email was sent in addition to the draft and task. Run `-r4` was rated medium (0.95): draft and task, no alert, `handoff_complete` | 103; children 104/105/106; adapter 122; children 123/124/125. Regression `-r3` 354; children 355/356/357. `-r4` 362; children 363/364/365 | Original cleaned proof plus Airtable `[sanitized Airtable record]`; Gmail draft `[sanitized Gmail draft]`; Asana task `[sanitized external record]`; extra alert from `-r3` `[sanitized Gmail message]` | `partial` | Passed in July and in run `-r4`. In run `-r3` the model rated this email high, which triggered an urgent alert the scenario says must not happen. The alert depends on the AI importance rating, and that rating varied between runs. The newsletter and handoff changes do not touch the triage core |
| P2-E2E-003 | Informational email | `fixtures/valid/P2-E2E-003.json` | Summary stored; no draft or task | — | — | — | `not_run_live` | internal/low; no side effects |
| P2-E2E-004 | Newsletter/promotion | `fixtures/valid/P2-E2E-004.json` | Deterministic low-priority route; no task or reply | `newsletter`, low; deterministic rule fired: `rules.rule = newsletter`, `newsletter_signal = body_footer` (body ends "To unsubscribe, click here."); no draft, task or alert; `processing_status = completed`; `handoff_complete`. Earlier run (exec 248) missed the rule because it only checked the subject | Re-test `-r3` 350; children 351/352/353. Earlier partial run 248 | Airtable event `[sanitized Airtable record]`; no draft/task/alert | `passed` | Fixed 17 Oct: the rule now also matches bulk-mail footer phrases in the body and a List-Unsubscribe header (only together with "unsubscribe" in the body, so client mail sent via a Google Group is not caught). A client asking "please unsubscribe us" does not match |
| P2-E2E-005 | Duplicate IMAP/Gmail delivery | `fixtures/edge-cases/P2-E2E-005.json` | No duplicate draft, task, or alert | Exact P2-E2E-002 mailbox + Message-ID replay returned `duplicate` with the original IDs; a later live Gmail poll repeated the duplicate outcome | 107; child 108; adapter duplicate 126 | No second external object required; sanitized executions reused the existing references | `passed` | Idempotency check runs before AI and external writes |
| P2-E2E-006 | Malicious prompt inside email | `fixtures/edge-cases/P2-E2E-006.json` | No policy change or external tool action; review or safe triage | Combined safety fixture detected prompt injection and sensitive content; `review_required_no_external_actions` | 109; children 110/111/112 | Review row `[sanitized Airtable record]`; no draft/task/alert | `passed` | Review row deleted after verification |
| P2-E2E-007 | Sensitive legal/refund request | `fixtures/edge-cases/P2-E2E-007.json` | Human review required; no auto-send | Combined safety fixture set `sensitive = true`, confidence 0.99, and created only a review row | 109; children 110/111/112 | Airtable event `[sanitized Airtable record]`; no draft/task/alert | `passed` | Event and review row deleted after verification |
| P2-E2E-008 | Malformed HTML/missing sender name | `fixtures/edge-cases/P2-E2E-008.json` | Safe normalization or explicit reject path | — | — | — | `not_run_live` | scripts/styles stripped; quoted history removed |
| P2-E2E-009 | Attachment present | `fixtures/valid/P2-E2E-009.json` | Metadata recorded; unsupported content not silently parsed | — | — | — | `not_run_live` | attachment_metadata stored; no file parsing |
| P2-E2E-010 | LLM timeout or invalid schema | `fixtures/failure-cases/P2-E2E-010.json` | Review/dead-letter path; no draft/task duplication on replay | Test copy of the triage core with an invalid model name: the model call failed ("resource could not be found"), the gate set `llm_timeout_or_malformed`, one review row was created, and no draft, task or alert was created (`review_required_no_external_actions`). Replay of the same Message-ID through the normal processor (working model) returned `duplicate`; nothing new was created | 252; children 253/254/255. Replay 256/257 | Review row `[sanitized Airtable record]`; no draft/task/alert | `passed` | The failure was forced in a test copy only. After the model is restored, the message stays in the review queue; it is not automatically re-triaged |
| P2-E2E-011 | Asana API failure | `fixtures/failure-cases/P2-E2E-011.json` | Draft state preserved; task marked failed and replayable | Re-test after the fixes. Run `-r4` (fixed handoff test copy with an invalid Asana project ID): Asana returned 400; Gmail draft created and kept; urgent alert sent and its ID stored in `alert_id`; `task_status = failed` with the error code; one dead-letter row (`pending`, `retryable = true`); email_events `processing_status = failed` (`task_failed_other_actions_preserved`). Manual replay of the same handoff payload through the fixed handoff with Asana working: Asana task created; no second draft; **no second alert** (alert skipped because `alert_id` was already set); email_events set to `completed`; the dead-letter row set to `resolved` with `resolved_at` and `replay_execution_id = 377`; `handoff_complete`. An earlier run `-r3` was routed to the review queue instead (the model flagged "set up their access" as an account-access request), so it never reached Asana | `-r4` 370; children 371/372/373. Manual replay 376/377. `-r3` (review route) 366; children 367/368/369. Earlier partial run 264–269 | Gmail draft `[sanitized Gmail draft]`; alert `[sanitized Gmail message]`; dead letter `[sanitized Airtable record]` (now resolved); Asana task on replay `[sanitized external record]` | `passed` | Replay gaps from the earlier run were fixed on 17 Oct. Replay is still a manual re-invocation of the handoff; P2 has no automated dead-letter replay workflow. The failure was forced in a test copy only |
| P2-E2E-012 | Daily brief delivery failure | `fixtures/failure-cases/P2-E2E-012.json` | Items remain unreported and appear on successful retry exactly once | — | — | — | `not_run_live` | reported_at not written on failure; retry reports once |
| P2-E2E-013 | Timezone boundary | `fixtures/valid/P2-E2E-013.json` | Due date and daily schedule match configured business timezone | — | — | — | `not_run_live` | Asia/Kolkata; 08:30 brief; due_on in IST |
| P2-E2E-014 | Thread follow-up | `fixtures/valid/P2-E2E-014.json` | Thread identifier and source link preserved; no claim of full conversation-history retrieval | — | — | — | `not_run_live` | Full thread retrieval and context-aware classification are not implemented |
| P2-E2E-015 | Retention sweep | `fixtures/valid/P2-E2E-015.json` | Expired raw body removed; audit metadata retained as documented | — | — | — | `not_run_live` | text_body cleared; retention_status=redacted; health report |

## Summary

- **Total scenarios:** 15
- **Passed:** 7 (P2-E2E-001, 004, 005, 006, 007, 010, 011)
- **Partial:** 1 (P2-E2E-002)
- **Failed:** 0
- **Not run live:** 7
- **Runtime evidence captured:** n8n sanitized executions plus exact
  Airtable, Gmail, and Asana IDs. The original 103–112 artifacts were cleaned;
  the 122 capture artifacts were retained for the portfolio screenshots.
  The 17 October runs (executions 244–269) used the E2E reference build with
  fictional fixtures; failures for 010 and 011 were forced in test copies only.
  The re-tests after the newsletter and handoff fixes (executions 350–377) used
  test copies of the fixed processor and handoff with new Message-IDs.

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

No precision/recall claim is made until the 40-message evaluation runs. The
remaining 7 scenarios also stay explicitly `not_run_live`.
