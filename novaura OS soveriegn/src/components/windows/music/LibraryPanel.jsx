import React, { useEffect, useMemo, useState } from 'react';
import { Play, Heart, MoreHorizontal, Image as ImageIcon, Globe, Download, Trash2, Disc3, Scissors, Loader2, Search, Send, X, Share2 } from 'lucide-react';
import { generateCover, updateTrack, deleteTrack, addToAlbum, publishTrack, unpublishTrack, getBlob } from '../../../services/music/musicStudio.js';
import { buildZip, downloadBytes } from '../../../services/cybeni/projectStore.js';
import { withImageModel } from '../../../services/engines/imageGen.js';
import { getConnectedPeers, sendFileToPeer } from '../../../services/sovereignMesh.js';
import { Cover, fmtTime } from './shared.jsx';

const FILTERS = [['all', 'All'], ['liked', 'Liked'], ['song', 'Songs'], ['instrumental', 'Instrumentals'], ['acapella', 'A cappella'], ['loop', 'Game loops'], ['imported', 'Imported']];
const EXT = { 'audio/flac': 'flac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg', 'audio/opus': 'opus' };

async function trackFile(track) {
  const blob = await getBlob(track.audioBlobId);
  const ext = EXT[track.audioMime] || 'flac';
  return { blob, name: `${track.title.replace(/[^\w\- ]+/g, '').trim() || 'track'}.${ext}` };
}

export async function downloadTrack(track) {
  const { blob, name } = await trackFile(track);
  downloadBytes(name, new Uint8Array(await blob.arrayBuffer()), blob.type || 'audio/flac');
}

/** A shareable pack: audio, cover and a readme with the credits and lyrics. */
export async function downloadSharePack(track) {
  const { blob, name } = await trackFile(track);
  const files = [{ path: name, bytes: new Uint8Array(await blob.arrayBuffer()) }];
  const cover = await getBlob(track.coverBlobId);
  if (cover) files.push({ path: 'cover.png', bytes: new Uint8Array(await cover.arrayBuffer()) });
  files.push({ path: 'README.txt', content: `${track.title}\n${track.spec?.genre || ''} ${track.spec?.era || ''}\nMade with Novaura Sovereign Music Studio (${track.model}).\n\n${track.lyrics && track.lyrics !== '[Instrumental]' ? track.lyrics : ''}` });
  downloadBytes(`${name.replace(/\.\w+$/, '')}.zip`, buildZip(files), 'application/zip');
}

