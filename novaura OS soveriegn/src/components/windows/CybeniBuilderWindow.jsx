import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Binds @monaco-editor/react to the locally bundled Monaco (offline, no CDN).
import '../../config/monacoConfig.js';
import {
  Code2, Eye, Columns2, Plus, Trash2, Pencil, Download, ChevronDown, Sparkles, GitCommit, Globe, ShoppingBag,
  FileArchive, FileCode2, X, Gauge, Server, AppWindow, Cpu,
} from 'lucide-react';
import { db } from '../../database/sovereignDatabase.js';
import { novaHub } from '../../services/novaHubService.js';
import { publishHostedSite } from '../../services/sovereignMesh.js';
import { marketplacePublish } from '../../services/marketplacePublishService.js';
import { runPipeline, phasesFor, TESTS_PATH } from '../../services/cybeni/pipeline.js';
import { listCybeniModels, runModel, suggestRoles } from '../../services/cybeni/models.js';
import { createAppAiBridge } from '../../services/cybeni/appAiBridge.js';
import { kernel } from '../../kernel/NovaKernel.js';
import { buildPreview, staticCheck } from '../../services/cybeni/previewBuilder.js';
import { publishPreview, clearPreview, verifyInHiddenFrame, newSessionId, isNoise } from '../../services/cybeni/previewHost.js';
import { normalizeTests } from '../../services/cybeni/testAgent.js';
import { generateFullStackServerFiles, buildNovappManifest } from '../../services/cybeni/fullStackRuntime.js';
import { detectNativeLanguage } from '../../services/cybeni/nativeReference.js';
import { compileNativeProject, buildNativeSourceBundleFiles, base64ToUint8Array } from '../../services/cybeni/nativeCompiler.js';
import { integrateAsApp } from '../../services/forge/forgeService.js';
import {
  TEMPLATES, listProjects, createProject, updateProject, deleteProject, loadProjectFiles, saveProjectFile,
  deleteProjectFile, replaceProjectFiles, createCheckpoint, restoreCheckpoint, buildZip, downloadBytes,
} from '../../services/cybeni/projectStore.js';
import AgentPanel from './cybeni/AgentPanel.jsx';
import PreviewPane from './cybeni/PreviewPane.jsx';
import CodePane from './cybeni/CodePane.jsx';
import CybeniIntegrationsModal from './cybeni/CybeniIntegrationsModal.jsx';
import BenchmarkModal from './cybeni/BenchmarkModal.jsx';

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

