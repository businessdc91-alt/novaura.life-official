/**
 * Sovereign OS — Semantics Engine
 *
 * Makes the entire operating system intent-driven and callable by AI companions (Aura/Nova).
 * Exposes all windows, apps, file capabilities, and system controls as semantic functions.
 */

class SemanticsEngine {
  constructor() {
    this._kernel = null;
    this._registry = new Map();
    this._initCoreRegistry();
  }

  init(kernel) {
    this._kernel = kernel;

    kernel.ipc.on('semantics:execute', async ({ intent, callbackId }) => {
      try {
        const result = await this.executeIntent(intent);
        if (callbackId) kernel.ipc.emit(`semantics:result:${callbackId}`, { success: true, result });
      } catch (err) {
        if (callbackId) kernel.ipc.emit(`semantics:result:${callbackId}`, { success: false, error: err.message });
      }
    });
  }

  _initCoreRegistry() {
    // Window control
    this.register('window:open', {
      description: 'Open a desktop application window',
      params: ['type', 'props', 'title'],
      handler: (params) => this._kernel?.wm?.openWindow(params.type, params.props, params.title),
    });

    this.register('window:close', {
      description: 'Close an open window by ID',
      params: ['windowId'],
      handler: (params) => this._kernel?.wm?.closeWindow(params.windowId),
    });

    this.register('window:minimize', {
      description: 'Minimize window by ID',
      params: ['windowId'],
      handler: (params) => this._kernel?.wm?.minimizeWindow(params.windowId),
    });

    this.register('window:maximize', {
      description: 'Maximize or unmaximize window by ID',
      params: ['windowId'],
      handler: (params) => this._kernel?.wm?.maximizeWindow(params.windowId),
    });

    this.register('window:focus', {
      description: 'Bring window to front',
      params: ['windowId'],
      handler: (params) => this._kernel?.wm?.focusWindow(params.windowId),
    });

    this.register('window:list', {
      description: 'List all open windows',
      params: [],
      handler: () => this._kernel?.wm?.getOpenWindows() || [],
    });

    // File actions
    this.register('file:create', {
      description: 'Create a new file',
      params: ['path', 'content'],
      handler: (params) => this._kernel?.fs?.writeFile(params.path, params.content),
    });

    this.register('file:read', {
      description: 'Read file contents',
      params: ['path'],
      handler: (params) => this._kernel?.fs?.readFile(params.path),
    });

    // Notifications
    this.register('notify', {
      description: 'Display desktop notification',
      params: ['title', 'message', 'type'],
      handler: (params) => this._kernel?.notifications?.notify(params.title, params.message, params.type),
    });

    // Terminal
    this.register('terminal:exec', {
      description: 'Execute command in terminal',
      params: ['command'],
      handler: (params) => this._kernel?.ipc.emit('terminal:run_command', { command: params.command }),
    });
  }

  register(actionKey, definition) {
    this._registry.set(actionKey, definition);
  }

  getAvailableActions() {
    return Array.from(this._registry.entries()).map(([key, def]) => ({
      key,
      description: def.description,
      params: def.params,
    }));
  }

  getAvailableApps() {
    return [
      { id: 'files', name: 'Files', description: 'Local file manager and cloud mount' },
      { id: 'terminal', name: 'Terminal', description: 'Command line terminal' },
      { id: 'browser', name: 'Decentralized Browser', description: 'Web browser and decentralized gateway' },
      { id: 'cybeni', name: 'Cybeni Builder', description: 'Dedicated AI IDE and code engineer' },
      { id: 'website_builder', name: 'Website Builder', description: 'Visual drag-and-drop website creator' },
      { id: 'card_creator', name: 'Business Card Creator', description: '3D interactive business card designer' },
      { id: 'resume_builder', name: 'Resume Builder', description: 'ATS-optimized executive resume architect' },
      { id: 'card_forge', name: 'TCG Card Forge', description: 'Card game studio, deck builder & AI rules' },
      { id: 'word_studio', name: 'Word Studio', description: 'Offline document authoring' },
      { id: 'novamail', name: 'NovaMail', description: 'Encrypted sovereign mail client' },
      { id: 'social', name: 'NovaSocial', description: 'P2P decentralized social network' },
      { id: 'sentinel', name: 'Sentinel Shield', description: 'Security, privacy and audit dashboard' },
      { id: 'hypervisor', name: 'Neural Hypervisor', description: 'Local model deck, Ollama/LM Studio monitor & hardware speedometer' },
      { id: 'media_foundry', name: 'Media Foundry', description: 'ComfyUI Forge lab, 1-click installer, model downloads & media studio' },
      { id: 'settings', name: 'Settings & Diagnostics', description: 'OS configuration, keys & system health' },
    ];
  }

  /**
   * Execute an action directly by actionKey or resolve natural language intent.
   */
  async executeAction(actionKey, params = {}) {
    const action = this._registry.get(actionKey);
    if (!action) {
      throw new Error(`Semantic action "${actionKey}" not registered.`);
    }
    return action.handler(params);
  }

  async executeIntent(intentText) {
    const text = (intentText || '').toLowerCase().trim();

    // Direct pattern matches for rapid response
    if (text.includes('open terminal')) return this.executeAction('window:open', { type: 'terminal' });
    if (text.includes('open files') || text.includes('open file manager')) return this.executeAction('window:open', { type: 'files' });
    if (text.includes('open browser')) return this.executeAction('window:open', { type: 'browser' });
    if (text.includes('open cybeni') || text.includes('open code editor') || text.includes('open ide')) return this.executeAction('window:open', { type: 'cybeni' });
    if (text.includes('open hypervisor') || text.includes('neural hypervisor') || text.includes('local models') || text.includes('speedometer') || text.includes('ollama')) return this.executeAction('window:open', { type: 'hypervisor' });
    if (text.includes('open media foundry') || text.includes('comfyui') || text.includes('comfy') || text.includes('forge') || text.includes('image generator') || text.includes('media lab')) return this.executeAction('window:open', { type: 'media_foundry' });
    if (text.includes('open website builder') || text.includes('build website')) return this.executeAction('window:open', { type: 'website_builder' });
    if (text.includes('open business card') || text.includes('business card')) return this.executeAction('window:open', { type: 'card_creator' });
    if (text.includes('open resume') || text.includes('build resume')) return this.executeAction('window:open', { type: 'resume_builder' });
    if (text.includes('open card forge') || text.includes('card forge') || text.includes('tcg')) return this.executeAction('window:open', { type: 'card_forge' });
    if (text.includes('open platform') || text.includes('open cloud') || text.includes('open bridge') || text.includes('live platform')) return this.executeAction('window:open', { type: 'platform_bridge' });
    if (text.includes('open disk') || text.includes('open drive') || text.includes('disk architect') || text.includes('clean disk') || text.includes('boot manager')) return this.executeAction('window:open', { type: 'disk_architect' });
    if (text.includes('open settings')) return this.executeAction('window:open', { type: 'settings' });
    if (text.includes('open shield') || text.includes('open sentinel')) return this.executeAction('window:open', { type: 'sentinel' });
    if (text.includes('list windows')) return this.executeAction('window:list');

    // Default: ask Nova agent to parse and execute intent
    if (this._kernel?.nova) {
      return this._kernel.nova.sendMessage(`User intent: ${intentText}`, 'nova');
    }

    throw new Error(`Unable to resolve intent: "${intentText}"`);
  }
}

let _instance = null;
export function getSemanticsEngine() {
  if (!_instance) {
    _instance = new SemanticsEngine();
  }
  return _instance;
}

export default getSemanticsEngine;
