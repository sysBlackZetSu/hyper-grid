// ============================================================
// Data Pipeline — filter → sort → paginate → visible rows
// Each stage is memoized; only recomputes when inputs change
// ============================================================

import type {
  FilterState,
  SortState,
  PaginationState,
  ColumnDef,
  FilterOperator,
} from '../types';
import { getAccessorValue } from '../utils';

// ---- Memoization Cache ----

interface PipelineCache<TData> {
  // Filter cache
  filterInput: ReadonlyArray<TData> | null;
  filterStates: ReadonlyArray<FilterState> | null;
  filteredResult: ReadonlyArray<TData>;

  // Sort cache
  sortInput: ReadonlyArray<TData> | null;
  sortStates: ReadonlyArray<SortState> | null;
  sortedResult: ReadonlyArray<TData>;

  // Paginate cache
  paginateInput: ReadonlyArray<TData> | null;
  paginationState: PaginationState | null;
  paginatedResult: ReadonlyArray<TData>;
}

export interface DataPipeline<TData> {
  process(
    data: ReadonlyArray<TData>,
    columns: ReadonlyArray<ColumnDef<TData>>,
    filters: ReadonlyArray<FilterState>,
    sorting: ReadonlyArray<SortState>,
    pagination: PaginationState,
  ): PipelineResult<TData>;
  invalidate(): void;
}

export interface PipelineResult<TData> {
  readonly filtered: ReadonlyArray<TData>;
  readonly sorted: ReadonlyArray<TData>;
  readonly paginated: ReadonlyArray<TData>;
  readonly totalFilteredCount: number;
  readonly totalPageCount: number;
}

