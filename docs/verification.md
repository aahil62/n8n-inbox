# Verification and limitations

## Confirmed

Controlled live paths passed for normal Gmail processing, duplicate replay, and sensitive or prompt-injection review routing. The accepted path created a reviewable Gmail draft, an Asana task, and Airtable state without automatically sending the AI-written reply.

The workflow JSON is sanitized, parses successfully, has no credential blocks, contains no live account identifiers, and is exported inactive.

## Not yet claimed

Eight of the 15 end-to-end scenarios have passed (P2-E2E-001, 002, 004, 005, 006, 007, 010, 011). P2-E2E-002 passed after the urgent-alert rule was changed on 17 October so an alert needs a high AI rating plus a deterministic urgency signal (keyword or VIP sender); 3 of 3 re-test runs sent no alert, including one where the model rated the email high. P2-E2E-004 and 011 passed on re-test after the newsletter-rule and handoff-replay fixes; the Asana-failure replay is still a manual re-invocation, not an automated replay workflow. The remaining 7 scenarios and the labeled 40-message evaluation set have not been run live as a complete production gate.

Do not describe the package as fully production-ready until the documented matrix passes against the target client's real field configuration and rate limits.

## Test assets

15 end-to-end scenarios plus a labeled 40-message triage evaluation set.

## Model-provider status

| Provider | Status |
|---|---|
| Groq-hosted model via an OpenAI-compatible endpoint | Used for the live test runs |
| OpenAI | Compatible with the same node configuration; test before claiming verified |
| Anthropic/Claude | Not verified in this package |
