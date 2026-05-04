// ============================================================
// Cooperative Scheduling System
// - rAF for UI updates
// - rIC for heavy computation
// - Task chunking for large datasets
// ============================================================

import type { TaskPriority, ScheduledTask } from '../types';

export interface Scheduler {
  /** Schedule a task at given priority */
  schedule(fn: () => void, priority?: TaskPriority): number;
  /** Cancel a scheduled task */
  cancel(taskId: number): void;
  /** Flush all immediate tasks synchronously */
  flushImmediate(): void;
  /** Chunk a large task into cooperative frames */
  chunkTask<T>(
    items: ReadonlyArray<T>,
    processFn: (item: T, index: number) => void,
    chunkSize?: number,
    onComplete?: () => void,
  ): number;
  /** Cancel a chunked task */
  cancelChunk(chunkId: number): void;
  /** Destroy the scheduler */
  destroy(): void;
}

export function createScheduler(): Scheduler {
  let nextId = 1;
  let destroyed = false;

  // Priority queues (simple arrays — avoid heap overhead for typical usage)
  const immediateQueue: ScheduledTask[] = [];
  const highQueue: ScheduledTask[] = [];
  const normalQueue: ScheduledTask[] = [];
  const lowQueue: ScheduledTask[] = [];
  const idleQueue: ScheduledTask[] = [];

  const pendingTasks = new Map<number, ScheduledTask>();
  const activeChunks = new Map<number, boolean>();

  let rafId: number | null = null;
  let ricId: ReturnType<typeof requestIdleCallback> | null = null;
  let isProcessing = false;

  function schedule(fn: () => void, priority: TaskPriority = 'normal'): number {
    if (destroyed) return -1;

    const id = nextId++;
    const task: ScheduledTask = { id, fn, priority };
    pendingTasks.set(id, task);

    switch (priority) {
      case 'immediate':
        immediateQueue.push(task);
        // Process immediately on next microtask
        queueMicrotask(processImmediate);
        break;
      case 'high':
        highQueue.push(task);
        scheduleRaf();
        break;
      case 'normal':
        normalQueue.push(task);
        scheduleRaf();
        break;
      case 'low':
        lowQueue.push(task);
        scheduleRaf();
        break;
      case 'idle':
        idleQueue.push(task);
        scheduleRic();
        break;
    }

    return id;
  }

  function cancel(taskId: number): void {
    pendingTasks.delete(taskId);
  }

  function scheduleRaf(): void {
    if (rafId !== null || destroyed) return;
    rafId = requestAnimationFrame(processRafQueue);
  }

  function scheduleRic(): void {
    if (ricId !== null || destroyed) return;
    if (typeof requestIdleCallback !== 'undefined') {
      ricId = requestIdleCallback(processIdleQueue);
    } else {
      // Fallback for browsers without rIC
      ricId = setTimeout(processIdleQueue, 50) as unknown as ReturnType<typeof requestIdleCallback>;
    }
  }

  function processImmediate(): void {
    if (isProcessing || destroyed) return;
    flushImmediate();
  }

  function flushImmediate(): void {
    isProcessing = true;
    while (immediateQueue.length > 0) {
      const task = immediateQueue.shift()!;
      if (pendingTasks.has(task.id)) {
        pendingTasks.delete(task.id);
        task.fn();
      }
    }
    isProcessing = false;
  }

  function processRafQueue(): void {
    rafId = null;
    if (destroyed) return;

    isProcessing = true;
    const startTime = performance.now();
    const budget = 12; // ms — leave room for browser work within 16ms frame

    // Process high priority first
    processQueue(highQueue, startTime, budget);

    // Then normal
    if (performance.now() - startTime < budget) {
      processQueue(normalQueue, startTime, budget);
    }

    // Then low
    if (performance.now() - startTime < budget) {
      processQueue(lowQueue, startTime, budget);
    }

    isProcessing = false;

    // Reschedule if work remains
    if (highQueue.length > 0 || normalQueue.length > 0 || lowQueue.length > 0) {
      scheduleRaf();
    }
  }

  function processIdleQueue(): void {
    ricId = null;
    if (destroyed) return;

    isProcessing = true;
    const startTime = performance.now();
    const budget = 50; // ms — idle time budget

    processQueue(idleQueue, startTime, budget);

    isProcessing = false;

    if (idleQueue.length > 0) {
      scheduleRic();
    }
  }

  function processQueue(queue: ScheduledTask[], startTime: number, budget: number): void {
    while (queue.length > 0) {
      if (performance.now() - startTime >= budget) break;

      const task = queue.shift()!;
      if (pendingTasks.has(task.id)) {
        pendingTasks.delete(task.id);
        task.fn();
      }
    }
  }

  function chunkTask<T>(
    items: ReadonlyArray<T>,
    processFn: (item: T, index: number) => void,
    chunkSize: number = 1000,
    onComplete?: () => void,
  ): number {
    const chunkId = nextId++;
    activeChunks.set(chunkId, true);

    let currentIndex = 0;

    function processChunk(): void {
      if (!activeChunks.has(chunkId) || destroyed) return;

      const end = Math.min(currentIndex + chunkSize, items.length);

      for (let i = currentIndex; i < end; i++) {
        processFn(items[i], i);
      }

      currentIndex = end;

      if (currentIndex < items.length) {
        // Schedule next chunk
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processChunk);
        } else {
          setTimeout(processChunk, 0);
        }
      } else {
        activeChunks.delete(chunkId);
        if (onComplete) onComplete();
      }
    }

    // Start first chunk
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(processChunk);
    } else {
      setTimeout(processChunk, 0);
    }

    return chunkId;
  }

  function cancelChunk(chunkId: number): void {
    activeChunks.delete(chunkId);
  }

  function destroy(): void {
    destroyed = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (ricId !== null) {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(ricId);
      }
      ricId = null;
    }
    immediateQueue.length = 0;
    highQueue.length = 0;
    normalQueue.length = 0;
    lowQueue.length = 0;
    idleQueue.length = 0;
    pendingTasks.clear();
    activeChunks.clear();
  }

  return {
    schedule,
    cancel,
    flushImmediate,
    chunkTask,
    cancelChunk,
    destroy,
  };
}
