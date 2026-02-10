'use server';

import { db } from '@/lib/db';
import { emailVerificationTokens, users } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { resend, EMAIL_CONFIG, getAppUrl } from '@/lib/email/client';
import { emailVerificationTemplate } from '@/lib/email/templates/email-verification';
import { randomBytes } from 'crypto';

/**
 * Generate a secure verification token
 */
function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Create and send a verification email to a user
 */
export async function sendVerificationEmail(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.emailVerified) {
      return { success: false, error: 'Email already verified' };
    }

    // Delete any existing tokens for this user
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId));

    // Generate new token with 24h expiry
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insert(emailVerificationTokens).values({
      userId,
      token,
      expiresAt,
    });

    // Build verification URL
    const verificationUrl = `${getAppUrl()}/verify-email?token=${token}`;

    // Send email
    const emailContent = await emailVerificationTemplate({
      name: user.name ?? undefined,
      verificationUrl,
    });

    await resend.emails.send({
      from: EMAIL_CONFIG.from,
      to: user.email,
      subject: emailContent.subject,
      html: emailContent.html,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return { success: false, error: 'Failed to send verification email' };
  }
}

/**
 * Verify a user's email using a token
 */
export async function verifyEmail(token: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Find valid token
    const verificationToken = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.token, token),
        gt(emailVerificationTokens.expiresAt, new Date())
      ),
    });

    if (!verificationToken) {
      return { success: false, error: 'Invalid or expired verification link' };
    }

    // Mark user as verified
    await db
      .update(users)
      .set({ emailVerified: new Date() })
      .where(eq(users.id, verificationToken.userId));

    // Delete the token
    await db
      .delete(emailVerificationTokens)
      .where(eq(emailVerificationTokens.id, verificationToken.id));

    return { success: true };
  } catch (error) {
    console.error('Failed to verify email:', error);
    return { success: false, error: 'Failed to verify email' };
  }
}

/**
 * Resend verification email to a user by email address
 */
export async function resendVerificationEmail(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Find user
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      // Don't reveal whether email exists
      return { success: true };
    }

    if (user.emailVerified) {
      // Already verified, still return success to not reveal state
      return { success: true };
    }

    // Send verification email
    return await sendVerificationEmail(user.id);
  } catch (error) {
    console.error('Failed to resend verification email:', error);
    return { success: false, error: 'Failed to resend verification email' };
  }
}
