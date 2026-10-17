# Setup guide

## Requirements

- a disposable n8n test instance
- test accounts for the integrations named in the README
- credentials created inside n8n's encrypted credential store
- fictional data for all test runs

## Import order

1. `workflows/shared-error-handler.json`
2. `workflows/p2-inbox-intake.json`
3. `workflows/p2-triage-draft-core.json`
4. `workflows/p2-review-task-handoff.json`
5. `workflows/p2-daily-operations-brief.json`
6. `workflows/p2-retention-health-sweep.json`

The shared error handler is intentionally first. After import, replace
`REPLACE-SHARED-ERROR-WORKFLOW-ID` with its assigned n8n ID.

## Workflow-to-workflow mapping

| Placeholder | Imported workflow | Used by |
|---|---|---|
| `REPLACE-P2-TRIAGE-WORKFLOW-ID` | Imported P2-02 Triage and Draft Core | P2-01 and E2E processor |
| `REPLACE-P2-HANDOFF-WORKFLOW-ID` | Imported P2-03 Review and Task Handoff | P2-01 and E2E processor |
| `REPLACE-P2-CANONICAL-PROCESSOR-WORKFLOW-ID` | Imported E2E canonical processor | Optional E2E Gmail adapter and harnesses |

Reconnect each Execute Workflow node through the n8n editor rather than editing
an exported ID blindly.

## Credentials and minimum permissions

| Credential | Minimum intended access |
|---|---|
| Gmail OAuth2 | Read messages, create drafts, and send owner notifications only where configured |
| Airtable | Read/write access only to email-events, review, audit, and dead-letter tables |
| Asana | Read tasks and create tasks in the selected project |
| OpenAI-compatible model | Structured triage and draft generation only |
| Slack | Optional reference adapter; not part of the verified live claim |

Credentials belong in n8n's encrypted credential store. Never paste a token
into a Set, Edit Fields, Code, or HTTP-header text field.

### Keep the Gmail login from expiring

Google expires refresh tokens after 7 days while an OAuth app's publishing
status is **Testing**. The sandbox lost its Gmail connection this way during
testing. Before the workflow watches a real inbox:

1. Open the [Google Cloud console](https://console.cloud.google.com/) and select
   the project that owns the OAuth client used by the n8n Gmail credential.
2. Go to **Google Auth Platform → Audience** (older console: **APIs & Services →
   OAuth consent screen**).
3. If the mailbox is in a Google Workspace domain and only that domain will use
   it, set **User type** to **Internal**; internal apps are not subject to the
   7-day limit.
4. Otherwise, under **Publishing status: Testing**, click **Publish app** and
   confirm, so the status reads **In production**. Gmail scopes are restricted,
   so Google may show an "unverified app" warning or ask for verification if the
   app is used beyond your own accounts.
5. In n8n, open **Credentials → Gmail account → Reconnect** and sign in again.
   Tokens issued while the app was in Testing keep their 7-day limit, so this
   reconnect is required.

If the login still fails later, the handoff creates an Asana task
`[ALERT][CRITICAL] Gmail login failed — reconnect the Gmail credential in n8n`
and writes a dead-letter row for each affected email.

## Resource mapping

Create the Airtable email-events, review-queue, execution-audit, and dead-letter tables. Configure the Gmail mailbox, Asana project, owner-notification address, and model credential. Slack remains an optional unverified reference adapter.

Use [the placeholder map](placeholder-map.md), [the Airtable schema](../config/airtable-schema.md),
and the CSV samples under `config/`. Confirm every field name and option
against the destination account instead of accepting defaults.

## Model configuration

Bind an OpenAI-compatible credential to the model nodes and request structured
output matching the data contract. Run the invalid-schema and timeout fixtures
before relying on the model path. Provider interchangeability is not proof that
every provider has been tested.

## Controlled test sequence

1. Keep all workflows inactive.
2. Run `node scripts/validate-repository.mjs`.
3. Import into a disposable n8n instance and validate every complete workflow.
4. Re-open each Execute Workflow node and verify its selected target.
5. Run one valid fixture through the full path.
6. Run the duplicate or unchanged case.
7. Run a malformed or low-confidence input.
8. Run an authentication or downstream-service failure.
9. Inspect destination, audit, review, and dead-letter state.
10. Deactivate the workflows after evidence capture.

## Activation checklist

- [ ] All placeholders are replaced with test or client-specific resources.
- [ ] Credentials use least-privilege scopes and contain no secrets in node text.
- [ ] Webhooks are authenticated or protected at the gateway.
- [ ] Workflow and connection validation pass.
- [ ] Duplicate and failure behavior pass with fictional data.
- [ ] Retention, owner notifications, and human-review responsibility are agreed.
- [ ] External triggers and schedules are enabled only after sign-off.

## Rollback and deactivation

Disable schedules, polling triggers, and webhooks first. Deactivate the project
workflows, preserve execution/audit evidence, and revert to the last validated
workflow version or exported JSON. Do not delete destination records during
rollback unless the client has explicitly approved the cleanup plan.

## Production boundary

The exports are a reusable reference implementation, not a drop-in production deployment. A real rollout needs client-specific credentials, field ownership, retention, failure policy, rate limits, and acceptance tests.
