'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ClientIcon } from '@/components/clients/ClientIcon';

interface ClientSwimlaneProps {
  clientName: string;
  clientColor: string | null;
  clientIcon?: string | null;
  taskCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  children: React.ReactNode;
}

export function ClientSwimlane({
  clientName,
  clientColor,
  clientIcon,
  taskCount,
  isCollapsed,
  onToggleCollapse,
  children,
}: ClientSwimlaneProps) {
  return (
    <div className="rounded-lg border bg-card">
      {/* Client Header */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
          'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          !isCollapsed && 'border-b'
        )}
      >
        {isCollapsed ? (
          <ChevronRight className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}

        <ClientIcon icon={clientIcon ?? null} color={clientColor} name={clientName} size="sm" />

        <span className="font-medium">{clientName}</span>

        <Badge variant="secondary" className="ml-auto">
          {taskCount}
        </Badge>
      </button>

      {/* Tasks Content */}
      {!isCollapsed && (
        <div className="p-2">
          {taskCount === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No tasks
            </div>
          ) : (
            <div className="space-y-2">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
