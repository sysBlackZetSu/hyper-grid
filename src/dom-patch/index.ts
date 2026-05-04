// ============================================================
// Direct DOM Patch Renderer
// Bypasses React entirely — patches DOM nodes directly
// Maintains Map<cellId, DOMNode> for O(1) cell access
// Uses node.textContent for maximum speed
// ============================================================

import type { RowId, ColumnId } from '../types';
import type { Patch } from '../streaming/diff-engine';

/** Composite key for cell lookup */
type CellKey = string;

function makeCellKey(rowId: RowId, colId: ColumnId): CellKey {
  return `${rowId}:${colId}`;
}

export interface DOMPatchRenderer<TData> {
  /** Register a DOM node for a cell */
  registerCell(rowId: RowId, colId: ColumnId, node: HTMLElement): void;
  /** Unregister a cell (when row leaves viewport) */
  unregisterCell(rowId: RowId, colId: ColumnId): void;
  /** Unregister all cells for a row */
  unregisterRow(rowId: RowId): void;
  /** Register a row container node */
  registerRow(rowId: RowId, node: HTMLElement): void;
  /** Unregister a row container node */
  unregisterRowNode(rowId: RowId): void;
  /** Apply patches directly to DOM */
  applyPatches(
    patches: ReadonlyArray<Patch<TData>>,
    getFieldValue: (data: TData, fieldId: string) => string,
  ): number;
  /** Apply a flash animation to changed cells */
  flashCells(rowId: RowId, changedFields: ReadonlyArray<string>, cssClass: string): void;
  /** Get the DOM node for a cell */
  getCell(rowId: RowId, colId: ColumnId): HTMLElement | undefined;
  /** Get the row container node */
  getRowNode(rowId: RowId): HTMLElement | undefined;
  /** Get total registered cells count */
  cellCount(): number;
  /** Clear all registrations */
  clear(): void;
}

export function createDOMPatchRenderer<TData>(): DOMPatchRenderer<TData> {
  // Cell registry — O(1) lookup
  const cellMap = new Map<CellKey, HTMLElement>();
  // Row registry
  const rowMap = new Map<RowId, HTMLElement>();
  // Track which cells belong to which row (for bulk unregister)
  const rowCells = new Map<RowId, CellKey[]>();

  // Reusable array for flash timeouts
  const flashTimeouts = new Map<CellKey, ReturnType<typeof setTimeout>>();

  function registerCell(rowId: RowId, colId: ColumnId, node: HTMLElement): void {
    const key = makeCellKey(rowId, colId);
    cellMap.set(key, node);

    // Track for row-level unregister
    let cells = rowCells.get(rowId);
    if (!cells) {
      cells = [];
      rowCells.set(rowId, cells);
    }
    cells.push(key);
  }

  function unregisterCell(rowId: RowId, colId: ColumnId): void {
    const key = makeCellKey(rowId, colId);
    cellMap.delete(key);

    // Clean up flash timeout
    const timeout = flashTimeouts.get(key);
    if (timeout !== undefined) {
      clearTimeout(timeout);
      flashTimeouts.delete(key);
    }
  }

  function unregisterRow(rowId: RowId): void {
    const cells = rowCells.get(rowId);
    if (cells) {
      for (let i = 0; i < cells.length; i++) {
        cellMap.delete(cells[i]);
        const timeout = flashTimeouts.get(cells[i]);
        if (timeout !== undefined) {
          clearTimeout(timeout);
          flashTimeouts.delete(cells[i]);
        }
      }
      rowCells.delete(rowId);
    }
    rowMap.delete(rowId);
  }

  function registerRow(rowId: RowId, node: HTMLElement): void {
    rowMap.set(rowId, node);
  }

  function unregisterRowNode(rowId: RowId): void {
    rowMap.delete(rowId);
  }

  function applyPatches(
    patches: ReadonlyArray<Patch<TData>>,
    getFieldValue: (data: TData, fieldId: string) => string,
  ): number {
    let patchedCells = 0;

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];

      if (patch.type === 'update' && patch.data && patch.changedFields) {
        // Direct DOM patching — no React re-render
        for (let j = 0; j < patch.changedFields.length; j++) {
          const fieldId = patch.changedFields[j];
          const key = makeCellKey(patch.id, fieldId);
          const node = cellMap.get(key);
          if (node) {
            // Critical hot path: direct textContent assignment
            node.textContent = getFieldValue(patch.data, fieldId);
            patchedCells++;
          }
        }
      }
      // insert/remove patches are handled by the virtualization layer
      // (they require structural DOM changes)
    }

    return patchedCells;
  }

  function flashCells(rowId: RowId, changedFields: ReadonlyArray<string>, cssClass: string): void {
    for (let i = 0; i < changedFields.length; i++) {
      const key = makeCellKey(rowId, changedFields[i]);
      const node = cellMap.get(key);
      if (!node) continue;

      // Remove existing flash timeout
      const existing = flashTimeouts.get(key);
      if (existing !== undefined) {
        clearTimeout(existing);
        node.classList.remove(cssClass);
      }

      // Add flash class
      node.classList.add(cssClass);

      // Schedule removal
      flashTimeouts.set(key, setTimeout(function removeFlash(): void {
        node.classList.remove(cssClass);
        flashTimeouts.delete(key);
      }, 300));
    }
  }

  function getCell(rowId: RowId, colId: ColumnId): HTMLElement | undefined {
    return cellMap.get(makeCellKey(rowId, colId));
  }

  function getRowNode(rowId: RowId): HTMLElement | undefined {
    return rowMap.get(rowId);
  }

  function cellCount(): number {
    return cellMap.size;
  }

  function clear(): void {
    cellMap.clear();
    rowMap.clear();
    rowCells.clear();
    flashTimeouts.forEach(function clearTimeoutEntry(t: ReturnType<typeof setTimeout>): void {
      clearTimeout(t);
    });
    flashTimeouts.clear();
  }

  return {
    registerCell,
    unregisterCell,
    unregisterRow,
    registerRow,
    unregisterRowNode,
    applyPatches,
    flashCells,
    getCell,
    getRowNode,
    cellCount,
    clear,
  };
}
