import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export type OAuthScope = 'central:read' | 'central:write';
export type OAuthClientRegistrationType = 'static' | 'dynamic';
export type OAuthTokenEndpointAuthMethod =
  | 'none'
  | 'client_secret_basic'
  | 'client_secret_post';

/** Registered clients created by an administrator or RFC 7591 DCR. */
export const oauthClients = pgTable(
  'oauth_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: text('client_id').notNull().unique(),
    clientSecretHash: text('client_secret_hash'),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    clientUri: text('client_uri'),
    logoUri: text('logo_uri'),
    redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
    grantTypes: jsonb('grant_types').$type<string[]>().notNull(),
    responseTypes: jsonb('response_types').$type<string[]>().notNull(),
    tokenEndpointAuthMethod: varchar('token_endpoint_auth_method', { length: 50 })
      .$type<OAuthTokenEndpointAuthMethod>()
      .notNull(),
    applicationType: varchar('application_type', { length: 20 }).notNull().default('web'),
    registrationType: varchar('registration_type', { length: 20 })
      .$type<OAuthClientRegistrationType>()
      .notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    active: boolean('active').notNull().default(true),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('oauth_clients_registration_type_idx').on(table.registrationType)]
);

/** Validated HTTPS Client ID Metadata Documents, cached for a short period. */
export const oauthClientMetadataCache = pgTable('oauth_client_metadata_cache', {
  clientId: text('client_id').primaryKey(),
  document: jsonb('document').$type<Record<string, unknown>>().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** User consent for a client/resource pair. */
export const oauthGrants = pgTable(
  'oauth_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    resource: text('resource').notNull(),
    scopes: jsonb('scopes').$type<OAuthScope[]>().notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
  },
  (table) => [
    uniqueIndex('oauth_grants_user_client_resource_idx').on(
      table.userId,
      table.clientId,
      table.resource
    ),
    index('oauth_grants_user_idx').on(table.userId),
  ]
);

/** Five-minute, one-time authorization codes. Only the SHA-256 digest is stored. */
export const oauthAuthorizationCodes = pgTable(
  'oauth_authorization_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeHash: text('code_hash').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => oauthGrants.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    resource: text('resource').notNull(),
    scopes: jsonb('scopes').$type<OAuthScope[]>().notNull(),
    codeChallenge: text('code_challenge').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('oauth_authorization_codes_expires_idx').on(table.expiresAt)]
);

/** One-hour opaque access tokens. */
export const oauthAccessTokens = pgTable(
  'oauth_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => oauthGrants.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    resource: text('resource').notNull(),
    scopes: jsonb('scopes').$type<OAuthScope[]>().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    lastUsedAt: timestamp('last_used_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('oauth_access_tokens_user_idx').on(table.userId),
    index('oauth_access_tokens_expires_idx').on(table.expiresAt),
  ]
);

/** Rotating refresh tokens. Reuse revokes every token sharing familyId. */
export const oauthRefreshTokens = pgTable(
  'oauth_refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tokenHash: text('token_hash').notNull().unique(),
    familyId: uuid('family_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    grantId: uuid('grant_id')
      .notNull()
      .references(() => oauthGrants.id, { onDelete: 'cascade' }),
    clientId: text('client_id').notNull(),
    resource: text('resource').notNull(),
    scopes: jsonb('scopes').$type<OAuthScope[]>().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    rotatedAt: timestamp('rotated_at'),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('oauth_refresh_tokens_family_idx').on(table.familyId),
    index('oauth_refresh_tokens_expires_idx').on(table.expiresAt),
  ]
);

/** Small database-backed fixed-window limiter for unauthenticated OAuth endpoints. */
export const oauthRateLimits = pgTable(
  'oauth_rate_limits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyHash: text('key_hash').notNull(),
    bucket: varchar('bucket', { length: 40 }).notNull(),
    windowStartedAt: timestamp('window_started_at').notNull(),
    count: integer('count').notNull().default(1),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_rate_limits_key_bucket_window_idx').on(
      table.keyHash,
      table.bucket,
      table.windowStartedAt
    ),
    index('oauth_rate_limits_updated_idx').on(table.updatedAt),
  ]
);

export const oauthAuditEvents = pgTable(
  'oauth_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    clientId: text('client_id'),
    event: varchar('event', { length: 80 }).notNull(),
    toolName: varchar('tool_name', { length: 100 }),
    outcome: varchar('outcome', { length: 20 }).notNull(),
    durationMs: integer('duration_ms'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('oauth_audit_events_user_created_idx').on(table.userId, table.createdAt),
    index('oauth_audit_events_client_created_idx').on(table.clientId, table.createdAt),
  ]
);
