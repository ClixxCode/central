import { NextRequest, NextResponse } from 'next/server';
import { requireTokenAuth } from '@/lib/extension/auth';
import { corsHeaders, handlePreflight } from '@/lib/extension/cors';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UserPreferences } from '@/lib/db/schema/users';

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request);
}

// POST: Toggle a task's priority status
// Body: { taskId: string }
// Returns: { priorityTaskIds: string[] }
export async function POST(request: NextRequest) {
  const headers = corsHeaders(request);

  const user = await requireTokenAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  }

  let body: { taskId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }

  if (!body.taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400, headers });
  }

  // Get current preferences
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404, headers });
  }

  const prefs = (dbUser.preferences as UserPreferences) ?? {};
  const currentIds: string[] = prefs.priorityTaskIds ?? [];

  // Toggle: add if not present, remove if present
  const newIds = currentIds.includes(body.taskId)
    ? currentIds.filter((id) => id !== body.taskId)
    : [...currentIds, body.taskId];

  const newPrefs: UserPreferences = {
    ...prefs,
    priorityTaskIds: newIds,
  };

  await db
    .update(users)
    .set({ preferences: newPrefs })
    .where(eq(users.id, user.id));

  return NextResponse.json({ priorityTaskIds: newIds }, { headers });
}
