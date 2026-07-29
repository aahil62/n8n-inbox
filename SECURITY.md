# Security

These repositories contain sanitized n8n workflow exports. Credentials, tokens, account-specific resource IDs, and real customer data must never be committed.

If you find sensitive information, do not place it in a public issue. Use GitHub's private vulnerability-reporting or Security Advisory flow when it is available. If a private channel is unavailable, open a public issue containing no sensitive details and ask the maintainer to enable private reporting.

Every imported webhook must be authenticated or protected at the gateway before activation. Grant each credential only the minimum OAuth scopes and API permissions listed in the setup guide.

Before using a workflow:

1. Import it into a test n8n instance.
2. Create new credentials in n8n's encrypted credential store.
3. replace every `REPLACE-...` placeholder.
4. Verify the credential scopes and destination permissions.
5. Validate the workflow and inspect its connections.
6. Test with fictional data.
7. Keep the workflow inactive until the expected and failure paths pass.
