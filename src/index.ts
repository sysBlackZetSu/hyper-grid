// ============================================================
// HyperGrid — Next-generation React Data Grid Engine
// ============================================================

// Core engine
export { createGridEngine } from './core';
export { createDataPipeline } from './core/pipeline';

// Store
export { createStore } from './store';

// Virtualization
export { createVirtualizationEngine, createColumnVirtualization } from './virtualization';

// Scheduling
export { createScheduler } from './scheduling';

// Scroll
export { createScrollEngine } from './scroll';

// Selection
export { createSelectionEngine } from './selection';

// Plugins
export { createPluginManager } from './plugins';

// Benchmarking
export {
  createFPSMonitor,
  createMemoryMonitor,
  createRenderCounter,
  createBenchmarkSuite,
} from './benchmark';

// Types
export type {
  // Core types
  RowId,
  ColumnId,
  SortDirection,
  FilterOperator,
  ColumnDef,
  CellRenderer,
  HeaderRenderer,
  CellRendererProps,
  HeaderRendererProps,

  // State types
  SortState,
  FilterState,
  PaginationState,
  ViewportState,
  SelectionState,
  GridState,
  ComputedState,
  VisibleRow,

  // Options & API
  GridOptions,
  GridApi,
  RowIdAccessor,

  // Plugin
  GridPlugin,

  // Scheduler
  TaskPriority,
  ScheduledTask,

  // Store
  Listener,
  Unsubscribe,
  Selector,

  // Benchmark
  FrameMetrics,
  MemoryMetrics,
  RenderMetrics,
  BenchmarkResult,
} from './types';
