// StoriesBar.jsx — 24-Hour Ephemeral Peer Stories Carousel (Facebook / Instagram on Mesh)
import React, { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, X, Heart, Flame, Sparkles, Rocket, Lightbulb, Send, Clock } from 'lucide-react';
import { getStories, createStory, reactToStory, getSocialProfile } from '../../../services/sovereignMesh';
import { STORY_GRADIENTS } from '../../../services/meshSocial.js';
import PeerMedia from './PeerMedia';

// The backgrounds other nodes accept (see meshSocial.js).
const GRADIENTS = STORY_GRADIENTS;

export default function StoriesBar() {
  const [stories, setStories] = useState([]);
  const [profile, setProfile] = useState(null);
  const [selectedStory, setSelectedStory] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Create Story Form State
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENTS[0]);

  const carouselRef = useRef(null);

  const refreshStories = () => {
    setProfile(getSocialProfile());
    setStories(getStories());
  };

  useEffect(() => {
    refreshStories();
    window.addEventListener('novaura:stories_updated', refreshStories);
    window.addEventListener('novaura:social_profile_updated', refreshStories);
    return () => {
      window.removeEventListener('novaura:stories_updated', refreshStories);
      window.removeEventListener('novaura:social_profile_updated', refreshStories);
    };
  }, []);

  // Story Viewer Timer
  useEffect(() => {
    if (!selectedStory || isPaused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          handleNextStory();
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [selectedStory, isPaused, stories]);

  const handleOpenStory = (story) => {
    setSelectedStory(story);
    setProgress(0);
    setIsPaused(false);
  };

  const handleNextStory = () => {
    if (!selectedStory) return;
    const currentIndex = stories.findIndex(s => s.id === selectedStory.id);
    if (currentIndex < stories.length - 1) {
      setSelectedStory(stories[currentIndex + 1]);
      setProgress(0);
    } else {
      setSelectedStory(null);
      setProgress(0);
    }
  };

  const handlePrevStory = () => {
    if (!selectedStory) return;
    const currentIndex = stories.findIndex(s => s.id === selectedStory.id);
    if (currentIndex > 0) {
      setSelectedStory(stories[currentIndex - 1]);
      setProgress(0);
    }
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!caption.trim() && !mediaUrl.trim()) return;

    try {
      createStory({
        mediaUrl: mediaUrl.trim() || null,
        caption: caption.trim(),
        bgGradient: selectedGradient,
        duration: 24,
      });
    } catch (err) {
      window.dispatchEvent(new CustomEvent('novaura:mesh_toast', { detail: { type: 'info', title: 'Could not post the story', message: err.message } }));
      return;
    }

    setCaption('');
    setMediaUrl('');
    setShowCreateModal(false);
    refreshStories();
  };

  const handleReact = (reactionKey) => {
    if (!selectedStory) return;
    reactToStory(selectedStory.id, reactionKey);
    refreshStories();
  };

  const scroll = (direction) => {
    if (carouselRef.current) {
      const amount = direction === 'left' ? -220 : 220;
      carouselRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', marginBottom: '1.25rem' }}>
      
      {/* Scroll Left Button */}
      <button
        onClick={() => scroll('left')}
        style={{
          position: 'absolute',
          left: '-10px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: 'rgba(15,23,42,0.9)',
          border: '1px solid rgba(0,240,255,0.3)',
          color: '#00f0ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
        }}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Stories Track */}
      <div
        ref={carouselRef}
        style={{
          display: 'flex',
          gap: '0.75rem',
          overflowX: 'auto',
          padding: '0.4rem 0.2rem',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Add Story Button Card */}
        <div
          onClick={() => setShowCreateModal(true)}
          style={{
            flexShrink: 0,
            width: '100px',
            height: '145px',
            borderRadius: '12px',
            backgroundColor: 'rgba(15,23,42,0.85)',
            border: '1px dashed rgba(0,240,255,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 0.5rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            backdropFilter: 'blur(8px)',
            position: 'relative',
            overflow: 'hidden',
          }}
          title="Broadcast 24-hour ephemeral peer story to Sovereign Swarm"
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: profile?.avatarColor || '#00f0ff',
              color: '#000',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1rem',
              boxShadow: '0 0 10px rgba(0,240,255,0.3)',
            }}
          >
            {profile?.displayName?.[0] || 'O'}
          </div>

          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: '#00f0ff',
              color: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 8px rgba(0,240,255,0.6)',
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
          </div>

          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f8fafc', textAlign: 'center' }}>
            Add Story
          </span>
        </div>

        {/* Peer Stories Cards */}
        {stories.map(story => {
          const isMine = story.authorHandle === profile?.handle;
          return (
            <div
              key={story.id}
              onClick={() => handleOpenStory(story)}
              style={{
                flexShrink: 0,
                width: '100px',
                height: '145px',
                borderRadius: '12px',
                background: story.bgGradient || GRADIENTS[0],
                padding: '0.6rem 0.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.15)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,240,255,0.3)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.4)';
              }}
            >
              {/* Media image background if present */}
              {story.mediaUrl && (
                <PeerMedia
                  authorDid={story.authorDid}
                  src={story.mediaUrl}
                  alt="Story preview"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    opacity: 0.65,
                  }}
                />
              )}

              {/* Story Author Avatar with Glowing Ring */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    padding: '2px',
                    background: 'linear-gradient(45deg, #00f0ff, #a855f7, #ec4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 8px rgba(0,240,255,0.6)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      backgroundColor: story.authorColor || '#0284c7',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {story.authorName?.[0] || 'U'}
                  </div>
                </div>
              </div>

              {/* Story Caption Teaser */}
              <div style={{ position: 'relative', zIndex: 2 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.68rem',
                    color: '#fff',
                    fontWeight: 600,
                    lineHeight: '1.25',
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {story.caption || `@${story.authorHandle}`}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '3px', fontSize: '0.62rem', color: '#e2e8f0', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}>
                  <Clock size={10} />
                  <span>24h Peer</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scroll Right Button */}
      <button
        onClick={() => scroll('right')}
        style={{
          position: 'absolute',
          right: '-10px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: 'rgba(15,23,42,0.9)',
          border: '1px solid rgba(0,240,255,0.3)',
          color: '#00f0ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 0 10px rgba(0,0,0,0.5)',
        }}
      >
        <ChevronRight size={16} />
      </button>

      {/* Modal: Fullscreen Interactive Story Viewer */}
      {selectedStory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(5,7,15,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(20px)',
          }}
          onClick={() => setSelectedStory(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            style={{
              position: 'relative',
              width: '380px',
              maxWidth: '92vw',
              height: '620px',
              maxHeight: '90vh',
              borderRadius: '16px',
              background: selectedStory.bgGradient || GRADIENTS[0],
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 0 40px rgba(0,240,255,0.3)',
              border: '1px solid rgba(0,240,255,0.3)',
            }}
          >
            {/* Background Media Image if present */}
            {selectedStory.mediaUrl && (
              <PeerMedia
                authorDid={selectedStory.authorDid}
                src={selectedStory.mediaUrl}
                alt="Story media"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.85,
                }}
              />
            )}

            {/* Top Progress Bar */}
            <div style={{ position: 'relative', zIndex: 10, padding: '0.75rem 0.75rem 0', display: 'flex', gap: '4px' }}>
              <div style={{ flex: 1, height: '3px', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#00f0ff', transition: 'width 0.1s linear' }} />
              </div>
            </div>

            {/* Header: Author + Close */}
            <div style={{ position: 'relative', zIndex: 10, padding: '0.65rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: selectedStory.authorColor || '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.85rem' }}>
                  {selectedStory.authorName?.[0] || 'U'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#fff' }}>{selectedStory.authorName}</span>
                    <span style={{ fontSize: '0.72rem', color: '#00f0ff', fontFamily: "'JetBrains Mono', monospace" }}>@{selectedStory.authorHandle}.nova</span>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>{new Date(selectedStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Sovereign Mesh</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedStory(null)}
                style={{ background: 'rgba(0,0,0,0.4)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Story Content / Caption Center Body */}
            <div style={{ flex: 1, position: 'relative', zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', textAlign: 'center' }}>
              {selectedStory.caption && (
                <div style={{ backgroundColor: 'rgba(0,0,0,0.65)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.4, backdropFilter: 'blur(8px)', maxWidth: '90%' }}>
                  {selectedStory.caption}
                </div>
              )}
            </div>

            {/* Click navigation halves */}
            <div style={{ position: 'absolute', inset: '60px 0 80px 0', display: 'flex', zIndex: 4 }}>
              <div onClick={handlePrevStory} style={{ flex: 1, cursor: 'w-resize' }} />
              <div onClick={handleNextStory} style={{ flex: 1, cursor: 'e-resize' }} />
            </div>

            {/* Bottom Interaction Rail: Reactions & Reply */}
            <div style={{ position: 'relative', zIndex: 10, padding: '0.75rem 1rem 1rem', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              
              {/* Quick Reactions Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: '30px', padding: '0.35rem 0.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                {[
                  { key: 'heart', emoji: '❤️' },
                  { key: 'fire', emoji: '🔥' },
                  { key: 'clap', emoji: '👏' },
                  { key: 'rocket', emoji: '🚀' },
                  { key: 'mindblown', emoji: '🤯' },
                ].map(r => (
                  <button
                    key={r.key}
                    onClick={() => handleReact(r.key)}
                    style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', transition: 'transform 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.25)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    title={`React ${r.emoji}`}
                  >
                    {r.emoji}
                  </button>
                ))}
              </div>

              {/* Direct Reply Bar */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  placeholder={`Reply to @${selectedStory.authorHandle}...`}
                  style={{
                    flex: 1,
                    backgroundColor: 'rgba(2,6,23,0.8)',
                    border: '1px solid rgba(0,240,255,0.3)',
                    borderRadius: '20px',
                    padding: '0.45rem 0.9rem',
                    color: '#fff',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
                <button
                  style={{
                    backgroundColor: '#00f0ff',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    cursor: 'pointer',
                  }}
                >
                  <Send size={14} />
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Modal: Create 24h Story */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={e => e.stopPropagation()}
            style={{
              width: '420px',
              maxWidth: '92vw',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(0,240,255,0.3)',
              borderRadius: '14px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              boxShadow: '0 0 30px rgba(0,240,255,0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} color="#00f0ff" />
                <h3 style={{ margin: 0, fontSize: '0.98rem', color: '#f8fafc' }}>Broadcast 24h Peer Story</h3>
              </div>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Gradient Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.4rem' }}>CANVAS GRADIENT</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {GRADIENTS.map((g, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedGradient(g)}
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: '8px',
                      background: g,
                      cursor: 'pointer',
                      border: selectedGradient === g ? '2px solid #00f0ff' : '2px solid transparent',
                      transform: selectedGradient === g ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Story Caption */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem' }}>STORY TEXT / THOUGHT</label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                rows={3}
                placeholder="What's happening in your sovereign node or workshop?"
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  backgroundColor: 'rgba(2,6,23,0.8)',
                  border: '1px solid rgba(0,240,255,0.25)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.84rem',
                  outline: 'none',
                  resize: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Media URL / Photo */}
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', color: '#94a3b8', marginBottom: '0.35rem' }}>IMAGE URL (OPTIONAL)</label>
              <input
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                placeholder="https://... or data:image/..."
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'rgba(2,6,23,0.8)',
                  border: '1px solid rgba(0,240,255,0.2)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Live Preview Box */}
            <div
              style={{
                width: '100%',
                height: '110px',
                borderRadius: '10px',
                background: selectedGradient,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0.75rem',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              {mediaUrl && (
                <img src={mediaUrl} alt="Preview" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} />
              )}
              <span style={{ position: 'relative', zIndex: 2, color: '#fff', fontWeight: 600, fontSize: '0.86rem', textAlign: 'center', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                {caption || 'Live Story Canvas Preview'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ padding: '0.45rem 0.9rem', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '0.45rem 1.25rem', backgroundColor: '#0284c7', border: 'none', borderRadius: '6px', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}
              >
                Broadcast 24h Story
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
