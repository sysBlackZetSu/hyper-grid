// ============================================================
// useGridSelection — Hook for selection management
// Thin wrapper around the grid API selection methods
// ============================================================

import { useCallback, useMemo } from 'react';
import type { GridApi, GridState, RowId, SelectionState } from '../types';

export interface UseGridSelectionResult {
  selection: SelectionState;
  selectRow: (rowId: RowId) => void;
  deselectRow: (rowId: RowId) => void;
  toggleSelectAll: () => void;
  isRowSelected: (rowId: RowId) => boolean;
  selectedCount: number;
}

export function useGridSelection<TData>(
  api: GridApi<TData>,
  state: GridState<TData>,
): UseGridSelectionResult {
  const selection = state.selection;

  const selectRow = useCallback(
    function handleSelectRow(rowId: RowId): void {
      api.selectRow(rowId);
    },
    [api],
  );

  const deselectRow = useCallback(
    function handleDeselectRow(rowId: RowId): void {
      api.deselectRow(rowId);
    },
    [api],
  );

  const toggleSelectAll = useCallback(
    function handleToggleSelectAll(): void {
      api.toggleSelectAll();
    },
    [api],
  );

  const isRowSelected = useCallback(
    function checkRowSelected(rowId: RowId): boolean {
      return api.isRowSelected(rowId);
    },
    [api],
  );

  const selectedCount = useMemo(
    function computeSelectedCount(): number {
      if (selection.selectAll) {
        return state.data.length - selection.excludedIds.size;
      }
      return selection.selectedIds.size;
    },
    [selection, state.data.length],
  );

  return {
    selection,
    selectRow,
    deselectRow,
    toggleSelectAll,
    isRowSelected,
    selectedCount,
  };
}
