import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Binds @monaco-editor/react to the locally bundled Monaco (offline, no CDN).
import '../../config/monacoConfig.js';
import {
  Code2, Eye, Columns2, Plus, Trash2, Pencil, Download, ChevronDown, Sparkles, GitCommit, Globe, ShoppingBag, FileArchive, FileCode2, X,
} from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';
import { novaHub } from '../../services/novaHubService.js';
import { publishHostedSite } from '../../services/sovereignMesh.js';
import { marketplacePublish } from '../../services/marketplacePublishService.js';
import { runPipeline, phasesFor } from '../../services/cybeni/pipeline.js';
import { listCybeniModels, runModel, suggestRoles } from '../../services/cybeni/models.js';
import { buildPreview } from '../../services/cybeni/previewBuilder.js';
import { publishPreview, clearPreview, verifyInHiddenFrame, newSessionId, isNoise } from '../../services/cybeni/previewHost.js';
import {
  TEMPLATES, listProjects, createProject, updateProject, deleteProject, loadProjectFiles, saveProjectFile,
  deleteProjectFile, replaceProjectFiles, createCheckpoint, restoreCheckpoint, buildZip, downloadBytes,
} from '../../services/cybeni/projectStore.js';
import AgentPanel from './cybeni/AgentPanel.jsx';
import PreviewPane from './cybeni/PreviewPane.jsx';
import CodePane from './cybeni/CodePane.jsx';
import CybeniIntegrationsModal from './cybeni/CybeniIntegrationsModal.jsx';

const SETTINGS_KEY = 'cybeni_settings';
const DEFAULT_SETTINGS = {
  mode: 'standard',
  roles: { architect: '', developer: '', reviewer: '', designer: '' },
  security: 'hardened',
  quality: 'strict',
  design: '',
  autoVerify: true,
  maxFixRounds: 3,
};
const MAX_RUNS = 25;

