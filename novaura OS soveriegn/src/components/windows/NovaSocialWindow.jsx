// NovaSocialWindow.jsx — Facebook meets YouTube meets Reddit on the Sovereign Mesh
import React, { useState, useEffect } from 'react';
import {
  Users, ThumbsUp, ThumbsDown, MessageSquare, Play, Video, Share2,
  TrendingUp, Compass, PlusCircle, Sparkles, Send, Eye, X, CornerDownRight,
  Globe, RefreshCw
} from 'lucide-react';
import {
  getSocialProfile, updateSocialProfile, getFeed, createPost, votePost, addComment,
  requestRoomSocialSync, getPeerCount
} from '../../services/sovereignMesh';

export default function NovaSocialWindow({ onClose }) {
  const [profile, setProfile] = useState(null);
  const [feed, setFeed] = useState([]);
  const [peerCount, setPeerCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'wall', 'video', 'reddit'
  const [selectedSubAura, setSelectedSubAura] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentInput, setCommentInput] = useState('');

  // Create post form state
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState('wall'); // 'wall', 'video', 'reddit'
  const [newSubAura, setNewSubAura] = useState('r/general');
  const [newMediaUrl, setNewMediaUrl] = useState('');
  const [newDuration, setNewDuration] = useState('04:20');

  useEffect(() => {
    refreshData();
    setPeerCount(getPeerCount());

    const handleUpdate = () => {
      refreshData();
      setPeerCount(getPeerCount());
    };

    window.addEventListener('novaura:social_updated', handleUpdate);
    window.addEventListener('novaura:mesh_updated', handleUpdate);
    window.addEventListener('novaura:peer_discovered', handleUpdate);
    window.addEventListener('novaura:peer_lost', handleUpdate);

    return () => {
      window.removeEventListener('novaura:social_updated', handleUpdate);
      window.removeEventListener('novaura:mesh_updated', handleUpdate);
      window.removeEventListener('novaura:peer_discovered', handleUpdate);
      window.removeEventListener('novaura:peer_lost', handleUpdate);
    };
  }, [activeTab, selectedSubAura]);

  const refreshData = () => {
    setProfile(getSocialProfile());
    setFeed(getFeed(selectedSubAura, activeTab));
  };

  const handleVote = (postId, direction) => {
    votePost(postId, direction);
    refreshData();
  };

  const handleAddComment = (postId) => {
    if (!commentInput.trim()) return;
    addComment(postId, commentInput);
    setCommentInput('');
    refreshData();
  };

  const handleCreatePost = (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    createPost({
      title: newTitle,
      content: newContent,
      type: newType,
      subAura: newSubAura,
      mediaUrl: newMediaUrl || null,
      videoDuration: newType === 'video' ? newDuration : null,
    });
    setNewTitle('');
    setNewContent('');
    setNewMediaUrl('');
    setShowCreateModal(false);
    refreshData();
  };

  const subAuras = [
    { id: 'all', label: 'All Sub-Auras' },
    { id: 'r/local-llms', label: 'r/local-llms' },
    { id: 'r/comfy-art', label: 'r/comfy-art' },
    { id: 'r/sovereign-mesh', label: 'r/sovereign-mesh' },
    { id: 'r/general', label: 'r/general' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#090e1f', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>

      {/* Top App Header & Profile Banner */}
      <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'rgba(15,23,42,0.85)', borderBottom: '1px solid rgba(0,240,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(10px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: profile?.avatarColor || '#00f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '1.1rem', color: '#000', boxShadow: '0 0 10px rgba(0,240,255,0.4)' }}>
            {profile?.displayName?.[0] || 'O'}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>{profile?.displayName || 'Operator'}</span>
              <span style={{ fontSize: '0.78rem', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>@{profile?.handle}.nova</span>
              <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(168,85,247,0.2)', color: '#c084fc', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid rgba(168,85,247,0.3)' }}>{profile?.karma || 0} Karma</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>{profile?.bio || 'Sovereign Node Operator'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Swarm Room Badge & Sync */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
            <Globe size={14} color="#22d3ee" />
            <span style={{ color: '#22d3ee', fontWeight: 600 }}>SWARM #general</span>
            <span style={{ color: '#94a3b8' }}>• {peerCount} online</span>
            <button
              onClick={() => {
                setIsSyncing(true);
                requestRoomSocialSync();
                setTimeout(() => setIsSyncing(false), 1200);
              }}
              title="Sync latest posts from connected swarm peers"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', color: isSyncing ? '#22d3ee' : '#94a3b8', display: 'flex', alignItems: 'center', marginLeft: '0.2rem' }}
            >
              <RefreshCw size={13} style={{ transform: isSyncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }} />
            </button>
          </div>

          <button onClick={() => setShowCreateModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}>
            <PlusCircle size={15} />
            <span>Create Post / Video</span>
          </button>
          {onClose && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0.3rem' }}>
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Bar (Tabs: All / Wall / AuraTube / Sub-Auras) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1.25rem', backgroundColor: 'rgba(11,19,43,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { id: 'all', label: 'All Feeds', icon: Compass },
            { id: 'wall', label: 'The Wall (FB)', icon: Users },
            { id: 'video', label: 'AuraTube (YT)', icon: Video },
            { id: 'reddit', label: 'Sub-Auras (Reddit)', icon: TrendingUp },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderRadius: '6px', border: activeTab === tab.id ? '1px solid rgba(0,240,255,0.4)' : '1px solid transparent', backgroundColor: activeTab === tab.id ? 'rgba(0,240,255,0.1)' : 'transparent', color: activeTab === tab.id ? '#00f0ff' : '#94a3b8', fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.15s' }}>
              <tab.icon size={14} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Sub-Aura Channel Filter */}
        <select value={selectedSubAura} onChange={e => setSelectedSubAura(e.target.value)} style={{ padding: '0.3rem 0.6rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#94a3b8', fontSize: '0.76rem', outline: 'none' }}>
          {subAuras.map(sa => (
            <option key={sa.id} value={sa.id}>{sa.label}</option>
          ))}
        </select>
      </div>

      {/* Feed List Container */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {feed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
            <Users size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <div style={{ fontSize: '0.9rem' }}>No sovereign mesh transmissions in this filter.</div>
            <div style={{ fontSize: '0.76rem', marginTop: '0.25rem' }}>Be the first to publish a post or video to your local peers!</div>
          </div>
        ) : (
          feed.map(post => (
            <div key={post.id} style={{ backgroundColor: 'rgba(15,23,42,0.65)', border: '1px solid rgba(0,240,255,0.12)', borderRadius: '10px', padding: '1rem 1.25rem', backdropFilter: 'blur(8px)', transition: 'border-color 0.15s' }}>
              
              {/* Post Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: post.authorColor || '#00f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#000' }}>
                    {post.authorName?.[0] || 'U'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.86rem', color: '#f1f5f9' }}>{post.authorName}</span>
                      <span style={{ fontSize: '0.72rem', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>@{post.authorHandle}.nova</span>
                      <span style={{ fontSize: '0.7rem', color: '#a855f7', backgroundColor: 'rgba(168,85,247,0.15)', padding: '0.1rem 0.35rem', borderRadius: '4px' }}>{post.subAura}</span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Mesh Node Verified</div>
                  </div>
                </div>

                {/* Post Type Badge */}
                <div style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em', backgroundColor: post.type === 'video' ? 'rgba(236,72,153,0.15)' : post.type === 'reddit' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)', color: post.type === 'video' ? '#ec4899' : post.type === 'reddit' ? '#f59e0b' : '#60a5fa', border: `1px solid ${post.type === 'video' ? 'rgba(236,72,153,0.3)' : post.type === 'reddit' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'}` }}>
                  {post.type === 'video' ? 'AuraTube Video' : post.type === 'reddit' ? 'Discussion Thread' : 'Wall Post'}
                </div>
              </div>

              {/* Title if present (Reddit / Video style) */}
              {post.title && (
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.96rem', fontWeight: 600, color: '#f8fafc' }}>
                  {post.title}
                </h4>
              )}

              {/* Body Content */}
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.84rem', color: '#cbd5e1', lineHeight: '1.55', whiteWrap: 'pre-wrap' }}>
                {post.content}
              </p>

              {/* Video Player if Video type */}
              {post.type === 'video' && (
                <div style={{ position: 'relative', width: '100%', height: '220px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#020617', marginBottom: '0.75rem', border: '1px solid rgba(236,72,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {post.thumbnail || post.mediaUrl ? (
                    <img src={post.thumbnail || post.mediaUrl} alt="Video thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at center, rgba(236,72,153,0.15) 0%, rgba(2,6,23,0.95) 75%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <Video size={36} color="#ec4899" style={{ opacity: 0.7 }} />
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>SOVEREIGN MEDIA BUFFER</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'rgba(236,72,153,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 20px rgba(236,72,153,0.6)' }}>
                      <Play size={24} color="#fff" style={{ marginLeft: '3px' }} />
                    </div>
                  </div>
                  {post.videoDuration && (
                    <div style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', fontSize: '0.72rem', padding: '0.15rem 0.4rem', borderRadius: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                      {post.videoDuration}
                    </div>
                  )}
                </div>
              )}

              {/* Interaction Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  
                  {/* Upvote / Downvote Karma */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'rgba(2,6,23,0.5)', padding: '0.2rem 0.5rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                      onClick={() => handleVote(post.id, 'up')}
                      title={post.currentUserVote === 'up' ? 'Remove Like (Toggled)' : 'Like this post'}
                      style={{
                        background: post.currentUserVote === 'up' ? 'rgba(16,185,129,0.25)' : 'none',
                        border: post.currentUserVote === 'up' ? '1px solid rgba(16,185,129,0.5)' : 'none',
                        borderRadius: '4px',
                        color: '#10b981',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px 4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ThumbsUp size={13} fill={post.currentUserVote === 'up' ? '#10b981' : 'none'} />
                    </button>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: (post.upvotes - post.downvotes) >= 0 ? '#10b981' : '#ef4444', minWidth: '16px', textAlign: 'center' }}>
                      {post.upvotes - post.downvotes}
                    </span>
                    <button
                      onClick={() => handleVote(post.id, 'down')}
                      title={post.currentUserVote === 'down' ? 'Remove Dislike (Toggled)' : 'Dislike this post'}
                      style={{
                        background: post.currentUserVote === 'down' ? 'rgba(239,68,68,0.25)' : 'none',
                        border: post.currentUserVote === 'down' ? '1px solid rgba(239,68,68,0.5)' : 'none',
                        borderRadius: '4px',
                        color: '#ef4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px 4px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <ThumbsDown size={13} fill={post.currentUserVote === 'down' ? '#ef4444' : 'none'} />
                    </button>
                  </div>

                  {/* Comments Count Toggle */}
                  <button onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.76rem' }}>
                    <MessageSquare size={13} />
                    <span>{post.comments?.length || 0} Comments</span>
                  </button>

                  {/* Views */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#64748b', fontSize: '0.74rem' }}>
                    <Eye size={13} />
                    <span>{post.views || 1} views</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b', fontSize: '0.72rem' }}>
                  <Share2 size={13} />
                  <span>Mesh Broadcast</span>
                </div>
              </div>

              {/* Nested Comments Drawer */}
              {activeCommentPostId === post.id && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed rgba(255,255,255,0.08)' }}>
                  
                  {/* Comments List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    {post.comments?.map(c => (
                      <div key={c.id} style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(2,6,23,0.4)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <CornerDownRight size={14} color="#64748b" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#f1f5f9' }}>{c.authorName}</span>
                            <span style={{ fontSize: '0.68rem', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>@{c.authorHandle}.nova</span>
                            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>{new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>{c.content}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Comment Input */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input value={commentInput} onChange={e => setCommentInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddComment(post.id)} placeholder="Write a peer comment..." style={{ flex: 1, padding: '0.45rem 0.75rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.78rem', outline: 'none' }} />
                    <button onClick={() => handleAddComment(post.id)} style={{ padding: '0.45rem 0.75rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.76rem' }}>
                      <Send size={12} />
                      <span>Reply</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal: Create Post / Video / Reddit discussion */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(5,7,15,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleCreatePost} style={{ width: '480px', maxWidth: '92vw', backgroundColor: '#0f172a', border: '1px solid rgba(0,240,255,0.3)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backdropFilter: 'blur(16px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#00f0ff' }}>Publish to Sovereign Mesh</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Post Format Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem' }}>FORMAT</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {[
                  { id: 'wall', label: 'Wall Post (FB)' },
                  { id: 'video', label: 'AuraTube (YT)' },
                  { id: 'reddit', label: 'Discussion (Reddit)' },
                ].map(fmt => (
                  <button type="button" key={fmt.id} onClick={() => setNewType(fmt.id)} style={{ padding: '0.45rem', borderRadius: '6px', border: newType === fmt.id ? '1px solid #00f0ff' : '1px solid rgba(255,255,255,0.1)', backgroundColor: newType === fmt.id ? 'rgba(0,240,255,0.15)' : 'rgba(2,6,23,0.5)', color: newType === fmt.id ? '#00f0ff' : '#94a3b8', fontSize: '0.74rem', cursor: 'pointer' }}>
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Aura Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem' }}>TARGET SUB-AURA</label>
              <select value={newSubAura} onChange={e => setNewSubAura(e.target.value)} style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.8rem', outline: 'none' }}>
                <option value="r/general">r/general (Main Wall)</option>
                <option value="r/local-llms">r/local-llms (Model Engineering)</option>
                <option value="r/comfy-art">r/comfy-art (Diffusion & Video)</option>
                <option value="r/sovereign-mesh">r/sovereign-mesh (Network & P2P)</option>
              </select>
            </div>

            {/* Title (for Reddit and Video) */}
            {(newType === 'reddit' || newType === 'video') && (
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem' }}>TITLE / HEADLINE</label>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder={newType === 'video' ? 'e.g. Wan 2.1 Native 14B Workflow Breakdown' : 'e.g. DeepSeek-R1 vs Llama 3 8B Quantization benchmarks'} required style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {/* Video specifics */}
            {newType === 'video' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem' }}>MEDIA URL OR LOCAL FILE</label>
                  <input value={newMediaUrl} onChange={e => setNewMediaUrl(e.target.value)} placeholder="https://... or local file:// path" style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem' }}>DURATION</label>
                  <input value={newDuration} onChange={e => setNewDuration(e.target.value)} placeholder="04:20" style={{ width: '100%', padding: '0.5rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}

            {/* Content / Body */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem' }}>CONTENT / DESCRIPTION</label>
              <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={4} placeholder="Write your sovereign post, thoughts, or workflow details..." required style={{ width: '100%', padding: '0.6rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '6px', color: '#f1f5f9', fontSize: '0.82rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
              <button type="submit" style={{ padding: '0.5rem 1.25rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>Broadcast Post</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
