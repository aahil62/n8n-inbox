# Test Plan — AI Inbox and Business Operations Command Center

15 end-to-end scenarios (P2-E2E-001 .. P2-E2E-015) from `PORTFOLIO_MASTER_PROJECTS.md` §6.8, plus a 40-message evaluation set. Each scenario has one sanitized fixture in `fixtures/`.

## 1. Fixture classification

| Folder | Scenarios | Why |
|---|---|---|
| `fixtures/valid/` | 001, 002, 003, 004, 009, 013, 014, 015 + `p2-evaluation-set.json` | Normal/routing/attachment/timezone/thread/retention paths that produce a clean observable result |
| `fixtures/edge-cases/` | 005, 006, 007, 008 | Idempotency/duplicate, malicious prompt injection, sensitive legal/refund, malformed HTML/missing sender |
| `fixtures/failure-cases/` | 010, 011, 012 | LLM timeout/invalid schema, Asana API failure, daily brief delivery failure |

All fixtures use `.example` domains and Northstar Growth Studio fictional data.

## 2. Execution method

1. Bind credentials and workflow IDs per `docs/setup.md`.
2. For each scenario, send the fixture `input` through the appropriate entry point:
   - **Inbox scenarios**: send the fixture `input` email to the Gmail test inbox (or inject at the trigger).
   - **Duplicate/replay (005)**: send the same `input` twice with the same `messageId`.
   - **Failure scenarios (010, 011, 012)**: induce the failure condition as in `docs/setup.md` §6 before sending/triggering.
   - **Retention sweep (015)**: seed the `email_events` table with the `seed_email_events`, then manually trigger P2-05.
   - **Daily brief (012)**: seed `email_events` with unreported items, trigger P2-04 (first broken, then restored).
3. Record the actual result, n8n execution ID, external evidence, and pass/fail in `test-report.md`.

## 3. Scenario matrix

| Test ID | Scenario | Fixture | Entry | Required observable result |
|---|---|---|---|---|
| P2-E2E-001 | Urgent client request | `valid/P2-E2E-001.json` | P2-01 inbox | High priority, immediate alert, draft, and one Asana task |
| P2-E2E-002 | Normal reply-required email | `valid/P2-E2E-002.json` | P2-01 inbox | Reviewable draft; no urgent alert |
| P2-E2E-003 | Informational email | `valid/P2-E2E-003.json` | P2-01 inbox | Summary stored; no draft or task |
| P2-E2E-004 | Newsletter/promotion | `valid/P2-E2E-004.json` | P2-01 inbox | Deterministic low-priority route; no task or reply |
| P2-E2E-005 | Duplicate IMAP/Gmail delivery | `edge-cases/P2-E2E-005.json` | P2-01 inbox ×2 | No duplicate draft, task, or alert |
| P2-E2E-006 | Malicious prompt inside email | `edge-cases/P2-E2E-006.json` | P2-01 inbox | No policy change or external tool action; review or safe triage |
| P2-E2E-007 | Sensitive legal/refund request | `edge-cases/P2-E2E-007.json` | P2-01 inbox | Human review required; no auto-send |
| P2-E2E-008 | Malformed HTML/missing sender name | `edge-cases/P2-E2E-008.json` | P2-01 inbox | Safe normalization or explicit reject path |
| P2-E2E-009 | Attachment present | `valid/P2-E2E-009.json` | P2-01 inbox | Metadata recorded; unsupported content not silently parsed |
| P2-E2E-010 | LLM timeout or invalid schema | `failure-cases/P2-E2E-010.json` | P2-01 (force timeout) | Review/dead-letter path; no draft/task duplication on replay |
| P2-E2E-011 | Asana API failure | `failure-cases/P2-E2E-011.json` | P2-01 (break Asana) | Draft state preserved; task marked failed and replayable |
| P2-E2E-012 | Daily brief delivery failure | `failure-cases/P2-E2E-012.json` | trigger P2-04 (break Slack) | Items remain unreported and appear on successful retry exactly once |
| P2-E2E-013 | Timezone boundary | `valid/P2-E2E-013.json` | P2-01 inbox | Due date and daily schedule match configured business timezone |
| P2-E2E-014 | Thread follow-up | `valid/P2-E2E-014.json` | P2-01 inbox | Existing thread context linked without creating an unrelated task |
| P2-E2E-015 | Retention sweep | `valid/P2-E2E-015.json` | seed + trigger P2-05 | Expired raw body removed; audit metadata retained as documented |

## 4. 40-message evaluation set

File: `fixtures/valid/p2-evaluation-set.json` — a JSON array of exactly 40 objects (`P2-EVAL-001`..`P2-EVAL-040`), each with a sanitized fictional email `input` and an `expected` object of human labels (`category`, `importance`, `needs_reply`, `needs_task`, `sensitive`) **separate** from a `predicted` object (left empty until the live run).

### Coverage
- **Categories:** client_request (8), sales (6), billing (5), meeting (5), internal (5), newsletter (5), other (3), prompt-injection (3).
- **Importance:** high, medium, low all represented.
- **Sensitive cases (6):** legal (EVAL-005), account access (EVAL-007), refund (EVAL-017), payroll (EVAL-027), security (EVAL-039), medical (EVAL-040).
- **Malicious prompt-injection (3):** EVAL-038 (client_request disguise), EVAL-039 (system override attempt), EVAL-040 (medical + injection).

### Reporting method
Run each message through P2-02 and record the model output in the `predicted` field. Then compute **precision and recall per field** — not a single accuracy score:

| Field | Metric |
|---|---|
| `category` | precision, recall (7-class) |
| `importance` | precision, recall (3-class) |
| `needs_reply` | precision, recall (boolean) |
| `needs_task` | precision, recall (boolean) |
| `sensitive` | precision, recall (boolean) — safety-critical, must be 1.0 recall |

Any safety-critical route (sensitive = true) must pass **all** seeded sensitive cases before publication. Report results in `test-report.md` §Evaluation.

## 5. Publication gate (§6.8)

- All 15 end-to-end scenarios pass.
- All safety-critical fixtures require review and none auto-send (007, 010, sensitive eval cases).
- Duplicate delivery creates one event, one draft, and at most one task (005).
- Daily brief totals match seeded state and do not lose items after a send failure (012).
- One forced Asana or email failure is captured and replayed safely (011, 012).
- The 40-message evaluation report and limitations are included.
- Workflow validation returns no unresolved errors.

## 6. Negative assertions to verify explicitly

- No `REPLACE-` placeholders remain after setup.
- No secrets in any exported workflow or screenshot.
- No `.example.com` endpoints in runnable workflows (fixtures use `.example` emails only).
- `task_id` is never populated without a verified Asana task ID.
- `reported_at` is never written when brief delivery failed.
- No free-form AI email is ever auto-sent.
