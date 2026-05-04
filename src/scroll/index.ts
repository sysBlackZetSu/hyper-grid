// ============================================================
// Scroll Engine
// - Passive event listeners
// - rAF-throttled scroll handling
// - No heavy work inside scroll handler
// ============================================================

export interface ScrollEngine {
  /** Attach to a scrollable element */
  attach(element: HTMLElement): void;
  /** Detach from current element */
  detach(): void;
  /** Subscribe to scroll position changes */
  onScroll(handler: (scrollTop: number, scrollLeft: number) => void): () => void;
  /** Programmatic scroll to position */
  scrollTo(top: number, left?: number): void;
  /** Programmatic scroll to a specific row offset */
  scrollToOffset(offset: number): void;
  /** Get current scroll position */
  getScrollPosition(): { scrollTop: number; scrollLeft: number };
  /** Destroy the scroll engine */
  destroy(): void;
}

export function createScrollEngine(): ScrollEngine {
  let element: HTMLElement | null = null;
  let rafPending = false;
  let currentScrollTop = 0;
  let currentScrollLeft = 0;

  // Handlers set — O(1) add/remove
  const handlers = new Set<(scrollTop: number, scrollLeft: number) => void>();

  // Bound handler reference for cleanup
  let boundScrollHandler: (() => void) | null = null;

  function attach(el: HTMLElement): void {
    if (element) detach();
    element = el;
    currentScrollTop = el.scrollTop;
    currentScrollLeft = el.scrollLeft;

    boundScrollHandler = handleScroll;
    el.addEventListener('scroll', boundScrollHandler, { passive: true });
  }

  function detach(): void {
    if (element && boundScrollHandler) {
      element.removeEventListener('scroll', boundScrollHandler);
    }
    element = null;
    boundScrollHandler = null;
    rafPending = false;
  }

  function handleScroll(): void {
    if (rafPending) return;
    rafPending = true;

    requestAnimationFrame(processScroll);
  }

  function processScroll(): void {
    rafPending = false;
    if (!element) return;

    const newTop = element.scrollTop;
    const newLeft = element.scrollLeft;

    // Skip if nothing changed
    if (newTop === currentScrollTop && newLeft === currentScrollLeft) return;

    currentScrollTop = newTop;
    currentScrollLeft = newLeft;

    // Notify handlers (avoid iterator allocation — use forEach)
    handlers.forEach(callHandler);
  }

  function callHandler(handler: (scrollTop: number, scrollLeft: number) => void): void {
    handler(currentScrollTop, currentScrollLeft);
  }

  function onScroll(handler: (scrollTop: number, scrollLeft: number) => void): () => void {
    handlers.add(handler);
    return function removeHandler(): void {
      handlers.delete(handler);
    };
  }

  function scrollTo(top: number, left?: number): void {
    if (!element) return;
    element.scrollTop = top;
    if (left !== undefined) {
      element.scrollLeft = left;
    }
  }

  function scrollToOffset(offset: number): void {
    scrollTo(offset);
  }

  function getScrollPosition(): { scrollTop: number; scrollLeft: number } {
    return { scrollTop: currentScrollTop, scrollLeft: currentScrollLeft };
  }

  function destroy(): void {
    detach();
    handlers.clear();
  }

  return {
    attach,
    detach,
    onScroll,
    scrollTo,
    scrollToOffset,
    getScrollPosition,
    destroy,
  };
}
