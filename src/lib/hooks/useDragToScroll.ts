import { useRef, useEffect } from 'react';

/**
 * Enables click-and-drag horizontal scrolling on a container.
 * Only activates when clicking on the background (not on cards, buttons, etc).
 */
export function useDragToScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const state = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return true;
      return !!target.closest(
        'article, button, a, input, select, textarea, [role="button"], .cursor-grab, .cursor-grabbing'
      );
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target)) return;

      state.current = {
        isDragging: true,
        startX: e.pageX - el.offsetLeft,
        scrollLeft: el.scrollLeft,
      };
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!state.current.isDragging) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = x - state.current.startX;
      el.scrollLeft = state.current.scrollLeft - walk;
    };

    const onMouseUp = () => {
      if (!state.current.isDragging) return;
      state.current.isDragging = false;
      el.style.cursor = '';
      el.style.userSelect = '';
    };

    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return ref;
}
