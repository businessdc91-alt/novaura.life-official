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
      crashId: null,
      repairText: null,
      restarting: false,
    };
    this._unsubRepair = null;
    this._restartTimer = null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const { windowId, windowType } = this.props;

    ipc.emit('crash:boundary', {
      error: { message: error.message, stack: error.stack },
      componentStack: info?.componentStack,
      windowId,
      windowType,
    });

    this._unsubRepair = ipc.on('crash:repair:ready', ({ crashId, repair, canRestart }) => {
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
  }

  _restart() {
    this._unsubRepair?.();
    this.setState({
      hasError: false,
      error: null,
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
      <div style={{
        width: '100%', height: '100%',
        background: '#0d0d14',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 24, gap: 16,
        fontFamily: 'monospace',
        boxSizing: 'border-box',
      }}>
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
              color: '#ffffff50', fontSize: 10, maxWidth: 300,
              textAlign: 'center', lineHeight: 1.6,
            }}>
              {error?.message?.slice(0, 160) || 'An unexpected error occurred in this window.'}
            </div>

            {repairText && (
              <div style={{
                background: '#00f0ff08', border: '1px solid #00f0ff18',
                borderRadius: 6, padding: '10px 14px',
                color: '#00f0ffaa', fontSize: 10, maxWidth: 320,
                lineHeight: 1.7, textAlign: 'left',
              }}>
                {repairText.slice(0, 200)}{repairText.length > 200 ? '…' : ''}
              </div>
            )}

            <button
              onClick={() => this._restart()}
              style={{
                marginTop: 8,
                padding: '6px 20px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 10,
                letterSpacing: 1,
              }}
            >
              RECOVER WINDOW
            </button>
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

