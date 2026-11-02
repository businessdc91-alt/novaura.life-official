// FeedPostCard.jsx — Master Hybrid Post Card (Facebook Wall + Reddit Discussion + YouTube Player)
import React, { useState } from 'react';
import {
  ThumbsUp, ThumbsDown, MessageSquare, Play, Video, Share2, Sparkles,
  Eye, Repeat, Clock, CheckCircle2, ChevronDown, ChevronUp, Image as ImageIcon,
  Flame, Heart, Lightbulb, Rocket, Tag, ExternalLink, X
} from 'lucide-react';
import { votePost, reactToPost, repostPost } from '../../../services/sovereignMesh';
import { summarizeThread } from '../../../services/socialAiService';
import CommentTree from './CommentTree';
import AuraTubePlayer from './AuraTubePlayer';
import PeerMedia from './PeerMedia';

const REACTION_ICONS = {
  like: { emoji: '👍', label: 'Like', color: '#38bdf8' },
  love: { emoji: '❤️', label: 'Love', color: '#f43f5e' },
  fire: { emoji: '🔥', label: 'Fire', color: '#f97316' },
  insight: { emoji: '💡', label: 'Insight', color: '#eab308' },
  rocket: { emoji: '🚀', label: 'Rocket', color: '#a855f7' },
  mindblown: { emoji: '🤯', label: 'Mind Blown', color: '#06b6d4' },
};

