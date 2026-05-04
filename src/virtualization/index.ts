// ============================================================
// Virtualization Engine — Row + Column
// - Dynamic height with prefix sum + binary search
// - O(log n) visible window computation
// - Reuses VisibleRow objects to reduce GC pressure
// ============================================================

import type { VisibleRow } from '../types';
import { lowerBound, clamp } from '../utils';

export interface VirtualizationEngine<TData> {
  /** Update height map for a specific row */
  setRowHeight(index: number, height: number): void;
  /** Rebuild prefix sums (call after batch height updates) */
  rebuild(): void;
  /** Compute visible rows for given scroll position and viewport */
  computeVisibleRows(
    data: ReadonlyArray<TData>,
    scrollTop: number,
    viewportHeight: number,
    overscan: number,
    defaultRowHeight: number,
  ): ReadonlyArray<VisibleRow<TData>>;
  /** Get total content height */
  getTotalHeight(dataLength: number, defaultRowHeight: number): number;
  /** Get offset for a specific row index */
  getRowOffset(index: number, defaultRowHeight: number): number;
  /** Reset all cached heights */
  reset(): void;
}

export function createVirtualizationEngine<TData>(): VirtualizationEngine<TData> {
  // Height map: index → measured height
  let heightMap: Map<number, number> = new Map();

  // Prefix sum array for O(log n) offset lookups
  let prefixSums: number[] = [];
  let prefixSumsValid = false;
  let prefixSumsLength = 0;
  let lastDefaultHeight = 0;

  // Reusable visible row pool to minimize allocations
  let visibleRowPool: Array<VisibleRow<TData>> = [];
  let lastVisibleResult: ReadonlyArray<VisibleRow<TData>> = [];
  let lastScrollTop = -1;
  let lastViewportHeight = -1;
  let lastDataRef: ReadonlyArray<TData> | null = null;
  let lastOverscan = -1;

  function setRowHeight(index: number, height: number): void {
    const existing = heightMap.get(index);
    if (existing === height) return;
    heightMap.set(index, height);
    prefixSumsValid = false;
  }

  function buildPrefixSums(dataLength: number, defaultHeight: number): void {
    if (prefixSumsValid && prefixSumsLength === dataLength && lastDefaultHeight === defaultHeight) {
      return;
    }

    lastDefaultHeight = defaultHeight;
    prefixSumsLength = dataLength;

    // Reuse array if possible
    if (prefixSums.length < dataLength + 1) {
      prefixSums = new Array<number>(dataLength + 1);
    }

    prefixSums[0] = 0;
    for (let i = 0; i < dataLength; i++) {
      const h = heightMap.get(i) ?? defaultHeight;
      prefixSums[i + 1] = prefixSums[i] + h;
    }

    prefixSumsValid = true;
  }

  function rebuild(): void {
    prefixSumsValid = false;
  }

  function computeVisibleRows(
    data: ReadonlyArray<TData>,
    scrollTop: number,
    viewportHeight: number,
    overscan: number,
    defaultRowHeight: number,
  ): ReadonlyArray<VisibleRow<TData>> {
    const len = data.length;
    if (len === 0) return [];

    // Fast path: if nothing changed, return cached result
    if (
      scrollTop === lastScrollTop &&
      viewportHeight === lastViewportHeight &&
      data === lastDataRef &&
      overscan === lastOverscan
    ) {
      return lastVisibleResult;
    }

    lastScrollTop = scrollTop;
    lastViewportHeight = viewportHeight;
    lastDataRef = data;
    lastOverscan = overscan;

    // Ensure prefix sums are up to date
    buildPrefixSums(len, defaultRowHeight);

    // Binary search for start index
    const startIdx = findStartIndex(scrollTop, len);
    const endScrollTop = scrollTop + viewportHeight;
    const endIdx = findEndIndex(endScrollTop, len);

    // Apply overscan
    const visibleStart = clamp(startIdx - overscan, 0, len - 1);
    const visibleEnd = clamp(endIdx + overscan, 0, len - 1);

    const count = visibleEnd - visibleStart + 1;

    // Grow pool if needed (but never shrink — avoids allocation)
    while (visibleRowPool.length < count) {
      visibleRowPool.push({ data: null as unknown as TData, index: 0, originalIndex: 0, offsetTop: 0, height: 0 });
    }

    // Populate visible rows using pool objects
    const result: Array<VisibleRow<TData>> = new Array(count);
    for (let i = 0; i < count; i++) {
      const rowIndex = visibleStart + i;
      const h = heightMap.get(rowIndex) ?? defaultRowHeight;
      const offset = prefixSums[rowIndex];

      // Mutate pooled object to avoid allocation
      const pooled = visibleRowPool[i] as { data: TData; index: number; originalIndex: number; offsetTop: number; height: number };
      pooled.data = data[rowIndex];
      pooled.index = rowIndex;
      pooled.originalIndex = rowIndex;
      pooled.offsetTop = offset;
      pooled.height = h;

      result[i] = pooled;
    }

    lastVisibleResult = result;
    return result;
  }

  function findStartIndex(scrollTop: number, _len: number): number {
    // Binary search on prefix sums
    const idx = lowerBound(prefixSums, scrollTop);
    return clamp(idx - 1, 0, _len - 1);
  }

  function findEndIndex(scrollBottom: number, _len: number): number {
    const idx = lowerBound(prefixSums, scrollBottom);
    return clamp(idx - 1, 0, _len - 1);
  }

  function getTotalHeight(dataLength: number, defaultRowHeight: number): number {
    if (dataLength === 0) return 0;
    buildPrefixSums(dataLength, defaultRowHeight);
    return prefixSums[dataLength];
  }

  function getRowOffset(index: number, defaultRowHeight: number): number {
    if (index <= 0) return 0;
    buildPrefixSums(index + 1, defaultRowHeight);
    return prefixSums[index];
  }

  function reset(): void {
    heightMap = new Map();
    prefixSums = [];
    prefixSumsValid = false;
    prefixSumsLength = 0;
    visibleRowPool = [];
    lastVisibleResult = [];
    lastScrollTop = -1;
    lastViewportHeight = -1;
    lastDataRef = null;
    lastOverscan = -1;
  }

  return {
    setRowHeight,
    rebuild,
    computeVisibleRows,
    getTotalHeight,
    getRowOffset,
    reset,
  };
}

