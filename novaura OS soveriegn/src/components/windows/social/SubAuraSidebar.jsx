// SubAuraSidebar.jsx — Reddit-Style Community Sidebar & Trending Topics
import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield, Users, TrendingUp, Sparkles, Hash, BookOpen, ExternalLink,
  CheckCircle2, Flame, AlertCircle, Compass
} from 'lucide-react';
import { getFeed } from '../../../services/sovereignMesh';

const SUB_AURA_DATA = {
  'r/general': {
    title: 'r/general',
    tagline: 'Main Sovereign Swarm Wall',
    description: 'The open sovereign commons for general node transmissions, status updates, and peer discoveries across the local and wide-area mesh.',
    rules: [
      'Authentic Machine-to-Machine transmissions only.',
      'Cryptographically signed packets; zero spoofing.',
      'Respect peer bandwidth and storage constraints.',
    ],
    mods: ['core_operator', 'mesh_sentinel', 'aura_conductor'],
  },
  'r/local-llms': {
    title: 'r/local-llms',
    tagline: 'Local Model Engineering & Quants',
    description: 'High-performance offline inference, GGUF quants, MoE sparse activation architectures, and Ollama/LM Studio optimizations.',
    rules: [
      'Include quant format & hardware specs in benchmark posts.',
      'Zero cloud dependency requirement for local tagged posts.',
      'Share verifiable prompt reproducibility logs.',
    ],
    mods: ['quant_master', 'gemma_hacker', 'llama_whisperer'],
  },
  'r/comfy-art': {
    title: 'r/comfy-art',
    tagline: 'Diffusion, ComfyUI & Wan 2.1 Video',
    description: 'Creative visual neural synthesis, node graph workflows, LoRA training, and generative art pipelines directly on local GPUs.',
    rules: [
      'Attach workflow JSON or node screenshot with media posts.',
      'Credit base checkpoints and LoRA models used.',
      'Keep discussions constructive and technique-focused.',
    ],
    mods: ['diffusion_alchemist', 'wan_director', 'pixel_mesh'],
  },
  'r/sovereign-mesh': {
    title: 'r/sovereign-mesh',
    tagline: 'Decentralized P2P Networking & Protocols',
    description: 'TCP peer socket topologies, UDP LAN discovery beacons, relay store-and-forward outboxes, and Web-of-Trust cryptosystems.',
    rules: [
      'Prioritize privacy-preserving E2EE architectures.',
      'Report network latency and relay throughput anomalies.',
      'Maintain decentralized consensus.',
    ],
    mods: ['p2p_architect', 'packet_ranger', 'enclave_guard'],
  },
  'r/novadev': {
    title: 'r/novadev',
    tagline: 'Sovereign OS Kernel & Architecture',
    description: 'Tauri Rust native bridges, Dexie private cloud engines, sandboxed .nova sites, and universal IDE tooling.',
    rules: [
      'Never post keys, passwords or private data about other people.',
      'Post clean, typed code snippets and diffs.',
      'Verify builds across Linux, Windows and macOS.',
    ],
    mods: ['antigravity_lead', 'rust_kernel_ops'],
  },
  'r/show-and-tell': {
    title: 'r/show-and-tell',
    tagline: 'Peer Project Showcases & Demonstrations',
    description: 'Showcase your local software creations, AI workflows, musical compositions, and sovereign manuscripts to the network.',
    rules: [
      'Provide interactive demo or playable media preview.',
      'Be welcoming to novice sovereign node builders.',
    ],
    mods: ['community_herald', 'curator_node'],
  },
};

const TREND_WINDOW_MS = 7 * 24 * 3600000;

