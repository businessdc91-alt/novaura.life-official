// AuraShortsModal.jsx — Vertical 9:16 Reel Player (YouTube Shorts / TikTok on Mesh)
import React, { useState, useEffect, useRef } from 'react';
import {
  X, ChevronUp, ChevronDown, Heart, MessageSquare, Share2, Volume2,
  VolumeX, Play, Pause, Music2, Sparkles, CheckCircle2, UserPlus
} from 'lucide-react';
import { votePost, reactToPost, toggleFollowUser, isFollowingUser } from '../../../services/sovereignMesh';
import CommentTree from './CommentTree';
import PeerMedia from './PeerMedia';

export default function AuraShortsModal({ shorts = [], initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const videoRef = useRef(null);
  const currentShort = shorts[currentIndex] || null;

  useEffect(() => {
    if (currentShort?.authorHandle) {
      setIsFollowing(isFollowingUser(currentShort.authorHandle));
    }
    setIsPlaying(true);
  }, [currentIndex, currentShort]);

  // Keyboard navigation: Up / Down arrow keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') handleNext();
      else if (e.key === 'ArrowUp') handlePrev();
      else if (e.key === 'Escape') onClose();
      else if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, shorts]);

  const handleNext = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleLike = () => {
    if (!currentShort) return;
    reactToPost(currentShort.id, 'fire');
  };

  const handleFollowToggle = () => {
    if (!currentShort?.authorHandle) return;
    const nextState = toggleFollowUser(currentShort.authorHandle, currentShort.authorNodeId);
    setIsFollowing(nextState);
  };

  if (!currentShort) return null;

  const isDirectVideo = currentShort.mediaUrl && currentShort.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(2,6,23,0.96)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(24px)',
      }}
    >
      {/* Top Close Button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '24px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 100,
        }}
      >
        <X size={20} />
      </button>

      {/* Main 9:16 Vertical Reel Canvas */}
      <div
        style={{
          position: 'relative',
          width: '370px',
          maxWidth: '94vw',
          height: '660px',
          maxHeight: '92vh',
          borderRadius: '18px',
          overflow: 'hidden',
          backgroundColor: '#000',
          boxShadow: '0 0 50px rgba(236,72,153,0.3)',
          border: '1px solid rgba(236,72,153,0.4)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Media Layer */}
        <div
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          {isDirectVideo ? (
            <PeerMedia
              kind="video"
              mediaRef={videoRef}
              authorDid={currentShort.authorDid}
              src={currentShort.mediaUrl}
              autoPlay={isPlaying}
              loop
              muted={isMuted}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : currentShort.thumbnail || currentShort.mediaUrl ? (
            <PeerMedia
              authorDid={currentShort.authorDid}
              src={currentShort.thumbnail || currentShort.mediaUrl}
              alt="Short preview"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'radial-gradient(ellipse at center, rgba(236,72,153,0.35) 0%, rgba(2,6,23,0.95) 80%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem',
                textAlign: 'center',
              }}
            >
              <Sparkles size={48} color="#ec4899" />
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
                {currentShort.title || 'AuraShort Reel'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {currentShort.content}
              </div>
            </div>
          )}

          {/* Pause Icon Indicator */}
          {!isPlaying && (
            <div
              style={{
                position: 'absolute',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Play size={28} color="#fff" style={{ marginLeft: '4px' }} />
            </div>
          )}
        </div>

        {/* Top Header Overlay: Sound & Reel Counter */}
        <div style={{ position: 'relative', zIndex: 10, padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ec4899', fontFamily: "'JetBrains Mono', monospace", backgroundColor: 'rgba(236,72,153,0.15)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid rgba(236,72,153,0.3)' }}>
            AuraShorts • {currentIndex + 1} of {shorts.length}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
            style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>

        {/* Bottom Details Overlay & Floating Action Rail */}
        <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '1rem', background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)' }}>
          
          {/* Creator & Description Details */}
          <div style={{ flex: 1, marginRight: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: currentShort.authorColor || '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 700, fontSize: '0.85rem' }}>
                {currentShort.authorName?.[0] || 'U'}
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>{currentShort.authorName}</span>
              <CheckCircle2 size={13} color="#22d3ee" />
              
              <button
                onClick={handleFollowToggle}
                style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  border: isFollowing ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  backgroundColor: isFollowing ? 'rgba(255,255,255,0.15)' : '#ec4899',
                  color: '#fff',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: '0.25rem',
                }}
              >
                {isFollowing ? 'Joined' : '+ Follow'}
              </button>
            </div>

            <p style={{ margin: '0 0 0.4rem', fontSize: '0.84rem', color: '#f1f5f9', lineHeight: 1.35, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
              {currentShort.title || currentShort.content}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: '#94a3b8' }}>
              <Music2 size={12} color="#ec4899" />
              <span>Mesh Synthwave • Original Audio</span>
            </div>
          </div>

          {/* Right Action Rail: Like, Comments, Share */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            
            {/* Like */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <button
                onClick={handleLike}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: currentShort.currentUserReaction ? '#ec4899' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <Heart size={20} fill={currentShort.currentUserReaction ? '#ec4899' : 'none'} />
              </button>
              <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 600 }}>
                {(currentShort.upvotes || 1) + (currentShort.reactions?.fire || 0)}
              </span>
            </div>

            {/* Comments */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <button
                onClick={() => setShowComments(!showComments)}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(6px)',
                }}
              >
                <MessageSquare size={20} />
              </button>
              <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: 600 }}>
                {currentShort.comments?.length || 0}
              </span>
            </div>

            {/* Share */}
            <button
              onClick={() => {}}
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.12)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(6px)',
              }}
              title="Broadcast to Sovereign Mesh peers"
            >
              <Share2 size={18} />
            </button>
          </div>

        </div>

        {/* Up / Down Navigation Controls */}
        <div style={{ position: 'absolute', right: '-55px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(236,72,153,0.4)',
              color: '#ec4899',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === 0 ? 0.4 : 1,
            }}
          >
            <ChevronUp size={20} />
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === shorts.length - 1}
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              backgroundColor: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(236,72,153,0.4)',
              color: '#ec4899',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: currentIndex === shorts.length - 1 ? 'not-allowed' : 'pointer',
              opacity: currentIndex === shorts.length - 1 ? 0.4 : 1,
            }}
          >
            <ChevronDown size={20} />
          </button>
        </div>

      </div>

      {/* Drawer: Comments Overlay */}
      {showComments && (
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            width: '370px',
            maxWidth: '94vw',
            maxHeight: '50vh',
            backgroundColor: '#0f172a',
            border: '1px solid rgba(236,72,153,0.4)',
            borderRadius: '16px',
            padding: '1rem',
            overflowY: 'auto',
            zIndex: 110,
            boxShadow: '0 -10px 30px rgba(0,0,0,0.8)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.4rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f8fafc' }}>
              Reel Comments ({currentShort.comments?.length || 0})
            </span>
            <button
              onClick={() => setShowComments(false)}
              style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          <CommentTree
            postId={currentShort.id}
            postAuthorHandle={currentShort.authorHandle}
            comments={currentShort.comments || []}
            onRefresh={() => {}}
          />
        </div>
      )}

    </div>
  );
}
