'use server';

import { db } from '@/lib/db';
import { users, teamMembers } from '@/lib/db/schema';
import type { UserPreferences, SavedTaskFilters } from '@/lib/db/schema/users';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  hiddenBoards: [],
  hiddenColumns: [],
  defaultView: 'table',
  notifications: {
    email: {
      enabled: true,
      mentions: true,
      assignments: true,
      dueDates: true,
      newComments: true,
      replies: true,
      digest: 'instant',
    },
    slack: {
      enabled: false,
      mentions: true,
      assignments: true,
      dueDates: true,
      newComments: true,
      replies: true,
    },
    inApp: {
      enabled: true,
      mentions: true,
      assignments: true,
      dueDates: false,
      newComments: true,
      replies: true,
    },
  },
};

/**
 * Get current user's preferences
 */
export async function getUserPreferences(): Promise<{
  success: boolean;
  preferences?: UserPreferences;
  isContractor?: boolean;
  error?: string;
}> {
  const user = await requireAuth();

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return { success: false, error: 'User not found' };
  }

  // Check if user is in a contractor team (excludeFromPublic = true)
  const userTeams = await db.query.teamMembers.findMany({
    where: eq(teamMembers.userId, user.id),
    with: { team: { columns: { excludeFromPublic: true } } },
  });
  const isContractor = userTeams.some((tm) => tm.team.excludeFromPublic);

  // Merge with defaults to ensure all fields exist
  const preferences = mergeWithDefaults(dbUser.preferences as UserPreferences | null);

  return { success: true, preferences, isContractor };
}

/**
 * Update email notification preferences
 */
