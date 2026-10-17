# Workflow maps

Each map is generated from the exported workflow JSON in [`workflows/`](../workflows) by
[`scripts/render-workflow-maps.mjs`](../scripts/render-workflow-maps.mjs). They show the
node layout, branches and AI sub-nodes exactly as they import into n8n. Open an image
to view it at full size.

Regenerate after changing a workflow:

```bash
node scripts/render-workflow-maps.mjs
```

## P2-01 Inbox Intake

Gmail intake, clean-up, duplicate check and fixed rules, then calls to triage and handoff.

![P2-01 Inbox Intake workflow map](../assets/workflow-maps/p2-inbox-intake.svg)

## P2-02 AI Triage and Draft Core

Structured AI triage and draft, confidence and safety gate, review queue.

![P2-02 AI Triage and Draft Core workflow map](../assets/workflow-maps/p2-triage-draft-core.svg)

## P2-03 Review and Task Handoff

Gmail draft, Asana task, urgent-alert placeholder and dead-letter handling.

![P2-03 Review and Task Handoff workflow map](../assets/workflow-maps/p2-review-task-handoff.svg)

## P2-04 Daily Operations Brief

![P2-04 Daily Operations Brief workflow map](../assets/workflow-maps/p2-daily-operations-brief.svg)

## P2-05 Retention and Health Sweep

![P2-05 Retention and Health Sweep workflow map](../assets/workflow-maps/p2-retention-health-sweep.svg)

## P0-99 Shared Error Handler

![P0-99 Shared Error Handler workflow map](../assets/workflow-maps/shared-error-handler.svg)
