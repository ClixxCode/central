'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Users,
  Video,
} from 'lucide-react';
import { useTodaysEvents } from '@/lib/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const COLLAPSE_KEY = 'central-todays-events-collapsed';

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

export function TodaysEvents() {
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const { data, isLoading } = useTodaysEvents(timeZone);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_KEY);
    if (stored === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, String(next));
  };

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

  const { events } = data;

  return (
    <div className="mb-4">
      <button
        onClick={toggleCollapsed}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        <Calendar className="h-4 w-4" />
        Today&apos;s Events
        {events.length > 0 && (
          <span className="ml-1 text-xs">({events.length})</span>
        )}
      </button>

      {!collapsed && (
        <div className="space-y-1">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-7">No events today</p>
          ) : (
            events.map((event) => {
              const current = isCurrentEvent(event.start, event.end);
              return (
                <div
                  key={event.id}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                    current ? 'bg-primary/5 border border-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="text-muted-foreground min-w-[120px] shrink-0">
                    <span className="text-xs">
                      {formatTimeRange(event.start, event.end)}
                    </span>
                  </div>
                  <span className="truncate font-medium">{event.summary}</span>
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    {event.attendees && event.attendees.length > 1 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {event.attendees.length}
                      </span>
                    )}
                    {event.hangoutLink && (
                      <a
                        href={event.hangoutLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
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
