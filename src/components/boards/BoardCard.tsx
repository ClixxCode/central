'use client';

import Link from 'next/link';
import { MoreHorizontal, Settings, Trash2, LayoutList, Kanban } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface BoardCardProps {
  board: {
    id: string;
    name: string;
    type: 'standard' | 'rollup' | 'personal';
  };
  clientSlug: string;
  onSettings?: (board: { id: string; name: string; type: 'standard' | 'rollup' | 'personal' }) => void;
  onDelete?: (board: { id: string; name: string; type: 'standard' | 'rollup' | 'personal' }) => void;
}

export function BoardCard({ board, clientSlug, onSettings, onDelete }: BoardCardProps) {
  const boardUrl = `/clients/${clientSlug}/boards/${board.id}`;

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Link href={boardUrl} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {board.type === 'rollup' ? (
                <Kanban className="h-5 w-5 text-muted-foreground" />
              ) : (
                <LayoutList className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {board.name}
              </h3>
              <Badge
                variant={board.type === 'rollup' ? 'secondary' : 'outline'}
                className="text-xs mt-1"
              >
                {board.type === 'rollup' ? 'Rollup' : 'Standard'}
              </Badge>
            </div>
          </Link>

          {(onSettings || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onSettings && (
                  <DropdownMenuItem onClick={() => onSettings(board)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                )}
                {onSettings && onDelete && <DropdownMenuSeparator />}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(board)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
    </Card>
  );
}
