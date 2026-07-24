# Setup guide

## Requirements

- a disposable n8n test instance
- test accounts for the integrations named in the README
- credentials created inside n8n's encrypted credential store
- fictional data for all test runs

## Import order

- `workflows/p2-inbox-intake.json`
- `workflows/p2-triage-draft-core.json`
- `workflows/p2-review-task-handoff.json`
- `workflows/p2-daily-operations-brief.json`
- `workflows/p2-retention-health-sweep.json`
- `workflows/shared-error-handler.json`

Import the shared error handler first. Replace `REPLACE-SHARED-ERROR-WORKFLOW-ID` in each workflow after n8n assigns the imported error workflow an ID. Reconnect every `REPLACE-SUBWORKFLOW-ID` through the n8n editor.

## Resource mapping

Replace the Airtable, Asana, CRM, mailbox, model, and project placeholders with resources from your test accounts. Confirm every field name against the destination schema instead of accepting defaults.

## Validation

1. keep all workflows inactive.
2. validate every node and complete workflow.
3. run one valid fixture through the full path.
4. run the duplicate or unchanged case.
5. run a malformed input.
6. run an authentication failure.
7. inspect audit and dead-letter outputs.
8. deactivate the test workflow after evidence capture.

## Production boundary

The exports are a reusable reference implementation, not a drop-in production deployment. A real rollout needs client-specific credentials, field ownership, retention, failure policy, rate limits, and acceptance tests.
