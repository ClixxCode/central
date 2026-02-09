'use client';

import * as React from 'react';
import { useDrag } from '@use-gesture/react';
import { animated, useSpring } from '@react-spring/web';
import { cn } from '@/lib/utils';

interface SwipeableSheetContentProps {
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}

/**
 * A swipeable wrapper for sheet content that allows swipe-down to close on mobile.
 * Shows a visual drag indicator pill on mobile.
 */
export function SwipeableSheetContent({
  children,
  onClose,
  className,
}: SwipeableSheetContentProps) {
  const [{ y }, api] = useSpring(() => ({ y: 0 }));

  const bind = useDrag(
    ({ movement: [, my], velocity: [, vy], direction: [, dy], cancel }) => {
      // Only allow downward swipes
      if (my < 0) {
        api.start({ y: 0 });
        return;
      }

      // If swiped down 150px or velocity is high enough, close
      if (my > 150 || (vy > 0.5 && dy > 0)) {
        api.start({
          y: window.innerHeight,
          immediate: false,
          config: { tension: 200, friction: 25 },
          onRest: onClose,
        });
        cancel();
        return;
      }

      // Follow finger during drag
      api.start({ y: my, immediate: true });
    },
    {
      from: () => [0, y.get()],
      filterTaps: true,
      rubberband: true,
      axis: 'y',
    }
  );

  // Snap back when released without threshold
  const handleDragEnd = () => {
    api.start({ y: 0, config: { tension: 300, friction: 30 } });
  };

  return (
    <animated.div
      {...bind()}
      onPointerUp={handleDragEnd}
      style={{ y, touchAction: 'pan-x' }}
      className={cn('relative', className)}
    >
      {/* Swipe indicator - only visible on mobile */}
      <div className="md:hidden flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
      {children}
    </animated.div>
  );
}

/**
 * Hook to detect if we're on a mobile device
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
