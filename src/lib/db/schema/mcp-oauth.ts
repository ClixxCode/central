import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export type McpAuditMetadata = Record<string, unknown>;

/** OAuth clients that Central explicitly permits to connect to its MCP server. */
export const mcpOAuthClients = pgTable(
  'mcp_oauth_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: varchar('client_id', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
    allowedScopes: jsonb('allowed_scopes').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('mcp_oauth_clients_client_id_idx').on(table.clientId)]
);

/**
 * Authorization codes are intentionally stored only as SHA-256 digests. PKCE
 * is required so an intercepted code cannot be exchanged by another client.
 */
export const mcpAuthorizationCodes = pgTable(
  'mcp_authorization_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => mcpOAuthClients.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    codeChallenge: varchar('code_challenge', { length: 128 }).notNull(),
    codeChallengeMethod: varchar('code_challenge_method', { length: 10 }).notNull().default('S256'),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('mcp_authorization_codes_code_hash_idx').on(table.codeHash),
    index('mcp_authorization_codes_client_expires_idx').on(table.clientId, table.expiresAt),
  ]
);

/** OAuth bearer tokens are stored as hashes and can be revoked without deletion. */
export const mcpAccessTokens = pgTable(
  'mcp_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => mcpOAuthClients.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date' }),
    lastUsedAt: timestamp('last_used_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('mcp_access_tokens_token_hash_idx').on(table.tokenHash),
    index('mcp_access_tokens_user_client_idx').on(table.userId, table.clientId),
  ]
);

/**
 * Long-lived refresh credentials. A token family lets the service revoke every
 * descendant if an already-rotated token is presented again.
 */
export const mcpRefreshTokens = pgTable(
  'mcp_refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    familyId: uuid('family_id').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => mcpOAuthClients.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull(),
    expiresAt: timestamp('expires_at', { mode: 'date' }).notNull(),
    revokedAt: timestamp('revoked_at', { mode: 'date' }),
    rotatedAt: timestamp('rotated_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('mcp_refresh_tokens_token_hash_idx').on(table.tokenHash),
    index('mcp_refresh_tokens_family_idx').on(table.familyId),
    index('mcp_refresh_tokens_user_client_idx').on(table.userId, table.clientId),
  ]
);

/** Immutable security and tool-use activity for the Central MCP integration. */
export const mcpAuditEvents = pgTable(
  'mcp_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    clientId: uuid('client_id').references(() => mcpOAuthClients.id, { onDelete: 'set null' }),
    accessTokenId: uuid('access_token_id').references(() => mcpAccessTokens.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    toolName: varchar('tool_name', { length: 255 }),
    resourceType: varchar('resource_type', { length: 100 }),
    resourceId: varchar('resource_id', { length: 255 }),
    metadata: jsonb('metadata').$type<McpAuditMetadata>().notNull().default({}),
    createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('mcp_audit_events_user_created_idx').on(table.userId, table.createdAt),
    index('mcp_audit_events_client_created_idx').on(table.clientId, table.createdAt),
    index('mcp_audit_events_event_created_idx').on(table.eventType, table.createdAt),
  ]
);
