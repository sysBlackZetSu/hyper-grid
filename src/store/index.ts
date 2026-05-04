// ============================================================
// Reactive Store — ultra-light subscription-based state
// - Selector-based updates with constant-time subscription
// - No deep cloning, minimal allocations
// - Reuses objects via structural sharing
// ============================================================

import type { Listener, Unsubscribe, Selector } from '../types';

export interface Store<TState> {
  getState(): TState;
  setState(updater: (prev: TState) => TState): void;
  subscribe(listener: Listener): Unsubscribe;
  subscribeToSlice<TSelected>(
    selector: Selector<TState, TSelected>,
    listener: (value: TSelected) => void,
    equalityFn?: (a: TSelected, b: TSelected) => boolean,
  ): Unsubscribe;
  destroy(): void;
}

export function createStore<TState>(initialState: TState): Store<TState> {
  let state = initialState;

  // Use a Set for O(1) add/delete — no array splicing
  let listeners: Set<Listener> | null = new Set();

  // Reusable notification array to avoid allocation per notify
  let notifyBatch: Listener[] = [];

  function getState(): TState {
    return state;
  }

  function setState(updater: (prev: TState) => TState): void {
    const nextState = updater(state);
    // Referential equality — skip if same object
    if (nextState === state) return;
    state = nextState;
    notify();
  }

  function notify(): void {
    if (!listeners) return;

    // Copy into reusable array to handle unsubscribe during iteration
    notifyBatch.length = 0;
    listeners.forEach(pushToNotifyBatch);

    for (let i = 0; i < notifyBatch.length; i++) {
      notifyBatch[i]();
    }
  }

  // Extracted to avoid creating closure in forEach hot path
  function pushToNotifyBatch(listener: Listener): void {
    notifyBatch.push(listener);
  }

  function subscribe(listener: Listener): Unsubscribe {
    if (!listeners) return noop;
    listeners.add(listener);

    return function unsubscribe(): void {
      if (!listeners) return;
      listeners.delete(listener);
    };
  }

  function subscribeToSlice<TSelected>(
    selector: Selector<TState, TSelected>,
    listener: (value: TSelected) => void,
    equalityFn: (a: TSelected, b: TSelected) => boolean = Object.is,
  ): Unsubscribe {
    let previousValue = selector(state);

    return subscribe(function sliceListener(): void {
      const nextValue = selector(state);
      if (!equalityFn(previousValue, nextValue)) {
        previousValue = nextValue;
        listener(nextValue);
      }
    });
  }

  function destroy(): void {
    if (listeners) {
      listeners.clear();
      listeners = null;
    }
    notifyBatch = [];
  }

  return {
    getState,
    setState,
    subscribe,
    subscribeToSlice,
    destroy,
  };
}

function noop(): void {
  // intentionally empty
}
