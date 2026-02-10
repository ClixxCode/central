import { getAppUrl } from '../client';
import { baseEmailTemplate, emailButton } from './base';

/**
 * Email verification template
 * Sent when a user registers with email/password
 */
export function emailVerificationTemplate(params: {
  name?: string;
  verificationUrl: string;
}): { subject: string; html: string } {
  const { name, verificationUrl } = params;
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const content = `
    <p style="margin: 0 0 16px; color: #f5f5f5;">${greeting}</p>
    <p style="margin: 0 0 16px; color: #d0d0d5;">
      Welcome to Central! Please verify your email address to complete your registration
      and start managing your projects.
    </p>
    <p style="margin: 0 0 24px; text-align: center;">
      ${emailButton('Verify Email', verificationUrl)}
    </p>
    <p style="margin: 0 0 16px; color: #a0a0a8; font-size: 14px;">
      This link will expire in 24 hours. If you didn't create an account with Central,
      you can safely ignore this email.
    </p>
    <p style="margin: 0; color: #6b6b74; font-size: 13px;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${verificationUrl}" style="color: #C4959C; word-break: break-all;">${verificationUrl}</a>
    </p>
  `;

  return {
    subject: 'Verify your email for Central',
    html: baseEmailTemplate(content, 'Please verify your email to complete registration'),
  };
}

/**
 * Email verification success template
 * Optional: sent after successful verification
 */
export function emailVerifiedTemplate(params: {
  name?: string;
}): { subject: string; html: string } {
  const { name } = params;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const loginUrl = `${getAppUrl()}/login`;

  const content = `
    <p style="margin: 0 0 16px; color: #f5f5f5;">${greeting}</p>
    <p style="margin: 0 0 16px; color: #d0d0d5;">
      Your email has been verified successfully! You can now sign in to Central
      and start managing your projects.
    </p>
    <p style="margin: 0 0 24px; text-align: center;">
      ${emailButton('Sign In', loginUrl)}
    </p>
    <p style="margin: 0; color: #a0a0a8; font-size: 14px;">
      Welcome to the team!
    </p>
  `;

  return {
    subject: 'Email verified - Welcome to Central',
    html: baseEmailTemplate(content, 'Your email has been verified'),
  };
}