export async function updateEmailPreferences(input: {
  enabled?: boolean;
  mentions?: boolean;
  assignments?: boolean;
  dueDates?: boolean;
  newComments?: boolean;
  replies?: boolean;
  digest?: 'instant' | 'daily' | 'weekly' | 'none';
}): Promise<{
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}> {
  const user = await requireAuth();

  // Get current preferences
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return { success: false, error: 'User not found' };
  }

  const currentPrefs = mergeWithDefaults(dbUser.preferences as UserPreferences | null);

  // Update email preferences
  const newPrefs: UserPreferences = {
    ...currentPrefs,
    notifications: {
      ...currentPrefs.notifications,
      email: {
        ...currentPrefs.notifications.email,
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.mentions !== undefined && { mentions: input.mentions }),
        ...(input.assignments !== undefined && { assignments: input.assignments }),
        ...(input.dueDates !== undefined && { dueDates: input.dueDates }),
        ...(input.newComments !== undefined && { newComments: input.newComments }),
        ...(input.replies !== undefined && { replies: input.replies }),
        ...(input.digest !== undefined && { digest: input.digest }),
      },
    },
  };

  // Save to database
  await db
    .update(users)
    .set({
      preferences: newPrefs,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath('/settings/notifications');

  return { success: true, preferences: newPrefs };
}

/**
 * Update Slack notification preferences
 */
export async function updateSlackPreferences(input: {
  enabled?: boolean;
  slackUsername?: string;
  slackLinkType?: 'web' | 'app';
  mentions?: boolean;
  assignments?: boolean;
  dueDates?: boolean;
  newComments?: boolean;
  replies?: boolean;
}): Promise<{
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}> {
  const user = await requireAuth();

  // Get current preferences
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return { success: false, error: 'User not found' };
  }

  const currentPrefs = mergeWithDefaults(dbUser.preferences as UserPreferences | null);

  // Update Slack preferences
  const newPrefs: UserPreferences = {
    ...currentPrefs,
    notifications: {
      ...currentPrefs.notifications,
      slack: {
        ...currentPrefs.notifications.slack,
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.slackUsername !== undefined && { slackUsername: input.slackUsername }),
        ...(input.slackLinkType !== undefined && { slackLinkType: input.slackLinkType }),
        ...(input.mentions !== undefined && { mentions: input.mentions }),
        ...(input.assignments !== undefined && { assignments: input.assignments }),
        ...(input.dueDates !== undefined && { dueDates: input.dueDates }),
        ...(input.newComments !== undefined && { newComments: input.newComments }),
        ...(input.replies !== undefined && { replies: input.replies }),
      },
    },
  };

  // Save to database
  await db
    .update(users)
    .set({
      preferences: newPrefs,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath('/settings/notifications');

  return { success: true, preferences: newPrefs };
}

/**
 * Update in-app notification preferences
 */
export async function updateInAppPreferences(input: {
  enabled?: boolean;
  mentions?: boolean;
  assignments?: boolean;
  dueDates?: boolean;
  newComments?: boolean;
  replies?: boolean;
}): Promise<{
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}> {
  const user = await requireAuth();

  // Get current preferences
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return { success: false, error: 'User not found' };
  }

  const currentPrefs = mergeWithDefaults(dbUser.preferences as UserPreferences | null);

  // Update in-app preferences
  const newPrefs: UserPreferences = {
    ...currentPrefs,
    notifications: {
      ...currentPrefs.notifications,
      inApp: {
        ...currentPrefs.notifications.inApp,
        ...(input.enabled !== undefined && { enabled: input.enabled }),
        ...(input.mentions !== undefined && { mentions: input.mentions }),
        ...(input.assignments !== undefined && { assignments: input.assignments }),
        ...(input.dueDates !== undefined && { dueDates: input.dueDates }),
        ...(input.newComments !== undefined && { newComments: input.newComments }),
        ...(input.replies !== undefined && { replies: input.replies }),
      },
    },
  };

  // Save to database
  await db
    .update(users)
    .set({
      preferences: newPrefs,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath('/settings/notifications');

  return { success: true, preferences: newPrefs };
}

/**
 * Toggle in-app notifications (convenience function)
 */
export async function toggleInAppNotifications(enabled: boolean): Promise<{
  success: boolean;
  error?: string;
}> {
  return updateInAppPreferences({ enabled });
}

/**
 * Update personal list visibility preference
 */
export async function updatePersonalListVisibility(hidden: boolean): Promise<{
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}> {
  const user = await requireAuth();

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return { success: false, error: 'User not found' };
  }

  const currentPrefs = mergeWithDefaults(dbUser.preferences as UserPreferences | null);
  const newPrefs: UserPreferences = {
    ...currentPrefs,
    hidePersonalList: hidden,
  };

  await db
    .update(users)
    .set({ preferences: newPrefs, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath('/my-tasks');
  revalidatePath('/settings/profile');

  return { success: true, preferences: newPrefs };
}

/**
 * Update sidebar display preferences
 */
export async function updateSidebarPreferences(input: {
  hiddenNavItems?: string[];
  navOrder?: string[];
}): Promise<{
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}> {
  const user = await requireAuth();

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return { success: false, error: 'User not found' };
  }

  const currentPrefs = mergeWithDefaults(dbUser.preferences as UserPreferences | null);
  const newPrefs: UserPreferences = {
    ...currentPrefs,
    sidebar: {
      ...currentPrefs.sidebar,
      ...(input.hiddenNavItems !== undefined && { hiddenNavItems: input.hiddenNavItems }),
      ...(input.navOrder !== undefined && { navOrder: input.navOrder }),
    },
  };

  await db
    .update(users)
    .set({ preferences: newPrefs, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return { success: true, preferences: newPrefs };
}

/**
 * Update calendar display preferences
 */
export async function updateCalendarPreferences(input: {
  showScheduleInSidebar?: boolean;
  showEventsInMyWork?: boolean;
}): Promise<{
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}> {
  const user = await requireAuth();

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return { success: false, error: 'User not found' };
  }

  const currentPrefs = mergeWithDefaults(dbUser.preferences as UserPreferences | null);
  const newPrefs: UserPreferences = {
    ...currentPrefs,
    calendar: {
      ...currentPrefs.calendar,
      ...(input.showScheduleInSidebar !== undefined && { showScheduleInSidebar: input.showScheduleInSidebar }),
      ...(input.showEventsInMyWork !== undefined && { showEventsInMyWork: input.showEventsInMyWork }),
    },
  };

  await db
    .update(users)
    .set({ preferences: newPrefs, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath('/my-tasks');
  revalidatePath('/settings/integrations');

  return { success: true, preferences: newPrefs };
}

/**
 * Update My Work page preferences (boards, card items, filters, today's events)
 */
export async function updateMyWorkPreferences(input: {
  hiddenBoards?: string[];
  hiddenColumns?: string[];
  myWorkFilters?: SavedTaskFilters;
  personalTaskFilters?: SavedTaskFilters;
  todaysEvents?: { collapsed?: boolean; minimized?: boolean };
  priorityTaskIds?: string[];
}): Promise<{
  success: boolean;
  error?: string;
}> {
  const user = await requireAuth();

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { preferences: true },
  });

  if (!dbUser) {
    return { success: false, error: 'User not found' };
  }

  const currentPrefs = mergeWithDefaults(dbUser.preferences as UserPreferences | null);
  const newPrefs: UserPreferences = {
    ...currentPrefs,
    ...(input.hiddenBoards !== undefined && { hiddenBoards: input.hiddenBoards }),
    ...(input.hiddenColumns !== undefined && { hiddenColumns: input.hiddenColumns }),
    ...(input.myWorkFilters !== undefined && { myWorkFilters: input.myWorkFilters }),
    ...(input.personalTaskFilters !== undefined && { personalTaskFilters: input.personalTaskFilters }),
    ...(input.todaysEvents !== undefined && {
      todaysEvents: { ...currentPrefs.todaysEvents, ...input.todaysEvents },
    }),
    ...(input.priorityTaskIds !== undefined && { priorityTaskIds: input.priorityTaskIds }),
  };

  await db
    .update(users)
    .set({ preferences: newPrefs, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return { success: true };
}

/**
 * Merge preferences with defaults to ensure all fields exist
 */
function mergeWithDefaults(prefs: UserPreferences | null): UserPreferences {
  if (!prefs) {
    return DEFAULT_PREFERENCES;
  }

  return {
    hiddenBoards: prefs.hiddenBoards ?? DEFAULT_PREFERENCES.hiddenBoards,
    hiddenColumns: prefs.hiddenColumns ?? DEFAULT_PREFERENCES.hiddenColumns,
    defaultView: prefs.defaultView ?? DEFAULT_PREFERENCES.defaultView,
    hidePersonalList: prefs.hidePersonalList ?? false,
    priorityTaskIds: prefs.priorityTaskIds ?? [],
    myWorkFilters: prefs.myWorkFilters,
    personalTaskFilters: prefs.personalTaskFilters,
    todaysEvents: prefs.todaysEvents,
    calendar: {
      showScheduleInSidebar: prefs.calendar?.showScheduleInSidebar ?? false,
      showEventsInMyWork: prefs.calendar?.showEventsInMyWork ?? true,
    },
    sidebar: {
      hiddenNavItems: prefs.sidebar?.hiddenNavItems ?? [],
      navOrder: prefs.sidebar?.navOrder ?? [],
    },
    notifications: {
      email: {
        enabled: prefs.notifications?.email?.enabled ?? DEFAULT_PREFERENCES.notifications.email.enabled,
        mentions: prefs.notifications?.email?.mentions ?? DEFAULT_PREFERENCES.notifications.email.mentions,
        assignments: prefs.notifications?.email?.assignments ?? DEFAULT_PREFERENCES.notifications.email.assignments,
        dueDates: prefs.notifications?.email?.dueDates ?? DEFAULT_PREFERENCES.notifications.email.dueDates,
        newComments: prefs.notifications?.email?.newComments ?? DEFAULT_PREFERENCES.notifications.email.newComments,
        replies: prefs.notifications?.email?.replies ?? DEFAULT_PREFERENCES.notifications.email.replies,
        digest: prefs.notifications?.email?.digest ?? DEFAULT_PREFERENCES.notifications.email.digest,
      },
      slack: {
        enabled: prefs.notifications?.slack?.enabled ?? DEFAULT_PREFERENCES.notifications.slack.enabled,
        slackUsername: prefs.notifications?.slack?.slackUsername,
        slackLinkType: prefs.notifications?.slack?.slackLinkType,
        mentions: prefs.notifications?.slack?.mentions ?? DEFAULT_PREFERENCES.notifications.slack.mentions,
        assignments: prefs.notifications?.slack?.assignments ?? DEFAULT_PREFERENCES.notifications.slack.assignments,
        dueDates: prefs.notifications?.slack?.dueDates ?? DEFAULT_PREFERENCES.notifications.slack.dueDates,
        newComments: prefs.notifications?.slack?.newComments ?? DEFAULT_PREFERENCES.notifications.slack.newComments,
        replies: prefs.notifications?.slack?.replies ?? DEFAULT_PREFERENCES.notifications.slack.replies,
      },
      inApp: {
        enabled: prefs.notifications?.inApp?.enabled ?? DEFAULT_PREFERENCES.notifications.inApp.enabled,
        mentions: prefs.notifications?.inApp?.mentions ?? DEFAULT_PREFERENCES.notifications.inApp.mentions,
        assignments: prefs.notifications?.inApp?.assignments ?? DEFAULT_PREFERENCES.notifications.inApp.assignments,
        dueDates: prefs.notifications?.inApp?.dueDates ?? DEFAULT_PREFERENCES.notifications.inApp.dueDates,
        newComments: prefs.notifications?.inApp?.newComments ?? DEFAULT_PREFERENCES.notifications.inApp.newComments,
        replies: prefs.notifications?.inApp?.replies ?? DEFAULT_PREFERENCES.notifications.inApp.replies,
      },
    },
  };
}
