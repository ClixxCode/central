# Central remote MCP server

Central exposes an OAuth-protected remote Model Context Protocol server for Claude and other MCP clients.

## Connect

Use the MCP URL shown in **Settings → Integrations → AI assistants (MCP)**. In production it is:

```text
https://your-central-origin.example/mcp
```

Clients supporting MCP OAuth discovery can connect with only that URL. Central advertises protected-resource and authorization-server metadata, supports Client ID Metadata Documents, and retains Dynamic Client Registration for older clients.

For Claude, add a Custom Web Connector and paste the MCP URL. If the Claude organization requires explicit credentials, a Central administrator can create a static OAuth client in Integrations settings. Register the current callback URL displayed by Claude; its commonly documented callback is `https://claude.ai/api/mcp/auth_callback`.

## Authorization

- `central:read` permits board/task/comment tools and resources.
- `central:write` also grants read access and enables task creation/update/archive/unarchive and comment creation.
- Access is always restricted by the connected Central user's existing role, board access, contractor rules, personal boards, and task assignments.
- Users can revoke a connection in Integrations settings. Administrators can revoke static clients, which invalidates every associated grant and token.
- Existing extension API tokens are not accepted by `/mcp`.

## Tools and resources

Read tools: `boards_list`, `board_get`, `tasks_list`, `tasks_search`, `tasks_list_mine`, `task_get`, and `comments_list`.

Write tools: `task_create`, `task_update`, `task_archive`, `task_unarchive`, and `comment_add`. Permanent deletion and workspace administration are intentionally unavailable.

Resources use these URI forms:

```text
central://boards
central://boards/{boardId}
central://boards/{boardId}/tasks
central://tasks/{taskId}
central://tasks/{taskId}/comments
```

## Deployment requirements

- Set `NEXT_PUBLIC_APP_URL` to the exact public origin. Production OAuth refuses to run when it is absent or not HTTPS.
- Set a strong `AUTH_SECRET`; it signs short-lived consent transactions in addition to its Auth.js use.
- Apply the generated Drizzle migration before enabling the connector.
- The same `/mcp` endpoint supports current stateless Streamable HTTP clients and legacy 2025-era MCP clients.
