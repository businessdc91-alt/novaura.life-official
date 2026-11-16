import React from 'react';
import { 
  Panel, 
  Group as PanelGroup, 
  Separator as PanelResizeHandle 
} from 'react-resizable-panels';
import { 
  FileCode, 
  Bot, 
  Sparkles,
  Settings,
  Play,
  Rocket,
  Monitor,
  Code2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FileExplorer from '../../components/ide/FileExplorer';
import LiveCanvas from '../../components/ide/LiveCanvas';
import AuraIDEConsole from '../../components/ide/AuraIDEConsole';
import IDETerminal from '../../components/ide/IDETerminal';
import IDESplash from '../../components/ide/IDESplash';
import { useAIStore } from '../../stores/aiStore';

const NovaIDE: React.FC = () => {
  const { 
    activeIDETab: activeTab, 
    setActiveIDETab: setActiveTab,
    ideMainLayout,
    ideCenterLayout,
    setIDELayout
  } = useAIStore();

  return (
    <div className="h-[calc(100vh-64px)] w-full bg-void flex flex-col overflow-hidden text-white font-sans">
      {/* IDE Header/Toolbar */}
      <header className="h-12 border-b border-white/5 bg-void-light flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20">
              <Sparkles className="w-4 h-4 text-neon-cyan" />
            </div>
            <span className="font-heading font-bold text-sm tracking-widest hidden md:block uppercase">Nova Neural IDE</span>
            <Badge variant="outline" className="text-[10px] border-neon-cyan/30 text-neon-cyan bg-neon-cyan/5">BETA 2.0</Badge>
          </div>
          
          <div className="h-6 w-px bg-white/10" />

          <div className="flex items-center gap-1 bg-void-lighter rounded-lg p-1">
            <Button 
              variant={activeTab === 'editor' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setActiveTab('editor')}
              className="h-7 px-3 text-xs gap-2"
            >
              <FileCode className="w-3.5 h-3.5" /> Code
            </Button>
            <Button 
              variant={activeTab === 'preview' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setActiveTab('preview')}
              className="h-7 px-3 text-xs gap-2"
            >
              <Monitor className="w-3.5 h-3.5" /> Preview
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-void bg-void-lighter flex items-center justify-center text-[10px] text-text-muted">
                <Bot className="w-3 h-3" />
              </div>
            ))}
            <div className="pl-4 text-[10px] text-text-muted uppercase tracking-tighter">Genesis Swarm Active</div>
          </div>
          
          <Button size="sm" variant="outline" className="h-8 border-white/10 hover:bg-neon-cyan/10 hover:text-neon-cyan gap-2">
            <Play className="w-3.5 h-3.5" /> Run
          </Button>
          <Button size="sm" className="h-8 bg-neon-cyan text-void font-bold hover:shadow-glow-cyan gap-2">
            <Rocket className="w-3.5 h-3.5" /> Deploy
          </Button>
          
          <div className="h-6 w-px bg-white/10 mx-1" />
          
          <Button size="icon" variant="ghost" className="h-8 w-8 text-text-muted">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Workbench */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup 
          orientation="horizontal" 
          defaultLayout={ideMainLayout || undefined}
          onLayoutChanged={(layout) => setIDELayout('ideMainLayout', layout as Record<string, number>)}
        >
          {/* Left Panel: File Explorer & Templates */}
          <Panel defaultSize={15} minSize={10} className="bg-void-light border-r border-white/5 flex flex-col">
            <FileExplorer />
          </Panel>

          <PanelResizeHandle className="w-1 bg-void hover:bg-neon-cyan/30 transition-colors" />

          {/* Center Panel: Editor/LiveCanvas */}
          <Panel defaultSize={60} className="bg-void flex flex-col relative">
            {/* Splash screen — shown on first open */}
            <IDESplash />

            <PanelGroup
              orientation="vertical"
              defaultLayout={ideCenterLayout || undefined}
              onLayoutChanged={(layout) => setIDELayout('ideCenterLayout', layout as Record<string, number>)}
            >
              <Panel defaultSize={75} className="flex flex-col">
                <div className="flex-1 relative overflow-hidden">
                  <LiveCanvas mode={activeTab} />
                </div>
              </Panel>
              
              <PanelResizeHandle className="h-1 bg-void hover:bg-neon-cyan/30 transition-colors" />
              
              {/* Bottom Panel: Terminal */}
              <Panel defaultSize={25} minSize={5} className="bg-void-lighter">
                <IDETerminal />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-1 bg-void hover:bg-neon-cyan/30 transition-colors" />

          {/* Right Panel: Aura Chat & AI Settings */}
          <Panel defaultSize={25} minSize={15} className="bg-void-light border-l border-white/5 flex flex-col">
            <AuraIDEConsole />
          </Panel>
        </PanelGroup>
      </div>

      {/* Status Bar */}
      <footer className="h-6 border-t border-white/5 bg-void-lighter shrink-0 flex items-center justify-between px-3 text-[10px] text-text-muted">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Genesis Node: Operational</span>
          </div>
          <div className="flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
            <Code2 className="w-3 h-3" />
            <span>main.tsx</span>
          </div>
          <span>Line 42, Col 12</span>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="hover:text-white cursor-pointer">UTF-8</span>
          <span className="hover:text-white cursor-pointer">TypeScript React</span>
          <div className="flex items-center gap-1 hover:text-neon-cyan cursor-pointer transition-colors">
            <Bot className="w-3 h-3" />
            <span>Aura 2.1 (Kimi Fusion)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NovaIDE;