function SendDialog({ track, onClose, say }) {
  const peers = getConnectedPeers();
  const [busy, setBusy] = useState('');
  const send = async (peer) => {
    setBusy(peer.id);
    try {
      const { blob, name } = await trackFile(track);
      const ok = await sendFileToPeer(peer.id, new File([blob], name, { type: blob.type }));
      say(ok ? `Sent "${track.title}" to ${peer.name}.` : `Could not reach ${peer.name}.`, ok ? 'good' : 'bad');
      if (ok) onClose();
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="absolute inset-0 z-40 bg-black/60 flex items-center justify-center" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-80 p-4 rounded-xl bg-zinc-900 border border-white/10">
        <div className="flex items-center text-white font-semibold text-sm">Send to someone on the mesh<button onClick={onClose} className="ml-auto text-white/40"><X className="w-4 h-4" /></button></div>
        <div className="text-[11px] text-white/50 mt-1">Sent directly, peer to peer. Nobody else gets a copy.</div>
        <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
          {peers.length === 0 && <div className="text-[12px] text-white/40">No peers connected right now.</div>}
          {peers.map(p => (
            <button key={p.id} onClick={() => send(p)} disabled={Boolean(busy)} className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-left text-[12px] text-white">
              {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} {p.name || p.id}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrackCard({ track, albums, onPlay, playing, say, onEdit }) {
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState('');
  const [sending, setSending] = useState(false);

  const act = async (label, fn) => {
    setMenu(false);
    setBusy(label);
    try { await fn(); } catch (err) { say(err.message); } finally { setBusy(''); }
  };

  return (
    <div className={`group relative rounded-xl overflow-visible bg-white/[0.03] border ${playing ? 'border-fuchsia-400/60' : 'border-white/5'} hover:border-white/20 transition-colors`}>
      <div className="relative aspect-square rounded-t-xl overflow-hidden">
        <Cover blobId={track.coverBlobId} title={track.title} className="w-full h-full" />
        <button onClick={() => onPlay(track)} className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
          <span className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-5 h-5 ml-0.5" /></span>
        </button>
        {busy && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-[11px] text-white gap-1.5"><Loader2 className="w-4 h-4 animate-spin" />{busy}</div>}
        <span className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white/80">{fmtTime(track.seconds)}</span>
        {track.published ? <span className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-600/80 text-white">Published</span> : null}
      </div>
      <div className="p-2.5">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-white truncate">{track.title}</div>
            <div className="text-[11px] text-white/45 truncate">{track.imported ? ([track.artist, track.album].filter(Boolean).join(' · ') || 'Imported') : `${track.spec?.genre} · ${track.spec?.era}`}{track.spec?.mode && track.spec.mode !== 'song' ? ` · ${track.spec.mode === 'loop' ? 'loop' : track.spec.mode}` : ''}</div>
          </div>
          <button onClick={() => updateTrack(track.id, { liked: track.liked ? 0 : 1 })} className={track.liked ? 'text-fuchsia-400' : 'text-white/30 hover:text-white/70'}><Heart className={`w-4 h-4 ${track.liked ? 'fill-current' : ''}`} /></button>
          <div className="relative">
            <button onClick={() => setMenu(m => !m)} className="text-white/40 hover:text-white"><MoreHorizontal className="w-4 h-4" /></button>
            {menu && (
              <div className="absolute right-0 bottom-6 z-30 w-52 py-1 rounded-lg bg-zinc-900 border border-white/10 shadow-2xl text-[12px] text-white/85" onMouseLeave={() => setMenu(false)}>
                <button onClick={() => act('Painting cover…', () => withImageModel(() => generateCover(track), { onStatus: setBusy }))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10"><ImageIcon className="w-3.5 h-3.5" /> {track.coverBlobId ? 'New cover art' : 'Generate cover art'}</button>
                {albums.length > 0 && (
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-white/35">Add to album</div>
                )}
                {albums.map(a => <button key={a.id} onClick={() => act('Adding…', () => addToAlbum(track.id, a.id))} className="w-full flex items-center gap-2 px-3 py-1 hover:bg-white/10"><Disc3 className="w-3.5 h-3.5" /> {a.title}{track.albumId === a.id ? ' ✓' : ''}</button>)}
                <div className="h-px bg-white/10 my-1" />
                {track.published
                  ? <button onClick={() => act('Unpublishing…', () => unpublishTrack(track))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10"><Globe className="w-3.5 h-3.5" /> Unpublish</button>
                  : <button onClick={() => act('Publishing…', () => publishTrack(track))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10"><Globe className="w-3.5 h-3.5" /> Publish</button>}
                <button onClick={() => { setMenu(false); setSending(true); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10"><Send className="w-3.5 h-3.5" /> Send to a peer</button>
                <button onClick={() => act('Packing…', () => downloadSharePack(track))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10"><Share2 className="w-3.5 h-3.5" /> Download share pack (.zip)</button>
                <button onClick={() => act('Saving…', () => downloadTrack(track))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10"><Download className="w-3.5 h-3.5" /> Download audio</button>
                <button onClick={() => { setMenu(false); onEdit(track); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10"><Scissors className="w-3.5 h-3.5" /> Edit / make loop</button>
                <div className="h-px bg-white/10 my-1" />
                <button onClick={() => { if (window.confirm(`Delete "${track.title}"?`)) act('Deleting…', () => deleteTrack(track.id)); }} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-rose-300"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {sending && <SendDialog track={track} onClose={() => setSending(false)} say={say} />}
    </div>
  );
}

export default function LibraryPanel({ tracks, albums, current, onPlay, say, onEdit, publishedOnly = false }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => tracks.filter(t => {
    if (publishedOnly && !t.published) return false;
    if (filter === 'liked' && !t.liked) return false;
    if (filter === 'imported' && !t.imported) return false;
    if (['song', 'instrumental', 'acapella', 'loop'].includes(filter) && (t.imported || t.spec?.mode !== filter)) return false;
    if (query && !`${t.title} ${t.artist || ''} ${t.album || ''} ${t.spec?.genre} ${t.spec?.description}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [tracks, filter, query, publishedOnly]);

  useEffect(() => { setFilter('all'); }, [publishedOnly]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="text-lg font-bold text-white mr-2">{publishedOnly ? 'Published works' : 'Library'}</div>
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} className={`px-2.5 py-1 rounded-full text-[12px] ${filter === id ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>{label}</button>
        ))}
        <div className="relative ml-auto">
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" className="bg-white/5 border border-white/10 rounded-full pl-8 pr-3 py-1 text-[12px] text-white w-44" />
        </div>
      </div>
      {publishedOnly && <div className="text-[12px] text-white/50 mb-3">Published tracks are listed on the Marketplace and announced to the mesh. Listeners get the audio from you directly when you send it or share the pack.</div>}
      {shown.length === 0 ? (
        <div className="text-center text-white/40 text-[13px] mt-16">{publishedOnly ? 'Nothing published yet. Use a track’s menu to publish it.' : 'No tracks yet. Head to Create.'}</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {shown.map(t => <TrackCard key={t.id} track={t} albums={albums} onPlay={onPlay} playing={current?.id === t.id} say={say} onEdit={onEdit} />)}
        </div>
      )}
    </div>
  );
}
