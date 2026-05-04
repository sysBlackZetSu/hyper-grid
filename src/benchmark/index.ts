// ============================================================
// Benchmarking Utilities
// - FPS measurement during scroll
// - Memory usage tracking
// - Render count tracking
// ============================================================

import type { FrameMetrics, MemoryMetrics, RenderMetrics, BenchmarkResult } from '../types';

// ---- FPS Monitor ----

export interface FPSMonitor {
  start(): void;
  stop(): void;
  getMetrics(): FrameMetrics;
  reset(): void;
}

export function createFPSMonitor(): FPSMonitor {
  let running = false;
  let rafId: number | null = null;
  let lastFrameTime = 0;
  let droppedFrames = 0;
  const frameTimes: number[] = [];
  const MAX_SAMPLES = 120; // 2 seconds at 60fps

  function start(): void {
    if (running) return;
    running = true;
    lastFrameTime = performance.now();
    droppedFrames = 0;
    frameTimes.length = 0;
    tick();
  }

  function tick(): void {
    if (!running) return;

    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;

    if (delta > 0) {
      frameTimes.push(delta);
      if (frameTimes.length > MAX_SAMPLES) {
        frameTimes.shift();
      }


      // Dropped frame = took longer than 16.67ms
      if (delta > 16.67) {
        droppedFrames++;
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function stop(): void {
    running = false;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function getMetrics(): FrameMetrics {
    if (frameTimes.length === 0) {
      return { fps: 0, frameTime: 0, frameTimes: [], droppedFrames: 0 };
    }

    let totalTime = 0;
    for (let i = 0; i < frameTimes.length; i++) {
      totalTime += frameTimes[i];
    }

    const avgFrameTime = totalTime / frameTimes.length;
    const fps = 1000 / avgFrameTime;

    return {
      fps: Math.round(fps * 10) / 10,
      frameTime: Math.round(avgFrameTime * 100) / 100,
      frameTimes: frameTimes.slice(),
      droppedFrames,
    };
  }

  function reset(): void {
    droppedFrames = 0;
    frameTimes.length = 0;
  }

  return { start, stop, getMetrics, reset };
}

// ---- Memory Monitor ----

export interface MemoryMonitor {
  getMetrics(): MemoryMetrics | null;
  snapshot(): MemoryMetrics | null;
}

export function createMemoryMonitor(): MemoryMonitor {
  function getMetrics(): MemoryMetrics | null {
    // Only available in Chrome with --enable-precise-memory-info
    const perf = performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    };
    if (!perf.memory) return null;

    return {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
    };
  }

  function snapshot(): MemoryMetrics | null {
    return getMetrics();
  }

  return { getMetrics, snapshot };
}

// ---- Render Counter ----

export interface RenderCounter {
  increment(renderTime: number): void;
  getMetrics(): RenderMetrics;
  reset(): void;
}

export function createRenderCounter(): RenderCounter {
  let renderCount = 0;
  let totalRenderTime = 0;
  let lastRenderTime = 0;

  function increment(renderTime: number): void {
    renderCount++;
    lastRenderTime = renderTime;
    totalRenderTime += renderTime;
  }

  function getMetrics(): RenderMetrics {
    return {
      renderCount,
      lastRenderTime: Math.round(lastRenderTime * 100) / 100,
      averageRenderTime:
        renderCount > 0 ? Math.round((totalRenderTime / renderCount) * 100) / 100 : 0,
    };
  }

  function reset(): void {
    renderCount = 0;
    totalRenderTime = 0;
    lastRenderTime = 0;
  }

  return { increment, getMetrics, reset };
}

// ---- Combined Benchmark ----

export interface BenchmarkSuite {
  fps: FPSMonitor;
  memory: MemoryMonitor;
  render: RenderCounter;
  start(): void;
  stop(): void;
  getResults(): BenchmarkResult;
  reset(): void;
}

export function createBenchmarkSuite(): BenchmarkSuite {
  const fps = createFPSMonitor();
  const memory = createMemoryMonitor();
  const render = createRenderCounter();

  function start(): void {
    fps.start();
  }

  function stop(): void {
    fps.stop();
  }

  function getResults(): BenchmarkResult {
    return {
      frame: fps.getMetrics(),
      memory: memory.getMetrics(),
      render: render.getMetrics(),
    };
  }

  function reset(): void {
    fps.reset();
    render.reset();
  }

  return { fps, memory, render, start, stop, getResults, reset };
}
