import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { kernel } from '../../../kernel/NovaKernel.js';
import { useAuth } from '../../../hooks/useAuth';
import { db, isFirebaseConfigured } from '../../../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const LiteratureContext = createContext();

export const useLiterature = () => {
  const context = useContext(LiteratureContext);
  if (!context) throw new Error('useLiterature must be used within a LiteratureProvider');
  return context;
};

const STORAGE_KEYS = {
  FILES: 'novaura_lit_files',
  BIBLE: 'novaura_lit_bible',
  SETTINGS: 'novaura_lit_settings',
  WORKFLOW: 'novaura_lit_workflow',
  OPEN_TABS: 'novaura_lit_tabs',
  ACTIVE_ID: 'novaura_lit_active_id',
  UI_STATE: 'novaura_lit_ui',
};

const DEFAULT_FILES = {
  id: 'root', name: 'My Novel', type: 'folder', expanded: true,
  children: [
    { id: 'ch1', name: 'Chapter 1', type: 'file', content: '<h1>Chapter 1</h1><p>The story begins here...</p>' },
    { id: 'notes', name: 'Research Notes', type: 'file', content: '<h2>Notes</h2><p></p>' },
  ],
};

const DEFAULT_BIBLE = {
  characters: [],
  settings: [],
  lore: [],
  plotThreads: [],
  timeline: [],
  lastAudit: null,
};

