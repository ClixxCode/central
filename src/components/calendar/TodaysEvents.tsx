'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Maximize2,
  Minimize2,
  Users,
  Video,
} from 'lucide-react';
import { useTodaysEvents, useAllUsers, useCurrentUser } from '@/lib/hooks';
import { useMyWorkPreferences } from '@/lib/hooks/useMyWorkPreferences';
import { getMeetingLink } from '@/lib/google-calendar/api';
import type { CalendarEvent } from '@/lib/google-calendar/api';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback, AvatarGroup } from '@/components/ui/avatar';

function getInitials(nameOrEmail: string): string {
  if (nameOrEmail.includes('@')) return nameOrEmail.charAt(0).toUpperCase();
  const words = nameOrEmail.split(' ').filter(Boolean);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}


function formatEventTime(dateTime?: string, date?: string): string {
  if (date) return 'All day';
  if (!dateTime) return '';
  return new Date(dateTime).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeRange(
  start: { dateTime?: string; date?: string },
  end: { dateTime?: string; date?: string }
): string {
  if (start.date) return 'All day';
  return `${formatEventTime(start.dateTime)} – ${formatEventTime(end.dateTime)}`;
}

function isCurrentEvent(start: { dateTime?: string; date?: string }, end: { dateTime?: string; date?: string }): boolean {
  if (start.date) return true; // all-day events are always "current"
  const now = Date.now();
  const startMs = start.dateTime ? new Date(start.dateTime).getTime() : 0;
  const endMs = end.dateTime ? new Date(end.dateTime).getTime() : 0;
  return now >= startMs && now < endMs;
}

type OrgUser = { id: string; name: string | null; email: string; avatarUrl: string | null };

const INTERNAL_GROUP_EMAIL = 'internal@clix.co';

function EventAttendees({
  attendees,
  usersByEmail,
  allUsers,
  currentUserEmail,
}: {
  attendees: NonNullable<CalendarEvent['attendees']>;
  usersByEmail: Map<string, OrgUser>;
  allUsers: OrgUser[];
  currentUserEmail?: string;
}) {
  const MAX_AVATARS = 3;

  const hasInternalGroup = attendees.some(
    (a) => a.email.toLowerCase() === INTERNAL_GROUP_EMAIL
  );

  const { orgAttendees, totalOthers } = useMemo(() => {
    if (hasInternalGroup) {
      // Expand internal group to all org users, merged with individual attendees, deduplicated
      const allOthers = allUsers.filter(
        (u) => u.email.toLowerCase() !== currentUserEmail?.toLowerCase()
      );
      // Also include any individual attendees not in the org (external guests listed separately)
      const orgEmails = new Set(allUsers.map((u) => u.email.toLowerCase()));
      const externalCount = attendees.filter(
        (a) =>
          a.email.toLowerCase() !== INTERNAL_GROUP_EMAIL &&
          a.email.toLowerCase() !== currentUserEmail?.toLowerCase() &&
          !orgEmails.has(a.email.toLowerCase())
      ).length;
      // Shuffle for variety
      const shuffled = [...allOthers].sort(() => Math.random() - 0.5);
      return { orgAttendees: shuffled, totalOthers: allOthers.length + externalCount };
    }

    const matched = attendees
      .map((a) => usersByEmail.get(a.email.toLowerCase()))
      .filter((u): u is OrgUser => u != null && u.email.toLowerCase() !== currentUserEmail?.toLowerCase());

    const total = currentUserEmail
      ? attendees.filter((a) => a.email.toLowerCase() !== currentUserEmail.toLowerCase()).length
      : attendees.length;

    return { orgAttendees: matched, totalOthers: total };
  }, [attendees, usersByEmail, allUsers, currentUserEmail, hasInternalGroup]);

  if (orgAttendees.length === 0) {
    if (totalOthers === 0) return null;
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Users className="h-3 w-3" />
        {totalOthers}
      </span>
    );
  }

  const shown = orgAttendees.slice(0, MAX_AVATARS);
  const remaining = totalOthers - shown.length;

  return (
    <div className="flex items-center gap-1 shrink-0">
      <AvatarGroup>
        {shown.map((user) => (
          <Avatar key={user.id} size="sm" className="!size-5">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
            <AvatarFallback className="text-[9px]">
              {getInitials(user.name ?? user.email)}
            </AvatarFallback>
          </Avatar>
        ))}
      </AvatarGroup>
      {remaining > 0 && (
        <span className="text-xs text-muted-foreground">+{remaining}</span>
      )}
    </div>
  );
}

