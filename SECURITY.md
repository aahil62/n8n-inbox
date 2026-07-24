# Security

These repositories contain sanitized n8n workflow exports. Credentials, tokens, account-specific resource IDs, and real customer data must never be committed.

If you find sensitive information, do not open a public issue. Contact the repository owner through the GitHub profile instead.

Before using a workflow:

1. Import it into a test n8n instance.
2. create new credentials in n8n's encrypted credential store.
3. replace every `REPLACE-...` placeholder.
4. validate the workflow.
5. test with fictional data.
6. keep the workflow inactive until the expected and failure paths pass.
