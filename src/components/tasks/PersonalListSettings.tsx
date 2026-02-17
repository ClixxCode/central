'use client';

import * as React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ColorPicker } from '@/components/clients/ColorPicker';
import { IconPicker } from '@/components/clients/IconPicker';
import { useUpdatePersonalBoard } from '@/lib/hooks/useBoards';
import type { BoardWithAccess } from '@/lib/actions/boards';

interface PersonalListSettingsProps {
  board: BoardWithAccess;
}

export function PersonalListSettings({ board }: PersonalListSettingsProps) {
  const updateBoard = useUpdatePersonalBoard();
  const [activeSection, setActiveSection] = React.useState<'color' | 'icon' | null>(null);

  const handleColorChange = (color: string) => {
    updateBoard.mutate({ color });
  };

  const handleIconChange = (icon: string) => {
    updateBoard.mutate({ icon });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="size-4" />
          Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Board Color</h4>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setActiveSection(activeSection === 'color' ? null : 'color')}
                className="w-8 h-8 rounded-lg shrink-0 border transition-all hover:scale-105"
                style={{ backgroundColor: board.color ?? '#3B82F6' }}
              />
              <span className="text-sm text-muted-foreground">
                {board.color ?? 'Default'}
              </span>
            </div>
            {activeSection === 'color' && (
              <ColorPicker
                value={board.color ?? '#3B82F6'}
                onChange={handleColorChange}
              />
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">Board Icon</h4>
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setActiveSection(activeSection === 'icon' ? null : 'icon')}
                className="w-8 h-8 rounded-lg shrink-0 border flex items-center justify-center transition-all hover:scale-105"
                style={{ color: board.color ?? '#3B82F6' }}
              >
                <span className="material-symbols-outlined text-lg">
                  {board.icon ?? 'checklist'}
                </span>
              </button>
              <span className="text-sm text-muted-foreground">
                {board.icon ?? 'Default'}
              </span>
            </div>
            {activeSection === 'icon' && (
              <div className="max-h-[300px] overflow-y-auto">
                <IconPicker
                  value={board.icon ?? null}
                  onChange={handleIconChange}
                  color={board.color ?? '#3B82F6'}
                />
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
