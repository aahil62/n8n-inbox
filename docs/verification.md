# Verification and limitations

## Confirmed

Controlled live paths passed for normal and urgent Gmail processing, duplicate replay, sensitive or prompt-injection review routing, AI failure, Asana failure with replay, and Gmail login failure. The accepted path created a reviewable Gmail draft, an Asana task, and Airtable state without automatically sending the AI-written reply.

The workflow JSON is sanitized, parses successfully, has no credential blocks, contains no live account identifiers, and is exported inactive.

## Not yet claimed

All 15 end-to-end scenarios have been run live. The first full run on 17 October had 8 passed, 2 partial and 5 failed. Fixes for 003 (summary stored), 008 (quoted history in HTML-only mail), 012 (daily brief counts, failure path and empty run), 013 (due date in the business timezone), 014 (no urgent alert from a `Re:` subject) and 015 (retention sweep clears the body) were applied to both builds and each passed one live re-test the same day. Current result: 14 passed, 1 failed (009: attachment email routed to review instead of draft and task, the cautious direction; not fixed). The due-date drop paths were checked offline only, and the Slack delivery used by the template brief and health report was not live-tested. See `docs/test-report.md` for causes and execution IDs.

The 40-message evaluation ran once through the triage core and passed its safety gate (all 6 sensitive cases caught, one false positive). It is one run on synthetic messages, not a measure of accuracy on a real inbox.

The urgent-alert rule (AI high rating plus a deterministic urgency signal) and the Gmail login-failure alert were added and re-tested on 17 October. The Gmail trigger's own login failures rely on the shared error handler, which was not live-tested. The Asana-failure replay is still a manual re-invocation.

Do not describe the package as production-ready: each fix was re-tested once with fictional data in a sandbox, P2-E2E-009 still fails, and the matrix must pass against the target client's real field configuration, delivery channel and rate limits.

## Test assets

15 end-to-end scenarios plus a labeled 40-message triage evaluation set.

## Model-provider status

| Provider | Status |
|---|---|
| Groq-hosted model via an OpenAI-compatible endpoint | Used for the live test runs |
| OpenAI | Compatible with the same node configuration; test before claiming verified |
| Anthropic/Claude | Not verified in this package |