export default function FeedPostCard({
  post,
  onRefresh,
  onOpenProfile,
  onOpenShorts,
}) {
  const [showComments, setShowComments] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [aiSummaryText, setAiSummaryText] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [selectedLightboxImage, setSelectedLightboxImage] = useState(null);

  // Repost modal state
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostCommentary, setRepostCommentary] = useState('');

  const handleVote = (dir) => {
    votePost(post.id, dir);
    if (onRefresh) onRefresh();
  };

  const handleSelectReaction = (reactionKey) => {
    reactToPost(post.id, reactionKey);
    setShowReactionPicker(false);
    if (onRefresh) onRefresh();
  };

  const handleToggleAiSummary = async () => {
    if (!showAiSummary) {
      setShowAiSummary(true);
      if (!aiSummaryText) {
        setIsSummarizing(true);
        try {
          const summary = await summarizeThread({ post, comments: post.comments || [] });
          setAiSummaryText(summary);
        } finally {
          setIsSummarizing(false);
        }
      }
    } else {
      setShowAiSummary(false);
    }
  };

  const handleConfirmRepost = (e) => {
    e.preventDefault();
    try {
      repostPost(post.id, repostCommentary);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('novaura:mesh_toast', { detail: { type: 'info', title: 'Could not repost', message: err.message } }));
      return;
    }
    setRepostCommentary('');
    setShowRepostModal(false);
    if (onRefresh) onRefresh();
  };

  const reactions = post.reactions || { like: 0, love: 0, fire: 0, insight: 0, rocket: 0, mindblown: 0 };
  const netScore = (post.upvotes || 0) - (post.downvotes || 0);
  const mediaGallery = post.mediaGallery || (post.mediaUrl ? [post.mediaUrl] : []);
  const activeUserReaction = post.currentUserReaction || null;

  return (
    <div
      style={{
        backgroundColor: 'rgba(15,23,42,0.72)',
        border: '1px solid rgba(0,240,255,0.14)',
        borderRadius: '12px',
        padding: '1.2rem',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Repost Header Attribution if this is a quote post */}
      {post.repostOf && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.74rem', color: '#a855f7', marginBottom: '0.65rem', paddingBottom: '0.4rem', borderBottom: '1px dashed rgba(168,85,247,0.2)' }}>
          <Repeat size={13} />
          <span>Boosted by @{post.authorHandle}.nova</span>
        </div>
      )}

      {/* Post Author Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        
        {/* Author Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          
          {/* Avatar (Click to open profile) */}
          <div
            onClick={() => onOpenProfile && onOpenProfile(post.authorHandle)}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: post.authorColor || '#00f0ff',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 0 10px rgba(0,240,255,0.3)',
              position: 'relative',
            }}
          >
            {post.authorName?.[0] || 'U'}
            <div
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                border: '2px solid #0f172a',
              }}
              title="Verified Active Mesh Peer"
            />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
              <span
                onClick={() => onOpenProfile && onOpenProfile(post.authorHandle)}
                style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', cursor: 'pointer' }}
              >
                {post.authorName}
              </span>
              <CheckCircle2 size={13} color="#22d3ee" />
              <span style={{ fontSize: '0.74rem', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>
                @{post.authorHandle}.nova
              </span>

              {/* Sub-Aura Community Badge (Reddit style) */}
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(168,85,247,0.18)',
                  color: '#c084fc',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  border: '1px solid rgba(168,85,247,0.3)',
                }}
              >
                {post.subAura || 'r/general'}
              </span>

              {/* Feeling/Activity Badge (Facebook style) */}
              {post.feeling && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.12)',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(245,158,11,0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span>{post.feeling.emoji || '⚡'}</span>
                  <span>{post.feeling.label || 'vibing'}</span>
                </span>
              )}
            </div>

            <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
              {new Date(post.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} • Mesh Node Verified
            </div>
          </div>

        </div>

        {/* Post Type & Flair Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {post.flair && (
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.25)' }}>
              {post.flair}
            </span>
          )}

          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              backgroundColor: post.type === 'video' ? 'rgba(236,72,153,0.15)' : post.type === 'reddit' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)',
              color: post.type === 'video' ? '#ec4899' : post.type === 'reddit' ? '#f59e0b' : '#60a5fa',
              border: `1px solid ${post.type === 'video' ? 'rgba(236,72,153,0.3)' : post.type === 'reddit' ? 'rgba(245,158,11,0.3)' : 'rgba(59,130,246,0.3)'}`,
            }}
          >
            {post.type === 'video' ? (post.isShort ? 'AuraShort' : 'AuraTube') : post.type === 'reddit' ? 'Discussion' : 'The Wall'}
          </span>
        </div>

      </div>

      {/* Post Title (Reddit / Video Headline) */}
      {post.title && (
        <h3 style={{ margin: '0 0 0.55rem', fontSize: '1.02rem', fontWeight: 600, color: '#f8fafc', lineHeight: 1.35 }}>
          {post.title}
        </h3>
      )}

      {/* Post Body Text */}
      <p style={{ margin: '0 0 0.85rem', fontSize: '0.86rem', color: '#cbd5e1', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
        {post.content}
      </p>

      {/* Embedded AuraTube Video Player if video */}
      {post.type === 'video' && (
        <div style={{ marginBottom: '0.85rem' }}>
          <AuraTubePlayer
            post={post}
            isTheater={isTheater}
            onTheaterToggle={() => setIsTheater(!isTheater)}
          />
        </div>
      )}

      {/* Media Photo Gallery (Facebook Style 1-up, 2-up, 3-up, 4-up) */}
      {post.type !== 'video' && mediaGallery.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: mediaGallery.length === 1 ? '1fr' : mediaGallery.length === 2 ? '1fr 1fr' : '1fr 1fr',
            gap: '0.5rem',
            marginBottom: '0.85rem',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          {mediaGallery.slice(0, 4).map((url, i) => (
            <div
              key={i}
              onClick={() => setSelectedLightboxImage(url)}
              style={{
                position: 'relative',
                height: mediaGallery.length === 1 ? '260px' : '150px',
                cursor: 'pointer',
                overflow: 'hidden',
                backgroundColor: '#020617',
              }}
            >
              <PeerMedia
                authorDid={post.authorDid}
                src={url}
                alt={`Media attachment ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              />
              {mediaGallery.length > 4 && i === 3 && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0,0,0,0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1.2rem',
                  }}
                >
                  +{mediaGallery.length - 4}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quoted Repost Card if this is a quote post */}
      {post.repostOf && (
        <div
          style={{
            backgroundColor: 'rgba(2,6,23,0.6)',
            border: '1px solid rgba(168,85,247,0.3)',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', fontSize: '0.74rem', color: '#c084fc' }}>
            <span style={{ fontWeight: 600 }}>{post.repostOf.authorName}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>@{post.repostOf.authorHandle}.nova</span>
          </div>
          {post.repostOf.title && (
            <div style={{ fontWeight: 600, fontSize: '0.84rem', color: '#f8fafc', marginBottom: '0.25rem' }}>
              {post.repostOf.title}
            </div>
          )}
          <div style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
            {post.repostOf.content}
          </div>
        </div>
      )}

      {/* AI TL;DR Synthesis Accordion Card */}
      {showAiSummary && (
        <div
          style={{
            backgroundColor: 'rgba(2,6,23,0.85)',
            border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: '8px',
            padding: '0.85rem 1rem',
            marginBottom: '0.85rem',
            boxShadow: '0 0 15px rgba(168,85,247,0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c084fc', fontSize: '0.78rem', fontWeight: 600 }}>
              <Sparkles size={14} />
              <span>Sovereign Neural Intelligence • Thread Synthesis</span>
            </div>
            <button onClick={() => setShowAiSummary(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>

          {isSummarizing ? (
            <div style={{ padding: '0.75rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="#c084fc" className="animate-spin" />
              <span>Analyzing discussion consensus and key arguments...</span>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: '1.55', whiteSpace: 'pre-wrap' }}>
              {aiSummaryText}
            </div>
          )}
        </div>
      )}

      {/* Interaction Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          paddingTop: '0.75rem',
          position: 'relative',
        }}
      >
        {/* Left Actions: Multi-reactions, Karma, Comments, AI Summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          
          {/* Reaction Trigger Button with Floating Glass Picker */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setShowReactionPicker(true)}
            onMouseLeave={() => setShowReactionPicker(false)}
          >
            <button
              onClick={() => handleSelectReaction(activeUserReaction ? activeUserReaction : 'like')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: activeUserReaction ? 'rgba(0,240,255,0.15)' : 'rgba(2,6,23,0.5)',
                border: activeUserReaction ? '1px solid rgba(0,240,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                padding: '0.25rem 0.55rem',
                color: activeUserReaction ? '#00f0ff' : '#94a3b8',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 600,
                transition: 'all 0.15s',
              }}
            >
              <span>{activeUserReaction ? REACTION_ICONS[activeUserReaction]?.emoji : '👍'}</span>
              <span>{activeUserReaction ? REACTION_ICONS[activeUserReaction]?.label : 'React'}</span>
            </button>

            {/* Floating Glass Reaction Picker Popup */}
            {showReactionPicker && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '0',
                  marginBottom: '8px',
                  backgroundColor: 'rgba(15,23,42,0.95)',
                  border: '1px solid rgba(0,240,255,0.3)',
                  borderRadius: '30px',
                  padding: '0.3rem 0.5rem',
                  display: 'flex',
                  gap: '0.45rem',
                  boxShadow: '0 8px 25px rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(16px)',
                  zIndex: 50,
                }}
              >
                {Object.entries(REACTION_ICONS).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectReaction(key);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.25rem',
                      cursor: 'pointer',
                      transition: 'transform 0.15s',
                      padding: '2px',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    title={val.label}
                  >
                    {val.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Reaction Summary Breakdown Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {Object.entries(reactions)
              .filter(([_, count]) => count > 0)
              .map(([key, count]) => (
                <span
                  key={key}
                  style={{
                    fontSize: '0.7rem',
                    backgroundColor: 'rgba(2,6,23,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    padding: '0.15rem 0.35rem',
                    borderRadius: '10px',
                    color: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                  }}
                  title={`${count} ${REACTION_ICONS[key]?.label}`}
                >
                  <span>{REACTION_ICONS[key]?.emoji}</span>
                  <span style={{ fontWeight: 600 }}>{count}</span>
                </span>
              ))}
          </div>

          {/* Reddit Up/Down Karma Gutter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'rgba(2,6,23,0.6)', padding: '0.2rem 0.45rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => handleVote('up')}
              style={{
                background: post.currentUserVote === 'up' ? 'rgba(16,185,129,0.2)' : 'none',
                border: 'none',
                color: '#10b981',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
              title="Upvote post"
            >
              <ThumbsUp size={13} fill={post.currentUserVote === 'up' ? '#10b981' : 'none'} />
            </button>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: netScore >= 0 ? '#10b981' : '#ef4444', minWidth: '16px', textAlign: 'center' }}>
              {netScore}
            </span>
            <button
              onClick={() => handleVote('down')}
              style={{
                background: post.currentUserVote === 'down' ? 'rgba(239,68,68,0.2)' : 'none',
                border: 'none',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
              }}
              title="Downvote post"
            >
              <ThumbsDown size={13} fill={post.currentUserVote === 'down' ? '#ef4444' : 'none'} />
            </button>
          </div>

          {/* Comments Toggle Button */}
          <button
            onClick={() => setShowComments(!showComments)}
            style={{
              background: 'none',
              border: 'none',
              color: showComments ? '#00f0ff' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.78rem',
            }}
          >
            <MessageSquare size={14} />
            <span>{post.comments?.length || 0} Comments</span>
          </button>

          {/* AI TL;DR Summary Trigger */}
          <button
            onClick={handleToggleAiSummary}
            style={{
              background: 'none',
              border: 'none',
              color: showAiSummary ? '#c084fc' : '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.76rem',
            }}
            title="Generate AI executive summary of this post and thread"
          >
            <Sparkles size={13} color="#c084fc" />
            <span>AI TL;DR</span>
          </button>

        </div>

        {/* Right Actions: Repost/Boost, Views, Mesh Node Pip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#64748b', fontSize: '0.72rem' }}>
          
          {/* Boost / Repost Button */}
          <button
            onClick={() => setShowRepostModal(true)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.74rem',
            }}
            title="Repost with commentary across the mesh"
          >
            <Repeat size={13} />
            <span>Boost</span>
          </button>

          {/* View Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Eye size={13} />
            <span>{post.views || 1} views</span>
          </div>
        </div>

      </div>

      {/* Recursive Reddit-Style Comments Drawer */}
      {showComments && (
        <CommentTree
          postId={post.id}
          postAuthorHandle={post.authorHandle}
          comments={post.comments || []}
          onRefresh={onRefresh}
        />
      )}

      {/* Repost Modal */}
      {showRepostModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(5,7,15,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(16px)',
          }}
          onClick={() => setShowRepostModal(false)}
        >
          <form
            onSubmit={handleConfirmRepost}
            onClick={e => e.stopPropagation()}
            style={{
              width: '460px',
              maxWidth: '92vw',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(168,85,247,0.4)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#c084fc', fontWeight: 600 }}>
                <Repeat size={16} />
                <span>Boost Transmission to Sovereign Mesh</span>
              </div>
              <button type="button" onClick={() => setShowRepostModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>

            <textarea
              value={repostCommentary}
              onChange={e => setRepostCommentary(e.target.value)}
              rows={3}
              placeholder="Add your thoughts or analysis to this broadcast..."
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'rgba(2,6,23,0.8)',
                border: '1px solid rgba(168,85,247,0.3)',
                borderRadius: '6px',
                color: '#f8fafc',
                fontSize: '0.82rem',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />

            {/* Quoted preview snippet */}
            <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'rgba(2,6,23,0.5)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.76rem', color: '#94a3b8' }}>
              <strong style={{ color: '#f8fafc' }}>{post.authorName}</strong>: {post.title || post.content.slice(0, 100)}...
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowRepostModal(false)}
                style={{ padding: '0.4rem 0.8rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '0.4rem 1.1rem', backgroundColor: '#a855f7', border: 'none', borderRadius: '5px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.78rem' }}
              >
                Broadcast Boost
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox Modal for Photo Gallery */}
      {selectedLightboxImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0,0,0,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(16px)',
          }}
          onClick={() => setSelectedLightboxImage(null)}
        >
          <PeerMedia
            authorDid={post.authorDid}
            src={selectedLightboxImage}
            alt="Fullscreen viewer"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>
      )}

    </div>
  );
}
