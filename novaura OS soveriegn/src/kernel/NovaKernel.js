/**
 * Sovereign OS — Nova Kernel
 *
 * Decentralized, local-first operating system kernel orchestrating all 14 subsystems.
 * Backed by private user-hosted database (Dexie/IndexedDB + Tauri local storage).
 * Zero cloud provider reliance for core OS features.
 */

import { ipc } from './IPCBus.js';
import AuthSubsystem from './subsystems/AuthSubsystem.js';
import WindowManager from './subsystems/WindowManager.js';
import AISubsystem from './subsystems/AISubsystem.js';
import FileSystem from './subsystems/FileSystem.js';
import SettingsStore from './subsystems/SettingsStore.js';
import NotificationBus from './subsystems/NotificationBus.js';
import ProcessManager from './subsystems/ProcessManager.js';
import MemoryMap from './subsystems/MemoryMap.js';
import PluginRegistry from './subsystems/PluginRegistry.js';
import Scheduler from './subsystems/Scheduler.js';
import CrashHandler from './subsystems/CrashHandler.js';
import { isPopoutWindow } from '../services/popoutWindows.js';
import LocalModelSubsystem from './subsystems/LocalModelSubsystem.js';
import NovaAgent from './subsystems/NovaAgent.js';
import SentinelShield from './subsystems/SentinelShield.js';
import { interAppSecurityBroker } from './InterAppSecurityBroker.js';
import { getSemanticsEngine } from './SemanticsEngine.js';
import { db } from '../database/sovereignDatabase.js';

export const BOOT_PHASES = [
  { id: 0,  name: 'KERNEL_INIT',  label: 'Initializing Sovereign subsystems...' },
  { id: 1,  name: 'IPC_READY',    label: 'Connecting high-speed IPC bus...' },
  { id: 2,  name: 'DATABASE',     label: 'Verifying private cloud database on PC...' },
  { id: 3,  name: 'AUTH',         label: 'Verifying sovereign operator identity...' },
  { id: 4,  name: 'PREFS',        label: 'Loading settings and environment...' },
  { id: 5,  name: 'MEMORY',       label: 'Restoring memory map and workspaces...' },
  { id: 6,  name: 'AI_CONNECT',   label: 'Probing local AI (Ollama/LM Studio/WebGPU)...' },
  { id: 7,  name: 'SEMANTICS',    label: 'Engaging OS semantics engine...' },
  { id: 8,  name: 'PLUGINS',      label: 'Loading decentralized plugin registry...' },
  { id: 9,  name: 'SCHEDULER',    label: 'Starting real-time task scheduler...' },
  { id: 10, name: 'CRASH_GUARD',  label: 'Arming Sentinel Shield and Crash Guard...' },
  { id: 11, name: 'DESKTOP',      label: 'Launching Sovereign Desktop...' },
];

export class NovaKernel {
  constructor() {
    this.kernel = this;
    this.ipc = ipc;
    this.broker = interAppSecurityBroker;

    this.auth          = null;
    this.wm            = null;
    this.ai            = null;
    this.fs            = null;
    this.settings      = null;
    this.notifications = null;
    this.processes     = null;
    this.memory        = null;
    this.plugins       = null;
    this.scheduler     = null;
    this.crash         = null;
    this.localModel    = null;
    this.semantics     = null;
    this.nova          = null;
    this.sentinel      = null;

    this.bootPhase = 'idle';
    this.bootLog   = [];
    this._bootStart = null;
  }

  createScopedIPC(appId) {
    return this.broker.createScopedIPC(appId, this.ipc);
  }