export function LiteratureProvider({ children }) {
  const { user } = useAuth();

  // --- Core Data (Authoritative Single Source of Truth: Firestore Cloud) ---
  const [files, setFiles] = useState(DEFAULT_FILES);
  const [bible, setBible] = useState(DEFAULT_BIBLE);
  const [settings, setSettings] = useState({ fontFamily: 'Georgia', fontSize: 18, theme: 'parchment' });
  const [workflow, setWorkflow] = useState({});

  // --- Cloud Sync Status ---
  const [cloudSyncStatus, setCloudSyncStatus] = useState('idle'); // 'idle' | 'saving' | 'synced' | 'offline' | 'error'
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const isCloudLoaded = useRef(false);
  const syncTimeoutRef = useRef(null);

  // --- Session State (Device Agnostic, Synced to Cloud) ---
  const [activeFileId, setActiveFileId] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [uiState, setUiState] = useState({ sidebar: true, muse: true, tab: 'explorer' });
  const [selectedText, setSelectedText] = useState('');

  // --- Convenience Getters ---
  const isSidebarOpen = uiState.sidebar;
  const isMuseOpen = uiState.muse;
  const activeSidebarTab = uiState.tab;

  // --- Real-time Multi-Device Firestore onSnapshot Listener ---
  useEffect(() => {
    if (!user?.uid || !isFirebaseConfigured || !db) {
      setCloudSyncStatus('offline');
      return;
    }

    setCloudSyncStatus('saving');
    const docRef = doc(db, 'users', user.uid, 'literature', 'workspace');

    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const cloudData = snap.data();
        // If update is from another device/browser or first load
        if (!snap.metadata.hasPendingWrites || !isCloudLoaded.current) {
          if (cloudData.files) setFiles(cloudData.files);
          if (cloudData.bible) setBible(cloudData.bible);
          if (cloudData.settings) setSettings(cloudData.settings);
          if (cloudData.workflow) setWorkflow(cloudData.workflow);
          if (cloudData.activeFileId) setActiveFileId(cloudData.activeFileId);
          if (cloudData.openTabs) setOpenTabs(cloudData.openTabs);
          if (cloudData.uiState) setUiState(cloudData.uiState);
        }
        setCloudSyncStatus('synced');
        setLastSyncedAt(cloudData.updatedAt?.toDate?.() || new Date());
        isCloudLoaded.current = true;
      } else {
        // First time user ever opens Literature IDE — initialize cloud document
        setDoc(docRef, {
          files: DEFAULT_FILES,
          bible: DEFAULT_BIBLE,
          settings: { fontFamily: 'Georgia', fontSize: 18, theme: 'parchment' },
          workflow: {},
          activeFileId: 'ch1',
          openTabs: [{ id: 'ch1', name: 'Chapter 1' }],
          uiState: { sidebar: true, muse: true, tab: 'explorer' },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).then(() => {
          setCloudSyncStatus('synced');
          setLastSyncedAt(new Date());
          isCloudLoaded.current = true;
        }).catch((err) => {
          console.error('[LiteratureContext] Cloud seed error:', err);
          setCloudSyncStatus('error');
        });
      }
    }, (err) => {
      console.error('[LiteratureContext] Real-time cloud subscription error:', err);
      setCloudSyncStatus('error');
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // --- Debounced Cloud Auto-Save to Firestore (1.5s debounce) ---
  useEffect(() => {
    if (!isCloudLoaded.current || !user?.uid || !isFirebaseConfigured || !db) return;

    setCloudSyncStatus('saving');
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);

    syncTimeoutRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'literature', 'workspace');
        await setDoc(docRef, {
          files,
          bible,
          settings,
          workflow,
          activeFileId,
          openTabs,
          uiState,
          updatedAt: serverTimestamp()
        }, { merge: true });
        setCloudSyncStatus('synced');
        setLastSyncedAt(new Date());
      } catch (err) {
        console.error('[LiteratureContext] Cloud save error:', err);
        setCloudSyncStatus('error');
      }
    }, 1500);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [files, bible, settings, workflow, activeFileId, openTabs, uiState, user?.uid]);

  // --- Force Cloud Sync Immediately ---
  const forceCloudSync = useCallback(async () => {
    if (!user?.uid || !isFirebaseConfigured || !db) return false;
    try {
      setCloudSyncStatus('saving');
      const docRef = doc(db, 'users', user.uid, 'literature', 'workspace');
      await setDoc(docRef, {
        files,
        bible,
        settings,
        workflow,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setCloudSyncStatus('synced');
      setLastSyncedAt(new Date());
      return true;
    } catch (err) {
      console.error('[LiteratureContext] Force sync error:', err);
      setCloudSyncStatus('error');
      return false;
    }
  }, [files, bible, settings, workflow, user?.uid]);

  // --- Deep Search for Files ---
  const findFileById = useCallback((id, tree = files) => {
    if (!id) return null;
    if (tree.id === id) return tree;
    if (tree.children) {
      for (const child of tree.children) {
        const found = findFileById(id, child);
        if (found) return found;
      }
    }
    return null;
  }, [files]);

  const activeFile = useMemo(() => findFileById(activeFileId), [activeFileId, findFileById]);

  // --- UI Actions ---
  const setSidebarOpen = (val) => setUiState(p => ({...p, sidebar: val}));
  const setMuseOpen = (val) => setUiState(p => ({...p, muse: val}));
  const setActiveSidebarTab = (val) => setUiState(p => ({...p, tab: val}));

  const updateFileContent = useCallback((id, content) => {
    const updateNode = (node) => {
      if (node.id === id) return { ...node, content, lastModified: Date.now() };
      if (node.children) return { ...node, children: node.children.map(updateNode) };
      return node;
    };
    setFiles(prev => updateNode(prev));
  }, []);

  const openTab = useCallback((fileId) => {
    const file = findFileById(fileId);
    if (!file || file.type === 'folder') return;
    
    setOpenTabs(prev => {
      if (prev.find(t => t.id === fileId)) return prev;
      return [...prev, { id: file.id, name: file.name }];
    });
    setActiveFileId(fileId);
  }, [findFileById]);

  const closeTab = useCallback((fileId) => {
    setOpenTabs(prev => {
      const next = prev.filter(t => t.id !== fileId);
      if (activeFileId === fileId) {
        setActiveFileId(next.length > 0 ? next[next.length - 1].id : null);
      }
      return next;
    });
  }, [activeFileId]);

  // --- Real Manuscript Exporter ---
  const exportManuscript = useCallback((format = 'epub') => {
    // Collect all documents in order
    const docs = [];
    const traverse = (node) => {
      if (node.type === 'file' && node.content) {
        docs.push({ name: node.name, content: node.content });
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(files);

    const title = files.name || 'Manuscript';
    let fileContent = '';
    let mimeType = 'text/plain';
    let extension = 'txt';

    if (format === 'epub' || format === 'html') {
      mimeType = 'text/html';
      extension = format === 'epub' ? 'epub' : 'html';
      fileContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Georgia', serif; line-height: 1.8; max-width: 800px; margin: 40px auto; padding: 20px; color: #1a1a1a; }
    h1 { font-size: 2.2rem; margin-top: 2rem; border-bottom: 2px solid #ddd; padding-bottom: 0.5rem; }
    h2 { font-size: 1.6rem; margin-top: 1.5rem; }
    p { margin-bottom: 1.2rem; text-indent: 1.5rem; }
    .toc { margin-bottom: 3rem; padding: 1.5rem; background: #f9f9f9; border-radius: 8px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="toc">
    <h3>Table of Contents</h3>
    <ul>
      ${docs.map((d, i) => `<li><a href="#section-${i}">${d.name}</a></li>`).join('\n      ')}
    </ul>
  </div>
  ${docs.map((d, i) => `<section id="section-${i}"><h2>${d.name}</h2><div>${d.content}</div></section>`).join('\n<hr/>\n')}
</body>
</html>`;
    } else if (format === 'markdown') {
      mimeType = 'text/markdown';
      extension = 'md';
      fileContent = `# ${title}\n\n` + docs.map(d => `## ${d.name}\n\n${d.content.replace(/<[^>]*>/g, '')}\n\n`).join('\n---\n\n');
    } else if (format === 'json') {
      mimeType = 'application/json';
      extension = 'json';
      fileContent = JSON.stringify({ title, files, bible, settings, workflow, exportedAt: new Date().toISOString() }, null, 2);
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [files, bible, settings, workflow]);

  const value = {
    files, setFiles,
    bible, setBible,
    settings, setSettings,
    workflow, setWorkflow,
    activeFileId, setActiveFileId,
    activeFile,
    openTabs, setOpenTabs,
    openTab, closeTab,
    activeSidebarTab, setActiveSidebarTab,
    selectedText, setSelectedText,
    isSidebarOpen, setIsSidebarOpen: setSidebarOpen,
    isMuseOpen, setIsMuseOpen: setMuseOpen,
    updateFileContent,
    findFileById,
    cloudSyncStatus,
    lastSyncedAt,
    forceCloudSync,
    exportManuscript
  };

  return <LiteratureContext.Provider value={value}>{children}</LiteratureContext.Provider>;
}
