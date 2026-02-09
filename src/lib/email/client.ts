import { Resend } from 'resend';

// Singleton Resend client
export const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
export const EMAIL_CONFIG = {
  from: 'Central <noreply@clix.co>',
  replyTo: 'support@clix.co',
} as const;

// Base app URL for links in emails
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
