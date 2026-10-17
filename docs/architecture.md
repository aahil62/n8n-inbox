# Architecture — AI Inbox and Business Operations Command Center

Source of truth: `PORTFOLIO_MASTER_PROJECTS.md` §6.3 (Reusable architecture), §6.4 (Workflows), and §8 (Shared build foundation).

## 1. Reusable architecture (§6.3)

```text
Inbox Adapter(s)
  → Normalize Headers, Body, Thread, and Attachments
  → Validate + Sanitize HTML
  → Message-ID Idempotency Check
  → Rules Layer (VIP, known automation, blocked sender, attachment policy)
  → AI Structured Triage
      → importance, category, needs_reply, needs_task,
        summary, proposed due date, draft, confidence
  → Confidence and Safety Gate
      ├─ uncertain / sensitive / malicious → Human Review
      └─ accepted
          ├─ needs reply → Create Draft, never silent send
          ├─ needs task → Asana Upsert + Source Link
          ├─ urgent → Immediate Alert
          └─ informational → Archive State
  → Daily Brief: Tasks + Urgent Mail + Pending Drafts

Any unrecovered failure
  → Shared Error Workflow (P0-99)
  → Dead-Letter Record + Alert + Replay Instructions
```

## 2. Workflow map (§6.4)

| ID | Workflow | File | Trigger | Responsibility |
|---|---|---|---|---|
| P2-01 | Inbox Intake | `workflows/p2-inbox-intake.json` | Gmail Trigger (IMAP swappable) | Normalize, sanitize, deduplicate, apply deterministic rules, write email_events, call triage core, call handoff |
| P2-02 | AI Triage and Draft Core | `workflows/p2-triage-draft-core.json` | Execute Sub-workflow | Structured classification, summary, draft, confidence, safety flags; confidence/safety gate; write review_queue |
| P2-03 | Review and Task Handoff | `workflows/p2-review-task-handoff.json` | Execute Sub-workflow | Create reviewable Gmail draft, upsert idempotent Asana task, send urgent alert; on Asana failure preserve draft + dead-letter |
| P2-04 | Daily Operations Brief | `workflows/p2-daily-operations-brief.json` | Schedule (daily 08:30 IST) | Combine Asana tasks + urgent mail + pending drafts into a brief from stored facts; mark reported_at only after delivery |
| P2-05 | Retention and Health Sweep | `workflows/p2-retention-health-sweep.json` | Schedule (weekly 03:00 IST) | Clear expired raw bodies and summaries (`retention_status = redacted`); report stuck/failed records |
| P0-99 | Shared Error Handler | `workflows/shared-error-handler.json` | Error Trigger | Record execution_audit, dead-letter, alert with replay context |

## 3. Data flow between workflows

```text
P2-01 (Gmail/IMAP)
  │  canonical email + email_event_id
  ▼
P2-02 AI Triage and Draft Core  ──(Execute Workflow)──  returns: review_required flag + triage fields (category, importance, needs_reply, needs_task, summary, draft_reply, suggested_due_at, confidence, sensitive, safety_reason)
  │  triage decision
  ▼
P2-03 Review and Task Handoff  ──(Execute Workflow)──  returns: draft_id, task_id, task_status, alert_sent, review_queue_id

P2-04 (Schedule) reads email_events + Asana tasks directly
P2-05 (Schedule) reads email_events directly
```

- P2-01 calls P2-02 via an **Execute Workflow** node (`workflowId` bound by controlled setup).
- P2-01 calls P2-03 via an **Execute Workflow** node for **every** triaged message (accepted and review_required); P2-03 decides which side effects to create. Review_required items get no auto draft/task/alert — the review_queue record from P2-02 holds the draft for human review.
- P2-04 and P2-05 are independent scheduled workflows that read the `email_events` Airtable table directly — they do not depend on the intake chain.

## 4. Per-workflow node structure

### P2-01 Inbox Intake (15 nodes)
Gmail Trigger → `Normalize & Sanitize Email` (Code: canonical email contract, HTML→text, strip quotes/sigs, max body 16000, attachments metadata-only, idempotency_key = mailbox:message-id, content_hash, retention_expires_at) → `Idempotency Check` (Airtable list email_events by idempotency_key) → `Already Processed?` If → true: `Return Duplicate Stop` (terminal) → false: `Deterministic Rules` (Code: VIP/newsletter/blocked-sender config; newsletter by sender, subject pattern, bulk-mail footer phrase in the body, or List-Unsubscribe header plus "unsubscribe" in the body) → `Proceed to Triage?` If → false: `Write Blocked Event` (Airtable, processing_status: blocked) → true: `Write email_events` (Airtable create, processing_status: received) → `Prepare Triage Input` (capture email_event_id) → `Call Triage Core` (Execute Workflow → P2-02) → `Build Handoff Input` → `Call Review & Task Handoff` (Execute Workflow → P2-03) → `Update email_events Final State` (category, importance, confidence, summary, draft_id, task_id, processing_status) → `Final Intake Result`.

### P2-02 AI Triage and Draft Core (10 nodes)
Execute Workflow Trigger → `Prepare AI Input` (Code: minimize text to 8000 chars, mark untrusted) → `AI Structured Triage` (chainLlm + structured parser with the exact §6.5 schema, `continueOnFail`) → `Confidence & Safety Gate` (Code: threshold 0.70, sensitive/malformed/low-confidence → review_required; normalises `suggested_due_at` to Asia/Kolkata and drops it when it is before the received time or on a weekday the email does not mention, recorded as `due_date_check`) → `Review Required?` If → false: `Return Triage Decision` (accepted) → true: `Write Review Queue` (Airtable create review_queue) → `Return Review Decision`. The OpenAI Chat Model and structured parser connect to the chain via `ai_languageModel` and `ai_outputParser`.

