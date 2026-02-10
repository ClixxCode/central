import { Resend } from 'resend';

// Singleton Resend client
export const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration
const fromName = process.env.EMAIL_FROM_NAME ?? 'Central';
const fromEmail = process.env.EMAIL_FROM_ADDRESS ?? 'noreply@clix.co';

export const EMAIL_CONFIG = {
  from: `${fromName} <${fromEmail}>` as const,
  replyTo: process.env.EMAIL_REPLY_TO ?? fromEmail,
};

// Base app URL for links in emails
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
