// ============================================================
// Example: Basic HyperGrid usage with 100k rows
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { HyperGrid } from '../src/react';
import type { ColumnDef } from '../src/types';

interface RowData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  department: string;
  salary: number;
  startDate: string;
  active: boolean;
}

const DEPARTMENTS = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance', 'Legal', 'Operations'];

function generateData(count: number): RowData[] {
  const data: RowData[] = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: i,
      firstName: `First${i}`,
      lastName: `Last${i}`,
      email: `user${i}@company.com`,
      age: 22 + (i % 43),
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      salary: 40000 + (i % 80) * 1000,
      startDate: `2020-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      active: i % 3 !== 0,
    };
  }
  return data;
}

const columns: ColumnDef<RowData>[] = [
  { id: 'id', header: 'ID', accessor: 'id', width: 80, sortable: true },
  { id: 'firstName', header: 'First Name', accessor: 'firstName', width: 150, sortable: true },
  { id: 'lastName', header: 'Last Name', accessor: 'lastName', width: 150, sortable: true },
  { id: 'email', header: 'Email', accessor: 'email', width: 250, sortable: true },
  { id: 'age', header: 'Age', accessor: 'age', width: 80, sortable: true },
  { id: 'department', header: 'Department', accessor: 'department', width: 140, sortable: true },
  { id: 'salary', header: 'Salary', accessor: 'salary', width: 120, sortable: true },
  { id: 'startDate', header: 'Start Date', accessor: 'startDate', width: 130, sortable: true },
  { id: 'active', header: 'Active', accessor: (row: RowData) => (row.active ? 'Yes' : 'No'), width: 80 },
];

export default function BasicExample(): React.ReactElement {
  const [rowCount, setRowCount] = useState(100000);

  const data = useMemo(() => generateData(rowCount), [rowCount]);

  const getRowId = useCallback((row: RowData) => row.id, []);

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <h1>HyperGrid — Basic Example</h1>

      <div style={{ marginBottom: 16 }}>
        <label>
          Rows:{' '}
          <select
            value={rowCount}
            onChange={(e) => setRowCount(Number(e.target.value))}
          >
            <option value={1000}>1,000</option>
            <option value={10000}>10,000</option>
            <option value={100000}>100,000</option>
            <option value={500000}>500,000</option>
            <option value={1000000}>1,000,000</option>
          </select>
        </label>
        <span style={{ marginLeft: 16, color: '#666' }}>
          Rendering {data.length.toLocaleString()} rows with virtualization
        </span>
      </div>

      <HyperGrid
        data={data}
        columns={columns}
        getRowId={getRowId}
        height={600}
        rowHeight={36}
        headerHeight={40}
        overscan={5}
        selectionMode="multiple"
        enableVirtualization={true}
      />
    </div>
  );
}
