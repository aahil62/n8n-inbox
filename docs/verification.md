# Verification and limitations

## Confirmed

A representative Gmail message passed through AI triage, grounded draft creation, Airtable tracking, and Asana task handoff.

The workflow JSON is sanitized, parses successfully, has no credential blocks, contains no live account identifiers, and is exported inactive.

## Not yet claimed

The full 15-scenario failure matrix and the labeled 40-message evaluation set are included but have not been run live as a complete production gate.

Do not describe the package as fully production-ready until the documented matrix passes against the target client's real field configuration and rate limits.

## Test assets

15 end-to-end scenarios plus a labeled 40-message triage evaluation set.
