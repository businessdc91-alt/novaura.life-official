import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FolderOpen, Package, Boxes, Building2, Droplets,
  Globe, Leaf, Mountain, TreePine, X, Trash2, ExternalLink,
  RefreshCw, LayoutGrid, List, Copy, Check,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  subscribeAssets, uploadAsset, deleteAsset, moveAsset, classifyAsset,
  type Asset, ASSET_CATEGORIES,
} from '../../services/assetService';

// ── Category icon map ────────────────────────────────────────────────
const CAT_ICONS: Record<string, React.ComponentType<any>> = {
  trees:        TreePine,
  shrubs:       Leaf,
  outdoor:      Mountain,
  structures:   Building2,
  frameworks:   Boxes,
  water:        Droplets,
  terraforming: Globe,
  misc:         Package,
};

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/avif',
]);

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Upload queue item ────────────────────────────────────────────────
interface UploadItem {
  id: string;
  file: File;
  category: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

// ── Asset thumbnail card ─────────────────────────────────────────────
function AssetCard({
  asset, isSelected, onSelect, onDelete, onOpen,
}: {
  asset: Asset;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const isImg = IMAGE_TYPES.has(asset.contentType);
  const cat = ASSET_CATEGORIES.find(c => c.id === asset.category);
  const CatIcon = CAT_ICONS[asset.category] || Package;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.93 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.93 }}
      onClick={onSelect}
      className={`group cursor-pointer rounded-xl overflow-hidden border transition-all bg-void-light ${
        isSelected
          ? 'border-neon-cyan/40 shadow-[0_0_12px_rgba(0,240,255,0.1)]'
          : 'border-white/5 hover:border-white/15'
      }`}
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-void-lighter relative overflow-hidden">
        {isImg
          ? <img src={asset.storageUrl} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
              <CatIcon className="w-9 h-9 opacity-40" style={{ color: cat?.color }} />
              <span className="text-[10px] font-mono text-white/30 uppercase">{asset.fileName.split('.').pop()}</span>
            </div>
        }

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={e => { e.stopPropagation(); onOpen(); }}
            className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="Open file">
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="w-8 h-8 rounded-xl bg-red-500/20 backdrop-blur-sm flex items-center justify-center text-red-400 hover:bg-red-500/35 transition-colors"
            title="Delete">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Category badge */}
        <span className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-md font-semibold"
          style={{ background: `${cat?.color || '#64748b'}30`, color: cat?.color || '#94a3b8' }}>
          {cat?.label || asset.category}
        </span>
      </div>

      {/* Name + meta */}
      <div className="px-2.5 py-2">
        <p className="text-white/80 text-xs font-medium truncate">{asset.name}</p>
        <p className="text-white/25 text-[10px]">{fmtSize(asset.size)}</p>
      </div>
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function AssetManager() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // All assets for sidebar counts
  useEffect(() => subscribeAssets(null, setAllAssets), []);

  // Filtered view
  useEffect(() => subscribeAssets(activeCategory, setAssets), [activeCategory]);

  const categoryCounts = Object.fromEntries(
    ASSET_CATEGORIES.map(c => [c.id, allAssets.filter(a => a.category === c.id).length])
  );

  // Keep selected asset in sync
  useEffect(() => {
    if (selectedAsset) {
      const updated = assets.find(a => a.id === selectedAsset.id);
      setSelectedAsset(updated || null);
    }
  }, [assets]);

  const handleFiles = useCallback(async (files: File[]) => {
    const items: UploadItem[] = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      category: classifyAsset(f.name),
      progress: 0,
      status: 'pending',
    }));

    setUploads(prev => [...prev, ...items]);

    for (const item of items) {
      setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'uploading' } : u));
      try {
        await uploadAsset(item.file, item.category, pct => {
          setUploads(prev => prev.map(u => u.id === item.id ? { ...u, progress: pct } : u));
        });
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'done', progress: 100 } : u));
      } catch (e: any) {
        setUploads(prev => prev.map(u => u.id === item.id ? { ...u, status: 'error', error: e.message } : u));
      }
    }
    setTimeout(() => setUploads(prev => prev.filter(u => u.status !== 'done')), 3000);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFiles(files);
  }, [handleFiles]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length) handleFiles(files);
    e.target.value = '';
  };

  const handleDelete = async (asset: Asset) => {
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    await deleteAsset(asset);
    if (selectedAsset?.id === asset.id) setSelectedAsset(null);
  };

  const handleMove = async (asset: Asset, newCat: string) => {
    await moveAsset(asset.id, newCat);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="h-full flex overflow-hidden"
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={onDrop}
    >
      {/* ── Sidebar ── */}
      <aside className="w-52 flex-shrink-0 bg-void-light border-r border-white/5 flex flex-col overflow-y-auto">
        <div className="px-4 py-4 border-b border-white/5 flex-shrink-0">
          <h1 className="text-white font-black text-sm">Asset Library</h1>
          <p className="text-white/30 text-xs mt-0.5">{allAssets.length} files total</p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {/* All */}
          <button onClick={() => setActiveCategory(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
              activeCategory === null ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
            }`}>
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left text-xs">All Assets</span>
            <span className="text-white/30 text-xs">{allAssets.length}</span>
          </button>

          <div className="border-t border-white/5 my-2" />

          {ASSET_CATEGORIES.map(cat => {
            const Icon = CAT_ICONS[cat.id] || Package;
            const count = categoryCounts[cat.id] || 0;
            const isActive = activeCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all ${
                  isActive ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}>
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: isActive ? cat.color : undefined }} />
                <span className="flex-1 text-left text-xs">{cat.label}</span>
                {count > 0 && <span className="text-white/25 text-xs">{count}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex-shrink-0 px-5 py-3.5 border-b border-white/5 flex items-center gap-3">
          {(() => {
            const cat = activeCategory ? ASSET_CATEGORIES.find(c => c.id === activeCategory) : null;
            const Icon = activeCategory ? (CAT_ICONS[activeCategory] || Package) : FolderOpen;
            return (
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" style={{ color: cat?.color }} />
                <h2 className="text-white font-bold text-sm">{cat?.label ?? 'All Assets'}</h2>
                <span className="text-white/30 text-xs">({assets.length})</span>
              </div>
            );
          })()}

          <button onClick={() => fileInputRef.current?.click()}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-semibold hover:bg-neon-cyan/20 transition-all">
            <Upload className="w-4 h-4" /> Upload Files
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileInput} />
        </div>

        {/* Upload progress bar */}
        <AnimatePresence>
          {uploads.length > 0 && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
              className="flex-shrink-0 border-b border-white/5 overflow-hidden">
              <div className="px-5 py-2.5 space-y-2">
                {uploads.map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <span className="text-white/60 text-xs truncate flex-1 max-w-xs">{u.file.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-white/40 flex-shrink-0">{u.category}</span>
                    <div className="w-28 h-1.5 bg-void-lighter rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${u.progress}%`,
                          background: u.status === 'error' ? '#ef4444' : u.status === 'done' ? '#22c55e' : '#00f0ff',
                        }} />
                    </div>
                    <span className="text-[10px] w-8 text-right flex-shrink-0"
                      style={{ color: u.status === 'error' ? '#ef4444' : u.status === 'done' ? '#22c55e' : '#00f0ff' }}>
                      {u.status === 'error' ? 'ERR' : u.status === 'done' ? '✓' : `${u.progress}%`}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid + detail panel */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Drag overlay */}
          <AnimatePresence>
            {dragging && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 bg-neon-cyan/5 border-2 border-dashed border-neon-cyan/40 rounded-xl m-3 flex flex-col items-center justify-center pointer-events-none">
                <Upload className="w-10 h-10 text-neon-cyan/50 mb-3" />
                <p className="text-neon-cyan/80 font-semibold">Drop files to upload</p>
                <p className="text-neon-cyan/40 text-sm mt-1">Auto-sorted by filename keywords</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Asset grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {assets.length === 0 && !dragging && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-2xl bg-void-lighter border border-white/10 flex items-center justify-center mb-4">
                  <Upload className="w-7 h-7 text-white/20" />
                </div>
                <p className="text-white/40 font-semibold mb-1">No assets here</p>
                <p className="text-white/20 text-sm">Upload files or drag & drop</p>
                <button onClick={() => fileInputRef.current?.click()}
                  className="mt-4 px-5 py-2 rounded-xl bg-void-lighter border border-white/10 text-white/50 text-sm hover:border-white/20 hover:text-white/70 transition-all">
                  Browse files
                </button>
              </div>
            )}

            {assets.length > 0 && (
              <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                <AnimatePresence>
                  {assets.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedAsset?.id === asset.id}
                      onSelect={() => setSelectedAsset(selectedAsset?.id === asset.id ? null : asset)}
                      onDelete={() => handleDelete(asset)}
                      onOpen={() => window.open(asset.storageUrl, '_blank')}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Detail panel */}
          <AnimatePresence>
            {selectedAsset && (
              <motion.aside
                initial={{ x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 320, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                className="w-72 flex-shrink-0 bg-void-light border-l border-white/5 flex flex-col overflow-y-auto"
              >
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 flex-shrink-0">
                  <span className="text-white/60 text-xs font-semibold truncate flex-1">{selectedAsset.name}</span>
                  <button onClick={() => setSelectedAsset(null)} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Preview */}
                  {IMAGE_TYPES.has(selectedAsset.contentType)
                    ? <img src={selectedAsset.storageUrl} alt={selectedAsset.name}
                        className="w-full rounded-xl border border-white/10 object-contain max-h-44 bg-void-lighter" />
                    : (() => {
                        const Icon = CAT_ICONS[selectedAsset.category] || Package;
                        const cat = ASSET_CATEGORIES.find(c => c.id === selectedAsset.category);
                        return (
                          <div className="w-full h-32 rounded-xl border border-white/10 bg-void-lighter flex flex-col items-center justify-center gap-2">
                            <Icon className="w-10 h-10 opacity-50" style={{ color: cat?.color }} />
                            <span className="text-white/30 text-xs font-mono uppercase">{selectedAsset.fileName.split('.').pop()}</span>
                          </div>
                        );
                      })()
                  }

                  {/* Metadata */}
                  <div className="space-y-2 text-xs">
                    {[
                      { label: 'File', value: selectedAsset.fileName },
                      { label: 'Size', value: fmtSize(selectedAsset.size) },
                      { label: 'Type', value: selectedAsset.contentType || '—' },
                      { label: 'By', value: selectedAsset.uploaderName },
                      { label: 'Date', value: selectedAsset.uploadedAt ? format(selectedAsset.uploadedAt.toDate(), 'MMM d, yyyy') : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-2">
                        <span className="text-white/30 w-8 flex-shrink-0">{label}</span>
                        <span className="text-white/60 font-mono truncate">{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Copy URL */}
                  <div>
                    <p className="text-white/30 text-xs mb-1.5">Storage URL</p>
                    <button onClick={() => copyUrl(selectedAsset.storageUrl)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-void-lighter border border-white/10 text-white/50 text-xs hover:border-white/20 transition-all text-left">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 flex-shrink-0" />}
                      <span className="font-mono truncate">{copied ? 'Copied!' : 'Copy URL'}</span>
                    </button>
                  </div>

                  {/* Move category */}
                  <div>
                    <p className="text-white/30 text-xs mb-1.5">Category</p>
                    <select value={selectedAsset.category}
                      onChange={e => handleMove(selectedAsset, e.target.value)}
                      className="w-full bg-void-lighter border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none">
                      {ASSET_CATEGORIES.map(cat => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                    </select>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <a href={selectedAsset.storageUrl} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-xs font-semibold hover:bg-neon-cyan/20 transition-all">
                      <ExternalLink className="w-3.5 h-3.5" /> Open
                    </a>
                    <button onClick={() => handleDelete(selectedAsset)}
                      className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
