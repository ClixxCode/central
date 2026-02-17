'use client';

import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToggleFavorite, useFavorites } from '@/lib/hooks/useFavorites';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FavoriteButtonProps {
  entityType: 'board' | 'rollup';
  entityId: string;
  className?: string;
}

export function FavoriteButton({ entityType, entityId, className }: FavoriteButtonProps) {
  const { data: favoritesData } = useFavorites();
  const { toggle, isPending } = useToggleFavorite();

  const isFavorited = favoritesData?.favorites?.some((f) => f.entityId === entityId) ?? false;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('px-3', className)}
            onClick={() => toggle(entityType, entityId)}
            disabled={isPending}
          >
            <Star
              className={cn(
                'size-4 transition-colors',
                isFavorited
                  ? 'fill-foreground text-foreground'
                  : 'text-muted-foreground/50'
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
