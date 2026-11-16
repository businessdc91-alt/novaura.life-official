// MemePanel.jsx — The Meme tab: pick a template, type the captions, add more text.
// Everything is ordinary layers, so captions stay editable and the history covers it all.

import React from 'react';
import { Plus } from 'lucide-react';
import { useStudio } from './useStudio.js';
import TextProperties from './TextProperties.jsx';
import { MEME_TEMPLATES } from './memeTemplates.js';
import { applyMemeTemplate, setMemeText, addMemeText } from '../../../creative/meme.js';

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    {children}
  </section>
);

export default function MemePanel({ store }) {
  useStudio(store, s => s.version);
  const session = store.active();
  if (!session) return null;
  const { doc } = session;
  const meta = { tab: 'meme' };
  const report = (r) => { if (r && !r.ok) store.notify(r.reason); };
  const caption = role => doc.layers.find(l => l.role === role)?.text ?? '';
  const template = doc.layers.find(l => l.role === 'memeTemplate');
  const input = 'w-full bg-slate-950 border border-slate-700 rounded-md px-2 py-1.5 text-xs text-white uppercase select-text';

  return (
    <aside className="w-60 shrink-0 border-r border-slate-800 bg-slate-900/50 p-3 space-y-4 overflow-y-auto" aria-label="Meme tools">
      <Section title="Template">
        <div className="grid grid-cols-2 gap-1.5">
          {MEME_TEMPLATES.map(t => (
            <button
              key={t.id} type="button" data-meme-template={t.id} title={t.name}
              aria-pressed={template?.name === `Template: ${t.name}`}
              onClick={async () => report(await applyMemeTemplate(session, t, meta))}
              className={`rounded-lg overflow-hidden border ${template?.name === `Template: ${t.name}` ? 'border-pink-500' : 'border-slate-700 hover:border-slate-500'}`}
            >
              <img src={t.url} alt={t.name} className="w-full h-14 object-cover" />
            </button>
          ))}
        </div>
      </Section>

      <Section title="Captions">
        <label className="block text-[11px] text-slate-400">
          Top
          <input data-meme-top="" value={caption('memeTop')} placeholder="Top text"
            onChange={e => report(setMemeText(session, 'top', e.target.value, meta))} className={input} />
        </label>
        <label className="block text-[11px] text-slate-400">
          Bottom
          <input data-meme-bottom="" value={caption('memeBottom')} placeholder="Bottom text"
            onChange={e => report(setMemeText(session, 'bottom', e.target.value, meta))} className={input} />
        </label>
        <button type="button" data-action="add-meme-text" onClick={() => report(addMemeText(session, meta))}
          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-[11px] font-semibold">
          <Plus className="w-3.5 h-3.5" /> Add text
        </button>
        <p className="text-[10px] text-slate-500">Captions are text layers: select one to change its font, size or colour.</p>
      </Section>

      <TextProperties store={store} />
    </aside>
  );
}
