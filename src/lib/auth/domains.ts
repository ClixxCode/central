/**
 * Check if an email address is from an allowed domain
 *
 * Configurable via ALLOWED_EMAIL_DOMAINS environment variable.
 * Multiple domains can be comma-separated (e.g., "clix.co,example.com")
 *
 * If ALLOWED_EMAIL_DOMAINS is not set or empty, returns false (no domains allowed)
 */
export function isAllowedDomain(email: string): boolean {
  const domainsEnv = process.env.ALLOWED_EMAIL_DOMAINS || '';

  const domains = domainsEnv
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  // If no domains configured, deny all
  if (domains.length === 0) {
    return false;
  }

  const emailDomain = email.split('@')[1]?.toLowerCase();

  if (!emailDomain) {
    return false;
  }

  return domains.includes(emailDomain);
}

/**
 * Get the list of allowed email domains
 * Used for displaying to users in error messages
 */
export function getAllowedDomains(): string[] {
  const domainsEnv = process.env.ALLOWED_EMAIL_DOMAINS || '';

  return domainsEnv
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}
