// ============================================================
// Selection Model — O(1) operations
// selectAll → store excludedIds
// normal → store selectedIds
// ============================================================

import type { SelectionState, RowId } from '../types';
import { emptySet } from '../utils';

export interface SelectionEngine {
  /** Get current selection state */
  getState(): SelectionState;
  /** Select a single row */
  selectRow(rowId: RowId, state: SelectionState): SelectionState;
  /** Deselect a single row */
  deselectRow(rowId: RowId, state: SelectionState): SelectionState;
  /** Toggle select all */
  toggleSelectAll(state: SelectionState): SelectionState;
  /** Check if a row is selected */
  isRowSelected(rowId: RowId, state: SelectionState): boolean;
  /** Get selected count (requires total for selectAll mode) */
  getSelectedCount(state: SelectionState, totalRows: number): number;
  /** Clear selection */
  clearSelection(state: SelectionState): SelectionState;
}

const INITIAL_SELECTION: SelectionState = {
  mode: 'none',
  selectAll: false,
  selectedIds: emptySet<RowId>(),
  excludedIds: emptySet<RowId>(),
};

export function createSelectionEngine(): SelectionEngine {
  function getState(): SelectionState {
    return INITIAL_SELECTION;
  }

  function selectRow(rowId: RowId, state: SelectionState): SelectionState {
    if (state.mode === 'none') return state;

    if (state.selectAll) {
      // In selectAll mode, selecting = removing from excluded
      if (!state.excludedIds.has(rowId)) return state;
      const nextExcluded = new Set(state.excludedIds);
      nextExcluded.delete(rowId);
      return {
        mode: state.mode,
        selectAll: true,
        selectedIds: state.selectedIds,
        excludedIds: nextExcluded,
      };
    }

    if (state.mode === 'single') {
      // Single mode: replace selection
      const nextSelected = new Set<RowId>();
      nextSelected.add(rowId);
      return {
        mode: 'single',
        selectAll: false,
        selectedIds: nextSelected,
        excludedIds: state.excludedIds,
      };
    }

    // Multiple mode: add to selected
    if (state.selectedIds.has(rowId)) return state;
    const nextSelected = new Set(state.selectedIds);
    nextSelected.add(rowId);
    return {
      mode: state.mode,
      selectAll: false,
      selectedIds: nextSelected,
      excludedIds: state.excludedIds,
    };
  }

  function deselectRow(rowId: RowId, state: SelectionState): SelectionState {
    if (state.mode === 'none') return state;

    if (state.selectAll) {
      // In selectAll mode, deselecting = adding to excluded
      if (state.excludedIds.has(rowId)) return state;
      const nextExcluded = new Set(state.excludedIds);
      nextExcluded.add(rowId);
      return {
        mode: state.mode,
        selectAll: true,
        selectedIds: state.selectedIds,
        excludedIds: nextExcluded,
      };
    }

    // Normal mode: remove from selected
    if (!state.selectedIds.has(rowId)) return state;
    const nextSelected = new Set(state.selectedIds);
    nextSelected.delete(rowId);
    return {
      mode: state.mode,
      selectAll: false,
      selectedIds: nextSelected,
      excludedIds: state.excludedIds,
    };
  }

  function toggleSelectAll(state: SelectionState): SelectionState {
    if (state.mode === 'none' || state.mode === 'single') return state;

    if (state.selectAll) {
      // Deselect all
      return {
        mode: state.mode,
        selectAll: false,
        selectedIds: emptySet<RowId>(),
        excludedIds: emptySet<RowId>(),
      };
    }

    // Select all
    return {
      mode: state.mode,
      selectAll: true,
      selectedIds: emptySet<RowId>(),
      excludedIds: emptySet<RowId>(),
    };
  }

  function isRowSelected(rowId: RowId, state: SelectionState): boolean {
    if (state.mode === 'none') return false;

    if (state.selectAll) {
      return !state.excludedIds.has(rowId);
    }

    return state.selectedIds.has(rowId);
  }

  function getSelectedCount(state: SelectionState, totalRows: number): number {
    if (state.mode === 'none') return 0;

    if (state.selectAll) {
      return totalRows - state.excludedIds.size;
    }

    return state.selectedIds.size;
  }

  function clearSelection(state: SelectionState): SelectionState {
    if (!state.selectAll && state.selectedIds.size === 0) return state;
    return {
      mode: state.mode,
      selectAll: false,
      selectedIds: emptySet<RowId>(),
      excludedIds: emptySet<RowId>(),
    };
  }

  return {
    getState,
    selectRow,
    deselectRow,
    toggleSelectAll,
    isRowSelected,
    getSelectedCount,
    clearSelection,
  };
}
