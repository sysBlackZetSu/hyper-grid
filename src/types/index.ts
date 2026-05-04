// ============================================================
// HyperGrid Type Definitions
// Flat, struct-like types for cache locality and V8 optimization
// ============================================================

/** Unique identifier for a row */
export type RowId = string | number;

/** Column identifier */
export type ColumnId = string;

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Filter operator */
export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in';

// ---- Column Definition ----

export interface ColumnDef<TData = unknown> {
  readonly id: ColumnId;
  readonly header: string;
  readonly accessor: keyof TData | ((row: TData) => unknown);
  readonly width?: number;
  readonly minWidth?: number;
  readonly maxWidth?: number;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly resizable?: boolean;
  readonly pinned?: 'left' | 'right' | false;
  readonly cellRenderer?: CellRenderer<TData>;
  readonly headerRenderer?: HeaderRenderer;
  readonly comparator?: (a: unknown, b: unknown) => number;
}

export type CellRenderer<TData = unknown> = (props: CellRendererProps<TData>) => string | HTMLElement;
export type HeaderRenderer = (props: HeaderRendererProps) => string | HTMLElement;

export interface CellRendererProps<TData = unknown> {
  readonly value: unknown;
  readonly row: TData;
  readonly rowIndex: number;
  readonly column: ColumnDef<TData>;
  readonly columnIndex: number;
}

export interface HeaderRendererProps {
  readonly column: ColumnDef;
  readonly columnIndex: number;
  readonly sortDirection: SortDirection | null;
}

// ---- Sort State ----

export interface SortState {
  readonly columnId: ColumnId;
  readonly direction: SortDirection;
}

// ---- Filter State ----

export interface FilterState {
  readonly columnId: ColumnId;
  readonly operator: FilterOperator;
  readonly value: unknown;
}

// ---- Pagination State ----

export interface PaginationState {
  readonly page: number;
  readonly pageSize: number;
}

// ---- Viewport State ----

export interface ViewportState {
  readonly scrollTop: number;
  readonly scrollLeft: number;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}

// ---- Selection State ----

export interface SelectionState {
  readonly mode: 'none' | 'single' | 'multiple';
  readonly selectAll: boolean;
  readonly selectedIds: ReadonlySet<RowId>;
  readonly excludedIds: ReadonlySet<RowId>;
}

// ---- Grid State (flat) ----

export interface GridState<TData = unknown> {
  readonly data: ReadonlyArray<TData>;
  readonly columns: ReadonlyArray<ColumnDef<TData>>;
  readonly sorting: ReadonlyArray<SortState>;
  readonly filters: ReadonlyArray<FilterState>;
  readonly pagination: PaginationState;
  readonly viewport: ViewportState;
  readonly selection: SelectionState;
  readonly rowHeight: number;
  readonly headerHeight: number;
  readonly overscan: number;
}

// ---- Derived/Computed State ----

export interface ComputedState<TData = unknown> {
  readonly filteredData: ReadonlyArray<TData>;
  readonly sortedData: ReadonlyArray<TData>;
  readonly paginatedData: ReadonlyArray<TData>;
  readonly visibleRows: ReadonlyArray<VisibleRow<TData>>;
  readonly totalFilteredCount: number;
  readonly totalPageCount: number;
}

export interface VisibleRow<TData = unknown> {
  readonly data: TData;
  readonly index: number;
  readonly originalIndex: number;
  readonly offsetTop: number;
  readonly height: number;
}

// ---- Row ID Accessor ----

export type RowIdAccessor<TData = unknown> = (row: TData, index: number) => RowId;

// ---- Grid Options ----

export interface GridOptions<TData = unknown> {
  readonly data: ReadonlyArray<TData>;
  readonly columns: ReadonlyArray<ColumnDef<TData>>;
  readonly getRowId: RowIdAccessor<TData>;
  readonly rowHeight?: number;
  readonly headerHeight?: number;
  readonly overscan?: number;
  readonly pagination?: Partial<PaginationState>;
  readonly sorting?: ReadonlyArray<SortState>;
  readonly filters?: ReadonlyArray<FilterState>;
  readonly selectionMode?: 'none' | 'single' | 'multiple';
  readonly onSortChange?: (sorting: ReadonlyArray<SortState>) => void;
  readonly onFilterChange?: (filters: ReadonlyArray<FilterState>) => void;
  readonly onPageChange?: (pagination: PaginationState) => void;
  readonly onSelectionChange?: (selection: SelectionState) => void;
  readonly plugins?: ReadonlyArray<GridPlugin<TData>>;
  readonly enableVirtualization?: boolean;
  readonly estimatedRowHeight?: number;
}

// ---- Plugin Interface ----

export interface GridPlugin<TData = unknown> {
  readonly name: string;
  readonly init?: (api: GridApi<TData>) => void;
  readonly destroy?: () => void;
  readonly onStateChange?: (state: GridState<TData>) => void;
}

// ---- Grid API ----

export interface GridApi<TData = unknown> {
  getState(): GridState<TData>;
  getComputedState(): ComputedState<TData>;
  setData(data: ReadonlyArray<TData>): void;
  setSorting(sorting: ReadonlyArray<SortState>): void;
  setFilters(filters: ReadonlyArray<FilterState>): void;
  setPagination(pagination: Partial<PaginationState>): void;
  setViewport(viewport: Partial<ViewportState>): void;
  setSelection(selection: Partial<SelectionState>): void;
  selectRow(rowId: RowId): void;
  deselectRow(rowId: RowId): void;
  toggleSelectAll(): void;
  isRowSelected(rowId: RowId): boolean;
  subscribe(listener: () => void): () => void;
  subscribeToSlice<T>(selector: (state: GridState<TData>) => T, listener: (value: T) => void): () => void;
  destroy(): void;
}

// ---- Store Types ----

export type Listener = () => void;
export type Unsubscribe = () => void;
export type Selector<TState, TSelected> = (state: TState) => TSelected;

// ---- Scheduler Types ----

export type TaskPriority = 'immediate' | 'high' | 'normal' | 'low' | 'idle';

export interface ScheduledTask {
  readonly id: number;
  readonly fn: () => void;
  readonly priority: TaskPriority;
}

// ---- Benchmark Types ----

export interface FrameMetrics {
  fps: number;
  frameTime: number;
  frameTimes: number[];
  droppedFrames: number;
}

export interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface RenderMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
}

export interface BenchmarkResult {
  frame: FrameMetrics;
  memory: MemoryMetrics | null;
  render: RenderMetrics;
}
