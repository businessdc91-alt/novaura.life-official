// CreateSocialPostModal.jsx — Multi-Tab Creator Studio (Wall Post + Reddit Discussion + AuraTube Video)
import React, { useState } from 'react';
import {
  X, Users, Video, TrendingUp, Sparkles, Image as ImageIcon,
  Smile, Tag, Check, Film, UploadCloud, Compass, BookOpen
} from 'lucide-react';
import { createPost } from '../../../services/sovereignMesh';
import { enhanceSocialPost } from '../../../services/socialAiService';

const FEELING_OPTIONS = [
  { emoji: '⚡', label: 'energized' },
  { emoji: '🧠', label: 'deep focus' },
  { emoji: '🎨', label: 'creative flow' },
  { emoji: '🚀', label: 'shipping code' },
  { emoji: '🎵', label: 'listening to music' },
  { emoji: '💡', label: 'eureka moment' },
  { emoji: '☕', label: 'debugging' },
];

const FLAIR_OPTIONS = [
  'Workflow', 'Benchmark', 'Discussion', 'Release', 'Tutorial', 'Showcase', 'Question'
];

export default function CreateSocialPostModal({ onClose, onCreated }) {
  const [activeFormat, setActiveFormat] = useState('wall'); // 'wall' | 'reddit' | 'video'
  
  // Common
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subAura, setSubAura] = useState('r/general');
  const [selectedFlair, setSelectedFlair] = useState('Discussion');
  const [selectedFeeling, setSelectedFeeling] = useState(null);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);

  // Media
  const [mediaUrl, setMediaUrl] = useState('');
  const [galleryInputs, setGalleryInputs] = useState(['']);

  // Video specifics
  const [videoDuration, setVideoDuration] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [videoChaptersText, setVideoChaptersText] = useState('00:00 Intro & Node Setup\n01:30 Workflow Walkthrough\n03:45 Live Benchmark');
  const [isShort, setIsShort] = useState(false);

  // AI Polish state
  const [isPolishing, setIsPolishing] = useState(false);

  const handleAddGalleryField = () => {
    if (galleryInputs.length < 4) {
      setGalleryInputs([...galleryInputs, '']);
    }
  };

  const handleGalleryChange = (index, value) => {
    const updated = [...galleryInputs];
    updated[index] = value;
    setGalleryInputs(updated);
  };

  const handleAiPolish = async () => {
    setIsPolishing(true);
    try {
      const res = await enhanceSocialPost({
        draftTitle: title,
        draftContent: content,
        postType: activeFormat,
        subAura,
      });
      if (res) {
        if (res.title) setTitle(res.title);
        if (res.content) setContent(res.content);
        if (res.flair) setSelectedFlair(res.flair);
      }
    } finally {
      setIsPolishing(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!content.trim() && !title.trim()) return;

    // Parse chapters
    const chapters = videoChaptersText.split('\n').map(line => {
      const match = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
      if (match) {
        const parts = match[1].split(':').map(Number);
        return { time: parts[0] * 60 + parts[1], title: match[2].trim() };
      }
      return null;
    }).filter(Boolean);

    const validGallery = galleryInputs.filter(url => url.trim().length > 0);
    if (mediaUrl.trim() && !validGallery.includes(mediaUrl.trim())) {
      validGallery.unshift(mediaUrl.trim());
    }

    try {
      createPost({
        title: activeFormat === 'wall' ? null : title,
        content,
        type: activeFormat,
        subAura,
        flair: activeFormat === 'reddit' ? selectedFlair : null,
        feeling: activeFormat === 'wall' ? selectedFeeling : null,
        mediaUrl: validGallery[0] || (mediaUrl.trim() || null),
        mediaGallery: validGallery,
        videoDuration: activeFormat === 'video' ? videoDuration : null,
        videoChapters: activeFormat === 'video' ? chapters : [],
        isShort: activeFormat === 'video' && isShort,
      });
    } catch (err) {
      setSubmitError(err.message || 'The post could not be published.');
      return;
    }

    if (onCreated) onCreated();
    if (onClose) onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(5,7,15,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(16px)',
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={e => e.stopPropagation()}
        style={{
          width: '540px',
          maxWidth: '92vw',
          maxHeight: '90vh',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(0,240,255,0.3)',
          borderRadius: '14px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          overflowY: 'auto',
          boxShadow: '0 0 40px rgba(0,240,255,0.25)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.6rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#00f0ff', fontWeight: 700 }}>
              Publish to Sovereign Social Mesh
            </h3>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Air-gapped peer broadcast across machine-to-machine network
            </span>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Format Selector Pills (FB Wall / Reddit Discussion / YouTube Video) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.4rem', fontWeight: 600 }}>
            POST FORMAT
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            {[
              { id: 'wall', label: 'The Wall (FB)', icon: Users, color: '#38bdf8' },
              { id: 'reddit', label: 'Discussion (Reddit)', icon: TrendingUp, color: '#f59e0b' },
              { id: 'video', label: 'AuraTube Video (YT)', icon: Video, color: '#ec4899' },
            ].map(fmt => (
              <button
                type="button"
                key={fmt.id}
                onClick={() => setActiveFormat(fmt.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem',
                  borderRadius: '8px',
                  border: activeFormat === fmt.id ? `1.5px solid ${fmt.color}` : '1px solid rgba(255,255,255,0.1)',
                  backgroundColor: activeFormat === fmt.id ? 'rgba(2,6,23,0.9)' : 'rgba(2,6,23,0.4)',
                  color: activeFormat === fmt.id ? fmt.color : '#94a3b8',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <fmt.icon size={14} />
                <span>{fmt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sub-Aura Community Picker */}
        <div>
          <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
            TARGET COMMUNITY SUB-AURA
          </label>
          <select
            value={subAura}
            onChange={e => setSubAura(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: 'rgba(2,6,23,0.85)',
              border: '1px solid rgba(0,240,255,0.25)',
              borderRadius: '7px',
              color: '#f8fafc',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          >
            <option value="r/general">r/general (The Main Swarm)</option>
            <option value="r/local-llms">r/local-llms (Weights, Quants & MoE)</option>
            <option value="r/comfy-art">r/comfy-art (Diffusion, Wan 2.1 & Visual)</option>
            <option value="r/sovereign-mesh">r/sovereign-mesh (Decentralized Mesh & P2P)</option>
            <option value="r/novadev">r/novadev (Engineering & Kernel Core)</option>
            <option value="r/show-and-tell">r/show-and-tell (Demos & Projects)</option>
          </select>
        </div>

        {/* Title input (for Reddit and Video) */}
        {activeFormat !== 'wall' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
              TITLE / HEADLINE
            </label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={activeFormat === 'video' ? 'e.g. Fine-Tuning Wan 2.1 14B on Single RTX 4090' : 'e.g. Benchmarking Gemma-4 26B-A4B Active Parameter MoE'}
              required
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                backgroundColor: 'rgba(2,6,23,0.85)',
                border: '1px solid rgba(0,240,255,0.25)',
                borderRadius: '7px',
                color: '#f8fafc',
                fontSize: '0.84rem',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Reddit Specific: Post Flair Picker */}
        {activeFormat === 'reddit' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 600 }}>
              POST FLAIR
            </label>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {FLAIR_OPTIONS.map(flair => (
                <button
                  type="button"
                  key={flair}
                  onClick={() => setSelectedFlair(flair)}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '12px',
                    border: selectedFlair === flair ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: selectedFlair === flair ? 'rgba(16,185,129,0.2)' : 'rgba(2,6,23,0.5)',
                    color: selectedFlair === flair ? '#10b981' : '#94a3b8',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                  }}
                >
                  {flair}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Facebook Specific: Feeling / Activity Badge Picker */}
        {activeFormat === 'wall' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                FEELING / ACTIVITY
              </label>
              {selectedFeeling && (
                <button
                  type="button"
                  onClick={() => setSelectedFeeling(null)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.68rem', cursor: 'pointer' }}
                >
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {FEELING_OPTIONS.map(f => (
                <button
                  type="button"
                  key={f.label}
                  onClick={() => setSelectedFeeling(f)}
                  style={{
                    padding: '0.25rem 0.55rem',
                    borderRadius: '14px',
                    border: selectedFeeling?.label === f.label ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: selectedFeeling?.label === f.label ? 'rgba(245,158,11,0.2)' : 'rgba(2,6,23,0.5)',
                    color: selectedFeeling?.label === f.label ? '#f59e0b' : '#cbd5e1',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span>{f.emoji}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* YouTube Video Specifics: Duration, Chapters, Shorts Toggle */}
        {activeFormat === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', backgroundColor: 'rgba(2,6,23,0.6)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(236,72,153,0.25)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.5rem', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>MEDIA URL / PATH</label>
                <input
                  value={mediaUrl}
                  onChange={e => setMediaUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  style={{ width: '100%', padding: '0.45rem', backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '5px', color: '#f8fafc', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>DURATION</label>
                <input
                  value={videoDuration}
                  onChange={e => setVideoDuration(e.target.value)}
                  placeholder="Length, e.g. 4:20 (optional)"
                  style={{ width: '100%', padding: '0.45rem', backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(236,72,153,0.3)', borderRadius: '5px', color: '#f8fafc', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>FORMAT</label>
                <button
                  type="button"
                  onClick={() => setIsShort(!isShort)}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: '5px',
                    border: isShort ? '1px solid #ec4899' : '1px solid rgba(255,255,255,0.1)',
                    backgroundColor: isShort ? 'rgba(236,72,153,0.2)' : 'rgba(15,23,42,0.9)',
                    color: isShort ? '#ec4899' : '#94a3b8',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isShort ? '9:16 Reel' : '16:9 Video'}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.25rem' }}>CHAPTERS (1 PER LINE: "MM:SS Title")</label>
              <textarea
                value={videoChaptersText}
                onChange={e => setVideoChaptersText(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '0.45rem', backgroundColor: 'rgba(15,23,42,0.9)', border: '1px solid rgba(236,72,153,0.25)', borderRadius: '5px', color: '#cbd5e1', fontSize: '0.76rem', fontFamily: "'JetBrains Mono', monospace", outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}

        {/* Content Body */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
              POST CONTENT / BODY
            </label>
            
            {/* AI Polish Button */}
            <button
              type="button"
              onClick={handleAiPolish}
              disabled={isPolishing}
              style={{
                background: 'none',
                border: 'none',
                color: '#c084fc',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <Sparkles size={12} />
              <span>{isPolishing ? 'Polishing with Neural AI...' : '✨ Polish with AI'}</span>
            </button>
          </div>

          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            placeholder={activeFormat === 'wall' ? 'What are you working on or building today?' : 'Share your benchmarks, findings, architectural code, or discussions...'}
            required
            style={{
              width: '100%',
              padding: '0.65rem',
              backgroundColor: 'rgba(2,6,23,0.85)',
              border: '1px solid rgba(0,240,255,0.25)',
              borderRadius: '7px',
              color: '#f8fafc',
              fontSize: '0.84rem',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Multi-photo gallery inputs for Wall / Reddit */}
        {activeFormat !== 'video' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
                PHOTO GALLERY ATTACHMENTS (UP TO 4)
              </label>
              {galleryInputs.length < 4 && (
                <button
                  type="button"
                  onClick={handleAddGalleryField}
                  style={{ background: 'none', border: 'none', color: '#00f0ff', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  + Add Another Photo
                </button>
              )}
            </div>
            {galleryInputs.map((val, idx) => (
              <input
                key={idx}
                value={val}
                onChange={e => handleGalleryChange(idx, e.target.value)}
                placeholder={`Image URL ${idx + 1} (https://...)`}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.65rem',
                  backgroundColor: 'rgba(2,6,23,0.85)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.78rem',
                  outline: 'none',
                  marginBottom: '0.35rem',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>
        )}

        {submitError && (
          <div style={{ fontSize: '0.74rem', color: '#f87171' }}>{submitError}</div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            style={{
              padding: '0.5rem 1.4rem',
              backgroundColor: '#0284c7',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.82rem',
              boxShadow: '0 0 15px rgba(2,132,199,0.5)',
            }}
          >
            Broadcast to Mesh
          </button>
        </div>

      </form>
    </div>
  );
}
