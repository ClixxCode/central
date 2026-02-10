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
    <p style="margin: 0 0 16px; color: #f5f5f5;">${greeting}</p>
    <p style="margin: 0 0 16px; color: #d0d0d5;">
      ${adminName} has sent you a link to reset your password for Central.
      Use the button below to set a new password and access your account.
    </p>
    <p style="margin: 0 0 24px; text-align: center;">
      ${emailButton('Reset Password', resetUrl)}
    </p>
    <p style="margin: 0 0 16px; color: #a0a0a8; font-size: 14px;">
      This link will expire in 24 hours. If you didn't expect this email,
      please contact your administrator.
    </p>
    <p style="margin: 0; color: #6b6b74; font-size: 13px;">
      If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${resetUrl}" style="color: #7c8fff; word-break: break-all;">${resetUrl}</a>
    </p>
  `;

  return {
    subject: 'Reset your password for Central',
    html: baseEmailTemplate(content, `${adminName} has sent you a password reset link`),
  };
}