### P2-03 Review and Task Handoff (14 nodes)
Execute Workflow Trigger → `Load email_events State` (Airtable list by message_id; check existing draft_id/task_id) → `Prepare Handoff Plan` (Code: determine create_draft, create_task, send_alert; task idempotency via Message-ID) → `Needs Reply & Accepted?` If → true: `Create Gmail Draft` (Gmail node, credentials omitted, continueOnFail) → `Needs Task & Accepted?` If → true: `Create Asana Task` (Asana, configured credential, continueOnFail, task name includes Message-ID idempotency key) → `Urgent Alert Needed?` If → true: `Urgent Alert Adapter — Not Configured` (explicit no-op in the stable master) → `Capture Handoff Results` (Code: merge draft_id, task_id, alert_sent, errors; flag Gmail login errors) → `Gmail Auth Failed?` If → true: `Create Gmail Auth Alert Task` (Asana `[ALERT][CRITICAL] Gmail login failed`, continueOnFail) → `Asana Failed?` If → true: `Write Dead Letter` (draft preserved, task failed + replayable) → `Update email_events Handoff State` (draft_id, task_id, alert_id, processing_status) → `Find Pending Dead Letters` → `Pending Dead Letter?` If → true: `Mark Dead Letter Resolved` → `Return Handoff Result`. `Prepare Handoff Plan` sends an alert only when the AI rated the email high (client_request/billing, confidence ≥ 0.80) **and** a deterministic urgency signal is present (urgency/outage/deadline/billing keyword in the subject or body — body only for `Re:`/`Fwd:` subjects — or a VIP sender); it records `alert_reason` and skips the alert when email_events already has an `alert_id`. The draft/task/alert branches use a diamond pattern: false branches skip ahead and both converge. The controlled E2E reference contains a Gmail owner-alert adapter, but that urgent delivery branch is not part of the verified live claim.

### P2-04 Daily Operations Brief (10 nodes)
Schedule (daily 08:30 IST) → `Get Asana Tasks` (Asana getAll, configured credential) → `Get Unreported email_events` (Airtable list, reported_at blank; execute once) → `Build Brief` (Code: deterministic counts of urgent mail, unreported rows with a draft, open/overdue tasks — no AI) → `Send Brief` (Slack reference path, credentials omitted, not live-verified; the E2E build sends Gmail) → `Brief Sent OK?` If → false: skip to result (items stay unreported) → true: `Any Rows To Mark?` If → false: skip to result → true: `Prepare Mark List` (Code: one item per email_event) → `Mark Reported` (Airtable update each, reported_at) → `Build Brief Result` (reads optional nodes in try/catch).

### P2-05 Retention and Health Sweep (8 nodes)
Schedule (weekly 03:00 IST) → `Get Expired email_events` (Airtable list, retention_expires_at < NOW and retention_status not `redacted`) → `Any Expired Rows?` If → false: skip to the stuck-records search → true: `Redact Expired Bodies` (text_body = "", summary = "", retention_status = redacted; processing_status unchanged) → `Get Stuck/Failed Records` (Airtable list, processing_status in failed/review_required/received; execute once) → `Build Health Report` (Code: deterministic counts) → `Send Health Report` (Slack reference path, credentials omitted, not live-verified) → `Build Sweep Result`.

## 5. Shared error handler integration

`P0-99 Shared Error Handler` (`workflows/shared-error-handler.json`) starts with a native **Error Trigger**, normalizes/redacts the error payload, derives project/severity/error-class, writes an `execution_audit` record, writes a `dead_letter` record when replay context exists, and creates an Asana alert task.

**Integration (assigned after import):** every P2 workflow will have `errorWorkflow` set in its `settings` to the P0-99 workflow ID. During offline construction this binding is intentionally omitted (no fake workflow ID is hard-coded, per the shared conventions). After import:
1. imports P0-99 and notes its workflow ID;
2. sets `settings.errorWorkflow` on P2-01..P2-05 to that ID;
3. re-validates and activates test copies.

In-workflow failure handling (P2-03's Asana failure → dead_letter with draft preserved; P2-04's delivery-failure → items stay unreported) operates **before** the error trigger and handles recoverable item-level failures. The shared error handler catches workflow/execution-level failures that escape in-workflow handling. The two layers are complementary, not redundant.

## 6. Adapters (§6.9)

| Layer | Standard demo | Swappable options |
|---|---|---|
| Inbox | Gmail / IMAP | Microsoft Outlook, shared mailbox, support form, Help Scout, Zendesk |
| Tasks | Asana | ClickUp, Monday.com, Trello, Notion, Jira, GoHighLevel tasks |
| Review | Gmail Draft / review_queue table | Slack approval, Microsoft Teams, CRM review stage |
| Alerts | Slack | Email, Teams, WhatsApp/Twilio, SMS, Telegram |
| State | Airtable email_events + review_queue | n8n Data Tables, Supabase, Postgres |
| Attachments | Metadata only | Invoice extraction, OCR, Drive/Dropbox routing, PDF parsing |
| Knowledge | None in core | Approved FAQ/RAG source with citations |
| Reporting | Slack daily brief | Email digest, Airtable Interface, Google Sheets, dashboard |

Each proposal changes adapters and business rules, not the verified triage core.

## 7. State vocabulary (§8.3)

```text
received → validated → processing → review_required → succeeded (triaged)
                                   └→ retry_pending → failed → replayed
```

External side effects carry their own state (`draft_id`, `task_id`, `task_status`: `pending` → `synced` | `failed`). The overall execution is not treated as successful merely because one external action succeeded.
