// ============================================================
// useGridScroll — Hook for scroll management
// Attaches scroll engine to container ref
// ============================================================

import { useRef, useEffect, useCallback } from 'react';
import type { GridApi } from '../types';
import { createScrollEngine, type ScrollEngine } from '../scroll';

export interface UseGridScrollResult {
  /** Ref to attach to the scrollable container */
  containerRef: React.RefCallback<HTMLElement>;
  /** Programmatic scroll to position */
  scrollTo: (top: number, left?: number) => void;
}

export function useGridScroll<TData>(api: GridApi<TData>): UseGridScrollResult {
  const engineRef = useRef<ScrollEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createScrollEngine();
  }

  const engine = engineRef.current;

  // Set up scroll handler
  useEffect(function setupScrollHandler(): () => void {
    const unsubscribe = engine.onScroll(function handleScroll(scrollTop: number, scrollLeft: number): void {
      api.setViewport({ scrollTop, scrollLeft });
    });

    return unsubscribe;
  }, [api, engine]);

  // Cleanup on unmount
  useEffect(function cleanup(): () => void {
    return function destroyEngine(): void {
      engine.destroy();
    };
  }, [engine]);

  // Ref callback to attach/detach scroll engine
  const containerRef = useCallback(
    function setContainerRef(node: HTMLElement | null): void {
      if (node) {
        engine.attach(node);
        // Set initial viewport dimensions
        api.setViewport({
          viewportHeight: node.clientHeight,
          viewportWidth: node.clientWidth,
        });
      } else {
        engine.detach();
      }
    },
    [api, engine],
  );

  const scrollTo = useCallback(
    function scrollToPosition(top: number, left?: number): void {
      engine.scrollTo(top, left);
    },
    [engine],
  );

  return { containerRef, scrollTo };
}
