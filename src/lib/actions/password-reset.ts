'use server';

import { db } from '@/lib/db';
import { passwordResetTokens, users } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { resend, EMAIL_CONFIG, getAppUrl } from '@/lib/email/client';
import { adminPasswordResetTemplate } from '@/lib/email/templates/password-reset';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { randomBytes } from 'crypto';

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Admin-initiated: send a password reset link to an existing user
 */
export async function sendPasswordResetLink(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const admin = await requireAdmin();

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Delete any existing reset tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    // Generate new token with 24h expiry
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    });

    // Build reset URL
    const resetUrl = `${getAppUrl()}/reset-password?token=${token}`;

    // Send email
    const emailContent = await adminPasswordResetTemplate({
      name: user.name ?? undefined,
      adminName: admin.name ?? 'An administrator',
      resetUrl,
    });

    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset link:', error);
    return { success: false, error: 'Failed to send password reset email' };
  }
}

/**
 * Reset password using a valid token
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Validate password strength
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return { success: false, error: validation.errors[0] };
    }

    // Find valid token
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, token),
        gt(passwordResetTokens.expiresAt, new Date())
      ),
    });

    if (!resetToken) {
      return { success: false, error: 'Invalid or expired reset link' };
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);

    await db
      .update(users)
      .set({
        passwordHash,
        emailVerified: new Date(), // Ensure email is marked as verified
        updatedAt: new Date(),
      })
      .where(eq(users.id, resetToken.userId));

    // Delete the token
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, resetToken.id));

    return { success: true };
  } catch (error) {
    console.error('Failed to reset password:', error);
    return { success: false, error: 'Failed to reset password' };
  }
}

/**
 * Validate a reset token (public, for the reset page to check before showing the form)
 */
export async function validateResetToken(token: string): Promise<{
  valid: boolean;
  email?: string;
}> {
  const resetToken = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.token, token),
      gt(passwordResetTokens.expiresAt, new Date())
    ),
    with: {
      user: {
        columns: { email: true },
      },
    },
  });

  if (!resetToken) {
    return { valid: false };
  }

  return { valid: true, email: resetToken.user.email };
}
