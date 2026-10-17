# Data Contract — AI Inbox and Business Operations Command Center

Source of truth: `PORTFOLIO_MASTER_PROJECTS.md` §6.5 (Canonical email contract, structured triage output, state tables) and §8.2 (Shared tables).

## 1. Canonical email contract (§6.5)

The shape every inbox adapter normalizes to **before any AI node**. This is the payload P2-01 produces and P2-02 consumes.

```json
{
  "correlation_id": "uuid",
  "idempotency_key": "mailbox:message-id",
  "mailbox": "string",
  "message_id": "string",
  "thread_id": "string|null",
  "from_name": "string",
  "from_email": "string",
  "to": ["string"],
  "subject": "string",
  "text_body": "string",
  "received_at": "ISO-8601",
  "attachment_metadata": [],
  "source_link": "string|null"
}
```

### Derivation rules (P2-01 Normalize & Sanitize Email)
- `correlation_id`: UUID-like generated in the Code node (pure JS, no `crypto`).
- `idempotency_key`: `mailbox:message-id` (primary). Message-ID idempotency is checked against `email_events` before any side effect. Content hash is a secondary field, not the primary key.
- `from_email`: lowercased, parsed from `Name <email>` envelope.
- `text_body`: HTML stripped to text (comments, `<style>`/`<script>` removed; `<br>` and closing block tags become line breaks first), quoted history (`On … wrote:`) and signature separators (`--`) stripped where safe, capped at 16000 chars. Treated as **UNTRUSTED DATA**.
- `attachment_metadata`: filename, mimeType, size only — never parsed in the core. Attachments over 10MB are flagged as oversized.
- `source_link`: Gmail thread URL when a thread_id exists.
- `list_unsubscribe` (optional): the raw `List-Unsubscribe` header when the adapter can read it; used only by the newsletter rule.
- `content_hash`: FNV-1a hash of the body (stored for dedup diagnostics).
- `retention_expires_at`: `received_at + 30 days` (documented retention window).

### Validation rules (P2-01)
Reject / block when any of:
- missing `message_id` (cannot build idempotency key)
- sender matches the blocked-sender list (audited as `processing_status: blocked`)
- body > 16000 chars after sanitization (truncated, flagged)

## 2. Structured triage output (§6.5)

The strict schema returned by the AI structured parser in P2-02. Malformed or partial output is caught by the confidence & safety gate and routed to review.

```json
{
  "category": "client_request|sales|billing|meeting|internal|newsletter|other",
  "importance": "high|medium|low",
  "needs_reply": true,
  "needs_task": true,
  "summary": "string",
  "draft_reply": "string",
  "suggested_due_at": "ISO-8601|null",
  "confidence": 0.0,
  "sensitive": false,
  "safety_reason": "string|null"
}
```

### Gate semantics (P2-02 Confidence & Safety Gate)
- `confidence < 0.70` → `review_required` (reason: `low_confidence`)
- `sensitive === true` → `review_required` (reason: `sensitive_content`) — always human review, never auto-send
- malformed/missing fields or LLM timeout → `review_required` (reason: `malformed_output` / `llm_timeout_or_malformed`)
- Sensitive categories: legal, security, payroll, medical, refund, account access, commitments.

## 3. State tables

### `email_events` (Airtable table `REPLACE-EMAIL-EVENTS-TABLE-ID`)

```text
message_id, mailbox, thread_id, received_at, content_hash, category,
importance, confidence, processing_status, draft_id, task_id, alert_id,
reported_at, retention_expires_at, last_error_code
```

Additional operational fields used by the workflows: `correlation_id`,
`idempotency_key`, `from_name`, `from_email`, `subject`, `text_body`,
`source_link`, `retention_status`, and `summary` (long text: the AI summary from P2-02, written by the P2-01 final-state update and cleared by P2-05).

### State semantics

| Field | Values | Set by |
|---|---|---|
| `processing_status` | `received` → `blocked` \| `completed` \| `review_required` \| `failed` | P2-01C sets `received`/`blocked`; P2-03 and P2-01C's final update set the terminal state, so a successful manual handoff replay moves `failed` → `completed` |
| `draft_id` | `""` → Gmail draft id | P2-03 after a draft is created; preserved on Asana failure |
| `task_id` | `""` → Asana task gid | P2-03 only after a verified Asana task ID exists; `failed` on Asana API failure |
| `alert_id` | `""` → sent alert message id | P2-03 after the urgent alert is sent; when set, P2-03 skips the alert so a replay does not alert twice |
| `reported_at` | `""` → ISO-8601 | P2-04 **only after** successful brief delivery |
| `retention_expires_at` | ISO-8601 | P2-01 at intake (`received_at + 30 days`) |
| `retention_status` | `""` → `redacted` | P2-05 after clearing `text_body` and `summary`; `processing_status` is left unchanged and redacted rows are not selected again |
| `last_error_code` | string | P2-03 on Asana/task failure |

