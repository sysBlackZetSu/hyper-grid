// ============================================================
// useGridEngine — Core React hook for the grid engine
// Thin adapter: stable refs, no heavy abstraction
// ============================================================

import { useRef, useCallback, useMemo, useSyncExternalStore } from 'react';
import type { GridOptions, GridApi, GridState, ComputedState } from '../types';
import { createGridEngine } from '../core';

export interface UseGridEngineResult<TData> {
  /** The grid API — stable reference */
  api: GridApi<TData>;
  /** Current grid state */
  state: GridState<TData>;
  /** Computed/derived state (filtered, sorted, visible rows) */
  computed: ComputedState<TData>;
}

export function useGridEngine<TData>(options: GridOptions<TData>): UseGridEngineResult<TData> {
  // Stable API ref — only create engine once
  const apiRef = useRef<GridApi<TData> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  if (apiRef.current === null) {
    apiRef.current = createGridEngine(options);
  }

  const api = apiRef.current;

  // Update data when it changes (referential check)
  const lastDataRef = useRef(options.data);
  if (options.data !== lastDataRef.current) {
    lastDataRef.current = options.data;
    api.setData(options.data);
  }

  // useSyncExternalStore for tear-safe state reading
  const subscribe = useCallback(
    function subscribeToStore(onStoreChange: () => void): () => void {
      return api.subscribe(onStoreChange);
    },
    [api],
  );

  const getSnapshot = useCallback(
    function getGridState(): GridState<TData> {
      return api.getState();
    },
    [api],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Computed state — derived on demand, memoized inside engine
  const computed = useMemo(
    function computeState(): ComputedState<TData> {
      return api.getComputedState();
    },
    [api, state],
  );

  return { api, state, computed };
}
