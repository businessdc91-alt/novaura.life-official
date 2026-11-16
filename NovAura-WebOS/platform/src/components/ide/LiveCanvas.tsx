import React from 'react';
import Editor from '@monaco-editor/react';
import {
  Monitor,
  Code2,
  RotateCcw,
  Maximize2,
  RefreshCw,
  Eye,
  Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useIDEStore } from '../../stores/ideStore';

interface LiveCanvasProps {
  mode: 'editor' | 'preview';
}

const LiveCanvas: React.FC<LiveCanvasProps> = ({ mode }) => {
  const { editorCode, setEditorCode, pipelineStatus } = useIDEStore();
  const isRunning = pipelineStatus === 'running';

  return (
    <div className="h-full flex flex-col bg-void">
      {/* Canvas Toolset */}
      <div className="h-10 border-b border-white/5 bg-void-light flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {mode === 'preview' ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-neon-cyan" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Interactive Preview</span>
              </>
            ) : (
              <>
                <Code2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Neural Core Editor</span>
              </>
            )}
          </div>
          {isRunning && (
            <div className="flex items-center gap-1.5 text-neon-cyan animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[9px] font-mono uppercase tracking-tighter">BuilderBot running...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === 'preview' ? (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-text-muted hover:text-white">
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-text-muted hover:text-white">
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-text-muted hover:text-white" title="Reset to default"
                onClick={() => useIDEStore.getState().setEditorCode(useIDEStore.getState().editorCode)}>
                <RotateCcw className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Editor/Preview Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {mode === 'editor' ? (
          <div className="flex-1">
            <Editor
              height="100%"
              defaultLanguage="html"
              theme="vs-dark"
              value={editorCode}
              onChange={(value) => setEditorCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'JetBrains Mono',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 20 },
                readOnly: isRunning,
              }}
            />
          </div>
        ) : (
          <div className="flex-1 bg-[#0A0A0F] p-8 flex items-center justify-center overflow-auto custom-scrollbar">
            <div className="w-full max-w-2xl bg-[#0A0A0F] border border-white/5 rounded-2xl shadow-2xl relative overflow-hidden aspect-video">
              <div className="absolute top-0 inset-x-0 h-6 bg-void-lighter border-b border-white/5 flex items-center justify-center px-4">
                <div className="flex gap-1 absolute left-3">
                  <div className="w-2 h-2 rounded-full bg-red-500/50" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                  <div className="w-2 h-2 rounded-full bg-green-500/50" />
                </div>
                <div className="bg-void-light px-3 py-0.5 rounded text-[8px] text-text-muted border border-white/5 flex items-center gap-1.5">
                  <Eye className="w-2 h-2" /> localhost:3000
                </div>
              </div>

              <div className="pt-6 h-full w-full overflow-hidden">
                <iframe
                  title="Preview"
                  className="w-full h-full border-0 pointer-events-none"
                  srcDoc={editorCode}
                />
              </div>

              <div className="absolute inset-0 pointer-events-none border border-neon-cyan/10 rounded-2xl" />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-6 bg-void flex items-center px-4 gap-4 text-[9px] text-text-muted shrink-0">
        <div className="flex items-center gap-1">
          <Badge className={`${isRunning ? 'bg-neon-cyan/20 text-neon-cyan' : 'bg-green-500/10 text-green-500'} border-0 h-3 px-1 text-[8px]`}>
            {isRunning ? 'BUILDING' : 'ACTIVE'}
          </Badge>
          <span>{isRunning ? 'Pipeline Running' : 'Hot Reloading Enabled'}</span>
        </div>
        <span>{editorCode.length.toLocaleString()} chars</span>
      </div>
    </div>
  );
};

export default LiveCanvas;