// ---- Column Virtualization ----

export interface ColumnVirtualization {
  computeVisibleColumns(
    columns: ReadonlyArray<{ id: string; width: number; left: number }>,
    scrollLeft: number,
    viewportWidth: number,
    overscan: number,
  ): { startIdx: number; endIdx: number; totalWidth: number };
}

export function createColumnVirtualization(): ColumnVirtualization {
  let lastScrollLeft = -1;
  let lastViewportWidth = -1;
  let lastResult = { startIdx: 0, endIdx: 0, totalWidth: 0 };

  function computeVisibleColumns(
    columns: ReadonlyArray<{ id: string; width: number; left: number }>,
    scrollLeft: number,
    viewportWidth: number,
    overscan: number,
  ): { startIdx: number; endIdx: number; totalWidth: number } {
    if (scrollLeft === lastScrollLeft && viewportWidth === lastViewportWidth) {
      return lastResult;
    }

    lastScrollLeft = scrollLeft;
    lastViewportWidth = viewportWidth;

    const len = columns.length;
    if (len === 0) {
      lastResult = { startIdx: 0, endIdx: 0, totalWidth: 0 };
      return lastResult;
    }

    let startIdx = 0;
    let endIdx = len - 1;

    // Find first visible column
    for (let i = 0; i < len; i++) {
      if (columns[i].left + columns[i].width > scrollLeft) {
        startIdx = i;
        break;
      }
    }

    // Find last visible column
    const scrollRight = scrollLeft + viewportWidth;
    for (let i = startIdx; i < len; i++) {
      if (columns[i].left >= scrollRight) {
        endIdx = i - 1;
        break;
      }
      endIdx = i;
    }

    // Apply overscan
    startIdx = Math.max(0, startIdx - overscan);
    endIdx = Math.min(len - 1, endIdx + overscan);

    const totalWidth = columns[len - 1].left + columns[len - 1].width;

    lastResult = { startIdx, endIdx, totalWidth };
    return lastResult;
  }

  return { computeVisibleColumns };
}
