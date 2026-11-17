import React, { useState } from 'react';
import {
  RefreshCw, Monitor, Tablet, Smartphone, AlertTriangle, Terminal, Trash2, ShieldCheck,
  Crosshair, Database, ScanEye, Play, Wand2, Plus, X, CheckCircle2, XCircle, Loader2, UserCheck,
} from 'lucide-react';

const WIDTHS = { desktop: '100%', tablet: '820px', mobile: '390px' };

export default function PreviewPane({
  doc,
  frameRef,
  consoleEntries,
  onClearConsole,
  onReload,
  building,
  staticIssues,
  inspecting = false,
  onToggleInspect,
  pickedElement = null,
  onClearPicked,
  onApplyElementEdit,
  dbState = { tables: {}, users: [], currentUser: null },
  onDbAdmin,
  onRequestDbSync,
  visualIssues = [],
  onFixVisualIssues,
  onRefreshAudit,
  onRunChecks,
  checkReport = null,
}) {
  const [device, setDevice] = useState('desktop');
  const [dockTab, setDockTab] = useState('console'); // 'console' | 'data' | 'visual' | 'checks' | null
  const [elementPrompt, setElementPrompt] = useState('');
  const [activeTable, setActiveTable] = useState('');
  const [newTableName, setNewTableName] = useState('items');
  const [newRowJson, setNewRowJson] = useState('{"title":"Sample item"}');
  const [rowError, setRowError] = useState('');

  const errors = consoleEntries.filter(e => e.level === 'error');
  const tableNames = Object.keys(dbState?.tables || {}).sort();
  const resolvedTable = tableNames.includes(activeTable) ? activeTable : (tableNames[0] || '');

  const selectTab = (tab) => {
    setDockTab(prev => (prev === tab ? null : tab));
    if (tab === 'data') onRequestDbSync?.();
    if (tab === 'visual') onRefreshAudit?.();
  };

  const handleElementSubmit = (e) => {
    e.preventDefault();
    if (!pickedElement || !elementPrompt.trim()) return;
    onApplyElementEdit?.(pickedElement, elementPrompt.trim());
    setElementPrompt('');
  };

  const handleInsertRow = (e) => {
    e.preventDefault();
    const targetTable = (resolvedTable || newTableName).trim() || 'items';
    try {
      const record = JSON.parse(newRowJson);
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        setRowError('Row must be a JSON object.');
        return;
      }
      setRowError('');
      onDbAdmin?.({ action: 'insert', table: targetTable, record });
      setActiveTable(targetTable);
    } catch (err) {
      setRowError(err.message);
    }
  };

  const rows = resolvedTable && Array.isArray(dbState?.tables?.[resolvedTable])
    ? dbState.tables[resolvedTable]
    : [];

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-950">
      <div className="h-9 px-2 flex items-center gap-1 border-b border-slate-800 bg-slate-900/70 shrink-0 overflow-x-auto">
        {[['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]].map(([id, Icon]) => (
          <button key={id} onClick={() => setDevice(id)} title={id} className={`p-1 rounded ${device === id ? 'text-cyan-300 bg-cyan-950/50' : 'text-slate-500 hover:text-slate-200'}`}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
        <button onClick={onReload} title="Rebuild preview" className="p-1 rounded text-slate-400 hover:text-white"><RefreshCw className={`w-3.5 h-3.5 ${building ? 'animate-spin' : ''}`} /></button>
        {onToggleInspect && (
          <button
            onClick={onToggleInspect}
            title="Inspect element in preview & edit with AI"
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors ${inspecting ? 'border-cyan-400 bg-cyan-950/70 text-cyan-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}
          >
            <Crosshair className="w-3 h-3" /> {inspecting ? 'Click element…' : 'Inspect'}
          </button>
        )}
        <span className="hidden xl:flex items-center gap-1 text-[10px] text-emerald-400/80 ml-1" title="Runs on its own origin, isolated from the OS, its data and its commands">
          <ShieldCheck className="w-3 h-3" /> Isolated
        </span>

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={() => selectTab('console')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${dockTab === 'console' ? 'border-cyan-500/60 bg-slate-800 text-white' : errors.length ? 'border-rose-500/60 text-rose-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
          >
            <Terminal className="w-3 h-3" /> Console{errors.length ? ` · ${errors.length}` : ''}
          </button>
          <button
            onClick={() => selectTab('data')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${dockTab === 'data' ? 'border-purple-500/60 bg-slate-800 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
            title="Live @cybeni/backend database tables & auth state"
          >
            <Database className="w-3 h-3" /> Data{tableNames.length ? ` · ${tableNames.length}` : ''}
          </button>
          <button
            onClick={() => selectTab('visual')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${dockTab === 'visual' ? 'border-amber-500/60 bg-slate-800 text-white' : visualIssues.length ? 'border-amber-600/50 text-amber-300' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
            title="Visual DOM & layout audit"
          >
            <ScanEye className="w-3 h-3" /> Audit{visualIssues.length ? ` · ${visualIssues.length}` : ''}
          </button>
          <button
            onClick={() => selectTab('checks')}
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${dockTab === 'checks' ? 'border-emerald-500/60 bg-slate-800 text-white' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
            title="Verification & test runner"
          >
            <Play className="w-3 h-3" /> Checks
          </button>
        </div>
      </div>

      {pickedElement && (
        <form onSubmit={handleElementSubmit} className="px-2.5 py-1.5 bg-cyan-950/50 border-b border-cyan-600/40 flex items-center gap-2 shrink-0">
          <Crosshair className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
          <div className="min-w-0 flex items-center gap-1.5 text-[11px]">
            <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-200 font-mono text-[10px] shrink-0">
              {pickedElement.selector || pickedElement.tag}
            </code>
            {pickedElement.component && (
              <span className="text-[10px] text-purple-300 shrink-0">&lt;{pickedElement.component}&gt;</span>
            )}
            {pickedElement.text && (
              <span className="text-[10px] text-slate-400 truncate max-w-[140px]">"{pickedElement.text}"</span>
            )}
          </div>
          <input
            autoFocus
            value={elementPrompt}
            onChange={(e) => setElementPrompt(e.target.value)}
            placeholder="Describe how to change this element…"
            className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
          />
          <button type="submit" disabled={!elementPrompt.trim()} className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-[10.5px] font-semibold disabled:opacity-40 shrink-0">
            <Wand2 className="w-3 h-3" /> Apply
          </button>
          <button type="button" onClick={onClearPicked} title="Clear selection" className="p-0.5 text-slate-400 hover:text-white shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </form>
      )}

      {staticIssues?.length > 0 && (
        <div className="px-3 py-1.5 bg-amber-950/40 border-b border-amber-700/40 text-[11px] text-amber-200 flex gap-1.5 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <div>{staticIssues.slice(0, 3).map((i, n) => <div key={n}>{i.message}</div>)}</div>
        </div>
      )}

      <div className="flex-1 min-h-0 flex justify-center bg-[radial-gradient(circle_at_center,_#0f172a,_#020617)] overflow-auto">
        {doc ? (
          <iframe
            ref={frameRef}
            key={doc.key}
            title="Cybeni preview"
            src={doc.src}
            srcDoc={doc.srcdoc}
            sandbox={doc.sandbox}
            className="h-full bg-white border-x border-slate-800 transition-all"
            style={{ width: WIDTHS[device] }}
          />
        ) : (
          <div className="self-center text-[12px] text-slate-500">{building ? 'Building preview…' : 'Nothing to preview yet.'}</div>
        )}
      </div>

      {dockTab === 'console' && (
        <div className="h-36 shrink-0 border-t border-slate-800 bg-slate-950 flex flex-col">
          <div className="flex items-center px-2 py-0.5 text-[10px] text-slate-500 border-b border-slate-900">
            <span>Preview console</span>
            <button onClick={onClearConsole} className="ml-auto hover:text-white" title="Clear"><Trash2 className="w-3 h-3" /></button>
          </div>
          <div className="flex-1 overflow-y-auto font-mono text-[10.5px] px-2 py-1 space-y-0.5">
            {consoleEntries.length === 0 && <div className="text-slate-600">No output.</div>}
            {consoleEntries.map((e, i) => (
              <div key={i} className={e.level === 'error' ? 'text-rose-300' : e.level === 'warn' ? 'text-amber-300' : 'text-slate-400'}>
                {e.level === 'error' ? '✖ ' : e.level === 'warn' ? '⚠ ' : '› '}{e.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {dockTab === 'data' && (
        <div className="h-48 shrink-0 border-t border-slate-800 bg-slate-950 flex flex-col">
          <div className="flex items-center gap-2 px-2 py-1 text-[10.5px] border-b border-slate-900 bg-slate-900/50">
            <span className="font-semibold text-purple-300">@cybeni/backend</span>
            {tableNames.length > 0 ? (
              <select
                value={resolvedTable}
                onChange={(e) => setActiveTable(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10.5px] text-white"
              >
                {tableNames.map(t => (
                  <option key={t} value={t}>{t} ({(dbState.tables[t] || []).length})</option>
                ))}
              </select>
            ) : (
              <input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Table name"
                className="w-24 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10.5px] text-white"
              />
            )}
            <span className="flex items-center gap-1 text-[10px] text-slate-400">
              <UserCheck className="w-3 h-3 text-emerald-400" />
              {dbState?.currentUser ? `${dbState.currentUser.email} (${dbState.currentUser.role})` : `${(dbState?.users || []).length} user(s)`}
            </span>
            {dbState?.currentUser && (
              <button onClick={() => onDbAdmin?.({ action: 'signout' })} className="text-[10px] text-slate-400 hover:text-white underline">
                Sign out
              </button>
            )}
            <button onClick={onRequestDbSync} title="Refresh backend state" className="ml-auto p-0.5 text-slate-400 hover:text-white">
              <RefreshCw className="w-3 h-3" />
            </button>
            {resolvedTable && (
              <button
                onClick={() => onDbAdmin?.({ action: 'clear', table: resolvedTable })}
                title={`Clear table "${resolvedTable}"`}
                className="text-[10px] text-rose-300 hover:text-rose-200 px-1.5 py-0.5 rounded border border-rose-700/40"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 space-y-1.5 text-[10.5px]">
            <form onSubmit={handleInsertRow} className="flex items-center gap-1.5">
              <input
                value={newRowJson}
                onChange={(e) => setNewRowJson(e.target.value)}
                placeholder='{"title":"New record"}'
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 font-mono text-[10px] text-slate-200"
              />
              <button type="submit" className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-700/60 hover:bg-purple-600/70 text-white text-[10px]">
                <Plus className="w-3 h-3" /> Insert row
              </button>
            </form>
            {rowError && <div className="text-[10px] text-rose-300">{rowError}</div>}
            {!rows.length ? (
              <div className="text-slate-500 py-2">
                No rows in {resolvedTable || newTableName}. Apps using <code className="text-slate-300">import {'{ db, auth, ai }'} from '@cybeni/backend'</code> sync tables and accounts here live.
              </div>
            ) : (
              <div className="space-y-1">
                {rows.map((r, idx) => (
                  <div key={r.id || idx} className="flex items-start gap-2 p-1.5 rounded bg-slate-900/70 border border-slate-800 font-mono text-[10px]">
                    <span className="text-slate-300 break-all flex-1">{JSON.stringify(r)}</span>
                    <button
                      onClick={() => onDbAdmin?.({ action: 'remove', table: resolvedTable, id: r.id })}
                      title="Delete row"
                      className="text-slate-500 hover:text-rose-300 shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {dockTab === 'visual' && (
        <div className="h-40 shrink-0 border-t border-slate-800 bg-slate-950 flex flex-col">
          <div className="flex items-center gap-2 px-2 py-1 text-[10px] text-slate-400 border-b border-slate-900">
            <span>Visual DOM & Layout Audit</span>
            <button onClick={onRefreshAudit} className="ml-auto flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 hover:text-white">
              <RefreshCw className="w-3 h-3" /> Re-scan
            </button>
            {visualIssues.length > 0 && onFixVisualIssues && (
              <button onClick={onFixVisualIssues} className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600/30 border border-amber-500/50 text-amber-200 hover:bg-amber-600/40">
                <Wand2 className="w-3 h-3" /> Auto-Fix
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-1.5 text-[11px] space-y-1">
            {visualIssues.length === 0 ? (
              <div className="text-emerald-400/90 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> No layout overflow, collapsed roots, broken images, or [object Object] renders detected.</div>
            ) : (
              visualIssues.map((v, i) => (
                <div key={i} className="flex items-start gap-2 p-1 rounded bg-amber-950/20 border border-amber-800/40 text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] text-amber-300 mr-1.5">[{v.kind}]</span>
                    <span>{v.message}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {dockTab === 'checks' && (
        <div className="h-44 shrink-0 border-t border-slate-800 bg-slate-950 flex flex-col">
          <div className="flex items-center gap-2 px-2 py-1 text-[10.5px] border-b border-slate-900 bg-slate-900/50">
            <span className="font-semibold text-emerald-300">Project Verification Harness</span>
            <button
              onClick={onRunChecks}
              disabled={checkReport?.running || !onRunChecks}
              className="ml-auto flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-semibold disabled:opacity-40"
            >
              {checkReport?.running ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {checkReport?.running ? 'Running…' : 'Run Static + Runtime + Tests'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2.5 py-1.5 text-[11px] space-y-1.5">
            {!checkReport && (
              <div className="text-slate-500">Click "Run Static + Runtime + Tests" to run Sucrase syntax/import checks, isolated sandbox execution, visual audit, and saved acceptance tests.</div>
            )}
            {checkReport && !checkReport.running && (
              <>
                <div className="flex flex-wrap gap-2 text-[10.5px]">
                  <span className={`px-2 py-0.5 rounded border ${checkReport.staticIssues?.length ? 'border-rose-600/50 text-rose-300' : 'border-emerald-600/40 text-emerald-300'}`}>
                    Static: {checkReport.staticIssues?.length || 0} issue(s)
                  </span>
                  <span className={`px-2 py-0.5 rounded border ${checkReport.runtimeErrors?.length ? 'border-rose-600/50 text-rose-300' : 'border-emerald-600/40 text-emerald-300'}`}>
                    Runtime: {checkReport.runtimeErrors?.length || 0} error(s)
                  </span>
                  <span className={`px-2 py-0.5 rounded border ${checkReport.visualIssues?.length ? 'border-amber-600/50 text-amber-300' : 'border-emerald-600/40 text-emerald-300'}`}>
                    Visual: {checkReport.visualIssues?.length || 0} note(s)
                  </span>
                  {checkReport.nativeResult && !checkReport.nativeResult.skipped && (
                    <span className={`px-2 py-0.5 rounded border ${checkReport.nativeResult.ok ? 'border-emerald-600/40 text-emerald-300' : 'border-rose-600/50 text-rose-300'}`}>
                      Native ({checkReport.nativeResult.lang?.toUpperCase()}): {checkReport.nativeResult.ok ? `OK (${checkReport.nativeResult.compiler})` : `${checkReport.nativeResult.errors?.length || 1} error(s)`}
                    </span>
                  )}
                  {Array.isArray(checkReport.testResults) && checkReport.testResults.length > 0 && (
                    <span className="px-2 py-0.5 rounded border border-cyan-600/40 text-cyan-200">
                      Acceptance: {checkReport.testResults.filter(t => t.passed).length}/{checkReport.testResults.length} pass
                    </span>
                  )}
                </div>
                {checkReport.nativeResult?.errors?.map((err, idx) => (
                  <div key={`ne:${idx}`} className="text-[10.5px] font-mono text-rose-300 bg-rose-950/30 border border-rose-800/40 rounded px-2 py-1">
                    {err}
                  </div>
                ))}
                {checkReport.testResults?.map(t => (
                  <div key={t.id} className="flex items-start gap-1.5 text-[10.5px]">
                    {t.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                    <div>
                      <span className="text-slate-200">{t.id}: {t.name}</span>
                      {!t.passed && t.message && <div className="text-rose-300 text-[10px]">{t.message}</div>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
