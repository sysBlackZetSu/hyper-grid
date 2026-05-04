// ============================================================
// Core Grid Engine — orchestrates all subsystems
// Pure TypeScript, no React, no DOM
// ============================================================

import type {
  GridState,
  GridOptions,
  GridApi,
  ComputedState,
  SortState,
  FilterState,
  PaginationState,
  ViewportState,
  SelectionState,
  RowId,
  VisibleRow,
} from '../types';
import { createStore, type Store } from '../store';
import { createDataPipeline, type DataPipeline } from './pipeline';
import { createVirtualizationEngine, type VirtualizationEngine } from '../virtualization';
import { createSelectionEngine, type SelectionEngine } from '../selection';
import { createPluginManager, type PluginManager } from '../plugins';
import { createScheduler, type Scheduler } from '../scheduling';
import { emptySet } from '../utils';

export function createGridEngine<TData>(options: GridOptions<TData>): GridApi<TData> {
  // ---- Initialize subsystems ----
  const store: Store<GridState<TData>> = createStore<GridState<TData>>(buildInitialState(options));
  const pipeline: DataPipeline<TData> = createDataPipeline<TData>();
  const virtualization: VirtualizationEngine<TData> = createVirtualizationEngine<TData>();
  const selectionEngine: SelectionEngine = createSelectionEngine();
  const pluginManager: PluginManager<TData> = createPluginManager<TData>();
  const scheduler: Scheduler = createScheduler();

  // ---- Computed state cache ----
  let computedCache: ComputedState<TData> | null = null;
  let computedStateVersion = 0;
  let lastComputedVersion = -1;

  // ---- Hook up store change listener ----
  store.subscribe(function onStateChange(): void {
    computedStateVersion++;
    pluginManager.notifyStateChange(store.getState());

    // Fire external callbacks
    const state = store.getState();
    if (options.onSortChange) {
      options.onSortChange(state.sorting);
    }
    if (options.onFilterChange) {
      options.onFilterChange(state.filters);
    }
    if (options.onPageChange) {
      options.onPageChange(state.pagination);
    }
    if (options.onSelectionChange) {
      options.onSelectionChange(state.selection);
    }
  });

  // ---- API Implementation ----

  function getState(): GridState<TData> {
    return store.getState();
  }

  function getComputedState(): ComputedState<TData> {
    if (computedCache && lastComputedVersion === computedStateVersion) {
      return computedCache;
    }

    const state = store.getState();

    // Run data pipeline
    const pipelineResult = pipeline.process(
      state.data,
      state.columns,
      state.filters,
      state.sorting,
      state.pagination,
    );

    // Compute visible rows via virtualization
    const dataForVirtualization = options.enableVirtualization !== false
      ? pipelineResult.sorted
      : pipelineResult.paginated;

    let visibleRows: ReadonlyArray<VisibleRow<TData>>;
    if (options.enableVirtualization !== false) {
      visibleRows = virtualization.computeVisibleRows(
        dataForVirtualization,
        state.viewport.scrollTop,
        state.viewport.viewportHeight,
        state.overscan,
        state.rowHeight,
      );
    } else {
      // No virtualization — return all paginated rows
      visibleRows = dataForVirtualization.map(function mapRow(row: TData, i: number): VisibleRow<TData> {
        return {
          data: row,
          index: i,
          originalIndex: i,
          offsetTop: i * state.rowHeight,
          height: state.rowHeight,
        };
      });
    }

    computedCache = {
      filteredData: pipelineResult.filtered,
      sortedData: pipelineResult.sorted,
      paginatedData: pipelineResult.paginated,
      visibleRows,
      totalFilteredCount: pipelineResult.totalFilteredCount,
      totalPageCount: pipelineResult.totalPageCount,
    };

    lastComputedVersion = computedStateVersion;
    return computedCache;
  }

  function setData(data: ReadonlyArray<TData>): void {
    store.setState(function updateData(prev: GridState<TData>): GridState<TData> {
      if (prev.data === data) return prev;
      return { ...prev, data };
    });
    pipeline.invalidate();
    virtualization.reset();
  }

  function setSorting(sorting: ReadonlyArray<SortState>): void {
    store.setState(function updateSorting(prev: GridState<TData>): GridState<TData> {
      return { ...prev, sorting };
    });
  }

  function setFilters(filters: ReadonlyArray<FilterState>): void {
    store.setState(function updateFilters(prev: GridState<TData>): GridState<TData> {
      return { ...prev, filters };
    });
  }

  function setPagination(partial: Partial<PaginationState>): void {
    store.setState(function updatePagination(prev: GridState<TData>): GridState<TData> {
      return {
        ...prev,
        pagination: { ...prev.pagination, ...partial },
      };
    });
  }

  function setViewport(partial: Partial<ViewportState>): void {
    store.setState(function updateViewport(prev: GridState<TData>): GridState<TData> {
      return {
        ...prev,
        viewport: { ...prev.viewport, ...partial },
      };
    });
  }

  function setSelection(partial: Partial<SelectionState>): void {
    store.setState(function updateSelection(prev: GridState<TData>): GridState<TData> {
      return {
        ...prev,
        selection: { ...prev.selection, ...partial },
      };
    });
  }

  function selectRow(rowId: RowId): void {
    store.setState(function updateSelectRow(prev: GridState<TData>): GridState<TData> {
      const nextSelection = selectionEngine.selectRow(rowId, prev.selection);
      if (nextSelection === prev.selection) return prev;
      return { ...prev, selection: nextSelection };
    });
  }

  function deselectRow(rowId: RowId): void {
    store.setState(function updateDeselectRow(prev: GridState<TData>): GridState<TData> {
      const nextSelection = selectionEngine.deselectRow(rowId, prev.selection);
      if (nextSelection === prev.selection) return prev;
      return { ...prev, selection: nextSelection };
    });
  }

  function toggleSelectAll(): void {
    store.setState(function updateToggleSelectAll(prev: GridState<TData>): GridState<TData> {
      const nextSelection = selectionEngine.toggleSelectAll(prev.selection);
      if (nextSelection === prev.selection) return prev;
      return { ...prev, selection: nextSelection };
    });
  }

  function isRowSelected(rowId: RowId): boolean {
    return selectionEngine.isRowSelected(rowId, store.getState().selection);
  }

  function subscribe(listener: () => void): () => void {
    return store.subscribe(listener);
  }

  function subscribeToSlice<T>(
    selector: (state: GridState<TData>) => T,
    listener: (value: T) => void,
  ): () => void {
    return store.subscribeToSlice(selector, listener);
  }

  function destroy(): void {
    pluginManager.destroyAll();
    scheduler.destroy();
    store.destroy();
    pipeline.invalidate();
    virtualization.reset();
  }

  // ---- Build the API object ----
  const api: GridApi<TData> = {
    getState,
    getComputedState,
    setData,
    setSorting,
    setFilters,
    setPagination,
    setViewport,
    setSelection,
    selectRow,
    deselectRow,
    toggleSelectAll,
    isRowSelected,
    subscribe,
    subscribeToSlice,
    destroy,
  };

  // ---- Initialize plugins ----
  if (options.plugins) {
    for (let i = 0; i < options.plugins.length; i++) {
      pluginManager.register(options.plugins[i]);
    }
  }
  pluginManager.initAll(api);

  return api;
}

// ---- Helper: Build initial state from options ----

function buildInitialState<TData>(options: GridOptions<TData>): GridState<TData> {
  return {
    data: options.data,
    columns: options.columns,
    sorting: options.sorting ?? [],
    filters: options.filters ?? [],
    pagination: {
      page: options.pagination?.page ?? 0,
      pageSize: options.pagination?.pageSize ?? 50,
    },
    viewport: {
      scrollTop: 0,
      scrollLeft: 0,
      viewportHeight: 0,
      viewportWidth: 0,
    },
    selection: {
      mode: options.selectionMode ?? 'none',
      selectAll: false,
      selectedIds: emptySet<RowId>(),
      excludedIds: emptySet<RowId>(),
    },
    rowHeight: options.rowHeight ?? 36,
    headerHeight: options.headerHeight ?? 40,
    overscan: options.overscan ?? 5,
  };
}

export { createDataPipeline } from './pipeline';
