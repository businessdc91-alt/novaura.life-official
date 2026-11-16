import React, { useState } from 'react';
import { 
  FolderOpen, 
  Folder, 
  FileCode, 
  Plus, 
  Search,
  Layout as LayoutIcon,
  Globe,
  PlusCircle,
  MoreVertical
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

const FileExplorer: React.FC = () => {
  const [activeSegment, setActiveSegment] = useState<'files' | 'templates'>('files');


  const templates = [
    { name: 'Genesis Portfolio', category: 'Portfolio' },
    { name: 'Neural Startup', category: 'SaaS' },
    { name: 'Aether Store', category: 'E-com' },
    { name: 'World Blog', category: 'Content' },
  ];

  return (
    <div className="flex flex-col h-full select-none">
      {/* Segment Switch */}
      <div className="flex p-1 bg-void-lighter mx-3 mt-3 rounded-lg flex-shrink-0">
        <button 
          onClick={() => setActiveSegment('files')}
          className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeSegment === 'files' ? 'bg-void-light text-neon-cyan shadow-sm' : 'text-text-muted hover:text-white'}`}
        >
          Project
        </button>
        <button 
          onClick={() => setActiveSegment('templates')}
          className={`flex-1 py-1 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${activeSegment === 'templates' ? 'bg-void-light text-neon-violet shadow-sm' : 'text-text-muted hover:text-white'}`}
        >
          Genesis
        </button>
      </div>

      <div className="px-3 py-4 flex-shrink-0">
        <div className="relative group">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-text-muted group-focus-within:text-neon-cyan transition-colors" />
          <Input 
            placeholder="Search nodes..." 
            className="h-8 pl-8 text-xs bg-void-lighter border-white/5 focus-visible:ring-1 focus-visible:ring-neon-cyan/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {activeSegment === 'files' ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
              <span>EXPLORER</span>
              <div className="flex gap-1">
                <Plus className="w-3 h-3 cursor-pointer hover:text-white" />
                <PlusCircle className="w-3 h-3 cursor-pointer hover:text-white" />
              </div>
            </div>
            
            {/* Mock Tree */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-neon-cyan bg-neon-cyan/5 group cursor-pointer transition-colors">
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="text-xs font-medium">nova-project</span>
              </div>
              <div className="pl-4 space-y-0.5">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-secondary hover:bg-white/5 cursor-pointer">
                  <Folder className="w-4 h-4 shrink-0 text-text-muted" />
                  <span className="text-xs">src</span>
                </div>
                <div className="pl-4 space-y-0.5 border-l border-white/5 ml-4">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-neon-cyan/10 text-white cursor-pointer group">
                    <FileCode className="w-4 h-4 shrink-0 text-blue-400" />
                    <span className="text-xs">App.tsx</span>
                    <Badge className="ml-auto bg-neon-cyan/20 text-neon-cyan border-0 scale-75 origin-right">EDITING</Badge>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-secondary hover:bg-white/5 cursor-pointer">
                    <FileCode className="w-4 h-4 shrink-0 text-orange-400" />
                    <span className="text-xs">index.css</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-secondary hover:bg-white/5 cursor-pointer">
                  <Folder className="w-4 h-4 shrink-0 text-text-muted" />
                  <span className="text-xs">public</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-text-secondary hover:bg-white/5 cursor-pointer">
                  <FileCode className="w-4 h-4 shrink-0 text-yellow-400" />
                  <span className="text-xs">package.json</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2 py-1 text-[10px] font-bold text-text-muted uppercase tracking-wider">
              <span>BLUEPRINTS</span>
            </div>
            
            <div className="grid gap-2 pr-1">
              {templates.map((t) => (
                <div key={t.name} className="p-3 rounded-xl bg-void-lighter border border-white/5 hover:border-neon-violet/30 group cursor-pointer transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <LayoutIcon className="w-3.5 h-3.5 text-neon-violet" />
                    <span className="text-xs font-bold group-hover:text-neon-violet transition-colors">{t.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[9px] border-white/10 text-text-muted py-0 h-4">{t.category}</Badge>
                    <Plus className="w-3 h-3 text-text-muted group-hover:text-white transition-colors" />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-neon-violet/5 border border-neon-violet/20">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-neon-violet" />
                <span className="text-xs font-bold text-neon-violet">Custom Port</span>
              </div>
              <p className="text-[10px] text-text-secondary leading-normal mb-3">
                Import an existing external site or legacy Novalow repository.
              </p>
              <Button size="sm" variant="outline" className="w-full text-[10px] h-7 border-neon-violet/30 hover:bg-neon-violet/10 text-neon-violet">
                Import Archive
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Account Info */}
      <div className="p-4 border-t border-white/5 bg-void-lighter shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neon-cyan to-neon-violet overflow-hidden" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">Genesis Project Alpha</p>
            <p className="text-[10px] text-text-muted truncate font-mono">ID: 0x9f22...ea2</p>
          </div>
          <MoreVertical className="w-4 h-4 text-text-muted" />
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
