// ============================================================
// Diff Engine — O(n) minimal patch generation
// Compares prevMap vs nextMap, produces insert/update/remove
// No deep comparison — uses referential equality + field-level shallow diff
// ============================================================

import type { RowId } from '../types';

export type PatchType = 'insert' | 'update' | 'remove';

export interface Patch<TData> {
  type: PatchType;
  id: RowId;
  data: TData | null;
  /** For updates: which fields changed (column IDs) */
  changedFields: string[] | null;
}

export interface DiffEngine<TData> {
  /** Compute patches from buffered updates against current state */
  computePatches(
    currentMap: Map<RowId, TData>,
    updates: Map<RowId, TData>,
    removals: Set<RowId>,
    fieldAccessors: ReadonlyArray<{ id: string; accessor: string | ((row: TData) => unknown) }>,
  ): ReadonlyArray<Patch<TData>>;
}

export function createDiffEngine<TData>(): DiffEngine<TData> {
  // Reusable patches array — avoids allocation per frame
  const patchPool: Patch<TData>[] = [];
  let patchIndex = 0;

  // Reusable changed fields array
  const fieldsPool: string[][] = [];
  let fieldsIndex = 0;

  function acquirePatch(type: PatchType, id: RowId, data: TData | null, changedFields: string[] | null): Patch<TData> {
    if (patchIndex < patchPool.length) {
      const p = patchPool[patchIndex];
      (p as { type: PatchType }).type = type;
      (p as { id: RowId }).id = id;
      (p as { data: TData | null }).data = data;
      (p as { changedFields: string[] | null }).changedFields = changedFields;
      patchIndex++;
      return p;
    }
    const p: Patch<TData> = { type, id, data, changedFields };
    patchPool.push(p);
    patchIndex++;
    return p;
  }

  function acquireFields(): string[] {
    if (fieldsIndex < fieldsPool.length) {
      const f = fieldsPool[fieldsIndex];
      f.length = 0;
      fieldsIndex++;
      return f;
    }
    const f: string[] = [];
    fieldsPool.push(f);
    fieldsIndex++;
    return f;
  }

  function computePatches(
    currentMap: Map<RowId, TData>,
    updates: Map<RowId, TData>,
    removals: Set<RowId>,
    fieldAccessors: ReadonlyArray<{ id: string; accessor: string | ((row: TData) => unknown) }>,
  ): ReadonlyArray<Patch<TData>> {
    // Reset pools
    patchIndex = 0;
    fieldsIndex = 0;

    // Process removals — O(r)
    removals.forEach(function processRemoval(id: RowId): void {
      if (currentMap.has(id)) {
        acquirePatch('remove', id, null, null);
      }
    });

    // Process updates — O(u)
    updates.forEach(function processUpdate(newData: TData, id: RowId): void {
      const existing = currentMap.get(id);

      if (!existing) {
        // Insert
        acquirePatch('insert', id, newData, null);
        return;
      }

      // Referential equality — skip if same object
      if (existing === newData) return;

      // Shallow field-level diff
      const changed = acquireFields();
      for (let i = 0; i < fieldAccessors.length; i++) {
        const fa = fieldAccessors[i];
        const oldVal = getFieldValue(existing, fa.accessor);
        const newVal = getFieldValue(newData, fa.accessor);
        if (oldVal !== newVal) {
          changed.push(fa.id);
        }
      }

      // Only emit patch if something actually changed
      if (changed.length > 0) {
        acquirePatch('update', id, newData, changed);
      }
    });

    // Return only used portion of pool
    return patchPool.slice(0, patchIndex);
  }

  return { computePatches };
}

function getFieldValue<TData>(row: TData, accessor: string | ((row: TData) => unknown)): unknown {
  if (typeof accessor === 'function') {
    return accessor(row);
  }
  return (row as Record<string, unknown>)[accessor];
}
