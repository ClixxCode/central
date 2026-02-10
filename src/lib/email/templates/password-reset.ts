import { baseEmailTemplate, emailButton } from './base';

/**
 * Admin-initiated password reset email template
 * Sent when an admin triggers a password reset for an existing user
 */
export function adminPasswordResetTemplate(params: {
  name?: string;
  adminName: string;
  resetUrl: string;
}): { subject: string; html: string } {
  const { name, adminName, resetUrl } = params;
  const greeting = name ? `Hi ${name},` : 'Hi,';

  const content = `
    <p style="margin: 0 0 16px;">${greeting}</p>
    <p style="margin: 0 0 16px;">
      ${adminName} has sent you a link to reset your password for Central.
      Use the button below to set a new password and access your account.
    </p>
    <p style="margin: 0 0 24px; text-align: center;">
      ${emailButton('Reset Password', resetUrl)}
    </p>
    <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
      This link will expire in 24 hours. If you didn't expect this email,
      please contact your administrator.
    </p>
    <p style="margin: 0; color: #9ca3af; font-size: 13px;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
    </p>
  `;

  return {
    subject: 'Reset your password for Central',
    html: baseEmailTemplate(content, `${adminName} has sent you a password reset link`),
  };
}
