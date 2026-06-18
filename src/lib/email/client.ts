import { Resend } from 'resend';

// Singleton Resend client
let resendClient: Resend | null = null;

export function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required to send email.');
  }

  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export const resend = new Proxy({} as Resend, {
  get(_target, property, receiver) {
    return Reflect.get(getResendClient(), property, receiver);
  },
});

// Email configuration
const emailFromConfig = resolveEmailFromConfig(process.env);

export const EMAIL_CONFIG = {
  from: emailFromConfig.from,
  replyTo: emailFromConfig.replyTo,
};

export function resolveEmailFromConfig(env: Partial<NodeJS.ProcessEnv>): {
  from: string;
  replyTo: string;
} {
  const fromName = env.EMAIL_FROM_NAME ?? 'Central';
  const fallbackFromEmail =
    env.EMAIL_FROM_ADDRESS ??
    (env.EMAIL_DOMAIN ? `noreply@${normalizeEmailDomainHost(env.EMAIL_DOMAIN)}` : 'noreply@clix.co');
  const from = env.EMAIL_FROM?.trim() || `${fromName} <${fallbackFromEmail}>`;

  return {
    from,
    replyTo: env.EMAIL_REPLY_TO ?? extractEmailAddress(from) ?? fallbackFromEmail,
  };
}

export function extractEmailAddress(value: string): string | null {
  const match = value.match(/<([^>]+)>/);
  return (match?.[1] ?? value).trim() || null;
}

// Base app URL for links in emails
export function getAppUrl(): string {
  return normalizeEmailBaseUrl(
    process.env.EMAIL_DOMAIN ??
      process.env.NEXT_PUBLIC_APP_URL ??
      'http://localhost:3000'
  );
}

export function normalizeEmailBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function normalizeEmailDomainHost(value: string): string {
  return new URL(normalizeEmailBaseUrl(value)).host;
}
