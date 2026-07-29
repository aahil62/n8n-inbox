# Verification and limitations

## Confirmed

Controlled live paths passed for normal Gmail processing, duplicate replay, and sensitive or prompt-injection review routing. The accepted path created a reviewable Gmail draft, an Asana task, and Airtable state without automatically sending the AI-written reply.

The workflow JSON is sanitized, parses successfully, has no credential blocks, contains no live account identifiers, and is exported inactive.

## Not yet claimed

Four of the 15 end-to-end scenarios have passed. The remaining 11 scenarios and the labeled 40-message evaluation set have not been run live as a complete production gate.

Do not describe the package as fully production-ready until the documented matrix passes against the target client's real field configuration and rate limits.

## Test assets

15 end-to-end scenarios plus a labeled 40-message triage evaluation set.
