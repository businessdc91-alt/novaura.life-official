/**
 * NovAura Sovereign OS — Kernel Error Boundary
 *
 * Wraps any window or component. When an error occurs:
 *   1. Catches the error silently
 *   2. Reports to kernel CrashHandler via IPC (triggers local AI repair/diagnostics)
 *   3. Shows an in-window recovery UI instead of crashing the desktop
 *   4. Auto-restarts the window safely
 */

import { Component } from 'react';
import { ipc } from './IPCBus.js';

class KernelErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: '',
      crashId: null,
      repairText: null,
      restarting: false,
    };
    this._unsubRepair = null;
    this._restartTimer = null;
    this._onRecoverWindow = (e) => {
      if (!this.state.hasError) return;
      const target = e?.detail?.targetApp || e?.detail?.windowId;
      if (!target || target === 'desktop' || target === this.props.windowId || target === this.props.appType || target === this.props.windowType) {
        this._restart();
      }
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidMount() {
    if (typeof window !== 'undefined') {
      window.addEventListener('novaura:repair_recover_window', this._onRecoverWindow);
    }
  }

  componentDidCatch(error, info) {
    const { windowId, windowType, appType } = this.props;
    this.setState({ componentStack: info?.componentStack || '' });

    ipc.emit('crash:boundary', {
      error: { message: error.message, stack: error.stack },
      componentStack: info?.componentStack,
      windowId,
      windowType,
      appType,
    });

    this._unsubRepair = ipc.on('crash:repair:ready', ({ repair, canRestart }) => {
      this.setState({ repairText: repair });
      if (canRestart) {
        this.setState({ restarting: true });
        this._restartTimer = setTimeout(() => this._restart(), 2000);
      }
    });
  }

  componentWillUnmount() {
    this._unsubRepair?.();
    if (this._restartTimer) clearTimeout(this._restartTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('novaura:repair_recover_window', this._onRecoverWindow);
    }
  }

  _openRepairPopout() {
    const { windowId, windowType = 'Window', appType } = this.props;
    const { error, componentStack } = this.state;
    import('../services/repair/repairOrchestrator.js')
      .then(({ launchRepairPopout }) =>
        launchRepairPopout({
          targetApp: appType || windowType || windowId || 'desktop',
          autoAnalyze: true,
          crash: {
            source: 'KernelErrorBoundary',
            appId: appType || windowId || 'window',
            windowType,
            message: error?.message || 'Window crashed during render',
            stack: error?.stack || '',
            componentStack,
          },
        })
      )
      .catch(() => {});
  }

  _restart() {
    this._unsubRepair?.();
    this.setState({
      hasError: false,
      error: null,
      componentStack: '',
      crashId: null,
      repairText: null,
      restarting: false,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { windowType = 'Window' } = this.props;
    const { error, repairText, restarting } = this.state;

    return (
      <div
        data-kernel-crash-boundary="true"
        data-window-type={windowType}
        style={{
          width: '100%', height: '100%',
          background: '#0d0d14',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, gap: 16,
          fontFamily: 'monospace',
          boxSizing: 'border-box',
        }}
      >
        {restarting ? (
          <>
            <div style={{ color: '#00f0ff', fontSize: 13, letterSpacing: 1 }}>
              Restarting {windowType}…
            </div>
            <div style={{
              width: 120, height: 2,
              background: '#ffffff10', borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', width: '100%',
                background: 'linear-gradient(90deg, #00f0ff, #7c3aed)',
                animation: 'ks-slide 2s linear forwards',
              }} />
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#ff4466', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
              {windowType} Error
            </div>

            <div style={{
              color: '#ffffff75', fontSize: 11, maxWidth: 360,
              textAlign: 'center', lineHeight: 1.6,
            }}>
              {error?.message?.slice(0, 180) || 'An unexpected error occurred in this window.'}
            </div>

            {repairText && (
              <div style={{
                background: '#00f0ff08', border: '1px solid #00f0ff18',
                borderRadius: 6, padding: '10px 14px',
                color: '#00f0ffaa', fontSize: 10, maxWidth: 360,
                lineHeight: 1.7, textAlign: 'left',
              }}>
                {repairText.slice(0, 200)}{repairText.length > 200 ? '…' : ''}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 6 }}>
              <button
                onClick={() => this._restart()}
                style={{
                  padding: '7px 18px',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 10,
                  letterSpacing: 1,
                }}
              >
                RECOVER WINDOW
              </button>
              <button
                onClick={() => this._openRepairPopout()}
                style={{
                  padding: '7px 18px',
                  background: 'linear-gradient(90deg, rgba(6, 182, 212, 0.25), rgba(124, 58, 237, 0.35))',
                  border: '1px solid rgba(168, 85, 247, 0.55)',
                  color: '#f5d0fe',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 10,
                  letterSpacing: 1,
                  fontWeight: 700,
                }}
              >
                POP-OUT AUTO-REPAIR (CYBENI · AURA · NOVA)
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
}

export function withErrorBoundary(WrappedComponent, options = {}) {
  const displayName = options.windowType || WrappedComponent.displayName || WrappedComponent.name || 'Window';

  function WithBoundary(props) {
    return (
      <KernelErrorBoundary windowId={props.windowId} windowType={displayName}>
        <WrappedComponent {...props} />
      </KernelErrorBoundary>
    );
  }

  WithBoundary.displayName = 'WithErrorBoundary(' + displayName + ')';
  return WithBoundary;
}

export { KernelErrorBoundary };
export default KernelErrorBoundary;