export function createDataPipeline<TData>(): DataPipeline<TData> {
  const cache: PipelineCache<TData> = {
    filterInput: null,
    filterStates: null,
    filteredResult: [],
    sortInput: null,
    sortStates: null,
    sortedResult: [],
    paginateInput: null,
    paginationState: null,
    paginatedResult: [],
  };

  function process(
    data: ReadonlyArray<TData>,
    columns: ReadonlyArray<ColumnDef<TData>>,
    filters: ReadonlyArray<FilterState>,
    sorting: ReadonlyArray<SortState>,
    pagination: PaginationState,
  ): PipelineResult<TData> {
    // Stage 1: Filter
    const filtered = applyFilters(data, columns, filters);

    // Stage 2: Sort
    const sorted = applySorting(filtered, columns, sorting);

    // Stage 3: Paginate
    const paginated = applyPagination(sorted, pagination);

    const totalFilteredCount = filtered.length;
    const totalPageCount = Math.max(1, Math.ceil(totalFilteredCount / pagination.pageSize));

    return { filtered, sorted, paginated, totalFilteredCount, totalPageCount };
  }

  function applyFilters(
    data: ReadonlyArray<TData>,
    columns: ReadonlyArray<ColumnDef<TData>>,
    filters: ReadonlyArray<FilterState>,
  ): ReadonlyArray<TData> {
    // Memoization check
    if (data === cache.filterInput && filters === cache.filterStates) {
      return cache.filteredResult;
    }

    cache.filterInput = data;
    cache.filterStates = filters;

    if (filters.length === 0) {
      cache.filteredResult = data;
      return data;
    }

    // Build column lookup once
    const columnMap = new Map<string, ColumnDef<TData>>();
    for (let i = 0; i < columns.length; i++) {
      columnMap.set(columns[i].id, columns[i]);
    }

    // Compile filter into a single predicate function (avoid per-row lookups)
    const compiledFilters = compileFilters(filters, columnMap);

    // Single pass filter
    const result: TData[] = [];
    for (let i = 0; i < data.length; i++) {
      if (compiledFilters(data[i])) {
        result.push(data[i]);
      }
    }

    cache.filteredResult = result;
    return result;
  }

  function compileFilters(
    filters: ReadonlyArray<FilterState>,
    columnMap: Map<string, ColumnDef<TData>>,
  ): (row: TData) => boolean {
    // Pre-resolve accessors and operators
    const compiledChecks: Array<{
      accessor: ColumnDef<TData>['accessor'];
      op: FilterOperator;
      value: unknown;
    }> = [];

    for (let i = 0; i < filters.length; i++) {
      const f = filters[i];
      const col = columnMap.get(f.columnId);
      if (!col) continue;
      compiledChecks.push({
        accessor: col.accessor,
        op: f.operator,
        value: f.value,
      });
    }

    return function runFilters(row: TData): boolean {
      for (let i = 0; i < compiledChecks.length; i++) {
        const check = compiledChecks[i];
        const cellValue = getAccessorValue(row, check.accessor);
        if (!matchOperator(cellValue, check.op, check.value)) {
          return false; // Short-circuit
        }
      }
      return true;
    };
  }

  function applySorting(
    data: ReadonlyArray<TData>,
    columns: ReadonlyArray<ColumnDef<TData>>,
    sorting: ReadonlyArray<SortState>,
  ): ReadonlyArray<TData> {
    // Memoization check
    if (data === cache.sortInput && sorting === cache.sortStates) {
      return cache.sortedResult;
    }

    cache.sortInput = data;
    cache.sortStates = sorting;

    if (sorting.length === 0) {
      cache.sortedResult = data;
      return data;
    }

    // Build column lookup
    const columnMap = new Map<string, ColumnDef<TData>>();
    for (let i = 0; i < columns.length; i++) {
      columnMap.set(columns[i].id, columns[i]);
    }

    // Precompute accessor values for sort columns (avoid per-comparison lookups)
    const sortConfigs: Array<{
      accessor: ColumnDef<TData>['accessor'];
      direction: number;
      comparator: ((a: unknown, b: unknown) => number) | null;
    }> = [];

    for (let i = 0; i < sorting.length; i++) {
      const s = sorting[i];
      const col = columnMap.get(s.columnId);
      if (!col) continue;
      sortConfigs.push({
        accessor: col.accessor,
        direction: s.direction === 'asc' ? 1 : -1,
        comparator: col.comparator ?? null,
      });
    }

    // Precompute accessor values to avoid repeated access during sort
    const indices = new Array<number>(data.length);
    for (let i = 0; i < data.length; i++) indices[i] = i;

    const precomputed: unknown[][] = new Array(sortConfigs.length);
    for (let s = 0; s < sortConfigs.length; s++) {
      const vals = new Array<unknown>(data.length);
      const acc = sortConfigs[s].accessor;
      for (let i = 0; i < data.length; i++) {
        vals[i] = getAccessorValue(data[i], acc);
      }
      precomputed[s] = vals;
    }

    // Stable sort via index-based comparison
    indices.sort(function comparator(a: number, b: number): number {
      for (let s = 0; s < sortConfigs.length; s++) {
        const config = sortConfigs[s];
        const va = precomputed[s][a];
        const vb = precomputed[s][b];

        let cmp: number;
        if (config.comparator) {
          cmp = config.comparator(va, vb);
        } else {
          cmp = defaultCompare(va, vb);
        }

        if (cmp !== 0) return cmp * config.direction;
      }
      // Stable: preserve original order
      return a - b;
    });

    const result = new Array<TData>(data.length);
    for (let i = 0; i < indices.length; i++) {
      result[i] = data[indices[i]];
    }

    cache.sortedResult = result;
    return result;
  }

  function applyPagination(
    data: ReadonlyArray<TData>,
    pagination: PaginationState,
  ): ReadonlyArray<TData> {
    // Memoization check
    if (data === cache.paginateInput && pagination === cache.paginationState) {
      return cache.paginatedResult;
    }

    cache.paginateInput = data;
    cache.paginationState = pagination;

    if (pagination.pageSize <= 0 || pagination.pageSize >= data.length) {
      cache.paginatedResult = data;
      return data;
    }

    const start = pagination.page * pagination.pageSize;
    const end = Math.min(start + pagination.pageSize, data.length);

    if (start >= data.length) {
      cache.paginatedResult = [];
      return cache.paginatedResult;
    }

    cache.paginatedResult = data.slice(start, end);
    return cache.paginatedResult;
  }

  function invalidate(): void {
    cache.filterInput = null;
    cache.filterStates = null;
    cache.sortInput = null;
    cache.sortStates = null;
    cache.paginateInput = null;
    cache.paginationState = null;
  }

  return { process, invalidate };
}

// ---- Filter operator matching ----

function matchOperator(cellValue: unknown, op: FilterOperator, filterValue: unknown): boolean {
  switch (op) {
    case 'eq':
      return cellValue === filterValue;
    case 'neq':
      return cellValue !== filterValue;
    case 'gt':
      return (cellValue as number) > (filterValue as number);
    case 'gte':
      return (cellValue as number) >= (filterValue as number);
    case 'lt':
      return (cellValue as number) < (filterValue as number);
    case 'lte':
      return (cellValue as number) <= (filterValue as number);
    case 'contains':
      return String(cellValue).indexOf(String(filterValue)) !== -1;
    case 'startsWith':
      return String(cellValue).startsWith(String(filterValue));
    case 'endsWith':
      return String(cellValue).endsWith(String(filterValue));
    case 'in':
      return Array.isArray(filterValue) && (filterValue as unknown[]).indexOf(cellValue) !== -1;
    default:
      return true;
  }
}

// ---- Default comparator (no try/catch in hot path) ----

function defaultCompare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  if (typeof a === 'string' && typeof b === 'string') {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // Fallback: convert to string
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
