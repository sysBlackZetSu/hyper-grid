// ============================================================
// Position Engine — Animated row movement via transform
// Avoids layout changes — uses translate3d only
// Smooth transitions when rows reorder (e.g., sort changes)
// ============================================================

import type { RowId } from '../types';

export interface PositionEngine {
  /** Set target position for a row */
  setTarget(rowId: RowId, targetY: number): void;
  /** Set immediate position (no animation) */
  setImmediate(rowId: RowId, y: number): void;
  /** Tick the animation (call from rAF loop) */
  tick(timestamp: number): boolean;
  /** Get current animated position */
  getPosition(rowId: RowId): number;
  /** Remove a row from tracking */
  remove(rowId: RowId): void;
  /** Apply positions to DOM nodes */
  applyToDOM(getNode: (rowId: RowId) => HTMLElement | undefined): void;
  /** Set animation speed (0-1, where 1 = instant) */
  setLerpFactor(factor: number): void;
  /** Reset all positions */
  reset(): void;
}

interface RowPosition {
  currentY: number;
  targetY: number;
  velocity: number;
  dirty: boolean;
}

export function createPositionEngine(): PositionEngine {
  const positions = new Map<RowId, RowPosition>();
  let lerpFactor = 0.15; // Smooth interpolation factor
  let hasAnimating = false;

  // Reusable — avoid allocating per tick
  let dirtyRows: RowId[] = [];

  function setTarget(rowId: RowId, targetY: number): void {
    const pos = positions.get(rowId);
    if (pos) {
      if (pos.targetY === targetY) return;
      pos.targetY = targetY;
      pos.dirty = true;
    } else {
      // New row — start at target (no initial animation)
      positions.set(rowId, {
        currentY: targetY,
        targetY,
        velocity: 0,
        dirty: false,
      });
    }
  }

  function setImmediate(rowId: RowId, y: number): void {
    const pos = positions.get(rowId);
    if (pos) {
      pos.currentY = y;
      pos.targetY = y;
      pos.velocity = 0;
      pos.dirty = true;
    } else {
      positions.set(rowId, {
        currentY: y,
        targetY: y,
        velocity: 0,
        dirty: true,
      });
    }
  }

  function tick(_timestamp: number): boolean {
    hasAnimating = false;
    dirtyRows.length = 0;

    positions.forEach(function updatePosition(pos: RowPosition, rowId: RowId): void {
      const diff = pos.targetY - pos.currentY;

      // Snap threshold — avoid endless sub-pixel animation
      if (Math.abs(diff) < 0.5) {
        if (pos.currentY !== pos.targetY) {
          pos.currentY = pos.targetY;
          pos.velocity = 0;
          pos.dirty = true;
          dirtyRows.push(rowId);
        }
        return;
      }

      // Lerp toward target
      pos.currentY += diff * lerpFactor;
      pos.velocity = diff * lerpFactor;
      pos.dirty = true;
      hasAnimating = true;
      dirtyRows.push(rowId);
    });

    return hasAnimating;
  }

  function getPosition(rowId: RowId): number {
    const pos = positions.get(rowId);
    return pos ? pos.currentY : 0;
  }

  function remove(rowId: RowId): void {
    positions.delete(rowId);
  }

  function applyToDOM(getNode: (rowId: RowId) => HTMLElement | undefined): void {
    for (let i = 0; i < dirtyRows.length; i++) {
      const rowId = dirtyRows[i];
      const pos = positions.get(rowId);
      if (!pos || !pos.dirty) continue;

      const node = getNode(rowId);
      if (node) {
        node.style.transform = `translate3d(0, ${Math.round(pos.currentY * 10) / 10}px, 0)`;
      }
      pos.dirty = false;
    }
  }

  function setLerpFactor(factor: number): void {
    lerpFactor = Math.max(0.01, Math.min(1, factor));
  }

  function reset(): void {
    positions.clear();
    dirtyRows = [];
    hasAnimating = false;
  }

  return {
    setTarget,
    setImmediate,
    tick,
    getPosition,
    remove,
    applyToDOM,
    setLerpFactor,
    reset,
  };
}
