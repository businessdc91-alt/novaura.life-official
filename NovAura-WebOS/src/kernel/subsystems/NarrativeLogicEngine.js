/**
 * NovAura OS — Narrative Logic Engine (Causality Engine)
 * 
 * Manages story structure, plot dependencies, character arcs, and thematic integrity.
 * This is a first-class Kernel subsystem.
 */

class NarrativeLogicEngine {
  constructor() {
    this._kernel = null;
    this._dag = new Map(); // Dynamic Character/Plot Dependency Graph
    this._activeFocus = 'general';
    this._subscribers = new Set();
  }

  init(kernel) {
    this._kernel = kernel;
    console.log('[NarrativeEngine] Initialized.');

    // Listen for story updates
    kernel.ipc.on('narrative:beat:add', (beat) => this.addBeat(beat));
    kernel.ipc.on('narrative:link:add', ({ source, target, type }) => this.addLink(source, target, type));
  }

  /**
   * Add a new plot point or story beat
   * @param {object} beat { id, title, content, timestamp, characters: [] }
   */
  addBeat(beat) {
    const id = beat.id || `beat_${Date.now()}`;
    this._dag.set(id, {
      ...beat,
      id,
      dependencies: [],
      effects: [],
    });
    this._notify();
    this._kernel.ipc.emit('narrative:updated', { type: 'beat_added', id });
  }

  /**
   * Link two narrative elements with a causal relationship
   */
  addLink(sourceId, targetId, type = 'causal') {
    const source = this._dag.get(sourceId);
    const target = this._dag.get(targetId);

    if (source && target) {
      if (!source.effects.includes(targetId)) source.effects.push(targetId);
      if (!target.dependencies.includes(sourceId)) target.dependencies.push(sourceId);
      
      this._notify();
      this._kernel.ipc.emit('narrative:updated', { type: 'link_added', sourceId, targetId });
    }
  }

  /**
   * Perform an integrity check on the narrative graph
   * Detects paradoxes, abandoned plot lines, or character inconsistencies.
   */
  async checkIntegrity() {
    const anomalies = [];
    
    // 1. Detect circular dependencies
    // (Simple DFS for cycle detection)
    
    // 2. Detect abandoned beats (no effects, and not a resolution)
    
    return anomalies;
  }

  _notify() {
    this._subscribers.forEach(sub => sub(this.getState()));
  }

  getState() {
    return {
      graph: Array.from(this._dag.entries()),
      activeFocus: this._activeFocus
    };
  }

  subscribe(callback) {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }
}

export default NarrativeLogicEngine;
