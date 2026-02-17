'use client';

import { Clock, Send, Trash2, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCalendarHolds } from '@/lib/hooks';
import type { HoldInput } from '@/lib/actions/google-calendar';

export interface PendingHold {
  id: string;
  attendeeEmails: string[];
  attendeeNames: string[];
  startTime: string;
  endTime: string;
}

interface HoldReviewTrayProps {
  holds: PendingHold[];
  title: string;
  description: string;
  timeZone: string;
  onUpdateTitle: (title: string) => void;
  onUpdateDescription: (description: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function formatHoldTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatHoldDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getDurationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

export function HoldReviewTray({
  holds,
  title,
  description,
  timeZone,
  onUpdateTitle,
  onUpdateDescription,
  onRemove,
  onClear,
}: HoldReviewTrayProps) {
  const createHoldsMutation = useCreateCalendarHolds();

  if (holds.length === 0) return null;

  const handleSendAll = () => {
    const holdInputs: HoldInput[] = holds.map((hold) => ({
      title: title || '[HOLD] Clix +',
      description: description || undefined,
      startTime: hold.startTime,
      endTime: hold.endTime,
      timeZone,
      attendeeEmails: hold.attendeeEmails,
    }));
    createHoldsMutation.mutate(holdInputs, {
      onSuccess: (result) => {
        if (result.success) {
          onClear();
        }
      },
    });
  };

  return (
    <div className="sticky bottom-0 z-40 -mx-4 lg:-mx-6 border-t bg-background shadow-lg">
      <div className="px-4 lg:px-6 py-4 max-w-5xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">
            Calendar Holds ({holds.length})
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear all
            </Button>
            <Button
              size="sm"
              onClick={handleSendAll}
              disabled={createHoldsMutation.isPending}
            >
              {createHoldsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-1" />
              )}
              Save All Holds
            </Button>
          </div>
        </div>

        {/* Shared title & description */}
        <div className="space-y-2 mb-3">
          <Input
            value={title}
            onChange={(e) => onUpdateTitle(e.target.value)}
            className="h-8 text-sm max-w-[300px]"
            placeholder="Hold title"
          />
          <Textarea
            value={description}
            onChange={(e) => onUpdateDescription(e.target.value)}
            className="text-sm min-h-[32px] resize-none max-w-lg"
            placeholder="Description (optional)"
            rows={1}
          />
        </div>

        {/* Time slot list */}
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {holds.map((hold) => {
            const duration = getDurationMinutes(hold.startTime, hold.endTime);
            return (
              <div
                key={hold.id}
                className="flex items-center gap-3 rounded-md border px-3 py-1.5"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {formatHoldDate(hold.startTime)}{' '}
                    {formatHoldTime(hold.startTime)} – {formatHoldTime(hold.endTime)}
                  </span>
                  <span className="text-muted-foreground/60">({duration}m)</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                  <Users className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">
                    {hold.attendeeNames.join(', ')}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => onRemove(hold.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
