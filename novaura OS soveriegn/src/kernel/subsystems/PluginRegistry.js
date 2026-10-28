/**
 * NovAura Sovereign OS — Plugin Registry Subsystem
 * Inter-app capability discovery and zero-cloud messaging.
 */

class PluginRegistry {
  constructor() {
    this._kernel = null;
    this._plugins = new Map();
    this._capabilityIndex = new Map();
    this._hooks = new Map();
  }

  init(kernel) {
    this._kernel = kernel;

    kernel.ipc.on('window:closed', ({ id }) => {
      this._unregisterByWindow(id);
    });

    kernel.ipc.on('plugin:call', async ({ plugin, capability, args, _requestId }) => {
      try {
        const result = await this.call(plugin, capability, args);
        kernel.ipc.reply('plugin:call', _requestId, { ok: true, result });
      } catch (e) {
        kernel.ipc.reply('plugin:call', _requestId, { ok: false, error: e.message });
      }
    });
  }

  registerPlugin(pluginId, meta = {}, capabilities = {}) {
    if (this._plugins.has(pluginId)) {
      const existing = this._plugins.get(pluginId);
      Object.entries(capabilities).forEach(([name, fn]) => {
        existing.capabilities.set(name, fn);
        this._indexCapability(name, pluginId);
      });
      existing.meta = { ...existing.meta, ...meta };
    } else {
      const capMap = new Map(Object.entries(capabilities));
      this._plugins.set(pluginId, { meta, capabilities: capMap, windowId: meta.windowId || null });
      capMap.forEach((_, name) => this._indexCapability(name, pluginId));
    }

    this._kernel.ipc.emit('plugin:registered', { pluginId, capabilities: Object.keys(capabilities) });
    this._runHook('plugin:registered', { pluginId, meta });
    return () => this.unregister(pluginId);
  }

  register(pluginId, capabilityName, handler) {
    if (!this._plugins.has(pluginId)) {
      this._plugins.set(pluginId, { meta: {}, capabilities: new Map(), windowId: null });
    }
    this._plugins.get(pluginId).capabilities.set(capabilityName, handler);
    this._indexCapability(capabilityName, pluginId);
    this._kernel.ipc.emit('plugin:capability:added', { pluginId, capability: capabilityName });
  }

  async call(pluginId, capability, args = {}) {
    const plugin = this._plugins.get(pluginId);
    if (!plugin) throw new Error('[Plugins] Plugin not found: ' + pluginId);
    const handler = plugin.capabilities.get(capability);
    if (!handler) throw new Error('[Plugins] Capability not found: ' + pluginId + '.' + capability);

    this._kernel.ipc.emit('plugin:call:start', { pluginId, capability });
    try {
      const result = await handler(args);
      this._kernel.ipc.emit('plugin:call:complete', { pluginId, capability });
      return result;
    } catch (e) {
      this._kernel.ipc.emit('plugin:call:error', { pluginId, capability, error: e.message });
      throw e;
    }
  }

  async broadcast(capability, args = {}) {
    const pluginIds = this._capabilityIndex.get(capability) || [];
    const results = await Promise.allSettled(
      pluginIds.map(id => this.call(id, capability, args))
    );
    return results.map((r, i) => ({
      pluginId: pluginIds[i],
      ok: r.status === 'fulfilled',
      value: r.value,
      error: r.reason?.message,
    }));
  }

  findByCapability(capability) {
    return (this._capabilityIndex.get(capability) || [])
      .map(id => ({ id, ...this._plugins.get(id)?.meta }));
  }

  getCapabilities(pluginId) {
    return [...(this._plugins.get(pluginId)?.capabilities.keys() || [])];
  }

  getAll() {
    return [...this._plugins.entries()].map(([id, p]) => ({
      id,
      meta: p.meta,
      capabilities: [...p.capabilities.keys()],
    }));
  }

  unregister(pluginId) {
    const plugin = this._plugins.get(pluginId);
    if (!plugin) return;
    plugin.capabilities.forEach((_, name) => this._unindexCapability(name, pluginId));
    this._plugins.delete(pluginId);
    this._kernel.ipc.emit('plugin:unregistered', { pluginId });
  }

  hook(event, handler) {
    if (!this._hooks.has(event)) this._hooks.set(event, new Set());
    this._hooks.get(event).add(handler);
    return () => this._hooks.get(event)?.delete(handler);
  }

  _indexCapability(name, pluginId) {
    if (!this._capabilityIndex.has(name)) this._capabilityIndex.set(name, []);
    const arr = this._capabilityIndex.get(name);
    if (!arr.includes(pluginId)) arr.push(pluginId);
  }

  _unindexCapability(name, pluginId) {
    const arr = this._capabilityIndex.get(name);
    if (arr) {
      const i = arr.indexOf(pluginId);
      if (i >= 0) arr.splice(i, 1);
    }
  }

  _unregisterByWindow(windowId) {
    for (const [id, plugin] of this._plugins.entries()) {
      if (plugin.windowId === windowId) this.unregister(id);
    }
  }

  _runHook(event, data) {
    const handlers = this._hooks.get(event);
    if (handlers) handlers.forEach(h => { try { h(data); } catch {} });
  }
}

export default PluginRegistry;
