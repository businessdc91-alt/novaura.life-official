// AuraTubePlayer.jsx — Sovereign Video Player with Custom Cyber Scrubber, Chapters & Speed Controls
import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, FastForward,
  RotateCcw, Sparkles, CheckCircle2, Bookmark, Share2, Layers
} from 'lucide-react';
import { toggleFollowUser, isFollowingUser } from '../../../services/sovereignMesh';
import PeerMedia from './PeerMedia';

export default function AuraTubePlayer({
  post,
  onTheaterToggle,
  isTheater = false,
  autoPlay = false,
}) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(260); // fallback ~4m20s
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeChapter, setActiveChapter] = useState(null);
  const [playNotice, setPlayNotice] = useState('');

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Parse duration if given as "04:20" string
  useEffect(() => {
    if (post?.videoDuration && typeof post.videoDuration === 'string') {
      const parts = post.videoDuration.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setDuration(parts[0] * 60 + parts[1]);
      } else if (parts.length === 3) {
        setDuration(parts[0] * 3600 + parts[1] * 60 + parts[2]);
      }
    }
    if (post?.authorHandle) {
      setIsFollowing(isFollowingUser(post.authorHandle));
    }
  }, [post]);

  // Video time updates
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  // Only direct video files play here; anything else gets an honest note
  // instead of a progress bar running over a still image.
  const togglePlay = () => {
    if (!post?.mediaUrl?.match(/\.(mp4|webm|ogg|mov)$/i)) {
      setPlayNotice('This post links to a page or image, not a video file. Only direct .mp4, .webm or .ogg links play here.');
      return;
    }
    if (!videoRef.current) return; // the video has not been loaded yet (click "Click to load" first)
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play().catch(() => setPlayNotice('This video could not be played.'));
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(pos * duration, duration));
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (videoRef.current) videoRef.current.muted = false;
    } else {
      setIsMuted(true);
      if (videoRef.current) videoRef.current.muted = true;
    }
  };

  const changeSpeed = (speed) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2800);
  };

  const handleFollowToggle = () => {
    if (!post?.authorHandle) return;
    const newState = toggleFollowUser(post.authorHandle, post.authorNodeId);
    setIsFollowing(newState);
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isDirectVideo = post?.mediaUrl && typeof post.mediaUrl === 'string' && post.mediaUrl.match(/\.(mp4|webm|ogg|mov)$/i);

  // Default Sovereign Video Chapters if none provided
  const chapters = post?.videoChapters?.length > 0 ? post.videoChapters : [
    { time: 0, title: 'Introduction & Node Setup' },
    { time: Math.floor(duration * 0.25), title: 'Model Architecture Breakdown' },
    { time: Math.floor(duration * 0.6), title: 'Live Sovereign Benchmark Run' },
    { time: Math.floor(duration * 0.85), title: 'Summary & Peer Transmission' },
  ];

  const jumpToChapter = (timeSecs) => {
    setCurrentTime(timeSecs);
    if (videoRef.current) videoRef.current.currentTime = timeSecs;
    if (!isPlaying) setIsPlaying(true);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      style={{
        position: 'relative',
        width: '100%',
        backgroundColor: '#020617',
        borderRadius: isFullscreen ? '0' : '10px',
        overflow: 'hidden',
        border: '1px solid rgba(236,72,153,0.35)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
      }}
    >
      {/* Viewport / Video Display */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          maxHeight: isTheater ? '65vh' : '420px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
        }}
        onClick={togglePlay}
      >
        {isDirectVideo ? (
          <PeerMedia
            kind="video"
            mediaRef={videoRef}
            authorDid={post.authorDid}
            src={post.mediaUrl}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onTimeUpdate={handleTimeUpdate}
            onEnded={() => setIsPlaying(false)}
            playsInline
          />
        ) : post?.thumbnail || post?.mediaUrl ? (
          <PeerMedia
            authorDid={post.authorDid}
            src={post.thumbnail || post.mediaUrl}
            alt="Video media thumbnail"
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isPlaying ? 0.9 : 0.7 }}
          />
        ) : (
          /* Generative Cyber Canvas Visualizer when offline/mesh */
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'radial-gradient(ellipse at center, rgba(236,72,153,0.2) 0%, rgba(15,23,42,0.95) 75%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(236,72,153,0.4) 0%, transparent 70%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: isPlaying ? 'pulse 2s infinite' : 'none',
              }}
            >
              <FastForward size={36} color="#ec4899" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                {post?.title || 'Sovereign Audio/Visual Media Stream'}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                No video file attached to this post
              </div>
            </div>
          </div>
        )}

        {playNotice && (
          <div style={{ position: 'absolute', top: '0.6rem', left: '0.6rem', right: '0.6rem', padding: '0.45rem 0.7rem', background: 'rgba(2,6,23,0.88)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', color: '#cbd5e1', fontSize: '0.72rem', zIndex: 2 }}>
            {playNotice}
          </div>
        )}

        {/* Big Central Play Button Overlay when paused */}
        {!isPlaying && (
          <div
            style={{
              position: 'absolute',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(236,72,153,0.9)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 25px rgba(236,72,153,0.7)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Play size={28} color="#fff" style={{ marginLeft: '4px' }} />
          </div>
        )}
      </div>

      {/* Cyber Scrubber & Controls Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(2,6,23,0.96) 0%, rgba(2,6,23,0.75) 70%, transparent 100%)',
          padding: '0.5rem 1rem 0.65rem',
          opacity: showControls || !isPlaying ? 1 : 0,
          transition: 'opacity 0.25s ease',
          pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
        }}
      >
        {/* Progress Bar / Scrubber */}
        <div
          onClick={handleSeek}
          style={{
            position: 'relative',
            width: '100%',
            height: '6px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          {/* Active Progress */}
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: '#ec4899',
              borderRadius: '3px',
              boxShadow: '0 0 10px rgba(236,72,153,0.8)',
              position: 'relative',
            }}
          >
            {/* Scrubber Knob */}
            <div
              style={{
                position: 'absolute',
                right: '-5px',
                top: '-4px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                boxShadow: '0 0 8px rgba(236,72,153,1)',
              }}
            />
          </div>
        </div>

        {/* Bottom Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Left Controls: Play/Pause, Volume, Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={togglePlay}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            {/* Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                onClick={toggleMute}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ width: '55px', accentColor: '#ec4899', cursor: 'pointer' }}
              />
            </div>

            {/* Time Display */}
            <div style={{ fontSize: '0.74rem', color: '#cbd5e1', fontFamily: "'JetBrains Mono', monospace" }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Right Controls: Speed, Theater, Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            
            {/* Speed Selector */}
            <select
              value={playbackSpeed}
              onChange={e => changeSpeed(parseFloat(e.target.value))}
              style={{
                backgroundColor: 'rgba(15,23,42,0.8)',
                border: '1px solid rgba(236,72,153,0.3)',
                borderRadius: '4px',
                color: '#ec4899',
                fontSize: '0.72rem',
                fontFamily: "'JetBrains Mono', monospace",
                padding: '0.15rem 0.35rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="0.5">0.5x</option>
              <option value="0.75">0.75x</option>
              <option value="1">1.0x</option>
              <option value="1.25">1.25x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2.0x</option>
            </select>

            {/* Theater Mode Toggle */}
            {onTheaterToggle && (
              <button
                onClick={onTheaterToggle}
                title={isTheater ? 'Default view' : 'Theater mode'}
                style={{ background: 'none', border: 'none', color: isTheater ? '#ec4899' : '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <Layers size={16} />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit full screen' : 'Full screen'}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>
          </div>

        </div>
      </div>

      {/* Video Footer: Channel Info & Chapter Quick Jumps */}
      <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(11,19,43,0.5)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        
        {/* Channel Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: post?.authorColor || '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#000' }}>
              {post?.authorName?.[0] || 'C'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f8fafc' }}>{post?.authorName || 'Creator Node'}</span>
                <CheckCircle2 size={13} color="#22d3ee" />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                @{post?.authorHandle}.nova
              </div>
            </div>
          </div>

          {/* Subscribe Button */}
          <button
            onClick={handleFollowToggle}
            style={{
              padding: '0.35rem 0.85rem',
              borderRadius: '20px',
              border: isFollowing ? '1px solid rgba(255,255,255,0.2)' : 'none',
              backgroundColor: isFollowing ? 'rgba(255,255,255,0.1)' : '#ec4899',
              color: '#fff',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {isFollowing ? 'Subscribed' : 'Subscribe'}
          </button>
        </div>

        {/* Chapters Accordion / Chip Rail */}
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          {chapters.map((ch, idx) => (
            <button
              key={idx}
              onClick={() => jumpToChapter(ch.time)}
              style={{
                flexShrink: 0,
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                backgroundColor: currentTime >= ch.time && (idx === chapters.length - 1 || currentTime < chapters[idx + 1].time)
                  ? 'rgba(236,72,153,0.25)'
                  : 'rgba(2,6,23,0.6)',
                border: currentTime >= ch.time && (idx === chapters.length - 1 || currentTime < chapters[idx + 1].time)
                  ? '1px solid #ec4899'
                  : '1px solid rgba(255,255,255,0.06)',
                color: '#e2e8f0',
                fontSize: '0.7rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              <span style={{ color: '#ec4899', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                {formatTime(ch.time)}
              </span>
              <span>{ch.title}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
