import React, { useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Shield, Zap, Trash2 } from 'lucide-react';
import { useIDEStore } from '../../stores/ideStore';
import type { TerminalLine } from '../../stores/ideStore';

const lineStyle = (type: TerminalLine['type']): string => {
  switch (type) {
    case 'system':  return 'text-neon-cyan opacity-80';
    case 'command': return 'text-white';
    case 'success': return 'text-green-400';
    case 'error':   return 'text-red-400';
    case 'info':    return 'text-blue-300';
    case 'build':   return 'text-neon-violet';
    case 'output':  return 'text-text-muted';
    default:        return 'text-text-muted';
  }
};

const IDETerminal: React.FC = () => {
  const { terminalLines, clearTerminal } = useIDEStore();
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  return (
    <div className="flex flex-col h-full bg-black/80 font-mono text-xs overflow-hidden border-t border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-void-lighter border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-neon-cyan" />
          <span className="text-text-muted font-bold tracking-tighter uppercase text-[9px]">BuilderBot Terminal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[9px] text-green-500/80">
            <Shield className="w-2.5 h-2.5" />
            <span>Sandbox Secure</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-neon-cyan/80">
            <Zap className="w-2.5 h-2.5" />
            <span>GPU Accel</span>
          </div>
          <button
            onClick={clearTerminal}
            title="Clear terminal"
            className="text-text-muted hover:text-white transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Log Output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-3 space-y-0.5 custom-scrollbar"
      >
        {terminalLines.map((line) => (
          <div key={line.id} className={`leading-relaxed whitespace-pre-wrap break-words ${lineStyle(line.type)}`}>
            {line.text || '\u00A0'}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IDETerminal;