### External-write state rule
`task_id` is populated **only after** the Asana create returns a verified task ID. On Asana API failure → `task_id` stays empty, `last_error_code` is set, a `dead_letter` row is written (retryable), and the **draft is preserved** (`draft_id` is not erased). The draft state and task state are independent.

### `review_queue` (Airtable table `REPLACE-REVIEW-QUEUE-TABLE-ID`)

```text
review_id, message_id, reason, draft_text, status, assigned_to,
created_at, reviewed_at, final_action
```

`review_id` is derived from the correlation ID for traceability. P2-02 writes
the row when the confidence/safety gate fails (sensitive, low-confidence,
malformed, or LLM timeout). The `draft_text` holds the AI draft for a person
to inspect and edit — **never auto-sent**. No Asana task is auto-created for
`review_required` items.

## 4. Shared tables (§8.2)

### `execution_audit` (Airtable table `REPLACE-EXECUTION-AUDIT-TABLE-ID`)

```text
correlation_id, project_id, workflow_id, execution_id, stage,
status, attempt, started_at, completed_at, external_ids,
error_code, sanitized_error, replay_of
```

Written by P0-99 Shared Error Handler on workflow-level failures.

### `dead_letter` (Airtable table `REPLACE-DEAD-LETTER-TABLE-ID`)

```text
dead_letter_id, correlation_id, project_id, workflow_id,
failed_stage, sanitized_input, error_code, retryable,
attempts, status, created_at, resolved_at, replay_execution_id
```

Written by P2-03 (Asana task-create failure; draft preserved) and P0-99. `retryable` is `true` for transient Asana failures so the task can be replayed after the credential is restored. After a successful P2-03 handoff, its `pending` P2 rows with the same `correlation_id` are set to `status = resolved` with `resolved_at` and `replay_execution_id`. Replay itself is a manual re-invocation of P2-03 with the original handoff payload.

## 5. Airtable base and table IDs (non-secret, for the target environment)

Base: `REPLACE-AIRTABLE-BASE-ID` ("Portfolio Automation OS").

| Table | ID |
|---|---|
| email_events | `REPLACE-EMAIL-EVENTS-TABLE-ID` |
| review_queue | `REPLACE-REVIEW-QUEUE-TABLE-ID` |
| execution_audit | `REPLACE-EXECUTION-AUDIT-TABLE-ID` |
| dead_letter | `REPLACE-DEAD-LETTER-TABLE-ID` |

## 6. Asana task contract (P2-03)

- Workspace `REPLACE-ASANA-WORKSPACE-ID`, project `REPLACE-ASANA-PROJECT-ID` (Portfolio Automation Delivery).
- Task name: `[msg:<message_id>] <category>: <subject>` — the Message-ID-derived prefix is the task idempotency marker so reruns cannot duplicate tasks.
- Task notes include: source link, mailbox, correlation ID, message ID, category, importance, confidence, summary, and the draft reply (marked "review before sending").
- `due_on` set from `suggested_due_at` when present. P2-02 normalises `suggested_due_at` to Asia/Kolkata (`+05:30`) and sets it to null when it cannot be parsed, is before the received time, or falls on a weekday the email does not mention (`due_date_check`).
- Authentication: `accessToken` via verified Asana credential `REPLACE-ASANA-CREDENTIAL-ID`.

## 7. Notification contracts

- **Urgent alert (P2-03):** Gmail message to the configured owner mailbox.
  Sent only for configured urgent conditions. Contains category, sender,
  subject, source link, summary, and correlation ID.
- **Daily brief (P2-04):** Gmail message to the owner mailbox, built from
  stored `email_events` and Asana tasks.
- **Health report (P2-05):** Gmail message to the owner mailbox with retention,
  failure, and review counts.
- Notification failures do not erase already-created drafts or tasks. AI reply
  content is still created only as a draft and is never automatically sent.
