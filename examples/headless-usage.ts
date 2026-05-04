// ============================================================
// Example: Headless core engine usage (no React, no DOM)
// ============================================================

import { createGridEngine, createBenchmarkSuite } from '../src';
import type { ColumnDef, GridApi } from '../src/types';

interface RowData {
  id: number;
  name: string;
  value: number;
  category: string;
}

// Generate test data
function generateData(count: number): RowData[] {
  const categories = ['A', 'B', 'C', 'D', 'E'];
  const data: RowData[] = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: i,
      name: `Item ${i}`,
      value: Math.floor(Math.random() * 10000),
      category: categories[i % categories.length],
    };
  }
  return data;
}

const columns: ColumnDef<RowData>[] = [
  { id: 'id', header: 'ID', accessor: 'id', width: 80, sortable: true },
  { id: 'name', header: 'Name', accessor: 'name', width: 200, sortable: true },
  { id: 'value', header: 'Value', accessor: 'value', width: 120, sortable: true },
  { id: 'category', header: 'Category', accessor: 'category', width: 120, sortable: true },
];

function runDemo(): void {
  const data = generateData(100000);

  console.log('=== HyperGrid Headless Demo ===\n');
  console.log(`Data size: ${data.length.toLocaleString()} rows\n`);

  // Create engine
  const startCreate = performance.now();
  const engine: GridApi<RowData> = createGridEngine({
    data,
    columns,
    getRowId: (row) => row.id,
    rowHeight: 36,
    pagination: { page: 0, pageSize: data.length },
    enableVirtualization: true,
  });
  const createTime = performance.now() - startCreate;
  console.log(`Engine creation: ${createTime.toFixed(2)}ms`);

  // Test sorting
  const startSort = performance.now();
  engine.setSorting([{ columnId: 'value', direction: 'desc' }]);
  const computed = engine.getComputedState();
  const sortTime = performance.now() - startSort;
  console.log(`Sort (100k rows): ${sortTime.toFixed(2)}ms`);
  console.log(`  Top value: ${(computed.sortedData[0] as RowData).value}`);

  // Test filtering
  const startFilter = performance.now();
  engine.setFilters([{ columnId: 'category', operator: 'eq', value: 'A' }]);
  const filtered = engine.getComputedState();
  const filterTime = performance.now() - startFilter;
  console.log(`Filter (100k rows, category=A): ${filterTime.toFixed(2)}ms`);
  console.log(`  Filtered count: ${filtered.totalFilteredCount.toLocaleString()}`);

  // Test selection
  const startSelect = performance.now();
  engine.toggleSelectAll();
  for (let i = 0; i < 1000; i++) {
    engine.deselectRow(i);
  }
  const selectTime = performance.now() - startSelect;
  console.log(`Selection (selectAll + 1000 deselects): ${selectTime.toFixed(2)}ms`);
  console.log(`  Row 0 selected: ${engine.isRowSelected(0)}`);
  console.log(`  Row 1001 selected: ${engine.isRowSelected(1001)}`);

  // Test viewport update
  const startViewport = performance.now();
  engine.setViewport({ scrollTop: 50000, viewportHeight: 600 });
  const vpComputed = engine.getComputedState();
  const viewportTime = performance.now() - startViewport;
  console.log(`Viewport update: ${viewportTime.toFixed(2)}ms`);
  console.log(`  Visible rows: ${vpComputed.visibleRows.length}`);

  // Cleanup
  engine.destroy();

  console.log('\n=== Demo Complete ===');
}

runDemo();