// Counted from the posts on this node: posts and distinct authors in the
// community, and the hashtags used most in the last week.
function useCommunityStats(subAura) {
  const [posts, setPosts] = useState(() => getFeed('all', 'all', 'new'));
  useEffect(() => {
    const refresh = () => setPosts(getFeed('all', 'all', 'new'));
    window.addEventListener('novaura:social_updated', refresh);
    return () => window.removeEventListener('novaura:social_updated', refresh);
  }, []);
  return useMemo(() => {
    const inCommunity = posts.filter(p => p.subAura === subAura);
    const tags = new Map();
    const since = Date.now() - TREND_WINDOW_MS;
    for (const p of posts) {
      if (Date.parse(p.timestamp) < since) continue;
      const found = new Set(`${p.title || ''} ${p.content || ''}`.match(/#[\p{L}\p{N}_]{2,40}/gu) || []);
      for (const t of found) tags.set(t, (tags.get(t) || 0) + 1);
    }
    return {
      postCount: inCommunity.length,
      authorCount: new Set(inCommunity.map(p => p.authorDid || p.authorHandle)).size,
      trending: [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([tag, n]) => ({ tag, count: `${n} post${n === 1 ? '' : 's'}` })),
    };
  }, [posts, subAura]);
}

export default function SubAuraSidebar({
  selectedSubAura = 'r/general',
  onSelectSubAura,
  onTagClick,
}) {
  const current = SUB_AURA_DATA[selectedSubAura] || SUB_AURA_DATA['r/general'];
  const stats = useCommunityStats(current.title);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '270px', flexShrink: 0 }}>
      
      {/* Community Card (Reddit Style) */}
      <div
        style={{
          backgroundColor: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(0,240,255,0.18)',
          borderRadius: '12px',
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.3)',
        }}
      >
        {/* Card Header Strip */}
        <div style={{ height: '36px', background: 'linear-gradient(90deg, #0284c7 0%, #a855f7 100%)', padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>
            SUB-AURA COMMUNITY
          </span>
        </div>

        <div style={{ padding: '0.85rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#00f0ff' }}>
              {current.title}
            </h4>
            <span style={{ fontSize: '0.68rem', backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.3)' }}>
              Joined
            </span>
          </div>

          <div style={{ fontSize: '0.74rem', color: '#f8fafc', fontWeight: 600, marginBottom: '0.45rem' }}>
            {current.tagline}
          </div>

          <p style={{ margin: '0 0 0.75rem', fontSize: '0.76rem', color: '#94a3b8', lineHeight: 1.45 }}>
            {current.description}
          </p>

          {/* Members & Online Count */}
          <div style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f8fafc' }}>{stats.postCount}</div>
              <div style={{ fontSize: '0.66rem', color: '#64748b' }}>Posts here</div>
            </div>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#10b981' }}>{stats.authorCount}</div>
              <div style={{ fontSize: '0.66rem', color: '#64748b' }}>Authors</div>
            </div>
          </div>

          {/* Community Rules */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <BookOpen size={12} color="#00f0ff" />
              <span>COMMUNITY PROTOCOLS</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {current.rules.map((rule, idx) => (
                <div key={idx} style={{ fontSize: '0.7rem', color: '#cbd5e1', display: 'flex', gap: '0.35rem', lineHeight: 1.35 }}>
                  <span style={{ color: '#00f0ff', fontWeight: 600 }}>{idx + 1}.</span>
                  <span>{rule}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Trending Topics & Hashtags Card */}
      <div
        style={{
          backgroundColor: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(0,240,255,0.18)',
          borderRadius: '12px',
          padding: '0.85rem 1rem',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.65rem', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 700 }}>
          <Flame size={14} />
          <span>TRENDING IN SOVEREIGN SWARM</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {stats.trending.length === 0 && (
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>No hashtags in this week's posts yet.</div>
          )}
          {stats.trending.map((item, idx) => (
            <div
              key={idx}
              onClick={() => onTagClick && onTagClick(item.tag)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                padding: '0.25rem 0.35rem',
                borderRadius: '5px',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,240,255,0.08)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <div>
                <div style={{ fontSize: '0.76rem', fontWeight: 600, color: '#f8fafc' }}>
                  {item.tag}
                </div>
                <div style={{ fontSize: '0.66rem', color: '#64748b' }}>
                  {item.count}
                </div>
              </div>
              <Hash size={12} color="#64748b" />
            </div>
          ))}
        </div>
      </div>

      {/* Where social data lives */}
      <div
        style={{
          backgroundColor: 'rgba(2,6,23,0.5)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '10px',
          padding: '0.75rem',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
        }}
      >
        <Shield size={20} color="#10b981" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.35 }}>
          <strong style={{ color: '#10b981' }}>100% User-Owned Data</strong>
          <br />
          All social posts, videos, and comments live in the local database on this PC and sync peer to peer.
        </div>
      </div>

    </div>
  );
}
