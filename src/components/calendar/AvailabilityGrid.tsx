'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { FreeBusyResult } from '@/lib/google-calendar/api';
import type { SelectedPerson } from './TeamMemberSelect';
import type { PendingHold } from './HoldReviewTray';

interface AvailabilityGridProps {
  people: SelectedPerson[];
  availability: FreeBusyResult;
  weekDays: Date[];
  timeZone: string;
  pendingHolds: PendingHold[];
  onAddHold: (hold: PendingHold) => void;
}

const START_HOUR = 8;
const END_HOUR = 18;
const SLOT_MINUTES = 30;
const TOTAL_SLOTS = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const SLOT_HEIGHT = 28;

function getInitials(nameOrEmail: string): string {
  if (nameOrEmail.includes('@')) return nameOrEmail.charAt(0).toUpperCase();
  const words = nameOrEmail.split(' ').filter(Boolean);
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

function slotToISO(day: Date, slotIndex: number): string {
  const totalMinutes = START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

function formatSlotTime(slotIndex: number): string {
  const totalMinutes = START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return minutes === 0
    ? `${displayHours} ${ampm}`
    : `${displayHours}:${String(minutes).padStart(2, '0')}`;
}

function isBusy(
  email: string,
  day: Date,
  slotIndex: number,
  availability: FreeBusyResult
): boolean {
  const cal = availability.calendars[email];
  if (!cal?.busy) return false;

  const slotStartMs = new Date(slotToISO(day, slotIndex)).getTime();
  const slotEndMs = new Date(slotToISO(day, slotIndex + 1)).getTime();

  return cal.busy.some((block) => {
    const blockStart = new Date(block.start).getTime();
    const blockEnd = new Date(block.end).getTime();
    return blockStart < slotEndMs && blockEnd > slotStartMs;
  });
}

/** Build a Set of "dayIdx-slotIndex" keys covered by holds */
function buildHoldSlotKeys(
  holds: PendingHold[],
  weekDays: Date[]
): Set<string> {
  const set = new Set<string>();
  for (const hold of holds) {
    const hs = new Date(hold.startTime);
    const he = new Date(hold.endTime);
    const holdStartMin = hs.getHours() * 60 + hs.getMinutes();
    const holdEndMin = he.getHours() * 60 + he.getMinutes();

    for (let dayIdx = 0; dayIdx < weekDays.length; dayIdx++) {
      const d = weekDays[dayIdx];
      if (
        d.getFullYear() !== hs.getFullYear() ||
        d.getMonth() !== hs.getMonth() ||
        d.getDate() !== hs.getDate()
      ) continue;

      for (let slot = 0; slot < TOTAL_SLOTS; slot++) {
        const slotStart = START_HOUR * 60 + slot * SLOT_MINUTES;
        const slotEnd = slotStart + SLOT_MINUTES;
        if (holdStartMin < slotEnd && holdEndMin > slotStart) {
          set.add(`${dayIdx}-${slot}`);
        }
      }
    }
  }
  return set;
}

export function AvailabilityGrid({
  people,
  availability,
  weekDays,
  timeZone,
  pendingHolds,
  onAddHold,
}: AvailabilityGridProps) {
  const [dragging, setDragging] = useState<{
    dayIdx: number;
    startSlot: number;
  } | null>(null);
  const [dragCurrentSlot, setDragCurrentSlot] = useState<number | null>(null);

  const slots = useMemo(
    () => Array.from({ length: TOTAL_SLOTS }, (_, i) => i),
    []
  );

  const holdSlotKeys = useMemo(
    () => buildHoldSlotKeys(pendingHolds, weekDays),
    [pendingHolds, weekDays]
  );

  const handleMouseDown = useCallback(
    (dayIdx: number, slot: number) => {
      setDragging({ dayIdx, startSlot: slot });
      setDragCurrentSlot(slot);
    },
    []
  );

  const handleMouseEnter = useCallback(
    (dayIdx: number, slot: number) => {
      if (dragging && dragging.dayIdx === dayIdx) {
        setDragCurrentSlot(slot);
      }
    },
    [dragging]
  );

  const handleMouseUp = useCallback(() => {
    if (!dragging || dragCurrentSlot === null) {
      setDragging(null);
      setDragCurrentSlot(null);
      return;
    }

    const minSlot = Math.min(dragging.startSlot, dragCurrentSlot);
    const maxSlot = Math.max(dragging.startSlot, dragCurrentSlot);
    const day = weekDays[dragging.dayIdx];

    // Hold across ALL people
    onAddHold({
      id: crypto.randomUUID(),
      attendeeEmails: people.map((p) => p.email),
      attendeeNames: people.map((p) => p.name ?? p.email),
      startTime: slotToISO(day, minSlot),
      endTime: slotToISO(day, maxSlot + 1),
    });

    setDragging(null);
    setDragCurrentSlot(null);
  }, [dragging, dragCurrentSlot, weekDays, people, onAddHold]);

  const isDragTarget = useCallback(
    (dayIdx: number, slot: number): boolean => {
      if (!dragging || dragging.dayIdx !== dayIdx || dragCurrentSlot === null)
        return false;
      const min = Math.min(dragging.startSlot, dragCurrentSlot);
      const max = Math.max(dragging.startSlot, dragCurrentSlot);
      return slot >= min && slot <= max;
    },
    [dragging, dragCurrentSlot]
  );

  const now = useMemo(() => new Date(), []);

  const dayStatus = useMemo(() => {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return weekDays.map((day) => {
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      if (dayStart.getTime() === todayStart.getTime()) return 'today' as const;
      if (dayStart < todayStart) return 'past' as const;
      return 'future' as const;
    });
  }, [weekDays, now]);

  const isToday = (day: Date) => {
    return (
      day.getDate() === now.getDate() &&
      day.getMonth() === now.getMonth() &&
      day.getFullYear() === now.getFullYear()
    );
  };

  const totalPersonCols = weekDays.length * people.length;

  return (
    <div className="overflow-x-auto select-none" onMouseUp={handleMouseUp}>
      <p className="text-xs text-muted-foreground px-4 pt-3 pb-2">
        Click or drag on a day to create a hold for all attendees.
      </p>

      <div
        className="grid"
        style={{
          gridTemplateColumns: `56px repeat(${totalPersonCols}, minmax(80px, 1fr))`,
        }}
      >
        {/* Day header row */}
        <div className="sticky top-0 z-20 bg-background" />
        {weekDays.map((day, dayIdx) => {
          const status = dayStatus[dayIdx];
          return (
            <div
              key={dayIdx}
              className={`sticky top-0 z-20 border-b text-center py-2 ${
                dayIdx > 0 ? 'border-l-2 border-l-border' : ''
              } ${status === 'today' ? 'bg-primary/5' : 'bg-background'}`}
              style={{ gridColumn: `span ${people.length}` }}
            >
              <div className={`text-xs font-medium ${
                status === 'today' ? 'text-primary' : status === 'past' ? 'text-muted-foreground/50' : 'text-muted-foreground'
              }`}>
                {format(day, 'EEE')}
              </div>
              <div className={`text-sm font-semibold ${
                status === 'today' ? 'text-primary' : status === 'past' ? 'text-muted-foreground/50' : ''
              }`}>
                {format(day, 'MMM d')}
              </div>
            </div>
          );
        })}

        {/* Person sub-header row */}
        <div className="sticky top-[52px] z-20 bg-background border-b" />
        {weekDays.map((day, dayIdx) =>
          people.map((person, personIdx) => {
            const status = dayStatus[dayIdx];
            return (
              <div
                key={`person-${dayIdx}-${personIdx}`}
                className={`sticky top-[52px] z-20 border-b px-1 py-1.5 flex items-center justify-center gap-1 ${
                  dayIdx > 0 && personIdx === 0 ? 'border-l-2 border-l-border' : ''
                } ${status === 'today' ? 'bg-primary/5' : 'bg-background'} ${status === 'past' ? 'opacity-50' : ''}`}
              >
                <Avatar size="sm">
                  <AvatarImage src={person.avatarUrl ?? undefined} alt={person.name ?? person.email} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(person.name ?? person.email)}
                  </AvatarFallback>
                </Avatar>
                {people.length <= 3 && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                    {person.name?.split(' ')[0] ?? person.email.split('@')[0]}
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* Time slots */}
        {slots.map((slotIndex) => (
          <React.Fragment key={`slot-row-${slotIndex}`}>
            {/* Time label */}
            <div
              className="border-r border-b flex items-center justify-end pr-2"
              style={{ height: SLOT_HEIGHT }}
            >
              {slotIndex % 2 === 0 && (
                <span className="text-[10px] text-muted-foreground leading-none">
                  {formatSlotTime(slotIndex)}
                </span>
              )}
            </div>

            {/* Day × Person cells */}
            {weekDays.map((day, dayIdx) =>
              people.map((person, personIdx) => {
                const status = dayStatus[dayIdx];
                const isPast = status === 'past';
                const isTodayCol = status === 'today';
                const busy = isBusy(person.email, day, slotIndex, availability);
                const dragTarget = !isPast && isDragTarget(dayIdx, slotIndex);
                const hasHold = holdSlotKeys.has(`${dayIdx}-${slotIndex}`);

                let bgColor: string | undefined;
                if (hasHold) {
                  bgColor = 'rgba(16, 185, 129, 0.45)';
                } else if (busy) {
                  bgColor = isPast ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.3)';
                } else if (isTodayCol) {
                  bgColor = 'var(--color-primary-5, rgba(59, 130, 246, 0.05))';
                }

                return (
                  <div
                    key={`${dayIdx}-${personIdx}-${slotIndex}`}
                    className={`border-b transition-colors ${
                      dayIdx > 0 && personIdx === 0 ? 'border-l-2 border-l-border' : 'border-l'
                    } ${
                      isPast
                        ? 'opacity-40 cursor-default'
                        : 'cursor-pointer'
                    } ${
                      !hasHold && !busy && !isPast && dragTarget
                        ? 'bg-primary/30'
                        : !hasHold && !busy && !isPast && !dragTarget
                        ? 'hover:bg-muted/50'
                        : ''
                    }`}
                    style={{
                      height: SLOT_HEIGHT,
                      backgroundColor: bgColor,
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (!busy && !isPast) handleMouseDown(dayIdx, slotIndex);
                    }}
                    onMouseEnter={() => {
                      if (!isPast) handleMouseEnter(dayIdx, slotIndex);
                    }}
                  />
                );
              })
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
