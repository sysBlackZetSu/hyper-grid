// ============================================================
// Plugin System — Zero-cost abstraction
// Plugins are opt-in and tree-shakable
// No base bundle impact when unused
// ============================================================

import type { GridPlugin, GridApi } from '../types';

export interface PluginManager<TData> {
  /** Register a plugin */
  register(plugin: GridPlugin<TData>): void;
  /** Unregister a plugin by name */
  unregister(name: string): void;
  /** Initialize all plugins with the grid API */
  initAll(api: GridApi<TData>): void;
  /** Notify all plugins of state change */
  notifyStateChange(state: unknown): void;
  /** Destroy all plugins */
  destroyAll(): void;
  /** Get a plugin by name */
  get(name: string): GridPlugin<TData> | undefined;
}

export function createPluginManager<TData>(): PluginManager<TData> {
  const plugins = new Map<string, GridPlugin<TData>>();
  let initialized = false;
  let api: GridApi<TData> | null = null;

  function register(plugin: GridPlugin<TData>): void {
    if (plugins.has(plugin.name)) {
      // Replace existing
      const existing = plugins.get(plugin.name);
      if (existing?.destroy) existing.destroy();
    }
    plugins.set(plugin.name, plugin);

    // If already initialized, init the new plugin immediately
    if (initialized && api && plugin.init) {
      plugin.init(api);
    }
  }

  function unregister(name: string): void {
    const plugin = plugins.get(name);
    if (plugin) {
      if (plugin.destroy) plugin.destroy();
      plugins.delete(name);
    }
  }

  function initAll(gridApi: GridApi<TData>): void {
    api = gridApi;
    initialized = true;
    plugins.forEach(initPlugin);
  }

  function initPlugin(plugin: GridPlugin<TData>): void {
    if (plugin.init && api) {
      plugin.init(api);
    }
  }

  function notifyStateChange(state: unknown): void {
    plugins.forEach(function notifyPlugin(plugin: GridPlugin<TData>): void {
      if (plugin.onStateChange) {
        plugin.onStateChange(state as Parameters<NonNullable<GridPlugin<TData>['onStateChange']>>[0]);
      }
    });
  }

  function destroyAll(): void {
    plugins.forEach(function destroyPlugin(plugin: GridPlugin<TData>): void {
      if (plugin.destroy) plugin.destroy();
    });
    plugins.clear();
    initialized = false;
    api = null;
  }

  function get(name: string): GridPlugin<TData> | undefined {
    return plugins.get(name);
  }

  return {
    register,
    unregister,
    initAll,
    notifyStateChange,
    destroyAll,
    get,
  };
}
