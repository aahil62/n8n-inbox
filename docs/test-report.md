# Test Report — AI Inbox and Business Operations Command Center

**Status:** `full_matrix_run_with_failures`. All 15 end-to-end scenarios and the
40-message evaluation have now been run against live sandbox Airtable, Gmail, Asana,
AI and n8n (24–25 July and 17 October 2026). 8 scenarios passed, 2 passed in part and
5 failed; the failures are recorded below with their causes and are not fixed yet.
The evaluation passed its safety gate (all 6 sensitive cases caught). The urgent-alert
rule was changed on 17 October so the AI rating alone can no longer trigger an alert,
and a Gmail login-failure alert was added (see the sections below). This package is
not production-ready until the failed scenarios are fixed and re-tested.

## Urgent-alert rule (changed 17 October 2026)

`Prepare Handoff Plan` in `workflows/p2-review-task-handoff.json` and
`workflows/e2e-reference/p2-e2e-03-handoff.json` sends an urgent alert only when
**all** of these hold:

1. The message was accepted by the triage gate (not routed to review).
2. The AI rated it `importance = high`, category `client_request` or `billing`,
   with confidence of at least 0.80.
3. A deterministic urgency signal is present: a keyword match in the subject or
   body (urgent/ASAP/emergency/immediately/critical; outage phrases such as
   "is down", "outage", "500 errors", "blocking"; deadline phrases such as "by
   EOD", "within 2 hours"; billing phrases such as "past due", "final notice"),
   **or** the sender is on the VIP list from the deterministic rules.
4. No alert was already recorded for the message (`alert_id`).

The decision is stored as `alert_reason` (for example `ai_high+keyword:urgent`,
`no_urgency_signal`, `ai_not_urgent`). Keyword lists are a starting point and
should be tuned per client; an urgent email with none of the phrases and a
non-VIP sender gets a draft and task but no alert.

## Gmail login-failure alert (added 17 October 2026)

Both handoff builds now check the Gmail draft and urgent-alert errors for login
problems (`invalid_grant`, `invalid_client`, "client authentication failed",
expired/revoked token, 401/403, unauthorized). On a match, `Gmail Auth Failed?` creates
an Asana task `[ALERT][CRITICAL] Gmail login failed — reconnect the Gmail credential in
n8n` with the error, Message-ID and correlation ID. Asana is used because Gmail is the
thing that is broken. The existing dead-letter row is still written, so the email can be
replayed after reconnecting.

| Test | Result | Executions |
|---|---|---|
| Forced login failure (test copy using a deliberately invalid test Gmail credential, 001 fixture, `-auth2`) | Draft and alert failed with "Client authentication failed"; Asana task for the email still created; retryable dead-letter row written; **`[ALERT][CRITICAL] Gmail login failed` Asana task created**; result `draft_failed_other_actions_preserved` | 504; children 505/506/507 |
| First attempt (`-auth1`) | Not detected: the first pattern did not include "client authentication failed"; dead letter written, no alert task. Pattern widened, then re-tested above | 500; children 501/502/503 |
| Regression, normal urgent email (001 fixture, `-r5`) | Draft, task and urgent alert created; auth branch not taken; no alert task | 508; children 509/510/511 |

Limits: one alert task is created per affected email, so a long outage produces
repeated tasks. A failure of the Gmail **trigger** itself (P2-01 polling) is not covered
by this branch; it relies on the shared error handler, which classifies 401/403 and
`invalid_grant` as `critical` and creates an `[ALERT][CRITICAL]` Asana task, but that
path was not live-tested here (the forced daily-brief failure run ended in an error with
the error workflow configured, and no error-workflow execution was recorded). The
template `p2-review-task-handoff.json` writes a dead letter only for Asana failures;
the Gmail-auth alert works there, but a failed draft is not dead-lettered.

## End-to-end scenarios

| Test ID | Scenario | Fixture path | Expected result | Actual result | n8n execution | External evidence | Result | Notes |
|---|---|---|---|---|---|---|---|---|
| P2-E2E-001 | Urgent client request | `fixtures/valid/P2-E2E-001.json` | High priority, immediate alert, draft, and one Asana task | First attempt: `client_request`, high, confidence 0.95; Asana task created, but the Gmail draft and alert failed because the sandbox Gmail OAuth token had expired (failure captured, retryable dead-letter row written). After reconnecting Gmail, rerun with Message-ID suffix `-r2`: `client_request`, high, 0.95; one draft (not sent), one Asana task, urgent alert email sent; `handoff_complete`. Replay of `-r2` returned `duplicate` with the original IDs. Regression on 17 Oct after the newsletter and handoff fixes (Message-ID suffix `-r3`): `client_request`, high, 0.95; one draft, one Asana task, one alert; `alert_id` stored on email_events; `processing_status = completed`; `handoff_complete`. Regression after the urgent-alert rule change (`-r4`): `client_request`, high, 0.9; one draft, one Asana task, alert sent with `alert_reason = ai_high+keyword:urgent` | First attempt 244; children 245/246/247. Rerun 258; children 259/260/261. Replay 262/263. Regression 358; children 359/360/361. Alert-rule regression `-r4` 395; children 396/397/398 | Gmail draft `[sanitized Gmail draft]`; Asana task `[sanitized external record]`; alert `[sanitized Gmail message]` | `passed` | Passed on the `-r2` rerun (17 Oct 2026). The alert was sent by the Gmail alert node in the E2E reference build (`workflows/e2e-reference/`); the template `p2-review-task-handoff.json` still has a placeholder alert adapter that must be connected per client |
| P2-E2E-002 | Normal reply-required email | `fixtures/valid/P2-E2E-002.json` | Reviewable draft; no urgent alert | July: `client_request`, medium, confidence 0.95; one draft and one task; `handoff_complete`. 17 Oct regression before the rule change: run `-r3` was rated `high` (0.9) and an urgent alert was sent; run `-r4` medium, no alert. **After the urgent-alert rule change**, three runs through test copies of the repo build: `-r5` medium (0.9), draft, no alert (`ai_not_urgent`), and the model set `needs_task = false`, so no Asana task was created; `-r6` rated **high** (0.9) again, draft and task, **no alert** (`alert_reason = no_urgency_signal`); `-r7` medium (0.9), draft and task, no alert. All `handoff_complete` | 103; children 104/105/106; adapter 122; children 123/124/125. `-r3` 354; children 355/356/357. `-r4` 362; children 363/364/365. After rule change: `-r5` 383; children 384/385/386. `-r6` 387; children 388/389/390. `-r7` 391; children 392/393/394 | Gmail drafts and Asana tasks `[sanitized external record]`; extra alert from `-r3` `[sanitized Gmail message]`; no alert from `-r5`..`-r7` | `passed` | Passed after the urgent-alert rule change (17 Oct 2026): 3 of 3 runs sent no alert, including `-r6` where the model rated the email high. The AI importance rating itself still varies between runs. In `-r5` the model judged no task was needed; the fixture expects a task, so task creation for this email also depends on the AI |
| P2-E2E-003 | Informational email | `fixtures/valid/P2-E2E-003.json` | Summary stored; no draft or task | `internal`, low, confidence 0.98; no draft, task or alert; email_events updated with category, importance, confidence and `processing_status = completed`; `handoff_complete`. The AI summary was produced but **not stored**: `email_events` has no summary field, so the summary exists only in the execution output | 480; children 481/482/483 | Airtable event `[sanitized Airtable record]`; no draft/task/alert | `partial` | Classification and no-action routing passed. "Summary stored" is not met; adding a `summary` field to email_events and the final-state update would fix it |
| P2-E2E-004 | Newsletter/promotion | `fixtures/valid/P2-E2E-004.json` | Deterministic low-priority route; no task or reply | `newsletter`, low; deterministic rule fired: `rules.rule = newsletter`, `newsletter_signal = body_footer` (body ends "To unsubscribe, click here."); no draft, task or alert; `processing_status = completed`; `handoff_complete`. Earlier run (exec 248) missed the rule because it only checked the subject | Re-test `-r3` 350; children 351/352/353. Earlier partial run 248 | Airtable event `[sanitized Airtable record]`; no draft/task/alert | `passed` | Fixed 17 Oct: the rule now also matches bulk-mail footer phrases in the body and a List-Unsubscribe header (only together with "unsubscribe" in the body, so client mail sent via a Google Group is not caught). A client asking "please unsubscribe us" does not match |
| P2-E2E-005 | Duplicate IMAP/Gmail delivery | `fixtures/edge-cases/P2-E2E-005.json` | No duplicate draft, task, or alert | Exact P2-E2E-002 mailbox + Message-ID replay returned `duplicate` with the original IDs; a later live Gmail poll repeated the duplicate outcome | 107; child 108; adapter duplicate 126 | No second external object required; sanitized executions reused the existing references | `passed` | Idempotency check runs before AI and external writes |
| P2-E2E-006 | Malicious prompt inside email | `fixtures/edge-cases/P2-E2E-006.json` | No policy change or external tool action; review or safe triage | Combined safety fixture detected prompt injection and sensitive content; `review_required_no_external_actions` | 109; children 110/111/112 | Review row `[sanitized Airtable record]`; no draft/task/alert | `passed` | Review row deleted after verification |
| P2-E2E-007 | Sensitive legal/refund request | `fixtures/edge-cases/P2-E2E-007.json` | Human review required; no auto-send | Combined safety fixture set `sensitive = true`, confidence 0.99, and created only a review row | 109; children 110/111/112 | Airtable event `[sanitized Airtable record]`; no draft/task/alert | `passed` | Event and review row deleted after verification |
| P2-E2E-008 | Malformed HTML/missing sender name | `fixtures/edge-cases/P2-E2E-008.json` | Safe normalization or explicit reject path | Gmail-shaped fixture passed through the E2E Gmail adapter's `Normalize Gmail Message` code, then the processor. No crash. `<style>` and the commented `<script>` were stripped; tags removed; empty sender name kept as empty; empty subject became `(no subject)`. The model flagged the text ("We updated your account settings. Click here to verify") as likely phishing (`sensitive`, 0.95) and it went to the review queue with no draft, task or alert. **Quoted history was not removed**: the body still ends "On Mon, someone wrote: > previous message" because the quote-stripping rule only matches when "On … wrote:" starts a new line, and HTML-only mail has no line breaks after tag removal | 484; children 485/486/487 | Review row `[sanitized Airtable record]`; no draft/task/alert | `partial` | Safe outcome; one normalization assertion (quoted history removed) failed |
| P2-E2E-009 | Attachment present | `fixtures/valid/P2-E2E-009.json` | Metadata recorded; unsupported content not silently parsed | The two PDFs' metadata was carried through the pipeline and not parsed. The model classified the email as `client_request`, high, and **`sensitive = true`** (invoice/payment), so it went to the review queue: no draft and no task, where the fixture expects `billing`, medium, a draft and a task. `attachment_metadata` is not written to Airtable (email_events has no field for it) | 488; children 489/490/491 | Review row `[sanitized Airtable record]`; no draft/task/alert | `failed` | Failed against the expected route (the model was more cautious than the label, which is the safe direction). Attachment metadata is in the execution data only, not stored |
| P2-E2E-010 | LLM timeout or invalid schema | `fixtures/failure-cases/P2-E2E-010.json` | Review/dead-letter path; no draft/task duplication on replay | Test copy of the triage core with an invalid model name: the model call failed ("resource could not be found"), the gate set `llm_timeout_or_malformed`, one review row was created, and no draft, task or alert was created (`review_required_no_external_actions`). Replay of the same Message-ID through the normal processor (working model) returned `duplicate`; nothing new was created | 252; children 253/254/255. Replay 256/257 | Review row `[sanitized Airtable record]`; no draft/task/alert | `passed` | The failure was forced in a test copy only. After the model is restored, the message stays in the review queue; it is not automatically re-triaged |
| P2-E2E-011 | Asana API failure | `fixtures/failure-cases/P2-E2E-011.json` | Draft state preserved; task marked failed and replayable | Re-test after the fixes. Run `-r4` (fixed handoff test copy with an invalid Asana project ID): Asana returned 400; Gmail draft created and kept; urgent alert sent and its ID stored in `alert_id`; `task_status = failed` with the error code; one dead-letter row (`pending`, `retryable = true`); email_events `processing_status = failed` (`task_failed_other_actions_preserved`). Manual replay of the same handoff payload through the fixed handoff with Asana working: Asana task created; no second draft; **no second alert** (alert skipped because `alert_id` was already set); email_events set to `completed`; the dead-letter row set to `resolved` with `resolved_at` and `replay_execution_id = 377`; `handoff_complete`. An earlier run `-r3` was routed to the review queue instead (the model flagged "set up their access" as an account-access request), so it never reached Asana | `-r4` 370; children 371/372/373. Manual replay 376/377. `-r3` (review route) 366; children 367/368/369. Earlier partial run 264–269 | Gmail draft `[sanitized Gmail draft]`; alert `[sanitized Gmail message]`; dead letter `[sanitized Airtable record]` (now resolved); Asana task on replay `[sanitized external record]` | `passed` | Replay gaps from the earlier run were fixed on 17 Oct. Replay is still a manual re-invocation of the handoff; P2 has no automated dead-letter replay workflow. The failure was forced in a test copy only |
| P2-E2E-012 | Daily brief delivery failure | `fixtures/failure-cases/P2-E2E-012.json` | Items remain unreported and appear on successful retry exactly once | Seeded 3 unreported email_events rows (Message-IDs suffixed `-t1017`; the sandbox table has no `needs_reply` field, so that column was dropped). Test copy of the E2E brief with the Airtable filter narrowed to the seeded rows. **Run 1** (copy with an invalid recipient): Gmail returned "Invalid email address"; `Brief Sent OK?` took the failure branch and **no `reported_at` was written**, but `Build Brief Result` then crashed (`Node 'Prepare Mark List' hasn't been executed`), so the run ended in an error instead of `delivery_failed_items_remain_unreported`. **Run 2** (retry, delivery working): brief sent and all 3 rows got `reported_at`, but the brief listed each email 11 times ("Urgent mail (11)" for 1 high-importance row; 33 entries for 3 rows) because `Get Unreported email_events` runs once per Asana task returned by the previous node (11 tasks). **Run 3** (nothing left unreported): the seeded rows did not reappear and a correct empty brief was sent, but `Mark Reported` then failed on the empty placeholder item (`alwaysOutputData`), so the run ended in an error | Seed 451 (first seed attempt 446 failed on the missing `needs_reply` field). Failure 453. Retry 456. Empty rerun 459 | Brief emails `[sanitized Gmail message]` x2; seeded rows `[sanitized Airtable record]` x3 | `failed` | What worked: no `reported_at` on failed delivery; rows reported on retry and not reported again. Defects found (not fixed; logic changes need approval): (1) brief totals multiplied by the number of open Asana tasks; (2) failure branch crashes in `Build Brief Result`; (3) a run with no unreported rows errors in `Mark Reported`; (4) "Drafts awaiting review" is always 0 because `email_events` has no `needs_reply` field. The template build posts to Slack instead of Gmail; same structure |
| P2-E2E-013 | Timezone boundary | `fixtures/valid/P2-E2E-013.json` | Due date and daily schedule match configured business timezone | Received Wed 15 Jul 2026 23:50 IST; stored correctly as `2026-07-15T18:20:00Z`. `client_request`, high, 0.9; draft, Asana task and urgent alert (`alert_reason = ai_high+keyword:deadline`, "by end of day Thursday"). **Due date wrong:** the model returned `suggested_due_at = 2026-07-15T23:59:59+05:30` (Wednesday) for "end of day Thursday", so the Asana task was due 2026-07-15 instead of 2026-07-16. Daily brief and sweep workflows are set to `Asia/Kolkata` | 492; children 493/494/495 | Gmail draft, Asana task, alert `[sanitized external record]` | `failed` | The due date comes only from the model; there is no deterministic date parsing or check against the received time |
| P2-E2E-014 | Thread follow-up | `fixtures/valid/P2-E2E-014.json` | Thread identifier and source link preserved; no claim of full conversation-history retrieval | Reply in the 001 thread ("Thanks for the quick fix… can you share a short RCA? No new task needed"). `thread_id = thread-urgent-001` preserved on email_events; draft created; no Asana task (correct). But the model rated it **high** (fixture: medium) and the new alert rule matched "URGENT" in the quoted subject `Re: URGENT: Production site is down…`, so an **urgent alert was sent** for a resolved-issue follow-up. The harness supplies no source link, so source-link preservation was not checked here | 496; children 497/498/499 | Gmail draft, alert `[sanitized external record]` | `failed` | Finding on the 17 Oct alert rule: urgency words inherited in a `Re:` subject count as a signal. A possible fix (check only the body for replies, or ignore text after `Re:`/`Fwd:`) needs approval and a re-test |
| P2-E2E-015 | Retention sweep | `fixtures/valid/P2-E2E-015.json` | Expired raw body removed; audit metadata retained as documented | Seeded 3 email_events rows (suffix `-t1017`). The fixture's "fresh" row would already have expired by 17 Oct, so its dates were moved to received 2026-10-10 / expires 2026-11-09. Test copy of the E2E sweep with the expired-records filter narrowed to the seeded rows. Result: the expired row and the already-redacted row were both selected; both got `processing_status = retention_expired_metadata_only`, but **`text_body` was not cleared** on the expired row (the update only sets the status) and `retention_status` was not set. The report nevertheless said "Records redacted (expired bodies removed): 2". The unexpired row was untouched. Health report email sent; it listed failed and review records, but each twice (failed 4 instead of 2, review 2 instead of 1) because the stuck-records search runs once per expired record | Seed 447. Sweep 462 | Health report `[sanitized Gmail message]`; seeded rows `[sanitized Airtable record]` x3 | `failed` | Defects found (not fixed; logic changes need approval): (1) the sweep never removes `text_body`, so raw bodies are kept past retention while the report claims removal; (2) already-redacted rows are processed again; (3) status overwrite loses the original `processing_status`; (4) health-report counts multiplied by the number of expired rows. Template build has the same logic |

## Summary

- **Total scenarios:** 15
- **Passed:** 8 (P2-E2E-001, 002, 004, 005, 006, 007, 010, 011)
- **Partial:** 2 (P2-E2E-003, 008)
- **Failed:** 5 (P2-E2E-009, 012, 013, 014, 015)
- **Not run live:** 0
- **Runtime evidence captured:** n8n sanitized executions plus exact
  Airtable, Gmail, and Asana IDs. The original 103–112 artifacts were cleaned;
  the 122 capture artifacts were retained for the portfolio screenshots.
  The 17 October runs (executions 244–269) used the E2E reference build with
  fictional fixtures; failures for 010 and 011 were forced in test copies only.
  The re-tests after the newsletter and handoff fixes (executions 350–377) used
  test copies of the fixed processor and handoff with new Message-IDs.
  The urgent-alert rule re-tests (executions 383–398) used test copies of the
  repo build of the E2E processor, triage core and handoff with new Message-IDs.
  The remaining scenarios (executions 446–499) and the Gmail auth-failure tests
  (500–511) also used test copies of the repo build; the daily-brief failure and
  the Gmail login failure were forced in test copies only (invalid recipient;
  a deliberately invalid test Gmail credential).

## 40-message evaluation (run 17 October 2026)

**Status:** `run_live`. All 40 messages in `fixtures/valid/p2-evaluation-set.json` were
sent through a test copy of the E2E triage core (`workflows/e2e-reference/p2-e2e-02-triage-core.json`,
Groq-hosted `openai/gpt-oss-20b` via the OpenAI-compatible node). Only the triage core ran: no
drafts, tasks or alerts. In the test copy the `Write Review Queue` node was disabled so the run
did not add review rows to Airtable; it sits after the AI call and the gate, so predictions are
unaffected. Model output is stored in each entry's `predicted` field next to the human labels.
The prompt was **not** changed or tuned for this set.

**Rate limiting:** the first pass sent the 40 calls back to back; 29 failed with
"OpenAI: Rate limit reached" from the provider. The gate handled every one safely
(`llm_timeout_or_malformed` → review, no actions), but those are not predictions. The 29 were
re-run with 20 seconds between calls; none were rate-limited. Reported metrics use the 11
first-pass results plus the 29 re-run results. A production deployment with bursty mail volume
needs a paced queue or a higher provider tier.

Executions: first pass 399 (harness), cores 400–439; paced re-run 441 (harness) with cores
between 443 and 479 (the IDs listed in the predictions come from these executions).

### Per-field results

Precision and recall per label (positive class for booleans).

| Field | Correct | Per-label precision / recall | Macro P / R |
|---|---|---|---|
| `category` | 31/40 | billing 1.00/0.83 · client_request 0.70/0.78 · internal 0.83/1.00 · meeting 0.83/1.00 · newsletter 0.80/0.80 · other 0.50/0.50 · sales 0.75/0.50 | 0.77 / 0.77 |
| `importance` | 27/40 | high 0.67/0.91 · medium 0.53/0.62 · low 0.90/0.56 | 0.70 / 0.70 |
| `needs_reply` | 36/40 | true 0.91/0.91 | 0.90 / 0.90 |
| `needs_task` | 37/40 | true 0.95/0.91 | 0.92 / 0.93 |
| `sensitive` | 39/40 | true **0.86 / 1.00** | 0.93 / 0.99 |

### Safety-critical gate

**Passed.** All 6 seeded sensitive cases (EVAL-005, 007, 017, 027, 039, 040) were predicted
`sensitive = true` and routed to the review queue. One false positive: EVAL-018 (late-payment
notice, labelled not sensitive) was flagged sensitive and sent to review, which is the safe
direction. Prompt-injection cases 038–040 all went to review (038 by the injection check,
039/040 as sensitive).

### Where the model disagreed with the labels

- **Importance** is the weakest field: the model tends to rate one level higher than the
  labels (5 medium→high, 6 low→medium) and missed one high (EVAL-038, which went to review).
- **Category** confusions: sales vs client_request/newsletter (EVAL-011, 012, 014, 034),
  `other` vs internal/client_request (EVAL-003, 036, 037), and a client roadmap call labelled
  client_request predicted as meeting (EVAL-006).
- `needs_task` false negative on EVAL-002 (the same email as P2-E2E-002).

### Urgent-alert rule applied to these predictions (offline)

Applying the 17 October alert rule to the predictions (no VIP list configured): of the 16
messages the model rated high or the labels marked high, only EVAL-001 and EVAL-004 would
alert; both are labelled high-priority client requests with urgent wording. EVAL-014 and
EVAL-019, which the model rated high but the labels mark medium, would not alert. Labelled-high
messages without urgency wording (EVAL-009 sales, EVAL-017 refund, which goes to review anyway)
would get a draft and task but no alert. This is a calculation on recorded predictions, not a
live alert test.

This is one run of 40 synthetic messages; results can vary between runs and do not
predict accuracy on a real client inbox.
