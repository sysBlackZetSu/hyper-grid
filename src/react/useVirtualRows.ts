// ============================================================
// useVirtualRows — Hook for virtualized row rendering
// Returns only the visible rows + total height
// ============================================================

import { useMemo, useCallback, useRef } from 'react';
import type { GridApi, VisibleRow, ComputedState } from '../types';
import { createVirtualizationEngine, type VirtualizationEngine } from '../virtualization';

export interface UseVirtualRowsResult<TData> {
  visibleRows: ReadonlyArray<VisibleRow<TData>>;
  totalHeight: number;
  setRowHeight: (index: number, height: number) => void;
}

export function useVirtualRows<TData>(
  api: GridApi<TData>,
  computed: ComputedState<TData>,
): UseVirtualRowsResult<TData> {
  const engineRef = useRef<VirtualizationEngine<TData> | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createVirtualizationEngine<TData>();
  }

  const engine = engineRef.current;
  const state = api.getState();

  const visibleRows = useMemo(
    function computeVisible(): ReadonlyArray<VisibleRow<TData>> {
      return engine.computeVisibleRows(
        computed.sortedData,
        state.viewport.scrollTop,
        state.viewport.viewportHeight,
        state.overscan,
        state.rowHeight,
      );
    },
    [engine, computed.sortedData, state.viewport.scrollTop, state.viewport.viewportHeight, state.overscan, state.rowHeight],
  );

  const totalHeight = useMemo(
    function computeHeight(): number {
      return engine.getTotalHeight(computed.sortedData.length, state.rowHeight);
    },
    [engine, computed.sortedData.length, state.rowHeight],
  );

  const setRowHeight = useCallback(
    function updateRowHeight(index: number, height: number): void {
      engine.setRowHeight(index, height);
      engine.rebuild();
    },
    [engine],
  );

  return { visibleRows, totalHeight, setRowHeight };
}
