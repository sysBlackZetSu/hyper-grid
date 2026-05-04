# @hyper-grid/core

Next-generation React Data Grid engine with extreme performance optimization across CPU, memory, rendering, and bundle size.

## Performance Targets

- **60fps scroll** for 10k–1M rows
- **< 16ms frame time** during scroll
- **< 50ms cold start** (1k rows virtualized)
- **< 30kb core bundle** (minified + gzipped)
- **Zero unnecessary re-renders**
- **Minimal GC pressure**

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   React Adapter                  │
│   (useGridEngine, useVirtualRows, HyperGrid)    │
├─────────────────────────────────────────────────┤
│                 Reactive Store                   │
│   (subscription-based, selector updates)         │
├─────────────┬──────────────┬────────────────────┤
│  Core Engine│ Virtualization│   Scroll Engine    │
│  (pipeline) │ (row + col)  │  (passive, rAF)    │
├─────────────┼──────────────┼────────────────────┤
│  Selection  │  Scheduling  │   Plugin System    │
│  (O(1) ops) │ (cooperative)│  (zero-cost)       │
└─────────────┴──────────────┴────────────────────┘
```

### Core Engine (Pure TypeScript — no React, no DOM)
- Data pipeline: filter → sort → paginate
- Memoized stages with referential equality checks
- Compiled filter functions for short-circuit evaluation
- Precomputed accessor values for O(n log n) stable sort

### Reactive Store
- Custom ultra-light subscription system
- O(1) subscribe/unsubscribe via Set
- Selector-based slice subscriptions
- Structural sharing — no deep cloning

### Virtualization Engine
- Row + column virtualization
- Dynamic height support via height map
- Prefix sum array for O(log n) offset lookups
- Binary search for visible window computation
- Object pooling to reduce GC pressure

### Scheduling System
- `requestAnimationFrame` for UI updates
- `requestIdleCallback` for heavy computation
- Priority queues (immediate → high → normal → low → idle)
- Cooperative task chunking for 100k+ row operations

### Scroll Engine
- Passive event listeners
- rAF-throttled scroll handling
- No heavy work inside scroll handler

### Selection Model
- O(1) `isSelected` check
- `selectAll` mode stores `excludedIds` (not all IDs)
- Normal mode stores `selectedIds`

### Plugin System
- Zero-cost abstraction when unused
- Tree-shakable — no base bundle impact

## Installation

```bash
npm install @hyper-grid/core
```

## Quick Start

```tsx
import { HyperGrid } from '@hyper-grid/core/react';

const columns = [
  { id: 'id', header: 'ID', accessor: 'id', width: 80 },
  { id: 'name', header: 'Name', accessor: 'name', width: 200 },
  { id: 'email', header: 'Email', accessor: 'email', width: 250 },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, sortable: true },
];

const data = Array.from({ length: 100000 }, (_, i) => ({
  id: i,
  name: `User ${i}`,
  email: `user${i}@example.com`,
  age: 20 + (i % 60),
}));

function App() {
  return (
    <HyperGrid
      data={data}
      columns={columns}
      getRowId={(row) => row.id}
      height={600}
      rowHeight={36}
      selectionMode="multiple"
    />
  );
}
```

## Headless Usage (Core Engine Only)

```ts
import { createGridEngine } from '@hyper-grid/core';

const engine = createGridEngine({
  data: myData,
  columns: myColumns,
  getRowId: (row) => row.id,
});

// Set sorting
engine.setSorting([{ columnId: 'name', direction: 'asc' }]);

// Set filters
engine.setFilters([{ columnId: 'age', operator: 'gt', value: 25 }]);

// Get computed state
const { visibleRows, totalFilteredCount } = engine.getComputedState();

// Subscribe to changes
const unsubscribe = engine.subscribe(() => {
  console.log('State changed:', engine.getState());
});

// Cleanup
engine.destroy();
```

## Benchmarking

```ts
import { createBenchmarkSuite } from '@hyper-grid/core';

const bench = createBenchmarkSuite();
bench.start();

// ... scroll / interact with grid ...

const results = bench.getResults();
console.log('FPS:', results.frame.fps);
console.log('Avg frame time:', results.frame.frameTime, 'ms');
console.log('Dropped frames:', results.frame.droppedFrames);
console.log('Render count:', results.render.renderCount);

bench.stop();
```

## Build

```bash
npm run build        # ESM + CJS + Types
npm run typecheck    # Type checking only
npm run lint         # ESLint
```

## Design Philosophy

- **Game engine** mindset: render loop, frame budget, object pooling
- **Database engine** mindset: query optimization, memoized pipeline
- **JS runtime** mindset: monomorphic objects, minimal allocations, no try/catch in hot paths
- **Library author** mindset: stable API, tree-shakable, zero hidden costs

## License

MIT
