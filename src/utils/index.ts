// ============================================================
// Utility functions — zero-dependency, inlined where possible
// ============================================================

import type { ColumnDef } from '../types';

/** Shallow equality check for two values */
export function shallowEqual<T>(a: T, b: T): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
    ) {
      return false;
    }
  }

  return true;
}

/** Get value from a row using a column accessor */
export function getAccessorValue<TData>(row: TData, accessor: ColumnDef<TData>['accessor']): unknown {
  if (typeof accessor === 'function') {
    return accessor(row);
  }
  return (row as Record<string, unknown>)[accessor as string];
}

/** Binary search: find index of first element >= target in sorted array */
export function lowerBound(arr: ReadonlyArray<number>, target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Binary search: find index of first element > target in sorted array */
export function upperBound(arr: ReadonlyArray<number>, target: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= target) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Clamp a value between min and max */
export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/** Noop function for default callbacks */
export function noop(): void {
  // intentionally empty
}

/** Stable identity for empty arrays to avoid re-renders */
const EMPTY_ARRAY: ReadonlyArray<never> = [];
export function emptyArray<T>(): ReadonlyArray<T> {
  return EMPTY_ARRAY as ReadonlyArray<T>;
}

/** Reuse the same empty set to avoid allocations */
const EMPTY_SET: ReadonlySet<never> = new Set();
export function emptySet<T>(): ReadonlySet<T> {
  return EMPTY_SET as ReadonlySet<T>;
}