  async boot() {
    if (this.bootPhase === 'booting' || this.bootPhase === 'ready') return;
    this.bootPhase = 'booting';
    this._bootStart = Date.now();

    try {
      // Phase 0 — Instantiate subsystems
      await this._phase(0, () => {
        this.auth          = new AuthSubsystem();
        this.wm            = new WindowManager();
        this.ai            = new AISubsystem();
        this.fs            = new FileSystem();
        this.settings      = new SettingsStore();
        this.notifications = new NotificationBus();
        this.processes     = new ProcessManager();
        this.memory        = new MemoryMap();
        this.plugins       = new PluginRegistry();
        this.scheduler     = new Scheduler();
        this.crash         = new CrashHandler();
        this.localModel    = new LocalModelSubsystem();
        this.nova          = new NovaAgent();
        this.sentinel      = new SentinelShield();
      });

      // Phase 1 — IPC & Sentinel Security
      await this._phase(1, async () => {
        this.sentinel.init(this);
        await this.sentinel.boot();
        this._log(1, 'IPC bus online. Sentinel Shield active.');
      });

      // Phase 2 — Local Private Database
      await this._phase(2, async () => {
        if (!db.isOpen()) {
          await db.open();
        }
        this._log(2, 'Private cloud database online on host PC. Zero external dependencies.');
      });

      // Phase 3 — Sovereign Operator Auth
      await this._phase(3, async () => {
        this.auth.init(this);
        await this.auth.onReady?.();
        this._log(3, `Authenticated sovereign identity: ${this.auth.currentUser?.name || 'Local Operator'}`);
      });

      // Phase 4 — Settings & Preferences
      await this._phase(4, async () => {
        this.settings.init(this);
        await this.settings.onReady?.();
        this._log(4, 'Preferences loaded from private storage.');
      });

      // Phase 5 — Memory Map & Snapshot restore
      await this._phase(5, async () => {
        this.memory.init(this);
        await this.memory.onReady?.();
        const snapshot = this.memory.get('workspace:snapshot');
        if (isPopoutWindow()) {
          // A pop-out window hosts one app; the desktop layout belongs to the main window.
          this._log(5, 'Pop-out window: desktop workspace left to the main window.');
        } else if (snapshot?.windows?.length) {
          this._log(5, `Restoring ${snapshot.windows.length} windows from workspace snapshot.`);
          this.memory.restoreWorkspace();
        } else {
          this._log(5, 'Memory map clean. Default workspace active.');
        }
      });

      // Phase 6 — AI Engine & Local Probing
      await this._phase(6, async () => {
        try {
          this.localModel.init(this);
          await this.localModel.boot();

          this.ai.init(this);
          this._log(6, `Local model probe complete (${this.localModel.activeBackend}). AI layer online.`);
        } catch (aiErr) {
          this._log(6, `AI layer initialized in degraded state: ${aiErr.message}`);
        }
      });

      // Phase 7 — Semantics Engine
      await this._phase(7, () => {
        this.semantics = getSemanticsEngine();
        this.semantics.init(this);
        this._log(7, `Semantics engine online. ${this.semantics.getAvailableApps().length} apps registered.`);
      });

      // Phase 8 — Plugin Registry
      await this._phase(8, () => {
        this.plugins.init(this);
        this._log(8, 'Plugin registry active.');
      });

      // Phase 9 — Real-time Scheduler
      await this._phase(9, () => {
        this.scheduler.init(this);
        this._log(9, `Scheduler active. ${this.scheduler.getAll().length} tasks registered.`);
      });

      // Phase 10 — Crash Handler
      await this._phase(10, () => {
        this.crash.init(this);
        this._log(10, 'Crash guard active with instant repair capability.');
      });

      // Phase 11 — Core Services & Desktop Launch
      await this._phase(11, async () => {
        this.fs.init(this);
        this.notifications.init(this);
        this.processes.init(this);
        this.processes.boot();

        this.nova.init(this);
        await this.nova.boot();

        this._log(11, `Sovereign Desktop ready in ${Date.now() - this._bootStart}ms.`);
      });

      this.bootPhase = 'ready';
      this.ipc.emit('system:ready', {
        bootTime: Date.now() - this._bootStart,
        bootLog: this.bootLog,
      });
    } catch (fatalErr) {
      this.bootPhase = 'failed';
      this._log(99, `FATAL BOOT ERROR: ${fatalErr.message}`);
      console.error('[NovaKernel] Fatal boot failure:', fatalErr);
      this.ipc.emit('system:error', { error: fatalErr });
    }
  }

  async _phase(phaseId, fn) {
    this.bootPhase = `phase_${phaseId}`;
    const progress = Math.round(((phaseId + 1) / BOOT_PHASES.length) * 100);
    const label = BOOT_PHASES[phaseId]?.label || 'Booting Sovereign OS...';
    this.ipc.emit('boot:progress', {
      phase: phaseId,
      name: BOOT_PHASES[phaseId]?.name,
      label,
      percent: progress,
    });
    this.ipc.emit('system:boot:phase', {
      phase: phaseId,
      label,
      progress,
    });
    await fn();
  }

  _log(phase, message) {
    const entry = { phase, message, ts: Date.now() };
    this.bootLog.push(entry);
    this.ipc.emit('boot:log', entry);
  }
}

let _kernelInstance = null;
export function getKernel() {
  if (!_kernelInstance) {
    _kernelInstance = new NovaKernel();
  }
  return _kernelInstance;
}

export const kernel = getKernel();
export default NovaKernel;

