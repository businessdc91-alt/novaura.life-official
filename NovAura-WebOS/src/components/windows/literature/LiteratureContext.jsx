import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { kernel } from '../../../kernel/NovaKernel.js';

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
  // --- Core Data (Persisted to Cloud via MemoryMap) ---
  const [files, setFiles] = useState(() => {
    const d = kernel.memory.get(STORAGE_KEYS.FILES);
    return d || DEFAULT_FILES;
  });

  const [bible, setBible] = useState(() => {
    const d = kernel.memory.get(STORAGE_KEYS.BIBLE);
    return d || DEFAULT_BIBLE;
  });

  const [settings, setSettings] = useState(() => {
    const d = kernel.memory.get(STORAGE_KEYS.SETTINGS);
    return d || { fontFamily: 'Georgia', fontSize: 18, theme: 'parchment' };
  });

  const [workflow, setWorkflow] = useState(() => {
    const d = kernel.memory.get(STORAGE_KEYS.WORKFLOW);
    return d || {};
  });

  // --- Session State (Now also Persisted for "Device Agnostic" feel) ---
  const [activeFileId, setActiveFileId] = useState(() => kernel.memory.get(STORAGE_KEYS.ACTIVE_ID) || null);
  const [openTabs, setOpenTabs] = useState(() => kernel.memory.get(STORAGE_KEYS.OPEN_TABS) || []);
  
  const [uiState, setUiState] = useState(() => kernel.memory.get(STORAGE_KEYS.UI_STATE) || {"sidebar": true, "muse": true, "tab": "explorer"});
  const [selectedText, setSelectedText] = useState('');

  // --- Convenience Getters ---
  const isSidebarOpen = uiState.sidebar;
  const isMuseOpen = uiState.muse;
  const activeSidebarTab = uiState.tab;

  // --- Persistence Listeners ---
  useEffect(() => { kernel.memory.set(STORAGE_KEYS.FILES, files); }, [files]);
  useEffect(() => { kernel.memory.set(STORAGE_KEYS.BIBLE, bible); }, [bible]);
  useEffect(() => { kernel.memory.set(STORAGE_KEYS.SETTINGS, settings); }, [settings]);
  useEffect(() => { kernel.memory.set(STORAGE_KEYS.WORKFLOW, workflow); }, [workflow]);
  useEffect(() => { kernel.memory.set(STORAGE_KEYS.OPEN_TABS, openTabs); }, [openTabs]);
  useEffect(() => { kernel.memory.set(STORAGE_KEYS.ACTIVE_ID, activeFileId); }, [activeFileId]);
  useEffect(() => { kernel.memory.set(STORAGE_KEYS.UI_STATE, uiState); }, [uiState]);

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
    findFileById
  };

  return <LiteratureContext.Provider value={value}>{children}</LiteratureContext.Provider>;
}
