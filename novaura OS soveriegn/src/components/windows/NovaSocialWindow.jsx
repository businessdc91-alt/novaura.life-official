// NovaSocialWindow.jsx — Master Sovereign Social Network (Facebook + Reddit + YouTube Hybrid)
// 100% Peer-to-Peer, Air-Gapped Local Dexie Storage, Ephemeral 24h Stories, Multi-Tier Reddit Trees & AuraTube Media
import React, { useState, useEffect } from 'react';
import {
  Users, Video, TrendingUp, Compass, PlusCircle, Sparkles, Send, Eye, X,
  Globe, RefreshCw, Film, Flame, Clock, Award, Search, Hash, Shield, Layers
} from 'lucide-react';
import {
  getSocialProfile, getFeed, requestRoomSocialSync, getPeerCount
} from '../../services/sovereignMesh';
import StoriesBar from './social/StoriesBar';
import FeedPostCard from './social/FeedPostCard';
import CreateSocialPostModal from './social/CreateSocialPostModal';
import SocialProfileModal from './social/SocialProfileModal';
import AuraShortsModal from './social/AuraShortsModal';
import SubAuraSidebar from './social/SubAuraSidebar';

export default function NovaSocialWindow({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [feed, setFeed] = useState([]);
  const [peerCount, setPeerCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Navigation & Filter State
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'wall', 'video', 'reddit', 'shorts'
  const [selectedSubAura, setSelectedSubAura] = useState('all');
  const [sortBy, setSortBy] = useState('hot'); // 'hot', 'new', 'top', 'rising'
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProfileHandle, setSelectedProfileHandle] = useState(null);
  const [showShortsModal, setShowShortsModal] = useState(false);
  const [shortsIndex, setShortsIndex] = useState(0);

  const refreshData = () => {
    setProfile(getSocialProfile());
    setFeed(getFeed(selectedSubAura, activeTab, sortBy, searchQuery));
  };

  useEffect(() => {
    refreshData();
    setPeerCount(getPeerCount());

    const handleUpdate = () => {
      refreshData();
      setPeerCount(getPeerCount());
    };

    window.addEventListener('novaura:social_updated', handleUpdate);
    window.addEventListener('novaura:mesh_updated', handleUpdate);
    window.addEventListener('novaura:stories_updated', handleUpdate);
    window.addEventListener('novaura:social_profile_updated', handleUpdate);
    window.addEventListener('novaura:peer_discovered', handleUpdate);
    window.addEventListener('novaura:peer_lost', handleUpdate);

    return () => {
      window.removeEventListener('novaura:social_updated', handleUpdate);
      window.removeEventListener('novaura:mesh_updated', handleUpdate);
      window.removeEventListener('novaura:stories_updated', handleUpdate);
      window.removeEventListener('novaura:social_profile_updated', handleUpdate);
      window.removeEventListener('novaura:peer_discovered', handleUpdate);
      window.removeEventListener('novaura:peer_lost', handleUpdate);
    };
  }, [activeTab, selectedSubAura, sortBy, searchQuery]);

  const subAuras = [
    { id: 'all', label: 'All Sub-Auras' },
    { id: 'r/general', label: 'r/general (The Main Swarm)' },
    { id: 'r/local-llms', label: 'r/local-llms (Weights & Quants)' },
    { id: 'r/comfy-art', label: 'r/comfy-art (Diffusion & Video)' },
    { id: 'r/sovereign-mesh', label: 'r/sovereign-mesh (P2P Protocols)' },
    { id: 'r/novadev', label: 'r/novadev (Engineering & Kernel)' },
    { id: 'r/show-and-tell', label: 'r/show-and-tell (Showcase & Demos)' },
  ];

  const handleOpenShorts = (index = 0) => {
    setShortsIndex(index);
    setShowShortsModal(true);
  };

  const videoShorts = feed.filter(p => p.type === 'video' && (p.isShort || (p.videoDuration && p.videoDuration.startsWith('00:'))));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#090e1f',
        color: '#e2e8f0',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── Top Header & Profile Banner ── */}
      <div
        style={{
          padding: '0.75rem 1.25rem',
          backgroundColor: 'rgba(15,23,42,0.92)',
          borderBottom: '1px solid rgba(0,240,255,0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(12px)',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {/* User Profile Pill */}
        <div
          onClick={() => setSelectedProfileHandle(profile?.handle)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', cursor: 'pointer' }}
          title="Click to view sovereign profile dossier"
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: profile?.avatarColor || '#00f0ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.15rem',
              color: '#000',
              boxShadow: '0 0 12px rgba(0,240,255,0.4)',
              position: 'relative',
            }}
          >
            {profile?.displayName?.[0] || 'O'}
            <div
              style={{
                position: 'absolute',
                bottom: '-1px',
                right: '-1px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                border: '2px solid #0f172a',
              }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f8fafc' }}>
                {profile?.displayName || 'Sovereign Operator'}
              </span>
              <span style={{ fontSize: '0.76rem', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>
                @{profile?.handle || 'operator'}.nova
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  backgroundColor: 'rgba(245,158,11,0.18)',
                  color: '#f59e0b',
                  padding: '0.12rem 0.45rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(245,158,11,0.3)',
                  fontWeight: 600,
                }}
              >
                {profile?.karma || 420} Karma
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
              {profile?.bio || 'Local Node Sovereign Operator'}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ flex: '1 1 240px', maxWidth: '380px', position: 'relative' }}>
          <Search size={15} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search sovereign posts, titles, tags, @handles..."
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.2rem',
              backgroundColor: 'rgba(2,6,23,0.7)',
              border: '1px solid rgba(0,240,255,0.2)',
              borderRadius: '20px',
              color: '#f8fafc',
              fontSize: '0.78rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Right Controls: Swarm Room & Create Post Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          
          {/* Swarm Room Badge & Sync */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: 'rgba(6,182,212,0.1)',
              border: '1px solid rgba(6,182,212,0.3)',
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <Globe size={14} color="#22d3ee" />
            <span style={{ color: '#22d3ee', fontWeight: 600 }}>SWARM #general</span>
            <span style={{ color: '#94a3b8' }}>• {peerCount} peers</span>
            <button
              onClick={() => {
                setIsSyncing(true);
                requestRoomSocialSync();
                setTimeout(() => setIsSyncing(false), 1400);
              }}
              title="Sync latest posts & stories from connected swarm peers"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.1rem',
                color: isSyncing ? '#22d3ee' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                marginLeft: '0.2rem',
              }}
            >
              <RefreshCw size={13} style={{ transform: isSyncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }} />
            </button>
          </div>

          {/* Create Post / Video Publisher Button */}
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: '0 0 15px rgba(2,132,199,0.4)',
            }}
          >
            <PlusCircle size={16} />
            <span>Create Transmission</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.3rem' }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ── Secondary Navigation Bar (Tabs, Sort & Sub-Aura Filter) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1.25rem',
          backgroundColor: 'rgba(11,19,43,0.7)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        {/* Main Pillar Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'All Feeds', icon: Compass },
            { id: 'wall', label: 'The Wall (FB)', icon: Users },
            { id: 'video', label: 'AuraTube (YT)', icon: Video },
            { id: 'reddit', label: 'Sub-Auras (Reddit)', icon: TrendingUp },
            { id: 'shorts', label: 'AuraShorts (Reels)', icon: Film },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'shorts') {
                  handleOpenShorts(0);
                } else {
                  setActiveTab(tab.id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.8rem',
                borderRadius: '6px',
                border: activeTab === tab.id ? '1px solid rgba(0,240,255,0.45)' : '1px solid transparent',
                backgroundColor: activeTab === tab.id ? 'rgba(0,240,255,0.12)' : 'transparent',
                color: activeTab === tab.id ? '#00f0ff' : '#94a3b8',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Right Side: Sorting Filter (Hot / New / Top / Rising) + Sub-Aura Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          
          {/* Sorting Buttons */}
          <div style={{ display: 'flex', backgroundColor: 'rgba(2,6,23,0.7)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              { id: 'hot', label: 'Hot', icon: Flame },
              { id: 'new', label: 'New', icon: Clock },
              { id: 'top', label: 'Top', icon: Award },
              { id: 'rising', label: 'Rising', icon: TrendingUp },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => setSortBy(s.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.55rem',
                  borderRadius: '4px',
                  border: 'none',
                  backgroundColor: sortBy === s.id ? 'rgba(0,240,255,0.2)' : 'transparent',
                  color: sortBy === s.id ? '#00f0ff' : '#64748b',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <s.icon size={12} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>

          {/* Sub-Aura Dropdown Filter */}
          <select
            value={selectedSubAura}
            onChange={e => setSelectedSubAura(e.target.value)}
            style={{
              padding: '0.35rem 0.65rem',
              backgroundColor: 'rgba(2,6,23,0.85)',
              border: '1px solid rgba(0,240,255,0.25)',
              borderRadius: '6px',
              color: '#e2e8f0',
              fontSize: '0.76rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {subAuras.map(sa => (
              <option key={sa.id} value={sa.id}>{sa.label}</option>
            ))}
          </select>

        </div>
      </div>

      {/* ── Main Scrollable Body (Stories + Feed Stream + SubAura Sidebar) ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '1.5rem', width: '100%', maxWidth: '1040px' }}>
          
          {/* Main Feed Column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            
            {/* Top 24-Hour Stories Carousel (Facebook / Instagram on Mesh) */}
            {(activeTab === 'all' || activeTab === 'wall') && (
              <StoriesBar />
            )}

            {/* Posts Stream */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {feed.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '4rem 1rem',
                    backgroundColor: 'rgba(15,23,42,0.4)',
                    borderRadius: '12px',
                    border: '1px dashed rgba(255,255,255,0.1)',
                  }}
                >
                  <Users size={42} style={{ margin: '0 auto 0.75rem', opacity: 0.35, color: '#00f0ff' }} />
                  <div style={{ fontSize: '0.96rem', fontWeight: 600, color: '#f8fafc' }}>
                    No sovereign mesh transmissions found.
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.35rem', maxWidth: '380px', margin: '0.35rem auto 1rem' }}>
                    {searchQuery ? `No posts matched "${searchQuery}".` : 'Be the first node operator to broadcast a Wall post, Reddit discussion, or AuraTube video!'}
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                      padding: '0.5rem 1.25rem',
                      backgroundColor: '#0284c7',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Broadcast New Post
                  </button>
                </div>
              ) : (
                feed.map(post => (
                  <FeedPostCard
                    key={post.id}
                    post={post}
                    onRefresh={refreshData}
                    onOpenProfile={handle => setSelectedProfileHandle(handle)}
                    onOpenShorts={() => handleOpenShorts(0)}
                  />
                ))
              )}
            </div>

          </div>

          {/* Right Community & Trending Sidebar */}
          <SubAuraSidebar
            selectedSubAura={selectedSubAura === 'all' ? 'r/general' : selectedSubAura}
            onSelectSubAura={sa => setSelectedSubAura(sa)}
            onTagClick={tag => setSearchQuery(tag)}
          />

        </div>
      </div>

      {/* ── Integrated Modals ── */}

      {/* Creator Studio Publisher Modal */}
      {showCreateModal && (
        <CreateSocialPostModal
          onClose={() => setShowCreateModal(false)}
          onCreated={refreshData}
        />
      )}

      {/* User Profile Dossier Modal */}
      {selectedProfileHandle && (
        <SocialProfileModal
          handle={selectedProfileHandle}
          onClose={() => setSelectedProfileHandle(null)}
        />
      )}

      {/* AuraShorts 9:16 Vertical Reel Player Modal */}
      {showShortsModal && (
        <AuraShortsModal
          shorts={videoShorts.length > 0 ? videoShorts : feed.filter(p => p.type === 'video')}
          initialIndex={shortsIndex}
          onClose={() => setShowShortsModal(false)}
        />
      )}

    </div>
  );
}
