import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    // Attempt to report to kernel crash subsystem if available
    try {
      const { kernel } = require('../kernel/NovaKernel');
      if (kernel && kernel.reportCrash) {
        kernel.reportCrash(error, { 
          component: 'ErrorBoundary',
          info: errorInfo.componentStack 
        });
      }
    } catch (e) {
      // ignore
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center w-full h-full min-h-[400px] bg-black/40 backdrop-blur-xl border border-rose-500/20 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-white/40 text-sm max-w-md mb-8">
            The application encountered an unexpected error. We've logged the crash and the kernel is attempting an auto-repair.
          </p>
          <div className="bg-black/60 rounded-lg p-4 mb-8 w-full max-w-lg overflow-auto text-left border border-white/5">
            <code className="text-rose-400 text-xs font-mono">
              {this.state.error && this.state.error.toString()}
            </code>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:scale-105 transition-transform"
          >
            Refresh System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
