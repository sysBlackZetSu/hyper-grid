// ============================================================
// Stream Buffer — Last-write-wins data accumulator
// Map<id, latestData> — overwrites old updates
// Designed for 100–1000 updates/second with zero allocations
// ============================================================

import type { RowId } from '../types';

export interface StreamBuffer<TData> {
  /** Ingest a single update (last-write-wins) */
  put(id: RowId, data: TData): void;
  /** Ingest a batch of updates */
  putBatch(updates: ReadonlyArray<{ id: RowId; data: TData }>): void;
  /** Mark a row for removal */
  remove(id: RowId): void;
  /** Drain all buffered updates since last drain — returns and clears the buffer */
  drain(): DrainResult<TData>;
  /** Check if buffer has pending changes */
  hasPending(): boolean;
  /** Get current buffer size */
  size(): number;
  /** Reset the buffer */
  reset(): void;
}

export interface DrainResult<TData> {
  updates: Map<RowId, TData>;
  removals: Set<RowId>;
}

export function createStreamBuffer<TData>(): StreamBuffer<TData> {
  // Pending updates — last-write-wins semantics
  let pendingUpdates: Map<RowId, TData> = new Map();
  let pendingRemovals: Set<RowId> = new Set();

  // Double-buffer: swap on drain to avoid allocation
  let drainUpdates: Map<RowId, TData> = new Map();
  let drainRemovals: Set<RowId> = new Set();

  function put(id: RowId, data: TData): void {
    // Remove from removals if re-inserted
    pendingRemovals.delete(id);
    // Overwrite — last-write-wins
    pendingUpdates.set(id, data);
  }

  function putBatch(updates: ReadonlyArray<{ id: RowId; data: TData }>): void {
    for (let i = 0; i < updates.length; i++) {
      const u = updates[i];
      pendingRemovals.delete(u.id);
      pendingUpdates.set(u.id, u.data);
    }
  }

  function remove(id: RowId): void {
    pendingUpdates.delete(id);
    pendingRemovals.add(id);
  }

  function drain(): DrainResult<TData> {
    // Swap buffers — zero allocation
    const outUpdates = pendingUpdates;
    const outRemovals = pendingRemovals;

    pendingUpdates = drainUpdates;
    pendingRemovals = drainRemovals;

    // Clear the swapped-in buffers for next cycle
    pendingUpdates.clear();
    pendingRemovals.clear();

    // Store references for next swap
    drainUpdates = outUpdates;
    drainRemovals = outRemovals;

    return { updates: outUpdates, removals: outRemovals };
  }

  function hasPending(): boolean {
    return pendingUpdates.size > 0 || pendingRemovals.size > 0;
  }

  function size(): number {
    return pendingUpdates.size + pendingRemovals.size;
  }

  function reset(): void {
    pendingUpdates.clear();
    pendingRemovals.clear();
    drainUpdates.clear();
    drainRemovals.clear();
  }

  return { put, putBatch, remove, drain, hasPending, size, reset };
}
