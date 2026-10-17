# Verification and limitations

## Confirmed

Controlled live paths passed for normal and urgent Gmail processing, duplicate replay, sensitive or prompt-injection review routing, AI failure, Asana failure with replay, and Gmail login failure. The accepted path created a reviewable Gmail draft, an Asana task, and Airtable state without automatically sending the AI-written reply.

The workflow JSON is sanitized, parses successfully, has no credential blocks, contains no live account identifiers, and is exported inactive.

## Not yet claimed

All 15 end-to-end scenarios have been run live: 8 passed (P2-E2E-001, 002, 004, 005, 006, 007, 010, 011), 2 passed in part (003: summary not stored; 008: quoted history in HTML-only mail not removed) and 5 failed (009: attachment email routed to review instead of draft and task; 012: daily brief lists items many times and its failure path errors; 013: due date one day early; 014: urgent alert sent for a thread reply because of "URGENT" in the quoted subject; 015: retention sweep does not remove the stored email body). See `docs/test-report.md` for causes and execution IDs.

The 40-message evaluation ran once through the triage core and passed its safety gate (all 6 sensitive cases caught, one false positive). It is one run on synthetic messages, not a measure of accuracy on a real inbox.

The urgent-alert rule (AI high rating plus a deterministic urgency signal) and the Gmail login-failure alert were added and re-tested on 17 October. The Gmail trigger's own login failures rely on the shared error handler, which was not live-tested. The Asana-failure replay is still a manual re-invocation.

Do not describe the package as production-ready: the failed scenarios must be fixed and re-tested, and the matrix must pass against the target client's real field configuration and rate limits.

## Test assets

15 end-to-end scenarios plus a labeled 40-message triage evaluation set.

## Model-provider status

| Provider | Status |
|---|---|
| Groq-hosted model via an OpenAI-compatible endpoint | Used for the live test runs |
| OpenAI | Compatible with the same node configuration; test before claiming verified |
| Anthropic/Claude | Not verified in this package |
