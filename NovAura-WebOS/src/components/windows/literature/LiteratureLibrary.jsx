import React, { useState } from 'react';
import { 
  Folder, File, ChevronRight, ChevronDown, Plus, 
  Search, Book, HardDrive, Trash2, Edit2, Zap,
  FolderPlus, FilePlus, MoreVertical, LayoutGrid
} from 'lucide-react';
import { useLiterature } from './LiteratureContext';
import { toast } from 'sonner';

/**
 * NovAura Project Explorer — Integrated Literature Library
 * Refactored for active file management and unified cloud state.
 */

export default function LiteratureLibrary() {
  const { files, setFiles, activeFileId, openTab } = useLiterature();
  const [search, setSearch] = useState('');

  const toggleFolder = (id) => {
    const update = (node) => {
      if (node.id === id) return { ...node, expanded: !node.expanded };
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    };
    setFiles(prev => update(prev));
  };

  const createNewFile = (parentId = 'root') => {
    const newId = `file-${Date.now()}`;
    const newFile = { id: newId, name: 'Untitled Chapter', type: 'file', content: '<h1>New Chapter</h1><p>The journey continues...</p>' };
    
    const update = (node) => {
      if (node.id === parentId) return { ...node, expanded: true, children: [...(node.children || []), newFile] };
      if (node.children) return { ...node, children: node.children.map(update) };
      return node;
    };
    
    setFiles(prev => update(prev));
    openTab(newId);
    toast.success('New chapter manifested in the cloud');
  };

  const renderNode = (node, depth = 0) => {
    const isFolder = node.type === 'folder';
    const isActive = node.id === activeFileId;
    
    // Simple filter
    if (search && !node.name.toLowerCase().includes(search.toLowerCase()) && !isFolder) return null;

    return (
      <div key={node.id} className="select-none">
        <div 
          onClick={() => isFolder ? toggleFolder(node.id) : openTab(node.id)}
          className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all border-l-2 relative ${
            isActive 
              ? 'bg-primary/10 border-primary text-white' 
              : 'border-transparent hover:bg-white/[0.03] text-gray-500 hover:text-gray-300'
          }`}
          style={{ paddingLeft: `${depth * 14 + 14}px` }}
        >
          {isFolder ? (
            <div className="w-4 h-4 flex items-center justify-center">
              {node.expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </div>
          ) : (
            <div className="w-4 h-4 flex items-center justify-center">
              <div className={`w-1 h-1 rounded-full ${isActive ? 'bg-primary shadow-[0_0_8px_var(--primary)]' : 'bg-gray-600'}`} />
            </div>
          )}

          {isFolder ? (
            <Folder className={`w-3.5 h-3.5 ${node.expanded ? 'text-amber-400' : 'text-amber-500/60'}`} />
          ) : (
            <FileTextIcon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-blue-500/40'}`} />
          )}

          <span className={`text-[11px] font-bold tracking-wide truncate flex-1 uppercase ${isActive ? 'text-white' : ''}`}>
            {node.name}
          </span>

          {isFolder && (
            <button 
              onClick={(e) => { e.stopPropagation(); createNewFile(node.id); }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
        {isFolder && node.expanded && node.children?.map(child => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] border-r border-white/5 font-sans">
      
      {/* Header / Search */}
      <div className="p-4 border-b border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80">Explorer</span>
          </div>
          <button 
            onClick={() => createNewFile()}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-primary/20 hover:text-primary transition-all"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Manuscript..."
            className="w-full bg-black/40 border border-white/5 rounded-lg py-1.5 pl-8 pr-3 text-[10px] text-gray-400 placeholder:text-gray-700 focus:border-primary/30 outline-none transition-all"
          />
        </div>
      </div>

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {renderNode(files)}
      </div>

      {/* Project Intelligence Footer */}
      <div className="p-4 bg-black/40 border-t border-white/5 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-gray-600">
            <span>Project Integrity</span>
            <span className="text-emerald-500">100% SECURE</span>
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-primary/40 w-full animate-pulse" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
           <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <div className="text-[8px] text-gray-600 font-bold uppercase mb-1">Chapters</div>
              <div className="text-xs font-bold text-white">12</div>
           </div>
           <div className="bg-white/5 rounded-lg p-2 border border-white/5">
              <div className="text-[8px] text-gray-600 font-bold uppercase mb-1">Characters</div>
              <div className="text-xs font-bold text-white">8</div>
           </div>
        </div>
      </div>
    </div>
  );
}

function FileTextIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}
