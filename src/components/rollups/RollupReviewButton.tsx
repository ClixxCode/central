'use client';

import { Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RollupReviewButtonProps {
  rollupId: string;
  reviewModeEnabled: boolean;
}

export function RollupReviewButton({ rollupId, reviewModeEnabled }: RollupReviewButtonProps) {
  const { getBoardView, activeReviewBoardId, setActiveReviewBoardId } = useBoardViewStore();

  const viewMode = getBoardView(rollupId);
  const isActive = activeReviewBoardId === rollupId;

  if (!reviewModeEnabled || viewMode !== 'swimlane') return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn(
            'rounded-full text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            isActive && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
          )}
          onClick={() => setActiveReviewBoardId(isActive ? null : rollupId)}
        >
          {isActive ? <X className="size-4" /> : <Play className="size-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isActive ? 'Exit review mode' : 'Review mode'}
      </TooltipContent>
    </Tooltip>
  );
}