export default function CybeniBuilderWindow() {
  const [projects, setProjects] = useState([]);
  const [slug, setSlug] = useState(null);
  const [files, setFiles] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [openTabs, setOpenTabs] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [view, setView] = useState('split');
  const [notice, setNotice] = useState(null);

  const [settings, setSettingsState] = useState(DEFAULT_SETTINGS);
  const [models, setModels] = useState([]);

  const [running, setRunning] = useState(false);
  const [phases, setPhases] = useState([]);
  const [logs, setLogs] = useState([]);
  const [question, setQuestion] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [changedPaths, setChangedPaths] = useState([]);
  const cancelRef = useRef(false);

  const sessionRef = useRef(newSessionId());
  const frameRef = useRef(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewBuilding, setPreviewBuilding] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState([]);
  const [staticIssues, setStaticIssues] = useState([]);
  const liveTimer = useRef(null);

  const [showNewProject, setShowNewProject] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  const project = projects.find(p => p.slug === slug) || null;
  const say = useCallback((text, tone = 'info') => {
    setNotice({ text, tone });
    setTimeout(() => setNotice(n => (n?.text === text ? null : n)), 5000);
  }, []);

  // ── Settings & models ─────────────────────────────────────────────────────

  const setSettings = useCallback((next) => {
    setSettingsState(next);
    db.setSetting(SETTINGS_KEY, next).catch(() => {});
  }, []);

  const rescanModels = useCallback(async () => {
    const list = await listCybeniModels();
    setModels(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      const saved = await db.getSetting(SETTINGS_KEY, null).catch(() => null);
      const merged = { ...DEFAULT_SETTINGS, ...(saved || {}), roles: { ...DEFAULT_SETTINGS.roles, ...(saved?.roles || {}) } };
      const list = await rescanModels();
      const available = new Set(list.map(m => m.key));
      if (Object.values(merged.roles).some(k => !k || !available.has(k))) {
        const suggested = suggestRoles(list);
        for (const role of Object.keys(merged.roles)) {
          if (!merged.roles[role] || !available.has(merged.roles[role])) merged.roles[role] = suggested[role];
        }
      }
      setSettingsState(merged);
    })();
  }, [rescanModels]);

  // ── Projects ──────────────────────────────────────────────────────────────

  const refreshProjects = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      let list = await refreshProjects();
      if (!list.length) {
        await createProject('My first app', 'react');
        list = await refreshProjects();
      }
      setSlug(list[0].slug);
    })();
    const session = sessionRef.current;
    return () => { clearPreview(session); };
  }, [refreshProjects]);

  const refreshPreview = useCallback(async (projectFiles) => {
    setPreviewBuilding(true);
    try {
      const published = await publishPreview(sessionRef.current, projectFiles);
      setStaticIssues(published.issues);
      setConsoleEntries([]);
      setPreviewDoc({ ...published, key: Date.now() });
    } catch (err) {
      say(`Preview failed: ${err.message}`, 'bad');
    } finally {
      setPreviewBuilding(false);
    }
  }, [say]);

  const loadFiles = useCallback(async (projectSlug, { preview = true } = {}) => {
    const list = await loadProjectFiles(projectSlug);
    setFiles(list);
    setDrafts({});
    if (preview) refreshPreview(list);
    return list;
  }, [refreshPreview]);

  useEffect(() => {
    if (!slug) return;
    setOpenTabs([]);
    setActivePath(null);
    setPhases([]);
    setLastResult(null);
    setChangedPaths([]);
    loadFiles(slug).then(list => {
      const first = list.find(f => /App\.(j|t)sx?$/.test(f.path)) || list.find(f => f.path === 'index.html') || list[0];
      if (first) {
        setOpenTabs([first.path]);
        setActivePath(first.path);
      }
    });
  }, [slug, loadFiles]);

  // Preview console
  useEffect(() => {
    const onMessage = (e) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow || !e.data?.__cybeni) return;
      const d = e.data;
      if (d.type === 'error') setConsoleEntries(c => [...c.slice(-199), { level: 'error', text: `${d.message}${d.line ? ` (line ${d.line})` : ''}` }]);
      else if (d.type === 'console' && !isNoise(d.text)) setConsoleEntries(c => [...c.slice(-199), { level: d.level, text: d.text }]);
      else if (d.type === 'ready' && d.empty) setConsoleEntries(c => [...c, { level: 'warn', text: 'The app rendered a blank page.' }]);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // ── Editing ───────────────────────────────────────────────────────────────

  const openFile = (path) => {
    setOpenTabs(t => (t.includes(path) ? t : [...t, path]));
    setActivePath(path);
  };
  const closeTab = (path) => {
    setOpenTabs(t => {
      const next = t.filter(p => p !== path);
      if (activePath === path) setActivePath(next[next.length - 1] || null);
      return next;
    });
  };
  const saveActive = async () => {
    if (!slug || !activePath || !(activePath in drafts)) return;
    await saveProjectFile(slug, activePath, drafts[activePath]);
    const list = await loadFiles(slug);
    setDrafts(d => {
      const { [activePath]: _saved, ...rest } = d;
      return rest;
    });
    return list;
  };
  const flushDrafts = async () => {
    for (const [path, content] of Object.entries(drafts)) await saveProjectFile(slug, path, content);
    setDrafts({});
  };
  const newFile = async () => {
    const path = window.prompt('New file path (for example src/components/Card.jsx):');
    if (!path?.trim()) return;
    await saveProjectFile(slug, path.trim(), '');
    await loadFiles(slug, { preview: false });
    openFile(path.trim().replace(/^\/+/, ''));
  };
  const removeFile = async (path) => {
    if (!window.confirm(`Delete ${path}?`)) return;
    await deleteProjectFile(slug, path);
    closeTab(path);
    await loadFiles(slug);
  };
  const renameFile = async (path) => {
    const next = window.prompt('Rename to:', path);
    if (!next?.trim() || next.trim() === path) return;
    const content = drafts[path] ?? files.find(f => f.path === path)?.content ?? '';
    await saveProjectFile(slug, next.trim(), content);
    await deleteProjectFile(slug, path);
    closeTab(path);
    await loadFiles(slug);
    openFile(next.trim().replace(/^\/+/, ''));
  };

  // ── Pipeline ──────────────────────────────────────────────────────────────

  const startRun = async (mode, request) => {
    if (!slug || running) return;
    await flushDrafts();
    const before = await loadProjectFiles(slug);
    const checkpointId = await createCheckpoint(slug, request, before);
    setPhases(phasesFor(mode).map(p => ({ ...p, status: 'pending' })));
    setLogs([]);
    setLastResult(null);
    setChangedPaths([]);
    cancelRef.current = false;
    setRunning(true);

    const result = await runPipeline({
      request,
      files: before,
      mode,
      roles: settings.roles,
      design: settings.design,
      security: settings.security,
      quality: settings.quality,
      maxFixRounds: settings.maxFixRounds,
    }, {
      runModel,
      verify: settings.autoVerify ? (snapshot) => verifyInHiddenFrame(snapshot) : undefined,
      onPhase: (id, patch) => setPhases(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p))),
      onLog: (text) => setLogs(l => [...l.slice(-400), { text, at: Date.now() }]),
      onFiles: (snapshot, changed) => {
        setFiles(snapshot);
        setChangedPaths(changed);
        // Watch it come together: refresh the visible preview as files land.
        clearTimeout(liveTimer.current);
        liveTimer.current = setTimeout(() => refreshPreview(snapshot), 1200);
      },
      ask: (text) => new Promise(resolve => setQuestion({ text, resolve })),
      isCancelled: () => cancelRef.current,
    });

    clearTimeout(liveTimer.current);
    // Keep the work even when stopped or failed; the checkpoint allows rollback.
    await replaceProjectFiles(slug, result.files);
    const run = {
      id: checkpointId,
      prompt: request.slice(0, 400),
      mode,
      status: result.status,
      approved: result.approved,
      changed: result.changed,
      summary: (result.summary || result.error || '').slice(0, 1500),
      checkpointId,
      at: Date.now(),
    };
    const updated = await updateProject(slug, { runs: [run, ...(project?.runs || [])].slice(0, MAX_RUNS) });
    setProjects(ps => ps.map(p => (p.slug === slug ? updated : p)));
    setLastResult(result);
    setChangedPaths(result.changed);
    setRunning(false);
    setQuestion(null);
    await loadFiles(slug);
    if (result.status === 'done') say(`Build finished: ${result.changed.length} file(s) changed.`, 'good');
  };

  const stopRun = () => {
    cancelRef.current = true;
    if (question) {
      question.resolve('Stop.');
      setQuestion(null);
    }
  };

  const answerQuestion = (text) => {
    question?.resolve(text);
    setQuestion(null);
  };

  const previewErrors = consoleEntries.filter(e => e.level === 'error');
  const fixPreviewErrors = () => {
    const list = [...new Set(previewErrors.map(e => e.text))].slice(0, 10);
    startRun('fix', `The preview reported these problems. Fix them:\n${list.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);
  };

  const restore = async (checkpointId) => {
    if (!window.confirm('Restore the project to how it was before that run? Current files will be replaced (a new checkpoint is saved first).')) return;
    await createCheckpoint(slug, 'Before restoring a checkpoint', await loadProjectFiles(slug));
    await restoreCheckpoint(slug, checkpointId);
    await loadFiles(slug);
    setChangedPaths([]);
    say('Project restored.', 'good');
  };

  // ── Projects UI actions ──────────────────────────────────────────────────

  const makeProject = async (name, template) => {
    const p = await createProject(name, template);
    await refreshProjects();
    setSlug(p.slug);
    setShowNewProject(false);
  };
  const renameProject = async () => {
    const name = window.prompt('Project name:', project?.name);
    if (!name?.trim()) return;
    await updateProject(slug, { name: name.trim().slice(0, 60) });
    await refreshProjects();
  };
  const removeProject = async () => {
    if (!window.confirm(`Delete project "${project?.name}" and all its files and checkpoints?`)) return;
    await deleteProject(slug);
    const list = await refreshProjects();
    if (list.length) setSlug(list[0].slug);
    else {
      const p = await createProject('My first app', 'react');
      await refreshProjects();
      setSlug(p.slug);
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const currentFiles = async () => {
    await flushDrafts();
    return loadProjectFiles(slug);
  };
  const exportZip = async () => {
    downloadBytes(`${slug}.zip`, buildZip(await currentFiles()), 'application/zip');
    setShowExport(false);
  };
  const exportHtml = async () => {
    const { html, issues } = buildPreview(await currentFiles(), { mode: 'inline' });
    downloadBytes(`${slug}.html`, new TextEncoder().encode(html), 'text/html');
    if (issues.length) say(`Exported with ${issues.length} known issue(s).`, 'warn');
    setShowExport(false);
  };
  const pushHub = async () => {
    setShowExport(false);
    try {
      const list = await currentFiles();
      const message = window.prompt('Commit message:', `Update ${project?.name}`);
      if (message === null) return;
      let repoId = project?.repoId;
      if (!repoId || !(await novaHub.getRepository(repoId))) {
        const repo = await novaHub.createRepository({ name: slug, description: `${project?.name} (built with Cybeni)`, initialFiles: list });
        repoId = repo.id;
        await updateProject(slug, { repoId });
        await refreshProjects();
        say(`Created NovaHub repository ${repo.name}.`, 'good');
        return;
      }
      const commit = await novaHub.commitProjectFiles({ repoId, projectPath: `/projects/cybeni/${slug}`, message: message || `Update ${project?.name}` });
      say(`Committed ${commit.hash.slice(0, 7)} to NovaHub.`, 'good');
    } catch (err) {
      say(`NovaHub push failed: ${err.message}`, 'bad');
    }
  };
  const publishMesh = async () => {
    setShowExport(false);
    const domain = window.prompt('Mesh site address:', `${slug}.nova`);
    if (!domain?.trim()) return;
    try {
      const { html } = buildPreview(await currentFiles(), { mode: 'inline' });
      const site = await publishHostedSite({ domain: domain.trim(), title: project?.name, htmlContent: html });
      say(`Published to the mesh as nova://${site.domain}.`, 'good');
    } catch (err) {
      say(`Mesh publish failed: ${err.message}`, 'bad');
    }
  };
  const publishMarket = async () => {
    setShowExport(false);
    try {
      const list = await currentFiles();
      await marketplacePublish.publishCreation({
        title: project?.name || slug,
        category: 'apps',
        description: lastResult?.summary || `App built with Cybeni (${list.length} files).`,
        tags: ['cybeni', 'app'],
        content: JSON.stringify({ format: 'cybeni-project-v1', files: list }),
      });
      say('Published to the Marketplace.', 'good');
    } catch (err) {
      say(`Marketplace publish failed: ${err.message}`, 'bad');
    }
  };

  // ── Integrations library ─────────────────────────────────────────────────

  const integrationPath = (integration) => `integrations/${String(integration.suggestedPath || 'integration.js').split('/').pop()}`;
  const applyIntegration = async (integration) => {
    const path = integrationPath(integration);
    await saveProjectFile(slug, path, integration.code);
    await loadFiles(slug, { preview: false });
    openFile(path);
    setShowLibrary(false);
    say(`Added ${integration.title} as ${path}.`, 'good');
  };
  const askAiToIntegrate = async (integration) => {
    await applyIntegration(integration);
    startRun('quick', `Integrate ${integration.title} (${integration.vendor}) into the app using the reference in ${integrationPath(integration)}. ${integration.aiPrompt || ''}`.trim());
  };

  const runs = project?.runs || [];
  const toneClass = { good: 'bg-emerald-900/80 border-emerald-500/50 text-emerald-100', bad: 'bg-rose-900/80 border-rose-500/50 text-rose-100', warn: 'bg-amber-900/80 border-amber-500/50 text-amber-100', info: 'bg-slate-800 border-slate-600 text-slate-100' };

  const workspace = useMemo(() => ({ preview: view !== 'code', code: view !== 'preview' }), [view]);

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans relative">
      {/* Header */}
      <div className="h-11 px-3 bg-slate-900/90 border-b border-slate-800 flex items-center gap-2 shrink-0">
        <Code2 className="w-5 h-5 text-purple-400 shrink-0" />
        <span className="font-bold text-xs text-white hidden md:inline">Cybeni</span>
        <select
          value={slug || ''}
          onChange={e => setSlug(e.target.value)}
          disabled={running}
          className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[12px] text-white max-w-[180px]"
        >
          {projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
        <button onClick={() => setShowNewProject(true)} disabled={running} title="New project" className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-40"><Plus className="w-4 h-4" /></button>
        <button onClick={renameProject} disabled={running} title="Rename project" className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-40"><Pencil className="w-3.5 h-3.5" /></button>
        <button onClick={removeProject} disabled={running} title="Delete project" className="p-1 rounded text-slate-400 hover:text-rose-300 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" /></button>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex rounded-md border border-slate-700 overflow-hidden">
            {[['preview', Eye, 'Preview'], ['split', Columns2, 'Split'], ['code', Code2, 'Code']].map(([id, Icon, label]) => (
              <button key={id} onClick={() => setView(id)} title={label} className={`px-2 py-1 ${view === id ? 'bg-purple-700/50 text-white' : 'text-slate-400 hover:text-white'}`}><Icon className="w-3.5 h-3.5" /></button>
            ))}
          </div>
          <button onClick={() => setShowLibrary(true)} className="flex items-center gap-1 px-2 py-1 rounded-md border border-purple-600/50 text-purple-200 text-[11px] hover:bg-purple-900/40">
            <Sparkles className="w-3.5 h-3.5" /> Library
          </button>
          <div className="relative">
            <button onClick={() => setShowExport(s => !s)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-700/40 border border-cyan-600/50 text-cyan-100 text-[11px]">
              <Download className="w-3.5 h-3.5" /> Ship <ChevronDown className="w-3 h-3" />
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 w-60 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-[12px]">
                <button onClick={exportZip} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800"><FileArchive className="w-3.5 h-3.5 text-slate-400" /> Download project (.zip)</button>
                <button onClick={exportHtml} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800"><FileCode2 className="w-3.5 h-3.5 text-slate-400" /> Download as one HTML file</button>
                <button onClick={pushHub} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800"><GitCommit className="w-3.5 h-3.5 text-slate-400" /> Push to NovaHub</button>
                <button onClick={publishMesh} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800"><Globe className="w-3.5 h-3.5 text-slate-400" /> Publish to the mesh web</button>
                <button onClick={publishMarket} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800"><ShoppingBag className="w-3.5 h-3.5 text-slate-400" /> Publish to the Marketplace</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex">
        <div className="w-[320px] shrink-0 min-h-0">
          <AgentPanel
            settings={settings}
            setSettings={setSettings}
            models={models}
            onSuggestRoles={() => setSettings({ ...settings, roles: suggestRoles(models) })}
            onRescanModels={rescanModels}
            running={running}
            phases={phases}
            logs={logs}
            question={question}
            onAnswer={answerQuestion}
            onRun={startRun}
            onStop={stopRun}
            previewErrorCount={previewErrors.length}
            onFixErrors={fixPreviewErrors}
            runs={runs}
            onRestoreCheckpoint={restore}
            lastResult={lastResult}
          />
        </div>
        <div className="flex-1 min-w-0 min-h-0 flex">
          {workspace.code && (
            <div className={`${workspace.preview ? 'w-1/2 border-r border-slate-800' : 'flex-1'} min-w-0 min-h-0`}>
              <CodePane
                files={files}
                openTabs={openTabs}
                activePath={activePath}
                drafts={drafts}
                changedPaths={changedPaths}
                onOpen={openFile}
                onClose={closeTab}
                onChange={(path, value) => setDrafts(d => ({ ...d, [path]: value }))}
                onSave={saveActive}
                onNewFile={newFile}
                onDeleteFile={removeFile}
                onRenameFile={renameFile}
              />
            </div>
          )}
          {workspace.preview && (
            <div className="flex-1 min-w-0 min-h-0">
              <PreviewPane
                doc={previewDoc}
                frameRef={frameRef}
                consoleEntries={consoleEntries}
                onClearConsole={() => setConsoleEntries([])}
                onReload={async () => { await flushDrafts(); refreshPreview(await loadProjectFiles(slug)); }}
                building={previewBuilding}
                staticIssues={staticIssues}
              />
            </div>
          )}
        </div>
      </div>

      {notice && (
        <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg border text-[12px] shadow-xl z-50 ${toneClass[notice.tone] || toneClass.info}`}>
          {notice.text}
        </div>
      )}

      {showNewProject && <NewProjectDialog onCreate={makeProject} onClose={() => setShowNewProject(false)} />}

      <CybeniIntegrationsModal
        isOpen={showLibrary}
        onClose={() => setShowLibrary(false)}
        onApplyIntegration={applyIntegration}
        onAskAiToIntegrate={askAiToIntegrate}
      />
    </div>
  );
}

function NewProjectDialog({ onCreate, onClose }) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('react');
  return (
    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onCreate(name.trim(), template); }}
        className="w-80 bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3"
      >
        <div className="flex items-center text-sm font-bold">New project<button type="button" onClick={onClose} className="ml-auto text-slate-400 hover:text-white"><X className="w-4 h-4" /></button></div>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Project name" className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-[12px]" />
        <div className="space-y-1">
          {Object.entries(TEMPLATES).map(([id, t]) => (
            <label key={id} className="flex items-center gap-2 text-[12px] cursor-pointer">
              <input type="radio" name="template" checked={template === id} onChange={() => setTemplate(id)} /> {t.label}
            </label>
          ))}
        </div>
        <button disabled={!name.trim()} className="w-full py-1.5 rounded-md bg-purple-600 text-white text-[12px] font-semibold disabled:opacity-40">Create</button>
      </form>
    </div>
  );
}