export function TodaysEvents() {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const { data, isLoading } = useTodaysEvents(timeZone);
  const { user: currentUser } = useCurrentUser();
  const { data: allUsers = [] } = useAllUsers();
  const usersByEmail = useMemo(
    () => new Map(allUsers.map((u) => [u.email.toLowerCase(), u])),
    [allUsers]
  );
  const {
    todaysEventsCollapsed: collapsed,
    todaysEventsMinimized: minimized,
    setTodaysEventsCollapsed,
    setTodaysEventsMinimized,
  } = useMyWorkPreferences();

  const toggleCollapsed = () => setTodaysEventsCollapsed(!collapsed);
  const toggleMinimized = () => setTodaysEventsMinimized(!minimized);

  const events = (data && 'events' in data) ? data.events : [];

  // When minimized, show the most recent current/past event + next 2 upcoming
  const visibleEvents = useMemo(() => {
    if (!minimized || events.length === 0) return events;
    const now = Date.now();

    // Find the most recent event that's currently happening or already started
    let mostRecentIdx = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      const evt = events[i];
      const startMs = evt.start.dateTime ? new Date(evt.start.dateTime).getTime() : 0;
      const isAllDay = !!evt.start.date;
      if (isAllDay || startMs <= now) {
        mostRecentIdx = i;
        break;
      }
    }

    if (mostRecentIdx === -1) {
      // No current/past events — just show first 3 upcoming
      return events.slice(0, 3);
    }

    // Most recent + up to 2 upcoming
    return events.slice(mostRecentIdx, mostRecentIdx + 3);
  }, [events, minimized]);

  // Not connected — show subtle prompt
  if (data && !data.connected) {
    return (
      <div className="mb-4 rounded-lg border border-dashed p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>See today&apos;s calendar events here</span>
        </div>
        <Link
          href="/settings/integrations"
          className="text-sm text-primary hover:underline"
        >
          Connect Calendar
        </Link>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="mb-4 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  // Connected but no data yet
  if (!data || !data.connected) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Today&apos;s Events
          {events.length > 0 && (
            <span className="ml-1 text-xs">({events.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!collapsed && events.length > 3 && (
            <button
              onClick={toggleMinimized}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              title={minimized ? 'Show all events' : 'Show fewer events'}
            >
              {minimized ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="h-3.5 w-3.5" />
            )}
            </button>
          )}
          <button
            onClick={toggleCollapsed}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
            title={collapsed ? 'Expand events' : 'Collapse events'}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-1">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-7">No events today</p>
          ) : (
            visibleEvents.map((event) => {
              const current = isCurrentEvent(event.start, event.end);
              const meetingLink = getMeetingLink(event);
              return (
                <div
                  key={event.id}
                  className={`flex items-center rounded-md px-3 py-2 text-sm ${
                    current ? 'bg-primary/5 border border-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="text-muted-foreground text-xs" style={{ width: 135, flexShrink: 0 }}>
                    {formatTimeRange(event.start, event.end)}
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <span className="truncate font-medium">{event.summary}</span>
                    {event.attendees && event.attendees.length > 1 && (
                      <EventAttendees attendees={event.attendees} usersByEmail={usersByEmail} allUsers={allUsers} currentUserEmail={currentUser?.email} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4" style={{ flexShrink: 0 }}>
                    {meetingLink && (
                      <a
                        href={meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Video className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
