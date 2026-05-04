// ============================================================
// HyperGrid — Full React component
// Uses transform: translate3d() for GPU-accelerated positioning
// Zero unnecessary re-renders via stable refs + useSyncExternalStore
// ============================================================

import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import type { GridOptions, ColumnDef, VisibleRow, RowId } from '../types';
import { useGridEngine } from './useGridEngine';
import { useVirtualRows } from './useVirtualRows';
import { useGridScroll } from './useGridScroll';
import { useGridSelection } from './useGridSelection';
import { getAccessorValue } from '../utils';

export interface HyperGridProps<TData> extends GridOptions<TData> {
  className?: string;
  style?: React.CSSProperties;
  width?: number | string;
  height?: number | string;
}

function HyperGridInner<TData>(props: HyperGridProps<TData>): React.ReactElement {
  const {
    className,
    style,
    width = '100%',
    height = 400,
    ...gridOptions
  } = props;

  const { api, state, computed } = useGridEngine(gridOptions);
  const { visibleRows, totalHeight, setRowHeight } = useVirtualRows(api, computed);
  const { containerRef } = useGridScroll(api);
  const { selectRow, deselectRow, isRowSelected } = useGridSelection(api, state);

  // Measure row heights for dynamic sizing
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const measureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measureRows = useCallback(
    function doMeasure(): void {
      rowRefs.current.forEach(function measureRow(el: HTMLDivElement, index: number): void {
        const measuredHeight = el.offsetHeight;
        if (measuredHeight > 0) {
          setRowHeight(index, measuredHeight);
        }
      });
    },
    [setRowHeight],
  );

  useEffect(function scheduleMeasure(): () => void {
    if (measureTimeoutRef.current) {
      clearTimeout(measureTimeoutRef.current);
    }
    measureTimeoutRef.current = setTimeout(measureRows, 16);
    return function cleanup(): void {
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }
    };
  }, [visibleRows, measureRows]);

  // Compute column positions
  const columnLayout = useMemo(
    function computeColumnLayout(): ReadonlyArray<{ id: string; left: number; width: number }> {
      let left = 0;
      return state.columns.map(function layoutCol(col: ColumnDef<TData>): { id: string; left: number; width: number } {
        const w = col.width ?? 150;
        const layout = { id: col.id, left, width: w };
        left += w;
        return layout;
      });
    },
    [state.columns],
  );

  const totalWidth = useMemo(
    function computeTotalWidth(): number {
      let w = 0;
      for (let i = 0; i < columnLayout.length; i++) {
        w += columnLayout[i].width;
      }
      return w;
    },
    [columnLayout],
  );

  // Row click handler
  const handleRowClick = useCallback(
    function onRowClick(rowId: RowId): void {
      if (isRowSelected(rowId)) {
        deselectRow(rowId);
      } else {
        selectRow(rowId);
      }
    },
    [isRowSelected, selectRow, deselectRow],
  );

  // Sort click handler
  const handleSort = useCallback(
    function onSort(columnId: string): void {
      const currentSort = state.sorting.find(function findSort(s): boolean {
        return s.columnId === columnId;
      });

      if (!currentSort) {
        api.setSorting([{ columnId, direction: 'asc' }]);
      } else if (currentSort.direction === 'asc') {
        api.setSorting([{ columnId, direction: 'desc' }]);
      } else {
        api.setSorting([]);
      }
    },
    [api, state.sorting],
  );

  const containerStyle: React.CSSProperties = {
    ...style,
    width,
    height,
    overflow: 'auto',
    position: 'relative',
    willChange: 'transform',
  };

  const innerStyle: React.CSSProperties = {
    height: totalHeight + state.headerHeight,
    width: totalWidth,
    position: 'relative',
  };

  return (
    <div
      className={className}
      style={containerStyle}
      ref={containerRef}
    >
      <div style={innerStyle}>
        {/* Header */}
        <div
          style={{
            position: 'sticky',
            top: 0,
            height: state.headerHeight,
            zIndex: 1,
            display: 'flex',
            background: '#f8f9fa',
            borderBottom: '2px solid #dee2e6',
          }}
        >
          {state.columns.map(function renderHeader(col: ColumnDef<TData>, colIdx: number): React.ReactElement {
            const layout = columnLayout[colIdx];
            const sortState = state.sorting.find(function findSort(s): boolean {
              return s.columnId === col.id;
            });

            return (
              <div
                key={col.id}
                onClick={col.sortable !== false ? function onHeaderClick(): void { handleSort(col.id); } : undefined}
                style={{
                  width: layout.width,
                  minWidth: layout.width,
                  height: state.headerHeight,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 8px',
                  cursor: col.sortable !== false ? 'pointer' : 'default',
                  userSelect: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                  borderRight: '1px solid #dee2e6',
                  boxSizing: 'border-box',
                }}
              >
                {col.header}
                {sortState && (
                  <span style={{ marginLeft: 4, fontSize: '10px' }}>
                    {sortState.direction === 'asc' ? '\u25B2' : '\u25BC'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Virtualized rows */}
        {visibleRows.map(function renderRow(row: VisibleRow<TData>): React.ReactElement {
          const rowId = gridOptions.getRowId(row.data, row.originalIndex);
          const selected = isRowSelected(rowId);

          return (
            <VirtualRow
              key={row.index}
              row={row}
              rowId={rowId}
              columns={state.columns}
              columnLayout={columnLayout}
              headerHeight={state.headerHeight}
              selected={selected}
              onClick={handleRowClick}
              rowRefCallback={function setRef(el: HTMLDivElement | null): void {
                if (el) {
                  rowRefs.current.set(row.index, el);
                } else {
                  rowRefs.current.delete(row.index);
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---- Memoized Row Component ----

interface VirtualRowProps<TData> {
  row: VisibleRow<TData>;
  rowId: RowId;
  columns: ReadonlyArray<ColumnDef<TData>>;
  columnLayout: ReadonlyArray<{ id: string; left: number; width: number }>;
  headerHeight: number;
  selected: boolean;
  onClick: (rowId: RowId) => void;
  rowRefCallback: (el: HTMLDivElement | null) => void;
}

const VirtualRow = memo(function VirtualRowComponent<TData>(props: VirtualRowProps<TData>): React.ReactElement {
  const { row, rowId, columns, columnLayout, headerHeight, selected, onClick, rowRefCallback } = props;

  const handleClick = useCallback(
    function onRowClick(): void {
      onClick(rowId);
    },
    [onClick, rowId],
  );

  return (
    <div
      ref={rowRefCallback}
      onClick={handleClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: row.height,
        transform: `translate3d(0, ${row.offsetTop + headerHeight}px, 0)`,
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid #eee',
        background: selected ? '#e3f2fd' : row.index % 2 === 0 ? '#fff' : '#fafafa',
        cursor: 'pointer',
        boxSizing: 'border-box',
      }}
    >
      {columns.map(function renderCell(col: ColumnDef<TData>, colIdx: number): React.ReactElement {
        const layout = columnLayout[colIdx];
        const value = getAccessorValue(row.data, col.accessor);

        return (
          <div
            key={col.id}
            style={{
              width: layout.width,
              minWidth: layout.width,
              padding: '0 8px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          >
            {String(value ?? '')}
          </div>
        );
      })}
    </div>
  );
}) as <TData>(props: VirtualRowProps<TData>) => React.ReactElement;

export const HyperGrid = memo(HyperGridInner) as <TData>(props: HyperGridProps<TData>) => React.ReactElement;
