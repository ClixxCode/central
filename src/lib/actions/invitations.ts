'use server';

import { db } from '@/lib/db';
import { invitations, users } from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/session';
import { getAppUrl } from '@/lib/email/client';
import { sendCentralTemplateEmail } from '@/lib/email/send-template';
import { CENTRAL_EMAIL_TEMPLATE_ALIASES } from '@/lib/email/templates';

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
  const inviteUrl = `${getAppUrl()}/invite/${invitationId}`;

  try {
    await sendCentralTemplateEmail({
      templateAlias: CENTRAL_EMAIL_TEMPLATE_ALIASES.invitation,
      to: email,
      subject: `You've been invited to Central`,
      variables: {
        INVITER_NAME: inviterName,
        INVITE_URL: inviteUrl,
      },
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
  teamId: string | null;
  teamName: string | null;
  status: 'pending' | 'accepted' | 'expired';
  createdAt: Date;
  expiresAt: Date;
}[]> {
  await requireAdmin();

  const allInvitations = await db.query.invitations.findMany({
    with: {
      team: true,
    },
    orderBy: [desc(invitations.createdAt)],
  });

  return allInvitations.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    teamId: inv.teamId,
    teamName: inv.team?.name ?? null,
    status: inv.acceptedAt
      ? 'accepted'
      : inv.expiresAt < new Date()
        ? 'expired'
        : 'pending',
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
  }));
}
