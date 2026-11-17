import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Code2, ShieldCheck } from 'lucide-react';
import { loadProjectFiles } from '../../services/cybeni/projectStore.js';
import { publishPreview, clearPreview, newSessionId } from '../../services/cybeni/previewHost.js';

/**
 * A user's own app (built in Cybeni or rebranded in the Forge), running in the
 * same isolated sandbox as Cybeni previews: separate origin, no access to the
 * OS's data or commands.
 */
export default function UserAppWindow({ slug, name }) {
  const session = useRef(newSessionId());
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const files = await loadProjectFiles(slug);
      if (!files.length) throw new Error('This app has no files any more. It may have been deleted in Cybeni.');
      setDoc({ ...(await publishPreview(session.current, files, { appId: slug })), key: Date.now() });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [slug]);

  useEffect(() => {
    load();
    const s = session.current;
    return () => { clearPreview(s); };
  }, [load]);

  const openInCybeni = () => {
    window.dispatchEvent(new CustomEvent('novaura-open-window', { detail: { appId: 'cybeni', props: { project: slug } } }));
    window.dispatchEvent(new CustomEvent('novaura:cybeni_open_project', { detail: slug }));
  };

  return (
    <div className="relative h-full bg-white">
      {doc && <iframe key={doc.key} title={name || slug} src={doc.src} srcDoc={doc.srcdoc} sandbox={doc.sandbox} className="w-full h-full border-0" />}
      {error && <div className="absolute inset-0 flex items-center justify-center bg-slate-950 text-rose-300 text-[13px] p-6 text-center">{error}</div>}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-30 hover:opacity-100 transition-opacity">
        <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900/90 text-[10px] text-emerald-300" title="Runs isolated from the OS"><ShieldCheck className="w-3 h-3" /> Sandboxed</span>
        <button onClick={load} title="Reload" className="p-1.5 rounded-md bg-slate-900/90 text-slate-300 hover:text-white"><RefreshCw className="w-3.5 h-3.5" /></button>
        <button onClick={openInCybeni} title="Change this app with Cybeni" className="p-1.5 rounded-md bg-slate-900/90 text-slate-300 hover:text-white"><Code2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
