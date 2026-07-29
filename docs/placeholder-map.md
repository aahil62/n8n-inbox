# Placeholder map

Every placeholder is resource-specific so replacements can be reviewed safely.
Do not perform a global replacement across unrelated resources.

| Placeholder | Resource | Used in | Required permission |
|---|---|---|---|
| `REPLACE-AIRTABLE-BASE-ID` | Airtable base | `e2e-reference/p2-e2e-01c-processor.json`, `e2e-reference/p2-e2e-02-triage-core.json`, `e2e-reference/p2-e2e-03-handoff.json`, `e2e-reference/p2-e2e-04-daily-brief.json`, `e2e-reference/p2-e2e-05-retention-health.json`, `p2-daily-operations-brief.json`, `p2-inbox-intake.json`, `p2-retention-health-sweep.json`, `p2-review-task-handoff.json`, `p2-triage-draft-core.json`, `shared-error-handler.json` | Read/write for only the documented tables |
| `REPLACE-ASANA-PROJECT-ID` | Asana project | `e2e-reference/p2-e2e-03-handoff.json`, `e2e-reference/p2-e2e-04-daily-brief.json`, `p2-daily-operations-brief.json`, `p2-review-task-handoff.json`, `shared-error-handler.json` | Task creation |
| `REPLACE-ASANA-WORKSPACE-ID` | Asana workspace | `e2e-reference/p2-e2e-03-handoff.json`, `p2-review-task-handoff.json`, `shared-error-handler.json` | Workspace lookup |
| `REPLACE-DEAD-LETTER-TABLE-ID` | Airtable dead-letter table | `e2e-reference/p2-e2e-03-handoff.json`, `p2-review-task-handoff.json`, `shared-error-handler.json` | Read/write |
| `REPLACE-EMAIL-EVENTS-TABLE-ID` | Airtable email-events table | `e2e-reference/p2-e2e-01c-processor.json`, `e2e-reference/p2-e2e-03-handoff.json`, `e2e-reference/p2-e2e-04-daily-brief.json`, `e2e-reference/p2-e2e-05-retention-health.json`, `p2-daily-operations-brief.json`, `p2-inbox-intake.json`, `p2-retention-health-sweep.json`, `p2-review-task-handoff.json` | Read/write |
| `REPLACE-EXECUTION-AUDIT-TABLE-ID` | Airtable execution-audit table | `shared-error-handler.json` | Read/write |
| `REPLACE-OWNER-EMAIL` | Owner notification mailbox | `e2e-reference/p2-e2e-00-test-harness.json`, `e2e-reference/p2-e2e-03-handoff.json`, `e2e-reference/p2-e2e-04-daily-brief.json`, `e2e-reference/p2-e2e-05-retention-health.json` | Receive operational notifications |
| `REPLACE-P2-CANONICAL-PROCESSOR-WORKFLOW-ID` | Imported P2 E2E canonical processor | `e2e-reference/p2-e2e-00-review-test-harness.json`, `e2e-reference/p2-e2e-00-test-harness.json`, `e2e-reference/p2-e2e-01-gmail-adapter.json` | Execute |
| `REPLACE-P2-HANDOFF-WORKFLOW-ID` | Imported P2-03 handoff workflow | `e2e-reference/p2-e2e-01c-processor.json`, `p2-inbox-intake.json` | Execute |
| `REPLACE-P2-TRIAGE-WORKFLOW-ID` | Imported P2-02 triage workflow | `e2e-reference/p2-e2e-01c-processor.json`, `p2-inbox-intake.json` | Execute |
| `REPLACE-REVIEW-QUEUE-TABLE-ID` | Airtable review-queue table | `e2e-reference/p2-e2e-02-triage-core.json`, `p2-triage-draft-core.json` | Read/write |
| `REPLACE-SHARED-ERROR-WORKFLOW-ID` | Imported shared error-handler workflow | `e2e-reference/p2-e2e-01-gmail-adapter.json`, `e2e-reference/p2-e2e-01c-processor.json`, `e2e-reference/p2-e2e-02-triage-core.json`, `e2e-reference/p2-e2e-03-handoff.json`, `e2e-reference/p2-e2e-04-daily-brief.json`, `e2e-reference/p2-e2e-05-retention-health.json`, `p2-daily-operations-brief.json`, `p2-inbox-intake.json`, `p2-retention-health-sweep.json`, `p2-review-task-handoff.json`, `p2-triage-draft-core.json` | Error-workflow assignment |

After replacement, open every affected node in n8n and confirm the selected
resource by name. A syntactically valid ID can still point to the wrong table,
workflow, mailbox, workspace, or project.
