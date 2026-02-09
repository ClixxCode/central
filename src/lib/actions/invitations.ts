'use server';

import { db } from '@/lib/db';
import { invitations, users } from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface CreateInvitationInput {
  email: string;
  role?: 'admin' | 'user';
  teamId?: string;
  expiresInDays?: number;
}

/**
 * Create and send an invitation (admin only)
 */
export async function createInvitation(input: CreateInvitationInput): Promise<{
  success: boolean;
  invitationId?: string;
  error?: string;
}> {
  const admin = await requireAdmin();

  const { email, role = 'user', teamId, expiresInDays = 7 } = input;

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return { success: false, error: 'A user with this email already exists' };
  }

  // Check for existing pending invitation
  const existingInvitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.email, email),
      isNull(invitations.acceptedAt)
    ),
  });

  if (existingInvitation) {
    // Update existing invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await db
      .update(invitations)
      .set({
        role,
        teamId,
        expiresAt,
        invitedBy: admin.id,
      })
      .where(eq(invitations.id, existingInvitation.id));

    // Send new email
    await sendInvitationEmail(existingInvitation.id, email, admin.name ?? 'Admin');

    return { success: true, invitationId: existingInvitation.id };
  }

  // Create new invitation
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const [invitation] = await db
    .insert(invitations)
    .values({
      email,
      role,
      teamId,
      expiresAt,
      invitedBy: admin.id,
    })
    .returning();

  // Send invitation email
  await sendInvitationEmail(invitation.id, email, admin.name ?? 'Admin');

  return { success: true, invitationId: invitation.id };
}

/**
 * Send invitation email
 */
async function sendInvitationEmail(
  invitationId: string,
  email: string,
  inviterName: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const inviteUrl = `${appUrl}/invite/${invitationId}`;

  try {
    await resend.emails.send({
      from: 'Central <noreply@clix.co>',
      to: email,
      subject: `You've been invited to Central`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); padding: 30px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Central</h1>
            </div>
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none;">
              <h2 style="margin-top: 0;">You're invited!</h2>
              <p>${inviterName} has invited you to join Central.</p>
              <p>Click the button below to create your account and get started:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteUrl}" style="background: #3B82F6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                  Accept Invitation
                </a>
              </div>
              <p style="color: #6b7280; font-size: 14px;">
                This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
              <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
                Clix Digital Marketing Agency
              </p>
            </div>
          </body>
        </html>
      `,
    });
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    // Don't throw - invitation was created, just log the email error
  }
}

/**
 * Resend invitation email (admin only)
 */
export async function resendInvitation(invitationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const admin = await requireAdmin();

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
  });

  if (!invitation) {
    return { success: false, error: 'Invitation not found' };
  }

  if (invitation.acceptedAt) {
    return { success: false, error: 'Invitation has already been accepted' };
  }

  // Extend expiration
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db
    .update(invitations)
    .set({ expiresAt })
    .where(eq(invitations.id, invitationId));

  // Send email
  await sendInvitationEmail(invitationId, invitation.email, admin.name ?? 'Admin');

  return { success: true };
}

/**
 * Revoke invitation (admin only)
 */
export async function revokeInvitation(invitationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  await requireAdmin();

  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
  });

  if (!invitation) {
    return { success: false, error: 'Invitation not found' };
  }

  if (invitation.acceptedAt) {
    return { success: false, error: 'Cannot revoke an accepted invitation' };
  }

  // Set expiration to past
  await db
    .update(invitations)
    .set({ expiresAt: new Date(0) })
    .where(eq(invitations.id, invitationId));

  return { success: true };
}

/**
 * List all invitations (admin only)
 */
export async function listInvitations(): Promise<{
  id: string;
  email: string;
  role: 'admin' | 'user';
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}[]> {
  await requireAdmin();

  const allInvitations = await db.query.invitations.findMany({
    orderBy: [desc(invitations.createdAt)],
  });

  return allInvitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    status: inv.acceptedAt
      ? 'accepted'
      : inv.expiresAt < new Date()
        ? 'expired'
        : 'pending',
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
  }));
}
