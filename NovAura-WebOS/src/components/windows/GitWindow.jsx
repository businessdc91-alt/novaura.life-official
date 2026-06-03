import React, { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, GitCommit, RefreshCw, Plus, X,
  FileText, FilePlus, FileMinus, Edit3, AlertCircle,
  Upload, Download, History, Copy, CheckCircle2,
  Key, Link, Loader2, FolderGit2, ChevronRight
} from 'lucide-react';
import { GitEngine } from './builderbot/GitEngine';

// Singleton engine — persists across tab switches
let engineInstance = null;
function getEngine() {
  if (!engineInstance) engineInstance = new GitEngine({ dir: '/repo' });
  return engineInstance;
}

export default function GitWindow() {
  const [activeTab, setActiveTab] = useState('changes');
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [statusFiles, setStatusFiles] = useState([]);
  const [stagedPaths, setStagedPaths] = useState(new Set());
  const [commitMessage, setCommitMessage] = useState('');
  const [commits, setCommits] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [showClone, setShowClone] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [token, setToken] = useState(() => localStorage.getItem('nova_git_token') || '');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [diff, setDiff] = useState('');

  const git = getEngine();

  const showMsg = (text, isError = false) => {
    if (isError) setErrorMsg(text);
    else setMessage(text);
    setTimeout(() => { setMessage(''); setErrorMsg(''); }, 4000);
  };

  // ── Load repo state ──────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    try {
      const files = await git.getStatus();
      setStatusFiles(files.filter(f => f.status !== 'unmodified'));
    } catch {
      setStatusFiles([]);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const [branchList, branch] = await Promise.all([
        git.listBranches(),
        git.getCurrentBranch(),
      ]);
      setBranches(branchList);
      setCurrentBranch(branch || 'main');
    } catch {
      setBranches(['main']);
      setCurrentBranch('main');
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const log = await git.log(30);
      setCommits(log);
    } catch {
      setCommits([]);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isGitRepo) return;
    setLoading(true);
    await Promise.all([loadStatus(), loadBranches(), loadHistory()]);
    setLoading(false);
  }, [isGitRepo, loadStatus, loadBranches, loadHistory]);

  useEffect(() => {
    git.isRepo().then(async (isRepo) => {
      setIsGitRepo(isRepo);
      if (isRepo) {
        await Promise.all([loadStatus(), loadBranches(), loadHistory()]);
      }
      setInitLoading(false);
    });
  }, []);

  useEffect(() => {
    if (isGitRepo) refresh();
  }, [isGitRepo]);

  // ── Stage / unstage ──────────────────────────────────────────────────────────

  const toggleStage = async (filepath) => {
    setStagedPaths(prev => {
      const next = new Set(prev);
      if (next.has(filepath)) next.delete(filepath);
      else next.add(filepath);
      return next;
    });
  };

  const stageAll = () => {
    const all = new Set(statusFiles.map(f => f.filepath));
    setStagedPaths(all);
  };

  const unstageAll = () => setStagedPaths(new Set());

  // ── Commit ───────────────────────────────────────────────────────────────────

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedPaths.size === 0) return;
    setLoading(true);
    try {
      // Stage selected files
      for (const fp of stagedPaths) {
        const file = statusFiles.find(f => f.filepath === fp);
        if (file?.status === 'deleted') {
          await git.remove(fp);
        } else {
          await git.add(fp);
        }
      }
      await git.commit(commitMessage);
      setCommitMessage('');
      setStagedPaths(new Set());
      showMsg('Committed successfully');
      await Promise.all([loadStatus(), loadHistory()]);
    } catch (err) {
      showMsg(`Commit failed: ${err.message}`, true);
    }
    setLoading(false);
  };

  // ── Push / Pull ──────────────────────────────────────────────────────────────

  const handlePush = async () => {
    if (!token) { setShowTokenInput(true); return; }
    setLoading(true);
    try {
      git.token = token;
      await git.push('origin', currentBranch);
      showMsg('Pushed to origin/' + currentBranch);
      await loadHistory();
    } catch (err) {
      showMsg(`Push failed: ${err.message}`, true);
    }
    setLoading(false);
  };

  const handlePull = async () => {
    if (!token) { setShowTokenInput(true); return; }
    setLoading(true);
    try {
      git.token = token;
      await git.pull('origin', currentBranch);
      showMsg('Pulled from origin/' + currentBranch);
      await refresh();
    } catch (err) {
      showMsg(`Pull failed: ${err.message}`, true);
    }
    setLoading(false);
  };

  // ── Init / Clone ─────────────────────────────────────────────────────────────

  const handleInit = async () => {
    setLoading(true);
    try {
      await git.init();
      setIsGitRepo(true);
      showMsg('Repository initialized');
      await loadBranches();
    } catch (err) {
      showMsg(`Init failed: ${err.message}`, true);
    }
    setLoading(false);
  };

  const handleClone = async () => {
    if (!cloneUrl.trim()) return;
    setLoading(true);
    try {
      await git.clone(cloneUrl.trim(), token || null);
      setIsGitRepo(true);
      setShowClone(false);
      showMsg('Repository cloned');
      await refresh();
    } catch (err) {
      showMsg(`Clone failed: ${err.message}`, true);
    }
    setLoading(false);
  };

  // ── Branch ops ───────────────────────────────────────────────────────────────

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    setLoading(true);
    try {
      await git.createBranch(newBranchName.trim(), true);
      setNewBranchName('');
      setShowNewBranch(false);
      showMsg(`Switched to new branch '${newBranchName}'`);
      await loadBranches();
    } catch (err) {
      showMsg(`Branch failed: ${err.message}`, true);
    }
    setLoading(false);
  };

  const handleSwitchBranch = async (branch) => {
    if (branch === currentBranch) return;
    setLoading(true);
    try {
      await git.checkout(branch);
      setCurrentBranch(branch);
      showMsg(`Switched to branch '${branch}'`);
      await refresh();
    } catch (err) {
      showMsg(`Checkout failed: ${err.message}`, true);
    }
    setLoading(false);
  };

  // ── Diff ─────────────────────────────────────────────────────────────────────

  const handleSelectFile = async (file) => {
    setSelectedFile(file);
    try {
      const diffResult = await git.diff('HEAD', null, file.filepath);
      setDiff(typeof diffResult === 'string' ? diffResult : JSON.stringify(diffResult, null, 2));
    } catch {
      setDiff('(diff not available)');
    }
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  const getFileIcon = (status) => {
    switch (status) {
      case 'added': return <FilePlus className="w-4 h-4 text-green-400 flex-shrink-0" />;
      case 'deleted': return <FileMinus className="w-4 h-4 text-red-400 flex-shrink-0" />;
      case 'untracked': return <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />;
      default: return <Edit3 className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'added': return 'text-green-400';
      case 'deleted': return 'text-red-400';
      case 'untracked': return 'text-slate-400';
      default: return 'text-yellow-400';
    }
  };

  // ── Empty / init screen ──────────────────────────────────────────────────────

  if (initLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-950">
        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!isGitRepo) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 bg-slate-950 text-center px-8">
        <FolderGit2 className="w-14 h-14 text-orange-400/40" />
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">No Git Repository</h2>
          <p className="text-sm text-slate-400">Initialize a new repo or clone an existing one.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleInit}
            disabled={loading}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm text-white font-medium flex items-center gap-2 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
            Init Repo
          </button>
          <button
            onClick={() => setShowClone(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-slate-300 font-medium flex items-center gap-2 transition-colors"
          >
            <Link className="w-4 h-4" />
            Clone
          </button>
        </div>

        {showClone && (
          <div className="w-full max-w-md space-y-3 p-4 bg-slate-900 rounded-xl border border-slate-700">
            <input
              value={cloneUrl}
              onChange={e => setCloneUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
            <input
              value={token}
              onChange={e => { setToken(e.target.value); localStorage.setItem('nova_git_token', e.target.value); }}
              type="password"
              placeholder="GitHub token (for private repos)"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2">
              <button onClick={handleClone} disabled={loading || !cloneUrl.trim()} className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 rounded-lg text-sm font-medium text-white disabled:opacity-50">
                {loading ? 'Cloning...' : 'Clone'}
              </button>
              <button onClick={() => setShowClone(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300">Cancel</button>
            </div>
          </div>
        )}

        {(message || errorMsg) && (
          <p className={`text-sm ${errorMsg ? 'text-red-400' : 'text-green-400'}`}>{errorMsg || message}</p>
        )}
      </div>
    );
  }

  // ── Main UI ──────────────────────────────────────────────────────────────────

  const staged = statusFiles.filter(f => stagedPaths.has(f.filepath));
  const unstaged = statusFiles.filter(f => !stagedPaths.has(f.filepath) && f.status !== 'untracked');
  const untracked = statusFiles.filter(f => f.status === 'untracked' && !stagedPaths.has(f.filepath));

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-600/20 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <div className="font-semibold text-white text-sm">Git</div>
            <div className="text-xs text-orange-400 flex items-center gap-1">
              <span>●</span>
              <span>{currentBranch}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(message || errorMsg) && (
            <span className={`text-xs px-2 py-1 rounded ${errorMsg ? 'text-red-400 bg-red-900/20' : 'text-green-400 bg-green-900/20'}`}>
              {errorMsg || message}
            </span>
          )}
          <button onClick={() => setShowTokenInput(v => !v)} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors" title="GitHub Token">
            <Key className="w-4 h-4 text-slate-400" />
          </button>
          <button onClick={() => refresh()} disabled={loading} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handlePull} disabled={loading} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 disabled:opacity-50">
            <Download className="w-3.5 h-3.5" />
            Pull
          </button>
          <button onClick={handlePush} disabled={loading} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white flex items-center gap-1.5 disabled:opacity-50">
            <Upload className="w-3.5 h-3.5" />
            Push
          </button>
        </div>
      </div>

      {/* Token input */}
      {showTokenInput && (
        <div className="px-4 py-2 bg-slate-900/80 border-b border-slate-800 flex items-center gap-2">
          <Key className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            value={token}
            onChange={e => { setToken(e.target.value); localStorage.setItem('nova_git_token', e.target.value); }}
            type="password"
            placeholder="GitHub Personal Access Token (for push/pull)"
            className="flex-1 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
          <button onClick={() => setShowTokenInput(false)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center px-4 border-b border-slate-800 bg-slate-900/50 flex-shrink-0">
        {[
          { id: 'changes', label: 'Changes', icon: Edit3, badge: statusFiles.length || null },
          { id: 'history', label: 'History', icon: History, badge: null },
          { id: 'branches', label: 'Branches', icon: GitBranch, badge: null },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium capitalize transition-colors border-b-2 ${
              activeTab === tab.id ? 'text-orange-400 border-orange-400' : 'text-slate-400 border-transparent hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.badge ? (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-600/30 text-orange-400 rounded-full text-[10px]">{tab.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto p-4">

          {/* ── Changes Tab ── */}
          {activeTab === 'changes' && (
            <div className="max-w-2xl space-y-4">
              {statusFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <CheckCircle2 className="w-10 h-10 mb-3 text-green-500/40" />
                  <p className="text-sm">Working tree clean</p>
                  <p className="text-xs mt-1 opacity-60">No changes to commit</p>
                </div>
              ) : (
                <>
                  {/* Staged section */}
                  {staged.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-3 py-2 bg-green-900/20 border border-green-800/40 rounded-t-lg">
                        <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Staged ({staged.length})</span>
                        <button onClick={unstageAll} className="text-xs text-slate-400 hover:text-slate-300">Unstage all</button>
                      </div>
                      <div className="border border-green-800/20 border-t-0 rounded-b-lg overflow-hidden">
                        {staged.map((f, i) => (
                          <div
                            key={f.filepath}
                            onClick={() => { toggleStage(f.filepath); handleSelectFile(f); }}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800/40 ${i !== staged.length - 1 ? 'border-b border-slate-800' : ''}`}
                          >
                            {getFileIcon(f.status)}
                            <span className="flex-1 text-xs text-slate-300 truncate font-mono">{f.filepath}</span>
                            <span className={`text-[10px] capitalize ${getStatusColor(f.status)}`}>{f.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Unstaged section */}
                  {(unstaged.length > 0 || untracked.length > 0) && (
                    <div>
                      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/50 border border-slate-800 rounded-t-lg">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Changes ({unstaged.length + untracked.length})
                        </span>
                        <button onClick={stageAll} className="text-xs text-blue-400 hover:text-blue-300">Stage all</button>
                      </div>
                      <div className="border border-slate-800 border-t-0 rounded-b-lg overflow-hidden">
                        {[...unstaged, ...untracked].map((f, i, arr) => (
                          <div
                            key={f.filepath}
                            onClick={() => { toggleStage(f.filepath); handleSelectFile(f); }}
                            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800/40 transition-colors ${i !== arr.length - 1 ? 'border-b border-slate-800' : ''}`}
                          >
                            {getFileIcon(f.status)}
                            <span className="flex-1 text-xs text-slate-300 truncate font-mono">{f.filepath}</span>
                            <span className={`text-[10px] capitalize ${getStatusColor(f.status)}`}>{f.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Commit box */}
                  {staged.length > 0 && (
                    <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                      <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-2">Commit Message</label>
                      <textarea
                        value={commitMessage}
                        onChange={e => setCommitMessage(e.target.value)}
                        placeholder="Describe your changes..."
                        className="w-full h-20 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-orange-500/50 mb-3"
                      />
                      <button
                        onClick={handleCommit}
                        disabled={!commitMessage.trim() || loading}
                        className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCommit className="w-4 h-4" />}
                        Commit {staged.length} file{staged.length !== 1 ? 's' : ''}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── History Tab ── */}
          {activeTab === 'history' && (
            <div className="max-w-2xl space-y-3">
              {commits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <History className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No commits yet</p>
                </div>
              ) : commits.map((commit, i) => (
                <div key={commit.sha || i} className="flex items-start gap-3 p-4 bg-slate-900 rounded-xl border border-slate-800 hover:border-slate-700 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                    <GitCommit className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-white leading-snug">{commit.message}</p>
                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {commit.author?.timestamp
                          ? new Date(commit.author.timestamp * 1000).toLocaleDateString()
                          : 'unknown'
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-orange-400/70">{(commit.sha || '').slice(0, 7)}</span>
                      <span>•</span>
                      <span>{commit.author?.name || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Branches Tab ── */}
          {activeTab === 'branches' && (
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Branches</h3>
                <button
                  onClick={() => setShowNewBranch(true)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs text-white flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Branch
                </button>
              </div>

              {showNewBranch && (
                <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                  <input
                    value={newBranchName}
                    onChange={e => setNewBranchName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateBranch()}
                    placeholder="feature/my-feature"
                    autoFocus
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleCreateBranch} disabled={!newBranchName.trim() || loading} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 rounded-lg text-sm font-medium text-white disabled:opacity-50">
                      {loading ? 'Creating...' : 'Create & Switch'}
                    </button>
                    <button onClick={() => setShowNewBranch(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300">Cancel</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {branches.map((branch) => (
                  <div
                    key={branch}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                      branch === currentBranch ? 'bg-orange-900/10 border-orange-800/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className={`w-4 h-4 ${branch === currentBranch ? 'text-orange-400' : 'text-slate-400'}`} />
                      <span className={`text-sm font-medium ${branch === currentBranch ? 'text-orange-300' : 'text-slate-300'}`}>
                        {branch}
                      </span>
                      {branch === currentBranch && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-600/30 text-orange-400 rounded-full">current</span>
                      )}
                    </div>
                    {branch !== currentBranch && (
                      <button
                        onClick={() => handleSwitchBranch(branch)}
                        disabled={loading}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-slate-300 disabled:opacity-50"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Diff panel */}
        {selectedFile && (
          <div className="w-80 border-l border-slate-800 bg-slate-900/30 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-800 flex-shrink-0">
              <span className="text-xs font-medium text-slate-300 truncate">{selectedFile.filepath}</span>
              <button onClick={() => setSelectedFile(null)} className="text-slate-400 hover:text-white ml-2 flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono whitespace-pre-wrap text-slate-300 leading-relaxed">
              {diff || '(loading diff...)'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
