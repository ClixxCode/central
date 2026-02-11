'use server';

import { getCurrentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { isNull } from 'drizzle-orm';
import {
  getCalendarConnection,
  getValidGoogleToken,
  revokeGoogleToken,
} from '@/lib/google-calendar/token';
import {
  fetchTodaysEvents,
  fetchFreeBusy,
  createEvent,
  type CalendarEvent,
  type FreeBusyResult,
  type CreateEventInput,
} from '@/lib/google-calendar/api';

export async function getCalendarConnectionStatus(): Promise<{
  connected: boolean;
  email?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { connected: false };

  const connection = await getCalendarConnection(user.id);
  if (!connection) return { connected: false };

  return { connected: true, email: connection.email };
}

export async function getTodaysEvents(timeZone: string): Promise<
  | { connected: false }
  | { connected: true; events: CalendarEvent[] }
> {
  const user = await getCurrentUser();
  if (!user) return { connected: false };

  const token = await getValidGoogleToken(user.id);
  if (!token) return { connected: false };

  try {
    const events = await fetchTodaysEvents(token, timeZone);
    return { connected: true, events };
  } catch (error) {
    console.error('Failed to fetch today\'s events:', error);
    // If Google returns auth error, token may have been revoked
    const message = error instanceof Error ? error.message : '';
    if (message.includes('401') || message.includes('403')) {
      return { connected: false };
    }
    return { connected: true, events: [] };
  }
}

export async function disconnectGoogleCalendar(): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await revokeGoogleToken(user.id);
  return { success: true };
}

export async function getTeamAvailability(input: {
  emails: string[];
  timeMin: string;
  timeMax: string;
  timeZone: string;
}): Promise<{ success: boolean; data?: FreeBusyResult; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const token = await getValidGoogleToken(user.id);
  if (!token) return { success: false, error: 'Calendar not connected' };

  try {
    const result = await fetchFreeBusy(
      token,
      input.emails,
      input.timeMin,
      input.timeMax,
      input.timeZone
    );
    console.log('[freeBusy] request:', { emails: input.emails, timeMin: input.timeMin, timeMax: input.timeMax, timeZone: input.timeZone });
    console.log('[freeBusy] response:', JSON.stringify(result, null, 2));
    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch availability:', error);
    return { success: false, error: 'Failed to check availability' };
  }
}

export interface HoldInput {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  timeZone: string;
  attendeeEmails: string[];
}

export async function createCalendarHolds(input: {
  holds: HoldInput[];
}): Promise<{ success: boolean; created: number; errors: string[] }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, created: 0, errors: ['Not authenticated'] };

  const token = await getValidGoogleToken(user.id);
  if (!token) return { success: false, created: 0, errors: ['Calendar not connected'] };

  let created = 0;
  const errors: string[] = [];

  for (const hold of input.holds) {
    try {
      const event: CreateEventInput = {
        summary: hold.title || 'Hold',
        description: hold.description,
        start: { dateTime: hold.startTime, timeZone: hold.timeZone },
        end: { dateTime: hold.endTime, timeZone: hold.timeZone },
        attendees: hold.attendeeEmails.map((email) => ({ email })),
      };
      await createEvent(token, event);
      created++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to create "${hold.title}": ${message}`);
    }
  }

  return { success: errors.length === 0, created, errors };
}

export async function listAllUsers(): Promise<{
  success: boolean;
  data?: { id: string; name: string | null; email: string; avatarUrl: string | null }[];
}> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(isNull(users.deactivatedAt));

  return { success: true, data: allUsers };
}
