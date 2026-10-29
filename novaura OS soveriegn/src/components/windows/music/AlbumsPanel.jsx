import React, { useState } from 'react';
import { Plus, Disc3, Image as ImageIcon, Globe, Trash2, Play, Loader2, ArrowLeft, X } from 'lucide-react';
import { createAlbum, updateAlbum, deleteAlbum, generateAlbumCover, publishAlbum, updateTrack } from '../../../services/music/musicStudio.js';
import { Cover, fmtTime } from './shared.jsx';
import { withImageModel } from '../../../services/engines/imageGen.js';

export default function AlbumsPanel({ albums, tracks, onPlay, say }) {
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState('');

  const album = albums.find(a => a.id === openId);
  const albumTracks = (a) => {
    const list = tracks.filter(t => t.albumId === a.id);
    return list.sort((x, y) => a.order.indexOf(x.id) - a.order.indexOf(y.id));
  };
  const act = async (label, fn) => {
    setBusy(label);
    try { await fn(); } catch (err) { say(err.message); } finally { setBusy(''); }
  };

  if (album) {
    const list = albumTracks(album);
    const total = list.reduce((n, t) => n + (t.seconds || 0), 0);
    return (
      <div className="h-full overflow-y-auto p-4">
        <button onClick={() => setOpenId(null)} className="flex items-center gap-1 text-[12px] text-white/50 hover:text-white mb-3"><ArrowLeft className="w-3.5 h-3.5" /> Albums</button>
        <div className="flex gap-4 items-end">
          <div className="relative w-44 h-44 rounded-xl overflow-hidden shadow-2xl shrink-0">
            <Cover blobId={album.coverBlobId || list[0]?.coverBlobId} title={album.title} className="w-full h-full" />
            {busy && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[11px] text-white gap-1.5"><Loader2 className="w-4 h-4 animate-spin" />{busy}</div>}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-white/40">Album{album.published ? ' · published' : ''}</div>
            <input value={album.title} onChange={e => updateAlbum(album.id, { title: e.target.value })} className="block w-full bg-transparent text-3xl font-black text-white focus:outline-none" />
            <textarea value={album.description} onChange={e => updateAlbum(album.id, { description: e.target.value })} rows={2} placeholder="About this album" className="w-full bg-transparent text-[13px] text-white/60 resize-none focus:outline-none" />
            <div className="text-[12px] text-white/40">{list.length} tracks · {fmtTime(total)}</div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => list[0] && onPlay(list[0], list)} disabled={!list.length} className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black text-[12px] font-semibold disabled:opacity-40"><Play className="w-3.5 h-3.5" /> Play</button>
              <button onClick={() => act('Painting cover…', () => withImageModel(() => generateAlbumCover(album), { onStatus: setBusy }))} disabled={!list.length} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 text-white text-[12px] disabled:opacity-40"><ImageIcon className="w-3.5 h-3.5" /> Generate album art</button>
              <button onClick={() => act('Publishing…', () => publishAlbum(album))} disabled={!list.length || album.published} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 text-white text-[12px] disabled:opacity-40"><Globe className="w-3.5 h-3.5" /> {album.published ? 'Published' : 'Publish album'}</button>
              <button onClick={() => { if (window.confirm('Delete this album? Its tracks stay in your library.')) { deleteAlbum(album.id); setOpenId(null); } }} className="p-1.5 rounded-full text-white/40 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
        <div className="mt-5 space-y-1">
          {list.length === 0 && <div className="text-[13px] text-white/40">No tracks yet. Add them from a track’s menu in the Library.</div>}
          {list.map((t, i) => (
            <div key={t.id} className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5">
              <span className="w-5 text-right text-[12px] text-white/40">{i + 1}</span>
              <button onClick={() => onPlay(t, list)} className="text-white/60 hover:text-white"><Play className="w-3.5 h-3.5" /></button>
              <Cover blobId={t.coverBlobId} title={t.title} className="w-9 h-9 rounded" />
              <div className="flex-1 min-w-0"><div className="text-[13px] text-white truncate">{t.title}</div><div className="text-[11px] text-white/40">{t.spec?.genre}</div></div>
              <span className="text-[12px] text-white/40">{fmtTime(t.seconds)}</span>
              <button onClick={() => { updateTrack(t.id, { albumId: null }); updateAlbum(album.id, { order: album.order.filter(x => x !== t.id) }); }} title="Remove from album" className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-rose-300"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center mb-3">
        <div className="text-lg font-bold text-white">Albums</div>
        <button onClick={() => setCreating(true)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-black text-[12px] font-semibold"><Plus className="w-3.5 h-3.5" /> New album</button>
      </div>
      {creating && (
        <form onSubmit={async (e) => { e.preventDefault(); const a = await createAlbum({ title, description }); setCreating(false); setTitle(''); setDescription(''); setOpenId(a.id); }} className="p-3 mb-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Album title" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-[13px] text-white" />
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What it’s about (used for the album art)" className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-[13px] text-white" />
          <div className="flex gap-2"><button className="px-3 py-1.5 rounded-lg bg-fuchsia-600 text-white text-[12px] font-semibold" disabled={!title.trim()}>Create</button><button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 text-[12px] text-white/50">Cancel</button></div>
        </form>
      )}
      {albums.length === 0 && !creating && <div className="text-center text-white/40 text-[13px] mt-16">No albums yet. Group your best tracks into one.</div>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
        {albums.map(a => {
          const list = albumTracks(a);
          return (
            <button key={a.id} onClick={() => setOpenId(a.id)} className="text-left rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/20 overflow-hidden">
              <Cover blobId={a.coverBlobId || list[0]?.coverBlobId} title={a.title} className="w-full aspect-square" />
              <div className="p-2.5"><div className="text-[13px] font-semibold text-white truncate flex items-center gap-1.5"><Disc3 className="w-3.5 h-3.5 text-white/40" />{a.title}</div><div className="text-[11px] text-white/45">{list.length} tracks{a.published ? ' · published' : ''}</div></div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
