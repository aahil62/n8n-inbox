# Airtable schema guide

Use fictional messages while configuring the package. Exact field types and
state semantics are documented in [the data contract](../docs/data-contract.md).

| Table | Purpose | Key fields |
|---|---|---|
| email_events | Canonical message, triage, draft, and task state | idempotency_key, message_id, thread_id, category, confidence, draft_id, task_id, processing_status |
| review_queue | Sensitive, unsafe, or low-confidence cases | review_id, correlation_id, reason, draft_text, status, reviewer, reviewed_at |
| execution_audit | Sanitized run history | correlation_id, workflow, stage, status, timestamps |
| dead_letter | Recoverable failure context | correlation_id, failed_stage, retryable, sanitized_input, status |