export default function CybeniBuilderWindow({ props: windowProps } = {}) {
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
  const [lastCheckpointFiles, setLastCheckpointFiles] = useState(null);
  const [streamingInfo, setStreamingInfo] = useState(null);
  const cancelRef = useRef(false);

  const sessionRef = useRef(newSessionId());
  const frameRef = useRef(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewBuilding, setPreviewBuilding] = useState(false);
  const [consoleEntries, setConsoleEntries] = useState([]);
  const [staticIssues, setStaticIssues] = useState([]);
  const [inspecting, setInspecting] = useState(false);
  const [pickedElement, setPickedElement] = useState(null);
  const [dbState, setDbState] = useState({ tables: {}, users: [], currentUser: null });
  const [visualIssues, setVisualIssues] = useState([]);
  const [checkReport, setCheckReport] = useState(null);
  const liveTimer = useRef(null);

  // ai.chat() in the preview runs on the person's chosen OS model, like an installed app:
  // no companion memory, no cached answers.
  const [aiBridge] = useState(() => createAppAiBridge({
    chat: (messages, opts) => {
      if (!kernel?.ai?.chat) throw new Error('The AI subsystem is not ready yet.');
      return kernel.ai.chat(messages, { ...opts, useRag: false, noCache: true });
    },
  }));

  const [showNewProject, setShowNewProject] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showBenchmark, setShowBenchmark] = useState(false);

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
      // Opened from the Forge or a user app with a specific project.
      const wanted = windowProps?.project && list.find(p => p.slug === windowProps.project);
      setSlug(wanted ? wanted.slug : list[0].slug);
    })();
    const session = sessionRef.current;
    const onOpenProject = async (e) => {
      const list = await refreshProjects();
      if (list.some(p => p.slug === e.detail)) setSlug(e.detail);
    };
    window.addEventListener('novaura:cybeni_open_project', onOpenProject);
    return () => {
      clearPreview(session);
      window.removeEventListener('novaura:cybeni_open_project', onOpenProject);
    };
  }, [refreshProjects]); // windowProps is read once, on first open

  // appId names the project so its @cybeni/backend data stays its own on the shared origin.
  const refreshPreview = useCallback(async (projectFiles, appId) => {
    setPreviewBuilding(true);
    setInspecting(false);
    setPickedElement(null);
    setVisualIssues([]);
    try {
      const published = await publishPreview(sessionRef.current, projectFiles, { appId });
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
    if (preview) refreshPreview(list, projectSlug);
    return list;
  }, [refreshPreview]);

  useEffect(() => {
    if (!slug) return;
    setOpenTabs([]);
    setActivePath(null);
    setPhases([]);
    setLastResult(null);
    setChangedPaths([]);
    setLastCheckpointFiles(null);
    setStreamingInfo(null);
    setInspecting(false);
    setPickedElement(null);
    setDbState({ tables: {}, users: [], currentUser: null });
    setVisualIssues([]);
    setCheckReport(null);
    loadFiles(slug).then(list => {
      const first = list.find(f => /App\.(j|t)sx?$/.test(f.path)) || list.find(f => f.path === 'index.html') || list[0];
      if (first) {
        setOpenTabs([first.path]);
        setActivePath(first.path);
      }
    });
  }, [slug, loadFiles]);

  const postToPreview = useCallback((payload) => {
    const win = frameRef.current?.contentWindow;
    if (!win) return;
    const targetOrigin = previewDoc?.origin && previewDoc.origin !== 'null' ? previewDoc.origin : '*';
    win.postMessage(payload, targetOrigin);
  }, [previewDoc]);

  // Preview console + @cybeni/backend DB sync + Visual Audit + Element Inspector + AI bridge
  useEffect(() => {
    const onMessage = async (e) => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow || !e.data?.__cybeni) return;
      const d = e.data;
      const replyOrigin = e.origin && e.origin !== 'null' ? e.origin : '*';

      if (d.type === 'error') {
        setConsoleEntries(c => [...c.slice(-199), { level: 'error', text: `${d.message}${d.line ? ` (line ${d.line})` : ''}` }]);
      } else if (d.type === 'console' && !isNoise(d.text)) {
        setConsoleEntries(c => [...c.slice(-199), { level: d.level, text: d.text }]);
      } else if (d.type === 'ready') {
        if (d.empty) setConsoleEntries(c => [...c, { level: 'warn', text: 'The app rendered a blank page.' }]);
        if (Array.isArray(d.visualIssues)) setVisualIssues(d.visualIssues);
        try {
          frameRef.current?.contentWindow?.postMessage({ __cybeniDbAdmin: true, action: 'request-sync' }, replyOrigin);
        } catch { /* ignore */ }
      } else if (d.type === 'visual-audit') {
        if (Array.isArray(d.visualIssues)) setVisualIssues(d.visualIssues);
      } else if (d.type === 'db-sync') {
        setDbState({
          tables: d.tables || {},
          users: Array.isArray(d.users) ? d.users : [],
          currentUser: d.currentUser || null,
        });
      } else if (d.type === 'element-picked') {
        setPickedElement(d.element || null);
        setInspecting(false);
      } else if (d.type === 'inspect-cancelled') {
        setInspecting(false);
      } else if (d.type === 'ai-request' && d.requestId) {
        const target = e.source;
        aiBridge.handle(d, (payload) => {
          try { target?.postMessage(payload, replyOrigin); } catch { /* the preview was replaced */ }
        });
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [aiBridge]);

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

  const revertFile = async (path) => {
    if (!slug || !lastCheckpointFiles || !Object.prototype.hasOwnProperty.call(lastCheckpointFiles, path)) return;
    await saveProjectFile(slug, path, lastCheckpointFiles[path]);
    setDrafts(d => {
      const { [path]: _drop, ...rest } = d;
      return rest;
    });
    setChangedPaths(cs => cs.filter(p => p !== path));
    await loadFiles(slug);
    say(`Reverted ${path} to pre-run state.`, 'good');
  };

  const uploadAssets = async (fileList) => {
    if (!slug || !fileList?.length) return;
    const added = [];
    for (const file of Array.from(fileList)) {
      const cleanName = String(file.name || 'asset').replace(/[^a-zA-Z0-9._-]+/g, '-');
      const assetPath = `assets/${cleanName}`;
      const content = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        if (/\.svg$/i.test(cleanName)) reader.readAsText(file);
        else reader.readAsDataURL(file);
      });
      if (!content) continue;
      await saveProjectFile(slug, assetPath, content);
      added.push(assetPath);
    }
    if (added.length) {
      await loadFiles(slug);
      openFile(added[0]);
      say(`Added ${added.length} asset(s) under assets/. Import with "./${added[0]}" or src="${added[0]}".`, 'good');
    }
  };

  // ── Pipeline ──────────────────────────────────────────────────────────────

  const startRun = async (mode, request, images = []) => {
    if (!slug || running) return;
    await flushDrafts();
    const before = await loadProjectFiles(slug);
    setLastCheckpointFiles(Object.fromEntries(before.map(f => [f.path, f.content])));
    const checkpointId = await createCheckpoint(slug, request, before);
    setPhases(phasesFor(mode).map(p => ({ ...p, status: 'pending' })));
    setLogs([]);
    setLastResult(null);
    setChangedPaths([]);
    setPickedElement(null);
    setInspecting(false);
    setStreamingInfo(null);
    cancelRef.current = false;
    setRunning(true);

    const result = await runPipeline({
      request,
      images,
      files: before,
      mode,
      roles: settings.roles,
      design: settings.design,
      security: settings.security,
      quality: settings.quality,
      maxFixRounds: settings.maxFixRounds,
    }, {
      runModel,
      verify: settings.autoVerify ? (snapshot, opts) => verifyInHiddenFrame(snapshot, opts) : undefined,
      compileNative: settings.autoVerify ? (snapshot) => compileNativeProject(slug, snapshot, { checkOnly: true }) : undefined,
      onPhase: (id, patch) => setPhases(ps => ps.map(p => (p.id === id ? { ...p, ...patch } : p))),
      onStream: (info) => setStreamingInfo(info),
      onLog: (text) => setLogs(l => [...l.slice(-400), { text, at: Date.now() }]),
      onFiles: (snapshot, changed) => {
        setFiles(snapshot);
        setChangedPaths(changed);
        // Watch it come together: refresh the visible preview as files land.
        clearTimeout(liveTimer.current);
        liveTimer.current = setTimeout(() => refreshPreview(snapshot, slug), 1200);
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
      tests: result.testResults ? { passed: result.testResults.filter(r => r.passed).length, total: result.tests.length } : null,
      changed: result.changed,
      summary: (result.summary || result.error || '').slice(0, 1500),
      checkpointId,
      at: Date.now(),
    };
    const updated = await updateProject(slug, { runs: [run, ...(project?.runs || [])].slice(0, MAX_RUNS) });
    setProjects(ps => ps.map(p => (p.slug === slug ? updated : p)));
    setLastResult(result);
    setChangedPaths(result.changed);
    if (Array.isArray(result.visualIssues)) setVisualIssues(result.visualIssues);
    setStreamingInfo(null);
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

  const fixVisualIssues = () => {
    if (!visualIssues.length) return;
    startRun('fix', `Fix these visual layout & DOM rendering issues reported by the preview audit:\n${visualIssues.map((v, i) => `${i + 1}. [${v.kind}] ${v.message}${v.selector ? ` (selector: ${v.selector})` : ''}`).join('\n')}`);
  };

  const toggleInspect = () => {
    const next = !inspecting;
    setInspecting(next);
    postToPreview({ __cybeniInspect: next });
  };

  const applyElementEdit = (element, editPrompt) => {
    const details = [
      `Target element: ${element.selector || element.tag}`,
      element.component ? `React component: <${element.component}>` : '',
      element.fileHint ? `Likely file: ${element.fileHint}` : '',
      element.text ? `Visible text: "${element.text}"` : '',
      element.placeholder ? `Placeholder: "${element.placeholder}"` : '',
      element.classes ? `Current classes: "${element.classes}"` : '',
    ].filter(Boolean).join('\n');
    startRun('quick', `Make this targeted change ONLY to the inspected element below while keeping everything else working:\n\n${details}\n\nRequested change: ${editPrompt}`);
  };

  const handleDbAdmin = (payload) => {
    postToPreview({ __cybeniDbAdmin: true, ...payload });
  };

  const requestDbSync = () => {
    postToPreview({ __cybeniDbAdmin: true, action: 'request-sync' });
  };

  const refreshAudit = () => {
    postToPreview({ __cybeniAudit: true });
  };

  const runProjectChecks = async () => {
    if (!slug) return;
    setCheckReport(r => ({ ...(r || {}), running: true }));
    try {
      await flushDrafts();
      const current = await loadProjectFiles(slug);
      const staticList = staticCheck(current);
      const testsFile = current.find(f => f.path === TESTS_PATH);
      let tests = [];
      if (testsFile) {
        try { tests = normalizeTests(JSON.parse(testsFile.content)); } catch { tests = []; }
      }
      const nativeResult = detectNativeLanguage('', current.map(f => f.path))
        ? await compileNativeProject(slug, current, { checkOnly: true }).catch(err => ({ ok: false, lang: 'native', compiler: 'error', errors: [err.message] }))
        : null;
      const verifyRes = await verifyInHiddenFrame(current, { tests });
      if (Array.isArray(verifyRes.visualIssues)) setVisualIssues(verifyRes.visualIssues);
      setCheckReport({
        running: false,
        staticIssues: staticList,
        nativeResult,
        runtimeErrors: verifyRes.errors || [],
        testResults: verifyRes.tests || [],
        visualIssues: verifyRes.visualIssues || [],
        ranAt: Date.now(),
      });
    } catch (err) {
      setCheckReport({
        running: false,
        staticIssues: [],
        runtimeErrors: [err.message || 'Verification failed.'],
        testResults: [],
        visualIssues: [],
        ranAt: Date.now(),
      });
    }
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

  const openBenchmarkBuild = async (buildFiles, name) => {
    const p = await createProject(name, 'react');
    await replaceProjectFiles(p.slug, buildFiles);
    await refreshProjects();
    setSlug(p.slug);
    setShowBenchmark(false);
    say(`Opened "${name}" as a project.`, 'good');
  };

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

  // ── Export & Deploy ──────────────────────────────────────────────────────

  const currentFiles = async () => {
    await flushDrafts();
    return loadProjectFiles(slug);
  };
  const exportZip = async () => {
    downloadBytes(`${slug}.zip`, buildZip(await currentFiles()), 'application/zip');
    setShowExport(false);
  };
  const exportFullStackZip = async () => {
    setShowExport(false);
    try {
      const list = await currentFiles();
      const { html } = buildPreview(list, { mode: 'inline' });
      const serverFiles = generateFullStackServerFiles(project?.name || slug, list);
      const novapp = buildNovappManifest(project?.name || slug, slug, list);
      const map = new Map(list.map(f => [f.path, f.content]));
      map.set('standalone.html', html);
      map.set('novapp.json', `${JSON.stringify(novapp, null, 2)}\n`);
      for (const sf of serverFiles) map.set(sf.path, sf.content);
      const bundle = [...map.entries()].map(([path, content]) => ({ path, content }));
      downloadBytes(`${slug}-fullstack.zip`, buildZip(bundle), 'application/zip');
      say(`Exported full-stack Node.js + SQLite bundle (${bundle.length} files). Run with "npm start".`, 'good');
    } catch (err) {
      say(`Full-stack export failed: ${err.message}`, 'bad');
    }
  };
  const compileStandaloneExe = async () => {
    setShowExport(false);
    try {
      const list = await currentFiles();
      const lang = detectNativeLanguage('', list.map(f => f.path));
      if (!lang) {
        say('Add C++ (.cpp) or C# (.cs) source files (or create a C++/C# template project) to compile a native executable.', 'warn');
        return;
      }
      say(`Compiling standalone ${lang.toUpperCase()} binary…`, 'info');
      const res = await compileNativeProject(slug, list, { checkOnly: false });
      // A .NET build is the .exe plus the .dll and runtime files it needs: hand them over together.
      const artifacts = Array.isArray(res.artifacts) ? res.artifacts : [];
      if (res.ok && artifacts.length > 1) {
        const folder = String(res.exeName || slug).replace(/\.exe$/i, '');
        const entries = artifacts.map(a => ({ path: `${folder}/${a.name}`, bytes: base64ToUint8Array(a.base64) }));
        downloadBytes(`${folder}-windows.zip`, buildZip(entries), 'application/zip');
        say(`Compiled ${res.exeName} with ${res.compiler}. Keep the files in the zip together; it runs on Windows with the .NET runtime installed.`, 'good');
        return;
      }
      if (res.ok && res.exeBase64) {
        downloadBytes(res.exeName, base64ToUint8Array(res.exeBase64), 'application/octet-stream');
        say(`Compiled ${res.exeName} (${Math.max(1, Math.round(res.exeSize / 1024))} KB) with ${res.compiler}.`, 'good');
        return;
      }
      if (!res.ok) {
        say(`Native compile failed (${res.errors?.[0] || 'check C++/C# syntax'}).`, 'bad');
        setCheckReport(r => ({ ...(r || {}), running: false, nativeResult: res }));
        return;
      }
      const bundle = buildNativeSourceBundleFiles(project?.name || slug, list);
      downloadBytes(`${slug}-native-src.zip`, buildZip(bundle.files), 'application/zip');
      say(res.output || `Exported ready-to-build ${bundle.lang.toUpperCase()} bundle (run build.ps1 inside Sovereign Desktop or Windows terminal).`, 'good');
    } catch (err) {
      say(`Native compile failed: ${err.message}`, 'bad');
    }
  };
  const installToSovereignOs = async () => {
    setShowExport(false);
    try {
      const list = await currentFiles();
      const manifest = buildNovappManifest(project?.name || slug, slug, list);
      await saveProjectFile(slug, 'novapp.json', `${JSON.stringify(manifest, null, 2)}\n`);
      await integrateAsApp(slug, { name: project?.name || slug });
      await loadFiles(slug, { preview: false });
      say(`Installed "${project?.name || slug}" to Sovereign OS Apps.`, 'good');
    } catch (err) {
      say(`Install failed: ${err.message}`, 'bad');
    }
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

  const integrationPath = (integration) => {
    const raw = String(integration.suggestedPath || 'integration.js').replace(/\\/g, '/');
    if (raw.startsWith('/projects/cybeni/')) return raw.slice('/projects/cybeni/'.length);
    return `integrations/${raw.split('/').pop()}`;
  };
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
          <button onClick={() => setShowBenchmark(true)} disabled={running} title="Measure Cybeni on a fixed set of apps" className="flex items-center gap-1 px-2 py-1 rounded-md border border-slate-700 text-slate-300 text-[11px] hover:bg-slate-800 disabled:opacity-40">
            <Gauge className="w-3.5 h-3.5" /> Benchmark
          </button>
          <div className="relative">
            <button onClick={() => setShowExport(s => !s)} className="flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-700/40 border border-cyan-600/50 text-cyan-100 text-[11px]">
              <Download className="w-3.5 h-3.5" /> Ship <ChevronDown className="w-3 h-3" />
            </button>
            {showExport && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 py-1 text-[12px]">
                <button onClick={installToSovereignOs} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-emerald-300"><AppWindow className="w-3.5 h-3.5" /> Install to Sovereign OS</button>
                <button onClick={exportFullStackZip} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-cyan-200"><Server className="w-3.5 h-3.5" /> Full-Stack Server (.zip)</button>
                <button onClick={compileStandaloneExe} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-purple-200"><Cpu className="w-3.5 h-3.5" /> Compile Standalone .exe (C++/C#)</button>
                <div className="my-1 border-t border-slate-800" />
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
            streamingInfo={streamingInfo}
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
                checkpointFiles={lastCheckpointFiles}
                onOpen={openFile}
                onClose={closeTab}
                onChange={(path, value) => setDrafts(d => ({ ...d, [path]: value }))}
                onSave={saveActive}
                onNewFile={newFile}
                onDeleteFile={removeFile}
                onRenameFile={renameFile}
                onRevertFile={revertFile}
                onUploadAsset={uploadAssets}
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
                onReload={async () => { await flushDrafts(); refreshPreview(await loadProjectFiles(slug), slug); }}
                building={previewBuilding}
                staticIssues={staticIssues}
                inspecting={inspecting}
                onToggleInspect={toggleInspect}
                pickedElement={pickedElement}
                onClearPicked={() => setPickedElement(null)}
                onApplyElementEdit={applyElementEdit}
                dbState={dbState}
                onDbAdmin={handleDbAdmin}
                onRequestDbSync={requestDbSync}
                visualIssues={visualIssues}
                onFixVisualIssues={fixVisualIssues}
                onRefreshAudit={refreshAudit}
                onRunChecks={runProjectChecks}
                checkReport={checkReport}
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

      {showBenchmark && <BenchmarkModal roles={settings.roles} onClose={() => setShowBenchmark(false)} onOpenBuild={openBenchmarkBuild} />}

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
