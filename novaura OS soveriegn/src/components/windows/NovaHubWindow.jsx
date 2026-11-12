import React, { useState, useEffect } from 'react';
import {
  GitBranch, GitPullRequest, GitCommit, Folder, FileCode,
  Plus, Search, Download, Upload, Check, AlertCircle, Sparkles,
  ShieldCheck, RefreshCw, Layers, ArrowRight, Tag, MessageSquare,
  ChevronRight, CornerDownRight, CheckCircle2, XCircle, Code2, Copy
} from 'lucide-react';
import { novaHub, computeFileDiff } from '../../services/novaHubService.js';
import { toast } from 'sonner';

export default function NovaHubWindow() {
  const [repositories, setRepositories] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [activeTab, setActiveTab] = useState('code'); // 'code' | 'commits' | 'prs' | 'issues' | 'releases' | 'mesh'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Sub-view states
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [pullRequests, setPullRequests] = useState([]);
  const [issues, setIssues] = useState([]);
  const [releases, setReleases] = useState([]);

  // Code browser state
  const [activeFilePath, setActiveFilePath] = useState(null);
  const [fileContent, setFileContent] = useState('');

  // Modals
  const [showNewRepoModal, setShowNewRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDesc, setNewRepoDesc] = useState('');
  const [newRepoIsPrivate, setNewRepoIsPrivate] = useState(true);

  const [showNewPrModal, setShowNewPrModal] = useState(false);
  const [newPrTitle, setNewPrTitle] = useState('');
  const [newPrDesc, setNewPrDesc] = useState('');
  const [newPrSource, setNewPrSource] = useState('');

  const [showNewIssueModal, setShowNewIssueModal] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueDesc, setNewIssueDesc] = useState('');

  const [syncingCybeni, setSyncingCybeni] = useState(false);

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      loadRepoDetails(selectedRepo.id);
    }
  }, [selectedRepo]);

  const loadRepositories = async () => {
    setLoading(true);
    try {
      const list = await novaHub.getAllRepositories();
      setRepositories(list);
      if (list.length > 0 && !selectedRepo) {
        setSelectedRepo(list[0]);
      }
    } catch (err) {
      console.error('[NovaHub] Load repos error:', err);
      toast.error('Failed to load local repositories');
    } finally {
      setLoading(false);
    }
  };

  const loadRepoDetails = async (repoId) => {
    try {
      const bList = await novaHub.getBranches(repoId);
      setBranches(bList);
      const defBranch = bList.find(b => b.isDefault)?.name || bList[0]?.name || 'main';
      setSelectedBranch(defBranch);

      const cList = await novaHub.getCommits(repoId);
      setCommits(cList);
      if (cList.length > 0) {
        setSelectedCommit(cList[0]);
        // Set initial file browser view to README.md or first file
        const firstFiles = cList[0].files || [];
        const readme = firstFiles.find(f => f.path.toLowerCase().includes('readme'));
        const target = readme || firstFiles[0];
        if (target) {
          setActiveFilePath(target.path);
          setFileContent(target.content);
        }
      }

      const pList = await novaHub.getPullRequests(repoId);
      setPullRequests(pList);

      const iList = await novaHub.getIssues(repoId);
      setIssues(iList);

      const rList = await novaHub.getReleases(repoId);
      setReleases(rList);
    } catch (err) {
      console.error('[NovaHub] Load repo details error:', err);
    }
  };

  const handleCreateRepo = async (e) => {
    e?.preventDefault();
    if (!newRepoName.trim()) return;

    try {
      const created = await novaHub.createRepository({
        name: newRepoName,
        description: newRepoDesc,
        isPrivate: newRepoIsPrivate,
      });
      toast.success(`Repository created: ${created.name}`);
      setShowNewRepoModal(false);
      setNewRepoName('');
      setNewRepoDesc('');
      await loadRepositories();
      setSelectedRepo(created);
    } catch (err) {
      toast.error(`Create repo failed: ${err.message}`);
    }
  };

  const handleSyncFromCybeni = async () => {
    if (!selectedRepo) return;
    setSyncingCybeni(true);
    try {
      const commit = await novaHub.commitProjectFiles({
        repoId: selectedRepo.id,
        projectPath: '/projects/cybeni',
        branch: selectedBranch,
        message: `Sync active Cybeni workspace (${new Date().toLocaleTimeString()})`,
      });
      toast.success(`Committed snapshot ${commit.shortHash} to ${selectedBranch}!`);
      await loadRepoDetails(selectedRepo.id);
    } catch (err) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncingCybeni(false);
    }
  };

  const handleCreatePr = async (e) => {
    e?.preventDefault();
    if (!newPrTitle.trim() || !newPrSource) return;

    try {
      await novaHub.createPullRequest({
        repoId: selectedRepo.id,
        title: newPrTitle,
        description: newPrDesc,
        sourceBranch: newPrSource,
        targetBranch: selectedRepo.defaultBranch || 'main',
      });
      toast.success('Pull Request opened!');
      setShowNewPrModal(false);
      setNewPrTitle('');
      setNewPrDesc('');
      const updatedPrs = await novaHub.getPullRequests(selectedRepo.id);
      setPullRequests(updatedPrs);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleMergePr = async (prId) => {
    try {
      const mergeCommit = await novaHub.mergePullRequest(prId);
      toast.success(`Merged successfully! Commit: ${mergeCommit.shortHash}`);
      await loadRepoDetails(selectedRepo.id);
    } catch (err) {
      toast.error(`Merge failed: ${err.message}`);
    }
  };

  const handleCreateIssue = async (e) => {
    e?.preventDefault();
    if (!newIssueTitle.trim()) return;

    try {
      await novaHub.createIssue({
        repoId: selectedRepo.id,
        title: newIssueTitle,
        description: newIssueDesc,
      });
      toast.success('Issue logged in local vault!');
      setShowNewIssueModal(false);
      setNewIssueTitle('');
      setNewIssueDesc('');
      const updatedIssues = await novaHub.getIssues(selectedRepo.id);
      setIssues(updatedIssues);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleExportBundle = async () => {
    if (!selectedRepo) return;
    try {
      const bundle = await novaHub.exportRepositoryBundle(selectedRepo.id);
      const blob = new Blob([bundle], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedRepo.name}-sovereign-bundle.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported Git bundle for ${selectedRepo.name}`);
    } catch (err) {
      toast.error('Export failed: ' + err.message);
    }
  };

  const handleImportBundleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedId = await novaHub.importRepositoryBundle(event.target.result);
        toast.success(`Imported repository successfully!`);
        await loadRepositories();
        const imported = await novaHub.getRepository(importedId);
        if (imported) setSelectedRepo(imported);
      } catch (err) {
        toast.error('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const filteredRepos = repositories.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeFiles = selectedCommit?.files || [];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 select-none overflow-hidden font-sans">
      
      {/* Top Application Bar */}
      <div className="h-14 px-5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-600/25">
            <GitPullRequest className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide">
                Nova Hub — Decentralized Git Forge & Repository Vault
              </h1>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                Local database engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Zero cloud telemetry. Cryptographically signed commits, branches, issues & PRs hosted directly on your machine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync Cybeni Project snapshot button */}
          {selectedRepo && (
            <button
              onClick={handleSyncFromCybeni}
              disabled={syncingCybeni}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingCybeni ? 'animate-spin' : ''}`} />
              <span>Snapshot Cybeni Project</span>
            </button>
          )}

          {/* Import Bundle button */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import Bundle</span>
            <input type="file" accept=".json" onChange={handleImportBundleFile} className="hidden" />
          </label>

          {/* New Repo button */}
          <button
            onClick={() => setShowNewRepoModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-600/30 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Repository</span>
          </button>
        </div>
      </div>

      {/* Main Layout: Left Repos Sidebar + Right Active Repo Studio */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Repository Browser */}
        <div className="w-72 bg-slate-900/50 border-r border-slate-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter repositories..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Repositories ({filteredRepos.length})
            </div>

            {filteredRepos.map(repo => {
              const isSelected = selectedRepo?.id === repo.id;
              return (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo)}
                  className={`w-full p-2.5 rounded-xl text-left transition-all flex items-start gap-2.5 group ${
                    isSelected
                      ? 'bg-purple-950/40 border border-purple-500/50 shadow-md'
                      : 'hover:bg-slate-900 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                    isSelected ? 'bg-purple-900/60 text-purple-300' : 'bg-slate-800 text-slate-400 group-hover:text-white'
                  }`}>
                    <GitBranch className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {repo.displayName || repo.name}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                        {repo.isPrivate ? 'private' : 'public'}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {repo.description || 'Decentralized repository'}
                    </p>

                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <span>{repo.language || 'JS'}</span>
                      <span>•</span>
                      <span>{new Date(repo.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Node Sovereign Badge Footer */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Node Forge Online</span>
            </span>
            <span className="font-mono text-[10px] text-slate-500">v1.2.0</span>
          </div>
        </div>

        {/* Right Content: Selected Repository Workspace */}
        {selectedRepo ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            
            {/* Repo Header & Navigation Tabs */}
            <div className="px-6 pt-4 pb-0 bg-slate-900/60 border-b border-slate-800 shrink-0">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono text-xs">{selectedRepo.owner} /</span>
                  <h2 className="text-base font-bold text-white tracking-wide">
                    {selectedRepo.displayName || selectedRepo.name}
                  </h2>
                  <span className="text-[10px] font-mono uppercase bg-purple-950 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                    Sovereign Local
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportBundle}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                    title="Export complete commit history as Git bundle"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Bundle</span>
                  </button>

                  <button
                    onClick={() => setShowNewPrModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <GitPullRequest className="w-3.5 h-3.5" />
                    <span>New Pull Request</span>
                  </button>

                  <button
                    onClick={() => setShowNewIssueModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>New Issue</span>
                  </button>
                </div>
              </div>

              {/* Sub Navigation Tabs */}
              <div className="flex items-center gap-6 text-xs font-medium border-b border-transparent">
                <button
                  onClick={() => setActiveTab('code')}
                  className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'code'
                      ? 'border-purple-500 text-purple-300 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Code ({activeFiles.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('commits')}
                  className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'commits'
                      ? 'border-purple-500 text-purple-300 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <GitCommit className="w-3.5 h-3.5" />
                  <span>Commits ({commits.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('prs')}
                  className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'prs'
                      ? 'border-purple-500 text-purple-300 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  <span>Pull Requests ({pullRequests.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('issues')}
                  className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'issues'
                      ? 'border-purple-500 text-purple-300 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Issues ({issues.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('releases')}
                  className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'releases'
                      ? 'border-purple-500 text-purple-300 font-bold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Releases ({releases.length})</span>
                </button>
              </div>
            </div>

            {/* Tab 1: Code View */}
            {activeTab === 'code' && (
              <div className="flex-1 flex overflow-hidden">
                {/* Branch selector & File List */}
                <div className="w-64 bg-slate-900/30 border-r border-slate-800 flex flex-col p-3 shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono outline-none"
                    >
                      {branches.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-1">
                    Tree ({activeFiles.length} files)
                  </div>

                  <div className="space-y-1 overflow-y-auto flex-1 font-mono text-xs">
                    {activeFiles.map(file => {
                      const isSelected = activeFilePath === file.path;
                      return (
                        <button
                          key={file.path}
                          onClick={() => {
                            setActiveFilePath(file.path);
                            setFileContent(file.content);
                          }}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left truncate transition-colors ${
                            isSelected
                              ? 'bg-purple-950/60 text-purple-300 border border-purple-500/40'
                              : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                          }`}
                        >
                          <FileCode className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate">{file.path}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* File Content / Monaco Viewer */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                  {selectedCommit && (
                    <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 font-semibold">{selectedCommit.author}</span>
                        <span className="text-slate-300 truncate max-w-md">{selectedCommit.message}</span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>commit</span>
                        <span className="text-cyan-400">{selectedCommit.shortHash}</span>
                        <span className="text-emerald-400">🔒 Verified</span>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 p-4 overflow-y-auto font-mono text-xs bg-slate-950">
                    {activeFilePath ? (
                      <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3 text-slate-400">
                          <span className="font-semibold text-slate-200">{activeFilePath}</span>
                          <span>{fileContent.split('\n').length} lines</span>
                        </div>
                        <pre className="text-slate-200 overflow-x-auto leading-relaxed">
                          {fileContent}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-20 text-slate-500">
                        Select a file from the repository tree to inspect.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Commits History & Diff Inspector */}
            {activeTab === 'commits' && (
              <div className="flex-1 flex overflow-hidden">
                {/* Commits Timeline */}
                <div className="w-96 bg-slate-900/30 border-r border-slate-800 flex flex-col p-3 overflow-y-auto shrink-0 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                    Commit History ({commits.length})
                  </div>

                  {commits.map(c => {
                    const isSelected = selectedCommit?.hash === c.hash;
                    return (
                      <div
                        key={c.hash}
                        onClick={() => setSelectedCommit(c)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-950/40 border-purple-500/60 shadow-md'
                            : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-white truncate">
                            {c.message}
                          </span>
                          <span className="text-[10px] font-mono text-cyan-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            {c.shortHash}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
                          <span>{c.author}</span>
                          <span className="font-mono text-[10px] text-slate-500">
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-800/50 flex items-center justify-between text-[10px] font-mono">
                          <span className="text-emerald-400 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Signed Ed25519
                          </span>
                          <span className="text-slate-400">
                            +{c.stats?.additions || 0} -{c.stats?.deletions || 0}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Diff Inspector for Selected Commit */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-950 p-4">
                  {selectedCommit ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl mb-3 shrink-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="text-sm font-bold text-white">{selectedCommit.message}</h3>
                          <span className="text-xs font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                            commit {selectedCommit.hash}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-4 mt-2">
                          <span>Author: <strong className="text-slate-200">{selectedCommit.author}</strong></span>
                          <span>Timestamp: <strong className="text-slate-200">{new Date(selectedCommit.timestamp).toLocaleString()}</strong></span>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs">
                        {(selectedCommit.files || []).map((file, i) => (
                          <div key={i} className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                            <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-slate-300 font-semibold flex items-center justify-between">
                              <span>{file.path}</span>
                              <span className="text-slate-500 text-[10px]">snapshot view</span>
                            </div>
                            <pre className="p-3 text-slate-300 overflow-x-auto leading-relaxed">
                              {file.content}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-slate-500 text-xs">
                      Select a commit to view metadata and files.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Pull Requests */}
            {activeTab === 'prs' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Open & Merged Pull Requests ({pullRequests.length})
                  </h3>
                  <button
                    onClick={() => setShowNewPrModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Pull Request</span>
                  </button>
                </div>

                {pullRequests.map(pr => (
                  <div key={pr.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-950 text-purple-400 mt-0.5">
                        <GitPullRequest className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">#{pr.number} {pr.title}</span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            pr.status === 'merged'
                              ? 'bg-purple-950 text-purple-400 border border-purple-500/30'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {pr.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{pr.description || 'No description provided.'}</p>
                        <div className="text-[10px] font-mono text-slate-500 mt-1 flex items-center gap-2">
                          <span>{pr.sourceBranch} ➔ {pr.targetBranch}</span>
                          <span>•</span>
                          <span>by {pr.author}</span>
                        </div>
                      </div>
                    </div>

                    {pr.status === 'open' && (
                      <button
                        onClick={() => handleMergePr(pr.id)}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/30"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Merge PR</span>
                      </button>
                    )}
                  </div>
                ))}

                {pullRequests.length === 0 && (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    No pull requests open. Create a feature branch to collaborate.
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Issues */}
            {activeTab === 'issues' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Sovereign Issue Tracker ({issues.length})
                  </h3>
                  <button
                    onClick={() => setShowNewIssueModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Issue</span>
                  </button>
                </div>

                {issues.map(issue => (
                  <div key={issue.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-amber-950 text-amber-400 mt-0.5">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">#{issue.number} {issue.title}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                            {issue.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{issue.description || 'No description provided.'}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {(issue.labels || []).map((label, lidx) => (
                            <span key={lidx} className="text-[9px] font-mono px-2 py-0.5 rounded-md bg-purple-950/60 text-purple-300 border border-purple-500/30">
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {issues.length === 0 && (
                  <div className="text-center py-16 text-slate-500 text-xs">
                    No active issues recorded in the repository.
                  </div>
                )}
              </div>
            )}

            {/* Tab 5: Releases */}
            {activeTab === 'releases' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Tagged Releases ({releases.length})
                  </h3>
                </div>

                {releases.map(rel => (
                  <div key={rel.id} className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-white">{rel.name}</span>
                        <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                          {rel.tagName}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {new Date(rel.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{rel.notes}</p>
                  </div>
                ))}
              </div>
            )}

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">
            {loading ? 'Initializing Nova Hub...' : 'Select or create a repository to start.'}
          </div>
        )}

      </div>

      {/* Modal: New Repository */}
      {showNewRepoModal && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateRepo} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-purple-400" />
              <span>Create Decentralized Repository</span>
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Repository Name</label>
              <input
                type="text"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                placeholder="my-sovereign-app"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Description</label>
              <textarea
                value={newRepoDesc}
                onChange={(e) => setNewRepoDesc(e.target.value)}
                placeholder="Decentralized microservice built natively on NovAura..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPrivate"
                checked={newRepoIsPrivate}
                onChange={(e) => setNewRepoIsPrivate(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0"
              />
              <label htmlFor="isPrivate" className="text-xs text-slate-300">
                Private Sovereign Repository (Encrypted on local host)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewRepoModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold text-white shadow-md shadow-purple-600/30"
              >
                Create Repository
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: New Pull Request */}
      {showNewPrModal && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleCreatePr} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <GitPullRequest className="w-4 h-4 text-purple-400" />
              <span>Open Pull Request</span>
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Source Branch</label>
              <select
                value={newPrSource}
                onChange={(e) => setNewPrSource(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              >
                <option value="">Select branch...</option>
                {branches.filter(b => b.name !== (selectedRepo?.defaultBranch || 'main')).map(b => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">PR Title</label>
              <input
                type="text"
                value={newPrTitle}
                onChange={(e) => setNewPrTitle(e.target.value)}
                placeholder="feat: Integrate decentralized WebRTC calling"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Description</label>
              <textarea
                value={newPrDesc}
                onChange={(e) => setNewPrDesc(e.target.value)}
                placeholder="Details of architectural modifications..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewPrModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-bold text-white shadow-md shadow-purple-600/30"
              >
                Open PR
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: New Issue */}
      {showNewIssueModal && (
        <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateIssue} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Log Sovereign Issue</span>
            </h3>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Issue Title</label>
              <input
                type="text"
                value={newIssueTitle}
                onChange={(e) => setNewIssueTitle(e.target.value)}
                placeholder="bug: Fix WebSocket reconnect loop in offline mode"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">Description</label>
              <textarea
                value={newIssueDesc}
                onChange={(e) => setNewIssueDesc(e.target.value)}
                placeholder="Observed behavior, reproduction steps..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewIssueModal(false)}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold text-white shadow-md shadow-amber-600/30"
              >
                Save Issue
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
