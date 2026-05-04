// ============================================================
// Real-Time Grid Engine — Orchestrates all streaming subsystems
// Game-engine style render loop:
//   1. Buffer incoming data (any time)
//   2. Per frame: drain → diff → prioritize → patch DOM
// ============================================================

import type { RowId } from '../types';
import { createStreamBuffer, type StreamBuffer } from './stream-buffer';
import { createDiffEngine, type DiffEngine } from './diff-engine';
import { createStreamScheduler, type StreamScheduler } from './stream-scheduler';
import { createPrioritySystem, type PrioritySystem } from './priority-system';
import { createDOMPatchRenderer, type DOMPatchRenderer } from '../dom-patch';
import { createPositionEngine, type PositionEngine } from '../position';

export interface RealtimeEngineOptions<TData> {
  /** Column field accessors for diff engine */
  fields: ReadonlyArray<{ id: string; accessor: string | ((row: TData) => unknown) }>;
  /** Function to extract display value from data for a field */
  getFieldValue: (data: TData, fieldId: string) => string;
  /** Function to get row ID from data */
  getRowId: (data: TData) => RowId;
  /** CSS class for flash animation on update */
  flashClass?: string;
  /** Animation lerp factor (0-1) */
  lerpFactor?: number;
  /** Auto-start the render loop */
  autoStart?: boolean;
  /** Callback when frame is processed */
  onFrame?: (stats: FrameStats) => void;
}

export interface FrameStats {
  timestamp: number;
  patchCount: number;
  cellsPatched: number;
  deferredCount: number;
  isAnimating: boolean;
}

export interface RealtimeEngine<TData> {
  /** Push a single data update */
  push(id: RowId, data: TData): void;
  /** Push a batch of updates */
  pushBatch(updates: ReadonlyArray<{ id: RowId; data: TData }>): void;
  /** Mark a row for removal */
  remove(id: RowId): void;
  /** Set visible row IDs (for priority system) */
  setVisibleRows(rowIds: ReadonlySet<RowId>): void;
  /** Access the DOM patch renderer (for cell registration) */
  readonly domPatcher: DOMPatchRenderer<TData>;
  /** Access the position engine */
  readonly positionEngine: PositionEngine;
  /** Access the stream buffer */
  readonly buffer: StreamBuffer<TData>;
  /** Start the render loop */
  start(): void;
  /** Stop the render loop */
  stop(): void;
  /** Get the current data map */
  getDataMap(): ReadonlyMap<RowId, TData>;
  /** Force process a frame (for testing) */
  forceFrame(): void;
  /** Destroy everything */
  destroy(): void;
}

export function createRealtimeEngine<TData>(options: RealtimeEngineOptions<TData>): RealtimeEngine<TData> {
  const {
    fields,
    getFieldValue,
    flashClass = 'hg-cell-flash',
    lerpFactor = 0.15,
    autoStart = true,
    onFrame,
  } = options;

  // Current data state
  const dataMap = new Map<RowId, TData>();

  // Subsystems
  const buffer: StreamBuffer<TData> = createStreamBuffer();
  const diffEngine: DiffEngine<TData> = createDiffEngine();
  const scheduler: StreamScheduler = createStreamScheduler();
  const priority: PrioritySystem<TData> = createPrioritySystem();
  const domPatcher: DOMPatchRenderer<TData> = createDOMPatchRenderer();
  const positionEngine: PositionEngine = createPositionEngine();

  positionEngine.setLerpFactor(lerpFactor);

  // Current visible rows
  let visibleRowIds: ReadonlySet<RowId> = new Set();

  // Wire up the frame loop
  scheduler.onFrame(processFrame);

  function processFrame(timestamp: number): void {
    let patchCount = 0;
    let cellsPatched = 0;
    let deferredCount = 0;

    // Step 1: Drain buffered updates
    if (buffer.hasPending()) {
      const { updates, removals } = buffer.drain();

      // Step 2: Compute diffs
      const patches = diffEngine.computePatches(dataMap, updates, removals, fields);
      patchCount = patches.length;

      // Step 3: Apply to data map (source of truth)
      applyToDataMap(updates, removals);

      // Step 4: Prioritize
      if (patches.length > 0) {
        const { immediate, deferred } = priority.classify(patches, visibleRowIds);
        deferredCount = deferred.length;

        // Step 5: Patch DOM for visible rows immediately
        if (immediate.length > 0) {
          cellsPatched = domPatcher.applyPatches(immediate, getFieldValue);

          // Flash animations
          for (let i = 0; i < immediate.length; i++) {
            const patch = immediate[i];
            if (patch.type === 'update' && patch.changedFields) {
              domPatcher.flashCells(patch.id, patch.changedFields, flashClass);
            }
          }
        }
      }
    }

    // Step 6: Process deferred patches during idle
    if (priority.hasDeferredPatches()) {
      const deferred = priority.drainDeferred();
      domPatcher.applyPatches(deferred, getFieldValue);
    }

    // Step 7: Tick position animations
    const isAnimating = positionEngine.tick(timestamp);
    if (isAnimating) {
      positionEngine.applyToDOM(function getRowNode(rowId: RowId): HTMLElement | undefined {
        return domPatcher.getRowNode(rowId);
      });
    }

    // Notify
    if (onFrame) {
      onFrame({ timestamp, patchCount, cellsPatched, deferredCount, isAnimating });
    }
  }

  function applyToDataMap(updates: Map<RowId, TData>, removals: Set<RowId>): void {
    removals.forEach(function removeFromMap(id: RowId): void {
      dataMap.delete(id);
    });
    updates.forEach(function updateMap(data: TData, id: RowId): void {
      dataMap.set(id, data);
    });
  }

  function push(id: RowId, data: TData): void {
    buffer.put(id, data);
  }

  function pushBatch(updates: ReadonlyArray<{ id: RowId; data: TData }>): void {
    buffer.putBatch(updates);
  }

  function removeRow(id: RowId): void {
    buffer.remove(id);
  }

  function setVisibleRows(rowIds: ReadonlySet<RowId>): void {
    visibleRowIds = rowIds;
  }

  function start(): void {
    scheduler.start();
  }

  function stop(): void {
    scheduler.stop();
  }

  function getDataMap(): ReadonlyMap<RowId, TData> {
    return dataMap;
  }

  function forceFrame(): void {
    scheduler.forceFrame();
  }

  function destroy(): void {
    scheduler.destroy();
    buffer.reset();
    priority.reset();
    domPatcher.clear();
    positionEngine.reset();
    dataMap.clear();
  }

  // Auto-start
  if (autoStart) {
    start();
  }

  return {
    push,
    pushBatch,
    remove: removeRow,
    setVisibleRows,
    domPatcher,
    positionEngine,
    buffer,
    start,
    stop,
    getDataMap,
    forceFrame,
    destroy,
  };
}
