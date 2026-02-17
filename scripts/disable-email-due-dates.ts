import { db } from '../src/lib/db';
import { users, teamMembers } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { UserPreferences } from '../src/lib/db/schema/users';

async function disableEmailDueDatesForNonContractors() {
  // 1. Find all contractor user IDs (users in teams with excludeFromPublic = true)
  const contractorMemberships = await db.query.teamMembers.findMany({
    with: { team: { columns: { excludeFromPublic: true } } },
  });
  const contractorUserIds = new Set(
    contractorMemberships
      .filter((tm) => tm.team.excludeFromPublic)
      .map((tm) => tm.userId)
  );

  // 2. Get all users
  const allUsers = await db.query.users.findMany({
    columns: { id: true, name: true, email: true, preferences: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const user of allUsers) {
    // Skip contractors — they keep email due date notifications
    if (contractorUserIds.has(user.id)) {
      console.log(`SKIP (contractor): ${user.name ?? user.email}`);
      skipped++;
      continue;
    }

    const prefs = user.preferences as UserPreferences | null;
    const currentValue = prefs?.notifications?.email?.dueDates;

    // Already false — nothing to do
    if (currentValue === false) {
      console.log(`SKIP (already off): ${user.name ?? user.email}`);
      skipped++;
      continue;
    }

    // Update preferences to disable email due dates
    const newPrefs: UserPreferences = {
      hiddenBoards: prefs?.hiddenBoards ?? [],
      hiddenColumns: prefs?.hiddenColumns ?? [],
      defaultView: prefs?.defaultView ?? 'table',
      ...(prefs?.hidePersonalList !== undefined && { hidePersonalList: prefs.hidePersonalList }),
      ...(prefs?.calendar && { calendar: prefs.calendar }),
      ...(prefs?.sidebar && { sidebar: prefs.sidebar }),
      notifications: {
        email: {
          enabled: prefs?.notifications?.email?.enabled ?? true,
          mentions: prefs?.notifications?.email?.mentions ?? true,
          assignments: prefs?.notifications?.email?.assignments ?? true,
          dueDates: false,
          newComments: prefs?.notifications?.email?.newComments ?? true,
          replies: prefs?.notifications?.email?.replies ?? true,
          digest: prefs?.notifications?.email?.digest ?? 'instant',
        },
        slack: prefs?.notifications?.slack ?? {
          enabled: false,
          mentions: true,
          assignments: true,
          dueDates: true,
          newComments: true,
          replies: true,
        },
        inApp: prefs?.notifications?.inApp ?? {
          enabled: true,
          mentions: true,
          assignments: true,
          dueDates: true,
          newComments: true,
          replies: true,
        },
      },
    };

    await db
      .update(users)
      .set({ preferences: newPrefs, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    console.log(`UPDATED: ${user.name ?? user.email} (was: ${currentValue ?? 'default (true)'})`);
    updated++;
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  process.exit(0);
}

disableEmailDueDatesForNonContractors().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
