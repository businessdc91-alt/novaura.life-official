import React from 'react';
import { LiteratureProvider, useLiterature } from './literature/LiteratureContext';
import LiteratureLibrary from './literature/LiteratureLibrary';
import ManuscriptEditor from './literature/ManuscriptEditor';
import MuseSidebar from './literature/MuseSidebar';
import { PanelLeft, PanelRight, Library, Sparkles, BookOpen, Cloud, RefreshCw, CheckCircle2, AlertCircle, Database } from 'lucide-react';
import EbookPublisherModal from './literature/EbookPublisherModal';

/**
 * NovAura Literature IDE — Unified Production Workspace
 * Upgraded for professional writing, tabbed editing, and cloud-first persistence.
 */

function LiteratureIDEContent() {
  const { 
    isSidebarOpen, setIsSidebarOpen,
    isMuseOpen, setIsMuseOpen,
    activeSidebarTab, setActiveSidebarTab,
    cloudSyncStatus, lastSyncedAt, forceCloudSync
  } = useLiterature();

  const [isEbookModalOpen, setIsEbookModalOpen] = React.useState(false);

  return (
    <div className="flex flex-col h-full bg-[#050508] text-gray-300 font-sans selection:bg-primary/30 overflow-hidden relative">
      
      {/* Top Professional Toolbar */}
      <div className="h-12 flex-shrink-0 bg-black/40 backdrop-blur-2xl border-b border-white/5 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-white/80">NovAura Manuscript Studio</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1">
             <button 
               onClick={() => setIsSidebarOpen(!isSidebarOpen)}
               className={`p-1.5 rounded transition-all ${isSidebarOpen ? 'text-primary bg-primary/10' : 'text-gray-500 hover:text-white'}`}
             >
               <PanelLeft className="w-4 h-4" />
             </button>
             <button 
               onClick={() => setIsMuseOpen(!isMuseOpen)}
               className={`p-1.5 rounded transition-all ${isMuseOpen ? 'text-accent bg-accent/10' : 'text-gray-500 hover:text-white'}`}
             >
               <PanelRight className="w-4 h-4" />
             </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Cloud Persistence Status */}
          <button 
            onClick={forceCloudSync}
            title={lastSyncedAt ? `Last cloud sync: ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Sync with Firestore cloud'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 hover:border-white/20 transition-all text-[9px] font-mono cursor-pointer"
          >
            {cloudSyncStatus === 'saving' && (
              <>
                <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
                <span className="text-cyan-400 uppercase font-bold tracking-wider">Cloud Saving...</span>
              </>
            )}
            {cloudSyncStatus === 'synced' && (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400 uppercase font-bold tracking-wider">Cloud Synced</span>
              </>
            )}
            {cloudSyncStatus === 'offline' && (
              <>
                <Database className="w-3 h-3 text-amber-400" />
                <span className="text-amber-400 uppercase font-bold tracking-wider">Local DB</span>
              </>
            )}
            {cloudSyncStatus === 'error' && (
              <>
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span className="text-rose-400 uppercase font-bold tracking-wider">Sync Retry</span>
              </>
            )}
            {cloudSyncStatus === 'idle' && (
              <>
                <Cloud className="w-3 h-3 text-gray-400" />
                <span className="text-gray-400 uppercase font-bold tracking-wider">Cloud Ready</span>
              </>
            )}
          </button>

          <div className="h-4 w-px bg-white/10" />
          <button 
            onClick={() => setIsEbookModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all text-gray-300"
          >
            <BookOpen className="w-3 h-3" />
            <span className="text-[9px] font-bold uppercase">Publish / Export</span>
          </button>
          <button className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full hover:bg-primary/20 transition-all">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[9px] font-bold text-primary uppercase">Ghostwriter</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Unified Library / Explorer Sidebar */}
        <div className={`flex-shrink-0 bg-[#0a0a0f] border-r border-white/5 transition-all duration-500 overflow-hidden ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
          <div className="w-64 h-full">
            <LiteratureLibrary />
          </div>
        </div>

        {/* Main Workspace (Tabs + Editor) */}
        <div className="flex-1 flex flex-col min-w-0 relative bg-[#0d0d14]">
          <ManuscriptEditor />
        </div>

        {/* Unified AI Muse Sidebar */}
        <div className={`flex-shrink-0 bg-[#0a0a0f] border-l border-white/5 transition-all duration-500 overflow-hidden ${isMuseOpen ? 'w-80' : 'w-0'}`}>
          <div className="w-80 h-full">
            <MuseSidebar />
          </div>
        </div>
      </div>

      {/* Atmospheric Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Modals */}
      <EbookPublisherModal isOpen={isEbookModalOpen} onClose={() => setIsEbookModalOpen(false)} />
    </div>
  );
}

export default function LiteratureIDEWindow() {
  return (
    <LiteratureProvider>
      <LiteratureIDEContent />
    </LiteratureProvider>
  );
}
