'use server';

import { signIn, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { users, invitations } from '@/lib/db/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth/password';
import { isAllowedDomain } from '@/lib/auth/domains';
import { sendVerificationEmail } from './email-verification';
import { redirect } from 'next/navigation';

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle(callbackUrl?: string) {
  await signIn('google', { redirectTo: callbackUrl ?? '/my-tasks' });
}

/**
 * Sign in with email and password
 */
export async function signInWithCredentials(
  email: string,
  password: string,
  callbackUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: callbackUrl ?? '/my-tasks',
    });
    return { success: true };
  } catch (error) {
    // Auth.js throws NEXT_REDIRECT on success, which we need to rethrow
    if ((error as Error).message?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    return { success: false, error: 'Invalid email or password' };
  }
}

/**
 * Register new user with email and password
 * Requires valid invitation for non-allowed domain emails
 * Sends verification email for all credentials signups
 */
export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
  invitationId?: string;
}): Promise<{ success: boolean; error?: string; requiresVerification?: boolean }> {
  const { email, password, name, invitationId } = data;

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.errors[0] };
  }

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existingUser) {
    return { success: false, error: 'An account with this email already exists' };
  }

  // Check authorization - use configurable domain check
  const isAllowedEmail = isAllowedDomain(email);

  let newUserId: string;

  if (!isAllowedEmail) {
    // Need valid invitation
    if (!invitationId) {
      return { success: false, error: 'An invitation is required to register' };
    }

    const invitation = await db.query.invitations.findFirst({
      where: and(
        eq(invitations.id, invitationId),
        eq(invitations.email, email),
        gt(invitations.expiresAt, new Date()),
        isNull(invitations.acceptedAt)
      ),
    });

    if (!invitation) {
      return { success: false, error: 'Invalid or expired invitation' };
    }

    // Create user with invitation role (emailVerified = null)
    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        role: invitation.role,
        authProvider: 'credentials',
        // emailVerified intentionally left null
      })
      .returning({ id: users.id });

    newUserId = newUser.id;

    // Mark invitation as accepted
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitationId));
  } else {
    // Allowed domain email - auto approve (emailVerified = null)
    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash,
        role: 'user',
        authProvider: 'credentials',
        // emailVerified intentionally left null
      })
      .returning({ id: users.id });

    newUserId = newUser.id;
  }

  // Send verification email
  const verificationResult = await sendVerificationEmail(newUserId);
  if (!verificationResult.success) {
    console.error('Failed to send verification email during registration');
  }

  return { success: true, requiresVerification: true };
}

/**
 * Accept invitation and create account
 */
export async function acceptInvitation(
  invitationId: string,
  password: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  // Get invitation
  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.id, invitationId),
      gt(invitations.expiresAt, new Date()),
      isNull(invitations.acceptedAt)
    ),
  });

  if (!invitation) {
    return { success: false, error: 'Invalid or expired invitation' };
  }

  // Validate password
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    return { success: false, error: passwordValidation.errors[0] };
  }

  // Check if user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, invitation.email),
  });

  if (existingUser) {
    return { success: false, error: 'An account with this email already exists' };
  }

  // Create user (auto-verify since they followed invitation link)
  const passwordHash = await hashPassword(password);

  await db.insert(users).values({
    email: invitation.email,
    name,
    passwordHash,
    role: invitation.role,
    authProvider: 'credentials',
    emailVerified: new Date(), // Auto-verify invitation signups
  });

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitationId));

  // Add user to team if specified
  if (invitation.teamId) {
    const newUser = await db.query.users.findFirst({
      where: eq(users.email, invitation.email),
    });

    if (newUser) {
      const { teamMembers } = await import('@/lib/db/schema');
      await db.insert(teamMembers).values({
        teamId: invitation.teamId,
        userId: newUser.id,
      });
    }
  }

  return { success: true };
}

/**
 * Get invitation details by ID
 */
export async function getInvitation(invitationId: string): Promise<{
  email: string;
  role: 'admin' | 'user';
  expired: boolean;
  accepted: boolean;
} | null> {
  const invitation = await db.query.invitations.findFirst({
    where: eq(invitations.id, invitationId),
  });

  if (!invitation) {
    return null;
  }

  return {
    email: invitation.email,
    role: invitation.role,
    expired: invitation.expiresAt < new Date(),
    accepted: invitation.acceptedAt !== null,
  };
}

/**
 * Sign out current user
 */
export async function signOutUser() {
  await signOut({ redirectTo: '/login' });
}

/**
 * Check if email can register (has valid invitation or is from allowed domain)
 */
export async function canRegister(email: string): Promise<{
  allowed: boolean;
  reason?: string;
  invitationId?: string;
}> {
  // Check if email is from allowed domain
  if (isAllowedDomain(email)) {
    return { allowed: true };
  }

  // Check for valid invitation
  const invitation = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.email, email),
      gt(invitations.expiresAt, new Date()),
      isNull(invitations.acceptedAt)
    ),
  });

  if (invitation) {
    return { allowed: true, invitationId: invitation.id };
  }

  return {
    allowed: false,
    reason: 'An invitation is required to register with this email address',
  };
}
