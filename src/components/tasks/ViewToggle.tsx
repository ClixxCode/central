'use client';

import * as React from 'react';
import { LayoutList, Kanban, TableRowsSplit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { useIsClient } from '@/hooks/useIsClient';

type ViewMode = 'table' | 'swimlane' | 'kanban';

interface ViewToggleProps {
  boardId: string;
  defaultView?: ViewMode;
}

const viewOptions: { value: ViewMode; label: string; icon: React.ElementType }[] = [
  { value: 'swimlane', label: 'Swimlane', icon: TableRowsSplit },
  { value: 'kanban', label: 'Kanban', icon: Kanban },
  { value: 'table', label: 'Table', icon: LayoutList },
];

const DEFAULT_VIEW: ViewMode = 'swimlane';

export function ViewToggle({ boardId, defaultView = DEFAULT_VIEW }: ViewToggleProps) {
  const isClient = useIsClient();
  const { getBoardView, setBoardView } = useBoardViewStore();
  // Use default during SSR to prevent hydration mismatch
  const currentView = isClient ? getBoardView(boardId, defaultView) : defaultView;

  const currentOption = viewOptions.find((o) => o.value === currentView) ?? viewOptions[0];
  const CurrentIcon = currentOption.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CurrentIcon className="size-4" />
          <span>{currentOption.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={currentView}
          onValueChange={(value) => setBoardView(boardId, value as ViewMode)}
        >
          {viewOptions.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="gap-2"
              >
                <Icon className="size-4" />
                {option.label}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ViewToggleButtonsProps {
  boardId: string;
  defaultView?: ViewMode;
}

export function ViewToggleButtons({ boardId, defaultView = DEFAULT_VIEW }: ViewToggleButtonsProps) {
  const isClient = useIsClient();
  const { getBoardView, setBoardView } = useBoardViewStore();
  // Use default during SSR to prevent hydration mismatch
  const currentView = isClient ? getBoardView(boardId, defaultView) : defaultView;

  return (
    <div className="inline-flex rounded-md border bg-muted p-0.5">
      {viewOptions.map((option) => {
        const Icon = option.icon;
        const isActive = currentView === option.value;

        return (
          <Button
            key={option.value}
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setBoardView(boardId, option.value)}
            className={cn(
              'h-7 gap-1.5 px-2',
              isActive && 'bg-background shadow-sm'
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
