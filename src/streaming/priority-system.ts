// ============================================================
// Priority System — Visible rows → immediate, offscreen → deferred
// Determines update priority based on viewport visibility
// ============================================================

import type { RowId } from '../types';
import type { Patch } from './diff-engine';

export interface PrioritySystem<TData> {
  /** Classify patches into immediate (visible) and deferred (offscreen) */
  classify(
    patches: ReadonlyArray<Patch<TData>>,
    visibleRowIds: ReadonlySet<RowId>,
  ): PriorityResult<TData>;
  /** Process deferred patches (call during idle time) */
  drainDeferred(): ReadonlyArray<Patch<TData>>;
  /** Check if there are deferred patches */
  hasDeferredPatches(): boolean;
  /** Reset */
  reset(): void;
}

export interface PriorityResult<TData> {
  immediate: ReadonlyArray<Patch<TData>>;
  deferred: ReadonlyArray<Patch<TData>>;
}

export function createPrioritySystem<TData>(): PrioritySystem<TData> {
  // Reusable arrays to avoid allocation
  let immediateBuffer: Patch<TData>[] = [];
  let deferredBuffer: Patch<TData>[] = [];
  let deferredQueue: Patch<TData>[] = [];

  function classify(
    patches: ReadonlyArray<Patch<TData>>,
    visibleRowIds: ReadonlySet<RowId>,
  ): PriorityResult<TData> {
    immediateBuffer.length = 0;
    deferredBuffer.length = 0;

    for (let i = 0; i < patches.length; i++) {
      const patch = patches[i];

      if (patch.type === 'insert' || patch.type === 'remove') {
        // Structural changes are always immediate
        immediateBuffer.push(patch);
      } else if (visibleRowIds.has(patch.id)) {
        // Visible row update → immediate
        immediateBuffer.push(patch);
      } else {
        // Offscreen row update → deferred
        deferredBuffer.push(patch);
        deferredQueue.push(patch);
      }
    }

    return {
      immediate: immediateBuffer,
      deferred: deferredBuffer,
    };
  }

  function drainDeferred(): ReadonlyArray<Patch<TData>> {
    if (deferredQueue.length === 0) return deferredQueue;
    const out = deferredQueue;
    deferredQueue = [];
    return out;
  }

  function hasDeferredPatches(): boolean {
    return deferredQueue.length > 0;
  }

  function reset(): void {
    immediateBuffer = [];
    deferredBuffer = [];
    deferredQueue = [];
  }

  return { classify, drainDeferred, hasDeferredPatches, reset };
}
