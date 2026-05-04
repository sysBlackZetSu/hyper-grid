# Performance Analysis — @hyper-grid/core

## Architecture Decisions & Their Performance Impact

### 1. Data Pipeline Memoization

Each pipeline stage (filter → sort → paginate) is memoized using referential equality checks:

```
if (data === cache.filterInput && filters === cache.filterStates) {
  return cache.filteredResult; // O(1) cache hit
}
```

**Impact**: Avoids reprocessing 100k+ rows when only viewport changes (scroll, resize).

### 2. Compiled Filters

Filters are compiled into a single predicate function with pre-resolved accessors:

```
// Instead of per-row column lookups:
compiled = [{accessor, op, value}, ...]
for each row: run all checks with short-circuit
```

**Impact**: Eliminates Map lookups and accessor resolution per row. Short-circuit evaluation skips remaining filters on first mismatch.

### 3. Precomputed Sort Values

Sort comparisons use precomputed accessor values:

```
// Extract values ONCE before sort
for each sortColumn:
  precomputed[col][i] = getAccessorValue(data[i], accessor)

// Sort uses precomputed values (no accessor calls during comparison)
indices.sort((a, b) => compare(precomputed[col][a], precomputed[col][b]))
```

**Impact**: Reduces accessor calls from O(n log n) to O(n). For 100k rows, this saves ~1.7M function calls during sort.

### 4. Virtualization with Prefix Sum + Binary Search

```
prefixSums[0] = 0
prefixSums[i+1] = prefixSums[i] + height[i]

startIndex = binarySearch(prefixSums, scrollTop)  // O(log n)
endIndex = binarySearch(prefixSums, scrollTop + viewportHeight)
```

**Impact**: O(log n) visible window computation vs O(n) linear scan. For 1M rows, this is ~20 comparisons vs ~1M.

### 5. Object Pooling for Visible Rows

```
// Reuse pool objects instead of creating new ones per frame
const pooled = visibleRowPool[i];
pooled.data = data[rowIndex];
pooled.offsetTop = offset;
```

**Impact**: Zero allocations per scroll frame for visible row objects. Reduces GC pauses during rapid scrolling.

### 6. O(1) Selection Model

```
if (selectAll) {
  isSelected = !excludedIds.has(rowId)  // O(1) Set lookup
} else {
  isSelected = selectedIds.has(rowId)   // O(1) Set lookup
}
```

**Impact**: Selecting/deselecting all 1M rows is O(1), not O(n). Checking selection status is always O(1).

### 7. Passive Scroll + rAF Throttling

```
element.addEventListener('scroll', handler, { passive: true });

function handleScroll() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(processScroll);
}
```

**Impact**: Scroll handler never blocks the browser's compositor thread. At most one scroll processing per frame (16.67ms).

### 8. Store with Set-based Subscriptions

```
listeners: Set<Listener>  // O(1) add, O(1) delete
```

**Impact**: Constant-time subscription management vs O(n) array splice. No listener array allocation during notify (uses reusable batch array).

### 9. Cooperative Scheduling

```
processQueue(queue, startTime, budget=12ms) {
  while (queue.length > 0) {
    if (performance.now() - startTime >= budget) break; // yield to browser
    task = queue.shift();
    task.fn();
  }
}
```

**Impact**: Heavy computation (filtering 100k rows) is chunked to avoid blocking the main thread. 12ms budget leaves 4ms for browser paint within 16ms frame.

### 10. CSS Transform-based Positioning

```
transform: translate3d(0, ${offsetTop}px, 0)  // GPU-composited
```

Instead of:
```
top: ${offsetTop}px  // triggers layout
```

**Impact**: Row repositioning is handled by the GPU compositor, avoiding layout recalculation. No forced synchronous reflow.

---

## V8 Optimization Considerations

### Monomorphic Objects
All state objects maintain consistent shapes (same properties in same order). V8 can use inline caches (ICs) for property access.

### No try/catch in Hot Paths
The default comparator and filter matching functions avoid try/catch, which prevents V8 from deoptimizing these critical functions.

### Functional + Flat Structures
No deep prototype chains. All hot-path functions are plain functions (not methods on class instances), enabling V8 to inline them more effectively.

### Avoiding Megamorphic Property Access
Column accessors are resolved once during pipeline setup, not per-row. This keeps property access patterns monomorphic.

---

## Memory Profile

| Component | Estimated Memory |
|-----------|-----------------|
| 100k rows (data ref only) | ~0 bytes (references original array) |
| Height map (100k entries) | ~4MB |
| Prefix sum array (100k) | ~800KB |
| Visible row pool (50 rows) | ~4KB |
| Store state | ~1KB |
| Pipeline cache | ~24 bytes (3 references) |
| **Total overhead** | **~5MB for 100k rows** |

The grid does NOT clone the dataset. It holds a reference to the original array.

---

## Bundle Size Breakdown (Estimated)

| Module | Estimated Size (minified) |
|--------|--------------------------|
| Core engine | ~4KB |
| Data pipeline | ~3KB |
| Store | ~1KB |
| Virtualization | ~2.5KB |
| Scheduling | ~2KB |
| Scroll engine | ~1KB |
| Selection | ~1.5KB |
| Plugin system | ~1KB |
| React adapter | ~3KB |
| HyperGrid component | ~4KB |
| Types (stripped) | 0KB |
| Utils | ~0.5KB |
| **Total core** | **~16KB minified** |
| **Gzipped estimate** | **~6KB** |

Tree-shakable: using only `createGridEngine` imports ~8KB minified.

---

## Cross-Browser Notes

- **Scroll**: Uses passive event listeners (Chrome 51+, Firefox 49+, Safari 10+)
- **rIC fallback**: `requestIdleCallback` not available in Safari → falls back to `setTimeout(fn, 50)`
- **transform3d**: GPU-composited in all modern browsers
- **performance.memory**: Chrome-only; gracefully returns null in Firefox/Safari
- **useSyncExternalStore**: React 18+ (included in React 17 via shim package)
