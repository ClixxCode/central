'use client';

import { useState, useMemo, useCallback } from 'react';
import { CalendarDays, CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format, addDays, isSameWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarConnectionCard } from './CalendarConnectionCard';
import { TeamMemberSelect, type SelectedPerson } from './TeamMemberSelect';
import { AvailabilityGrid } from './AvailabilityGrid';
import { HoldReviewTray, type PendingHold } from './HoldReviewTray';
import { useCalendarConnection, useTeamAvailability } from '@/lib/hooks';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';
import { Skeleton } from '@/components/ui/skeleton';

function getWeekDates(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

function formatWeekLabel(start: Date, end: Date): string {
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${format(start, 'MMM d')} – ${format(end, 'd, yyyy')}`;
  }
  return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
}

export function SchedulePageClient() {
  const { data: connection, isLoading: connectionLoading } = useCalendarConnection();
  const { user: currentUser } = useCurrentUser();
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );

  // Week state
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const week = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const weekDays = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(week.start, i)),
    [week]
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Additional people (beyond current user)
  const [additionalPeople, setAdditionalPeople] = useState<SelectedPerson[]>([]);

  // All people = current user first + additional
  const allPeople = useMemo(() => {
    if (!currentUser) return additionalPeople;
    const me: SelectedPerson = {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      avatarUrl: currentUser.image,
    };
    return [me, ...additionalPeople.filter((p) => p.id !== currentUser.id)];
  }, [currentUser, additionalPeople]);

  // Availability auto-fetches whenever we have people
  const emails = useMemo(() => allPeople.map((p) => p.email), [allPeople]);
  const timeMin = useMemo(() => {
    const d = new Date(week.start);
    d.setHours(8, 0, 0, 0);
    return d.toISOString();
  }, [week]);
  const timeMax = useMemo(() => {
    const friday = addDays(week.start, 4);
    friday.setHours(18, 0, 0, 0);
    return friday.toISOString();
  }, [week]);

  const {
    data: availability,
    isLoading: availabilityLoading,
  } = useTeamAvailability(emails, timeMin, timeMax, timeZone, {
    enabled: emails.length > 0,
  });

  // Pending holds + shared title/description
  const [pendingHolds, setPendingHolds] = useState<PendingHold[]>([]);
  const [holdTitle, setHoldTitle] = useState('[HOLD] Clix +');
  const [holdDescription, setHoldDescription] = useState('');

  const addHold = useCallback((hold: PendingHold) => {
    setPendingHolds((prev) => [...prev, hold]);
  }, []);

  const removeHold = useCallback((id: string) => {
    setPendingHolds((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const clearHolds = useCallback(() => {
    setPendingHolds([]);
    setHoldTitle('[HOLD] Clix +');
    setHoldDescription('');
  }, []);

  const goToPrevWeek = () => setSelectedDate((d) => subWeeks(d, 1));
  const goToNextWeek = () => setSelectedDate((d) => addWeeks(d, 1));
  const goToThisWeek = () => setSelectedDate(new Date());

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setCalendarOpen(false);
    }
  };

  const isThisWeek = isSameWeek(selectedDate, new Date(), { weekStartsOn: 1 });

  if (connectionLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!connection?.connected) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Schedule</h1>
          <p className="text-muted-foreground">
            Check team availability and create calendar holds
          </p>
        </div>
        <div className="max-w-md">
          <CalendarConnectionCard />
        </div>
      </div>
    );
  }

  return (
    <div className={pendingHolds.length > 0 ? 'pb-64' : ''}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Schedule</h1>
        <p className="text-muted-foreground">
          Check team availability and create calendar holds
        </p>
      </div>

      {/* Controls — single row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <TeamMemberSelect
          selected={additionalPeople}
          onChange={setAdditionalPeople}
          currentUserId={currentUser?.id}
        />

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 font-medium">
              <CalendarIcon className="h-4 w-4" />
              {formatWeekLabel(week.start, addDays(week.start, 4))}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCalendarSelect}
              defaultMonth={selectedDate}
            />
          </PopoverContent>
        </Popover>

        {!isThisWeek && (
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={goToThisWeek}>
            Today
          </Button>
        )}
      </div>

      {/* Availability Grid */}
      <div className="border rounded-lg">
        {availabilityLoading ? (
          <div className="p-4 space-y-2">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : availability ? (
          <AvailabilityGrid
            people={allPeople}
            availability={availability}
            weekDays={weekDays}
            timeZone={timeZone}
            pendingHolds={pendingHolds}
            onAddHold={addHold}
          />
        ) : (
          <div className="border border-dashed rounded-lg p-12 text-center">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">
              Loading availability...
            </p>
          </div>
        )}
      </div>

      {/* Hold Review Tray */}
      <HoldReviewTray
        holds={pendingHolds}
        title={holdTitle}
        description={holdDescription}
        timeZone={timeZone}
        onUpdateTitle={setHoldTitle}
        onUpdateDescription={setHoldDescription}
        onRemove={removeHold}
        onClear={clearHolds}
      />
    </div>
  );
}
