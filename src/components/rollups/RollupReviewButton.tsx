'use client';

import { Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBoardViewStore } from '@/lib/stores/boardViewStore';
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
          variant={isActive ? 'default' : 'outline'}
          size="icon"
          className="size-8"
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
