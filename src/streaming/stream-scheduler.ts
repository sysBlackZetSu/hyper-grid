// ============================================================
// Stream Scheduler — rAF-batched update loop
// Processes all buffered updates once per frame
// Game-engine style render loop
// ============================================================

export interface StreamScheduler {
  /** Start the update loop */
  start(): void;
  /** Stop the update loop */
  stop(): void;
  /** Register the frame callback */
  onFrame(callback: (timestamp: number) => void): void;
  /** Check if running */
  isRunning(): boolean;
  /** Force a synchronous frame (for testing) */
  forceFrame(): void;
  /** Destroy */
  destroy(): void;
}

export function createStreamScheduler(): StreamScheduler {
  let running = false;
  let rafId: number | null = null;
  let frameCallback: ((timestamp: number) => void) | null = null;
  // Tracks frame timing for external consumers

  function start(): void {
    if (running) return;
    running = true;
    scheduleFrame();
  }

  function stop(): void {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function scheduleFrame(): void {
    if (!running) return;
    rafId = requestAnimationFrame(tick);
  }

  function tick(timestamp: number): void {
    rafId = null;
    if (!running) return;

    if (frameCallback) {
      frameCallback(timestamp);
    }

    // Schedule next frame
    scheduleFrame();
  }

  function onFrame(callback: (timestamp: number) => void): void {
    frameCallback = callback;
  }

  function isRunning(): boolean {
    return running;
  }

  function forceFrame(): void {
    if (frameCallback) {
      frameCallback(performance.now());
    }
  }

  function destroy(): void {
    stop();
    frameCallback = null;
  }

  return { start, stop, onFrame, isRunning, forceFrame, destroy };
}
