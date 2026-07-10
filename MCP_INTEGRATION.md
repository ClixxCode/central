# Central remote MCP integration

Central exposes an authenticated remote MCP server at `https://<central-origin>/api/mcp`. It is intended for Claude custom connectors and uses OAuth 2.1-style authorization-code flow with mandatory S256 PKCE. The integration acts as the signed-in Central user; it does not create a service account or bypass Central board permissions.

## What is deployed

| Endpoint | Purpose |
| --- | --- |
| `/.well-known/oauth-authorization-server` | OAuth authorization-server metadata and dynamic-registration endpoint |
| `/.well-known/oauth-protected-resource/api/mcp` | MCP protected-resource metadata |
| `/oauth/register` | Public-client dynamic client registration (PKCE only) |
| `/oauth/authorize` and `/oauth/consent` | Central login and explicit user consent |
| `/oauth/token` | Authorization-code and refresh-token exchange |
| `/api/mcp` | Streamable HTTP MCP transport |

The available permissions are deliberately small:

- `tasks:read` exposes `central_list_boards`, `central_list_tasks`, and `central_get_task` for data the user can already access.
- `tasks:write` additionally exposes `central_create_task` and `central_update_task`. Writes require an explicit board or task ID and accept only the fields documented in each tool schema.

OAuth clients are dynamically registered as public clients. Central accepts only HTTPS redirect URIs (except `http://localhost` and `http://127.0.0.1` for development), requires S256 PKCE, stores only hashes of authorization codes and credentials, and rotates refresh tokens. The protocol and mutation events are retained in `mcp_audit_events`.

## Configure and deploy

1. Apply the tracked database migrations, including `0038_flimsy_power_pack.sql` and `0039_faulty_firestar.sql`, to the target database. These create the OAuth-client, credential, refresh-token, and audit-event tables.
2. Set `DATABASE_URL` to that database.
3. Set `NEXT_PUBLIC_APP_URL` to the one canonical, public HTTPS Central origin, for example `https://central.example.com`. It is the OAuth issuer and is embedded in both discovery documents and bearer challenges. Do not use a preview URL, a private host, or a trailing-path URL.
4. Set `AUTH_SECRET` to a unique high-entropy secret. It signs the short-lived (10 minute) authorization/consent request. This can be the existing Auth.js secret, but must be treated as an OAuth signing secret.
5. Deploy the app with the Node runtime available for `/api/mcp`; then verify the public discovery URLs return the same canonical origin and that `/api/mcp` is reachable from outside your network.

There are no `MCP_*` application secrets or Claude API keys. Dynamic registration means Central creates an OAuth client record when a compatible connector first connects. Do not create a client secret: this server supports `token_endpoint_auth_method: none` only.

## Connect Claude

Before starting, obtain the following provider-side values from the Claude connector UI or Anthropic’s current connector documentation:

- The remote MCP URL: `https://<central-origin>/api/mcp`.
- Claude’s OAuth callback URL. Anthropic’s current custom-connector guidance identifies `https://claude.ai/api/mcp/auth_callback`; Central validates the callback submitted during registration, so use the provider’s displayed/current value if it differs.
- The client identity only if Claude asks for it in Advanced settings. This Central server uses dynamic registration and public PKCE clients, so leave a client secret blank—supplying a secret is unsupported.

For an individual Claude plan, open **Customize → Connectors → + → Add custom connector**, provide the MCP URL, and complete the connection. On Team or Enterprise, an Owner first adds a **Custom → Web** connector under **Organization settings → Connectors**; each member then connects it from **Customize → Connectors**. Claude’s connector traffic originates from Anthropic’s cloud, so the Central deployment must be publicly reachable rather than merely reachable from a developer laptop. See Anthropic’s [custom connector setup guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

When Claude redirects to Central, sign in as the Central user whose boards should be available, review the requested `tasks:read`/`tasks:write` scopes, and explicitly allow or deny the request. Enable the connector for the desired conversation and begin with a read-only request such as listing boards. Grant `tasks:write` only when task creation or updating is actually required.

## Local and release verification

Local Central can run at `http://localhost:3000`, and local callbacks are allowed by the OAuth client validator. Claude itself cannot connect directly to that address because remote custom connectors originate in Anthropic’s cloud. To exercise a real Claude connection before production, run Central locally against a disposable database, expose it through an authenticated HTTPS tunnel, set `NEXT_PUBLIC_APP_URL` to that tunnel’s stable HTTPS origin, and use a disposable Central user and test board.

Run the automated connection-flow coverage before deployment:

```sh
npx vitest run __tests__/unit/mcp-oauth-connection-flow.test.ts __tests__/unit/mcp-oauth-service.test.ts __tests__/unit/mcp-oauth-routes.test.ts __tests__/unit/mcp-route.test.ts __tests__/unit/schema.test.ts
npm run lint
npx tsc --noEmit --incremental false
```

The connection-flow test performs dynamic registration, authenticated consent, authorization-code exchange, and MCP initialization in one process with an in-memory OAuth-service boundary. It verifies endpoint contracts and the actual MCP transport/tool discovery, but cannot prove a live Claude cloud login, network allowlist, tunnel, or production database migration. Perform that manual smoke test once per new public origin.

## Security and operations checklist

Before enabling write access in an environment, confirm all of the following:

- [ ] `NEXT_PUBLIC_APP_URL` is a canonical public HTTPS URL and discovery metadata matches it exactly.
- [ ] The deployment is reachable from Anthropic’s cloud; firewall/WAF rules allow the required traffic without exposing a private origin.
- [ ] `AUTH_SECRET`, database credentials, and any app session secrets are unique per environment, managed outside source control, and have an incident rotation procedure. Rotating `AUTH_SECRET` invalidates in-progress consent requests.
- [ ] Only `tasks:read` is requested by default. `tasks:write` is explicitly reviewed for the smallest suitable users and boards.
- [ ] OAuth redirect URIs, clients, scopes, and consent screens are reviewed; never allow a client secret because Central accepts public PKCE clients only.
- [ ] A tested revocation runbook exists: revoke the affected Central MCP access token and the associated refresh-token family while preserving `mcp_audit_events`. (The current code exposes service-level revocation, but has no user-facing token-management screen.)
- [ ] Audit retention, access, and export policy for `mcp_audit_events` is defined. No automated retention/purge job exists yet; preserve sufficient evidence before any manual purge.
- [ ] Rate limiting, request-size limits, abuse detection, and WAF rules are configured at the edge. Application-level MCP/OAuth rate limiting is not implemented yet.
- [ ] Operators monitor failed authorization/token exchanges, refresh-token replay events, write-tool rejections, and unexpected tool volume.
- [ ] The module-memory MCP session limitation is accepted for the deployment model: a recycled or separately scaled Node instance requires the client to initialize a new MCP session. Use shared session storage before relying on cross-instance continuity.

## Incident quick reference

- A connector that cannot authenticate: confirm the public origin, discovery documents, callback URL, Central login, and requested scope. Check `mcp_audit_events` for OAuth event outcomes.
- `401 invalid_token` or `403 insufficient_scope`: reconnect or request the appropriate scope; do not work around the error with an application session cookie.
- Suspected credential loss or refresh-token replay: revoke the active access token and refresh-token family, preserve audit records, rotate any affected application secrets, and require a new consent flow.
- A missing MCP session after a deploy or cold start is expected with the current in-memory session store; reconnect/reinitialize the client.
