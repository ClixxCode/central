export const OAUTH_SCOPES = ['central:read', 'central:write'] as const;
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const AUTHORIZATION_CODE_TTL_SECONDS = 5 * 60;

function configuredOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL is required for OAuth in production');
  }
  return 'http://localhost:3000';
}

export function oauthIssuer(): string {
  const value = configuredOrigin();
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS for OAuth in production');
  }
  return url.origin;
}

export function mcpResourceUrl(): string {
  return `${oauthIssuer()}/mcp`;
}

export function protectedResourceMetadataUrl(): string {
  return `${oauthIssuer()}/.well-known/oauth-protected-resource/mcp`;
}

export function oauthAuthorizationServerMetadata() {
  const issuer = oauthIssuer();
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    scopes_supported: [...OAUTH_SCOPES],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: [
      'none',
      'client_secret_basic',
      'client_secret_post',
    ],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

export function oauthProtectedResourceMetadata() {
  return {
    resource: mcpResourceUrl(),
    authorization_servers: [oauthIssuer()],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ['header'],
    resource_name: 'Central MCP',
  };
}
