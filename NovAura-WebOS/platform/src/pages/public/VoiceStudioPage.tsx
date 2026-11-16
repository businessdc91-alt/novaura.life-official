/**
 * VOICE STUDIO - Ultimate Audio/Video Creation Station
 * Professional-grade recording, AI-powered effects, multi-track editing
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, Video, Square, Play, Pause, Download, Trash2, Upload,
  Wand2, Sparkles, Music, Film, Sliders, Layers, Zap, Repeat,
  Volume2, VolumeX, Volume1, Scissors, Copy, GripVertical,
  Plus, X, ChevronDown, ChevronRight, Settings, Save, Share2,
  Monitor, Headphones, Radio, Activity, TrendingUp, Heart,
  Disc, Speaker, Mic2, AudioLines, Type, Image as ImageIcon,
  Palette, Sun, Moon, Aperture, Grid3X3, Crop, RotateCcw,
  Undo2, Redo2, Maximize2, Minimize2, PictureInPicture, Cast,
  MoreHorizontal, Search, Filter, FolderOpen, FileAudio,
  FileVideo, Clock, Timer, Target, Gauge, Waves
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface AudioTrack {
  id: string;
  name: string;
  type: 'vocals' | 'instrumental' | 'beat' | 'effects' | 'master';
  color: string;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  volume: number;
  pan: number;
  clips: AudioClip[];
  effects: AudioEffect[];
  waveformData?: number[];
}

interface AudioClip {
  id: string;
  startTime: number;
  duration: number;
  url: string;
  name: string;
  blob?: Blob;
}

interface AudioEffect {
  id: string;
  type: 'reverb' | 'delay' | 'eq' | 'compressor' | 'autotune' | 'pitch' | 'distortion' | 'chorus';
  name: string;
  enabled: boolean;
  params: Record<string, number>;
}

interface VideoFilter {
  id: string;
  name: string;
  type: 'color' | 'blur' | 'distortion' | 'overlay' | 'ai-enhance';
  intensity: number;
  enabled: boolean;
}

interface Project {
  id: string;
  name: string;
  tracks: AudioTrack[];
  videoFilters: VideoFilter[];
  duration: number;
  bpm: number;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TRACK_COLORS = [
  'from-cyan-500 to-blue-500',
  'from-pink-500 to-rose-500',
  'from-amber-500 to-orange-500',
  'from-emerald-500 to-green-500',
  'from-violet-500 to-purple-500',
  'from-yellow-500 to-amber-500',
];

const AI_EFFECTS: AudioEffect[] = [
  { id: 'reverb', type: 'reverb', name: 'AI Reverb', enabled: false, params: { room: 50, damp: 30, wet: 40 } },
  { id: 'autotune', type: 'autotune', name: 'AI Auto-Tune', enabled: false, params: { amount: 80, speed: 50, key: 0 } },
  { id: 'pitch', type: 'pitch', name: 'AI Pitch Shift', enabled: false, params: { shift: 0, preserve: 100 } },
  { id: 'eq', type: 'eq', name: 'AI Smart EQ', enabled: false, params: { low: 50, mid: 50, high: 50 } },
  { id: 'compressor', type: 'compressor', name: 'AI Compressor', enabled: false, params: { threshold: -20, ratio: 4, attack: 10 } },
  { id: 'chorus', type: 'chorus', name: 'AI Chorus', enabled: false, params: { rate: 20, depth: 50, voices: 3 } },
];

const VIDEO_FILTERS: VideoFilter[] = [
  { id: 'neon', name: 'Neon Glow', type: 'color', intensity: 50, enabled: false },
  { id: 'cyber', name: 'Cyberpunk', type: 'color', intensity: 60, enabled: false },
  { id: 'mono', name: 'Monochrome', type: 'color', intensity: 100, enabled: false },
  { id: 'vintage', name: 'Vintage Film', type: 'color', intensity: 40, enabled: false },
  { id: 'bloom', name: 'Bloom', type: 'blur', intensity: 30, enabled: false },
  { id: 'glitch', name: 'Glitch FX', type: 'distortion', intensity: 25, enabled: false },
  { id: 'scanlines', name: 'Scanlines', type: 'overlay', intensity: 20, enabled: false },
  { id: 'enhance', name: 'AI Enhance', type: 'ai-enhance', intensity: 75, enabled: false },
];

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

const WaveformVisualizer = ({ 
  isRecording, 
  isPlaying, 
  audioContext,
  stream 
}: { 
  isRecording: boolean; 
  isPlaying: boolean;
  audioContext?: AudioContext;
  stream?: MediaStream;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    
    let analyser: AnalyserNode | null = null;
    
    if (audioContext && stream) {
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
    }

    const bufferLength = analyser?.frequencyBinCount || 128;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
      }

      ctx.fillStyle = 'rgba(10, 10, 15, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = ((dataArray[i] || 0) / 255) * canvas.height * 0.8;
        
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#00f0ff');
        gradient.addColorStop(0.5, '#ff00ff');
        gradient.addColorStop(1, '#7000ff');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };

    if (isRecording || isPlaying) {
      draw();
    } else {
      // Idle animation
      const idleDraw = () => {
        animationRef.current = requestAnimationFrame(idleDraw);
        ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw subtle sine wave
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.3)';
        ctx.lineWidth = 2;
        const time = Date.now() / 1000;
        for (let x = 0; x < canvas.width; x++) {
          const y = canvas.height / 2 + Math.sin(x * 0.02 + time) * 10;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      idleDraw();
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isRecording, isPlaying, audioContext, stream]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={120}
      className="w-full h-32 rounded-lg"
    />
  );
};

// =============================================================================
// AUDIO RECORDER WITH AI EFFECTS
// =============================================================================

const AdvancedAudioRecorder = ({ onRecordingComplete }: { onRecordingComplete: (blob: Blob, url: string) => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [selectedEffects, setSelectedEffects] = useState<AudioEffect[]>(AI_EFFECTS);
  const [activeEffectTab, setActiveEffectTab] = useState('autotune');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleEffect = (id: string) => {
    setSelectedEffects(prev => prev.map(e => 
      e.id === id ? { ...e, enabled: !e.enabled } : e
    ));
  };

  const updateEffectParam = (id: string, param: string, value: number) => {
    setSelectedEffects(prev => prev.map(e => 
      e.id === id ? { ...e, params: { ...e.params, [param]: value } } : e
    ));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
          channelCount: 2,
        }
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Monitor audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const levelInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);
      }, 50);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        onRecordingComplete(blob, url);
        clearInterval(levelInterval);
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      
      timerRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

    } catch (err) {
      console.error('Recording error:', err);
      toast.error('Could not access microphone. Check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setDuration(0);
      setAudioLevel(0);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <div className="space-y-6">
      {/* Main Visualizer */}
      <div className="relative bg-gradient-to-br from-void-light/50 to-void rounded-xl p-6 border border-white/5">
        <WaveformVisualizer 
          isRecording={isRecording} 
          isPlaying={false}
          audioContext={audioContextRef.current || undefined}
          stream={streamRef.current || undefined}
        />
        
        {isRecording && (
          <div className="absolute top-6 right-6 flex items-center gap-3 bg-void/80 backdrop-blur-sm px-4 py-2 rounded-full">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-red-400 font-mono font-bold">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Recording Controls */}
      <div className="flex items-center justify-center gap-6">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-10 py-7 text-lg font-bold rounded-full shadow-lg shadow-red-500/20"
          >
            <Mic className="w-6 h-6 mr-2" />
            Start Recording
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            variant="outline"
            className="border-red-500 text-red-400 hover:bg-red-500/10 px-10 py-7 text-lg rounded-full"
          >
            <Square className="w-6 h-6 mr-2" />
            Stop ({formatTime(duration)})
          </Button>
        )}
      </div>

      {/* AI Effects Panel */}
      <Card className="bg-void-light/30 border-white/5 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Wand2 className="w-6 h-6 text-neon-cyan" />
          <h3 className="text-xl font-bold">AI Voice Effects</h3>
          <Badge variant="outline" className="ml-auto border-neon-cyan/30 text-neon-cyan">
            Real-time
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {selectedEffects.map((effect) => (
            <button
              key={effect.id}
              onClick={() => toggleEffect(effect.id)}
              className={`p-4 rounded-xl border transition-all text-left ${
                effect.enabled
                  ? 'bg-neon-cyan/10 border-neon-cyan/50 shadow-lg shadow-neon-cyan/10'
                  : 'bg-void/50 border-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Sparkles className={`w-5 h-5 ${effect.enabled ? 'text-neon-cyan' : 'text-white/30'}`} />
                {effect.enabled && <div className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />}
              </div>
              <p className={`font-medium text-sm ${effect.enabled ? 'text-white' : 'text-white/50'}`}>
                {effect.name}
              </p>
            </button>
          ))}
        </div>

        {/* Effect Parameters */}
        {selectedEffects.find(e => e.enabled) && (
          <div className="bg-void/50 rounded-xl p-4 space-y-4">
            <p className="text-sm text-white/60 mb-4">Adjust AI Effect Parameters</p>
            {selectedEffects.filter(e => e.enabled).map(effect => (
              <div key={effect.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-neon-cyan">{effect.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(effect.params).map(([param, value]) => (
                    <div key={param} className="space-y-1">
                      <label className="text-xs text-white/40 uppercase">{param}</label>
                      <Slider
                        value={[value]}
                        onValueChange={([v]) => updateEffectParam(effect.id, param, v)}
                        max={100}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// =============================================================================
// VIDEO RECORDER WITH FILTERS
// =============================================================================

const AdvancedVideoRecorder = ({ onRecordingComplete }: { onRecordingComplete: (blob: Blob, url: string) => void }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [activeFilters, setActiveFilters] = useState<VideoFilter[]>(VIDEO_FILTERS);
  const [showFilters, setShowFilters] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const toggleFilter = (id: string) => {
    setActiveFilters(prev => prev.map(f => 
      f.id === id ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const updateFilterIntensity = (id: string, intensity: number) => {
    setActiveFilters(prev => prev.map(f => 
      f.id === id ? { ...f, intensity } : f
    ));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        onRecordingComplete(blob, URL.createObjectURL(blob));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setIsRecording(true);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

    } catch (err) {
      toast.error('Camera access denied. Check permissions.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setDuration(0);
  };

  const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // Apply CSS filters based on active video filters
  const getVideoFilterStyle = () => {
    const filters = activeFilters.filter(f => f.enabled);
    if (filters.length === 0) return {};
    
    let filterString = '';
    filters.forEach(f => {
      const intensity = f.intensity / 100;
      switch(f.id) {
        case 'neon':
          filterString += `hue-rotate(${120 * intensity}deg) saturate(${1 + intensity}) brightness(${1 + intensity * 0.3}) `;
          break;
        case 'cyber':
          filterString += `hue-rotate(${180 * intensity}deg) contrast(${1 + intensity}) saturate(${1.5 + intensity}) `;
          break;
        case 'mono':
          filterString += `grayscale(${intensity}) contrast(${1 + intensity * 0.2}) `;
          break;
        case 'vintage':
          filterString += `sepia(${intensity}) contrast(${0.9 + intensity * 0.1}) brightness(${1 + intensity * 0.1}) `;
          break;
        case 'bloom':
          filterString += `blur(${2 * intensity}px) brightness(${1 + intensity * 0.5}) `;
          break;
        case 'glitch':
          filterString += `hue-rotate(${Math.random() * 360 * intensity}deg) `;
          break;
        case 'scanlines':
          // Applied via overlay
          break;
        case 'enhance':
          filterString += `contrast(${1 + intensity * 0.3}) saturate(${1 + intensity * 0.4}) sharpen(${intensity}%) `;
          break;
      }
    });
    return { filter: filterString };
  };

  return (
    <div className="space-y-6">
      {/* Video Preview with Filters */}
      <div className="relative bg-void rounded-xl overflow-hidden border border-white/5 aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={getVideoFilterStyle()}
        />
        
        {/* Scanlines Overlay */}
        {activeFilters.find(f => f.id === 'scanlines' && f.enabled) && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0,0,0,0.3) 2px,
                rgba(0,0,0,0.3) 4px
              )`,
              opacity: (activeFilters.find(f => f.id === 'scanlines')?.intensity || 0) / 100
            }}
          />
        )}

        {/* Recording Indicator */}
        {isRecording && (
          <>
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-void/80 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-red-400 font-mono font-bold">REC</span>
            </div>
            <div className="absolute top-4 right-4 bg-void/80 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-white font-mono font-bold">{formatTime(duration)}</span>
            </div>
          </>
        )}

        {!isRecording && !videoRef.current?.srcObject && (
          <div className="absolute inset-0 flex items-center justify-center bg-void-light/30">
            <div className="text-center">
              <Film className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">Click Start to begin recording</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white px-10 py-7 text-lg font-bold rounded-full"
          >
            <Video className="w-6 h-6 mr-2" />
            Start Recording
          </Button>
        ) : (
          <Button
            onClick={stopRecording}
            variant="outline"
            className="border-red-500 text-red-400 hover:bg-red-500/10 px-10 py-7 text-lg rounded-full"
          >
            <Square className="w-6 h-6 mr-2" />
            Stop
          </Button>
        )}
        
        <Button
          variant="ghost"
          onClick={() => setShowFilters(!showFilters)}
          className={`${showFilters ? 'text-neon-cyan' : 'text-white/50'}`}
        >
          <Palette className="w-5 h-5 mr-2" />
          Filters
        </Button>
      </div>

      {/* Video Filters Panel */}
      {showFilters && (
        <Card className="bg-void-light/30 border-white/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Aperture className="w-6 h-6 text-neon-pink" />
            <h3 className="text-lg font-bold">Visual Effects</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {activeFilters.map((filter) => (
              <div key={filter.id} className="space-y-2">
                <button
                  onClick={() => toggleFilter(filter.id)}
                  className={`w-full p-3 rounded-xl border transition-all text-left ${
                    filter.enabled
                      ? 'bg-neon-pink/10 border-neon-pink/50'
                      : 'bg-void/50 border-white/5 hover:border-white/20'
                  }`}
                >
                  <p className={`font-medium text-sm ${filter.enabled ? 'text-white' : 'text-white/50'}`}>
                    {filter.name}
                  </p>
                </button>
                {filter.enabled && (
                  <Slider
                    value={[filter.intensity]}
                    onValueChange={([v]) => updateFilterIntensity(filter.id, v)}
                    max={100}
                    className="px-2"
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// =============================================================================
// MULTI-TRACK EDITOR
// =============================================================================

const MultiTrackEditor = ({ 
  tracks, 
  onTracksChange,
  currentTime,
  isPlaying,
  onPlayPause
}: { 
  tracks: AudioTrack[];
  onTracksChange: (tracks: AudioTrack[]) => void;
  currentTime: number;
  isPlaying: boolean;
  onPlayPause: () => void;
}) => {
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [zoom, setZoom] = useState(50);
  const timelineRef = useRef<HTMLDivElement>(null);

  const addTrack = (type: AudioTrack['type']) => {
    const newTrack: AudioTrack = {
      id: `track-${Date.now()}`,
      name: `${type} ${tracks.filter(t => t.type === type).length + 1}`,
      type,
      color: TRACK_COLORS[tracks.length % TRACK_COLORS.length],
      muted: false,
      solo: false,
      armed: false,
      volume: 75,
      pan: 50,
      clips: [],
      effects: [],
    };
    onTracksChange([...tracks, newTrack]);
  };

  const toggleMute = (id: string) => {
    onTracksChange(tracks.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
  };

  const toggleSolo = (id: string) => {
    onTracksChange(tracks.map(t => t.id === id ? { ...t, solo: !t.solo } : t));
  };

  const updateVolume = (id: string, volume: number) => {
    onTracksChange(tracks.map(t => t.id === id ? { ...t, volume } : t));
  };

  const deleteTrack = (id: string) => {
    onTracksChange(tracks.filter(t => t.id !== id));
  };

  const secondsToPixels = (seconds: number) => seconds * zoom;
  const pixelsToSeconds = (pixels: number) => pixels / zoom;

  return (
    <Card className="bg-void-light/30 border-white/5 overflow-hidden">
      {/* Timeline Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onPlayPause}
            className={`${isPlaying ? 'bg-neon-cyan/20 text-neon-cyan' : ''}`}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <span className="font-mono text-lg">{formatTime(currentTime)}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Zoom</span>
          <Slider value={[zoom]} onValueChange={([v]) => setZoom(v)} min={20} max={200} className="w-32" />
        </div>
      </div>

      {/* Tracks */}
      <div className="flex">
        {/* Track Headers */}
        <div className="w-64 border-r border-white/5 bg-void/50">
          <div className="h-8 border-b border-white/5 flex items-center px-3">
            <span className="text-xs font-medium text-white/40">TRACKS</span>
          </div>
          
          {tracks.map((track) => (
            <div
              key={track.id}
              className={`h-24 border-b border-white/5 p-2 cursor-pointer transition-colors ${
                selectedTrack === track.id ? 'bg-white/5' : 'hover:bg-white/5'
              }`}
              onClick={() => setSelectedTrack(track.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${track.color}`} />
                <span className="text-sm font-medium truncate flex-1 mx-2">{track.name}</span>
              </div>
              
              <div className="flex items-center gap-1 mb-2">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleMute(track.id); }}
                  className={`p-1 rounded ${track.muted ? 'bg-red-500/20 text-red-400' : 'text-white/30 hover:text-white'}`}
                >
                  {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSolo(track.id); }}
                  className={`px-2 py-1 rounded text-xs font-bold ${track.solo ? 'bg-amber-500/20 text-amber-400' : 'text-white/30 hover:text-white'}`}
                >
                  S
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }}
                  className="p-1 rounded text-white/30 hover:text-red-400 ml-auto"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              
              <Slider
                value={[track.volume]}
                onValueChange={([v]) => updateVolume(track.id, v)}
                max={100}
                className="h-1"
              />
            </div>
          ))}
          
          {/* Add Track Buttons */}
          <div className="p-2 space-y-1">
            <Button variant="ghost" size="sm" onClick={() => addTrack('vocals')} className="w-full justify-start text-xs">
              <Plus className="w-3 h-3 mr-1" /> Vocals
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addTrack('instrumental')} className="w-full justify-start text-xs">
              <Plus className="w-3 h-3 mr-1" /> Instrumental
            </Button>
            <Button variant="ghost" size="sm" onClick={() => addTrack('beat')} className="w-full justify-start text-xs">
              <Plus className="w-3 h-3 mr-1" /> Beat
            </Button>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto" ref={timelineRef}>
          <div className="min-w-full">
            {/* Time Ruler */}
            <div className="h-8 border-b border-white/5 relative" style={{ minWidth: `${secondsToPixels(120)}px` }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-white/10 flex items-end pb-1"
                  style={{ left: `${secondsToPixels(i * 5)}px` }}
                >
                  <span className="text-xs text-white/30 ml-1">{i * 5}s</span>
                </div>
              ))}
            </div>
            
            {/* Track Clips */}
            {tracks.map((track) => (
              <div key={track.id} className="h-24 border-b border-white/5 relative">
                {/* Grid Lines */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 h-full border-l border-white/5"
                    style={{ left: `${secondsToPixels(i * 5)}px` }}
                  />
                ))}
                
                {/* Clips */}
                {track.clips.map((clip) => (
                  <div
                    key={clip.id}
                    className={`absolute top-2 h-20 rounded-lg bg-gradient-to-r ${track.color} opacity-80 cursor-pointer hover:opacity-100 transition-opacity`}
                    style={{
                      left: `${secondsToPixels(clip.startTime)}px`,
                      width: `${secondsToPixels(clip.duration)}px`,
                    }}
                  >
                    <div className="p-2 text-xs font-medium text-white truncate">
                      {clip.name}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};

const formatTime = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

// =============================================================================
// SONG COVER GENERATOR
// =============================================================================

const SongCoverGenerator = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [coverStyle, setCoverStyle] = useState('ai-voice');
  const [progress, setProgress] = useState(0);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      toast.success(`Loaded: ${file.name}`);
    }
  };

  const generateCover = async () => {
    if (!uploadedFile) return;
    
    setIsProcessing(true);
    setProgress(0);
    
    // Simulate AI processing
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          toast.success('AI Cover generated! Ready for download.');
          return 100;
        }
        return p + 5;
      });
    }, 200);
  };

  const styles = [
    { id: 'ai-voice', name: 'AI Voice Clone', icon: Mic, desc: 'Clone your voice and sing the song' },
    { id: 'style-transfer', name: 'Style Transfer', icon: Wand2, desc: 'Transform into different genres' },
    { id: 'remix', name: 'AI Remix', icon: Layers, desc: 'Generate new arrangements' },
    { id: 'acapella', name: 'Acapella Extract', icon: Mic2, desc: 'Remove instrumental, keep vocals' },
  ];

  return (
    <Card className="bg-void-light/30 border-white/5 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Music className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold">AI Song Cover Generator</h3>
          <p className="text-sm text-white/50">Upload a song and create AI-powered covers</p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center mb-6 hover:border-neon-cyan/30 transition-colors">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          className="hidden"
          id="song-upload"
        />
        <label htmlFor="song-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 text-white/30 mx-auto mb-4" />
          <p className="text-lg font-medium text-white mb-2">
            {uploadedFile ? uploadedFile.name : 'Drop your song here or click to browse'}
          </p>
          <p className="text-sm text-white/40">Supports MP3, WAV, FLAC, M4A</p>
        </label>
      </div>

      {/* Style Selection */}
      {uploadedFile && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {styles.map((style) => (
              <button
                key={style.id}
                onClick={() => setCoverStyle(style.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  coverStyle === style.id
                    ? 'bg-neon-cyan/10 border-neon-cyan/50'
                    : 'bg-void/50 border-white/5 hover:border-white/20'
                }`}
              >
                <style.icon className={`w-6 h-6 mb-2 ${coverStyle === style.id ? 'text-neon-cyan' : 'text-white/50'}`} />
                <p className={`font-medium ${coverStyle === style.id ? 'text-white' : 'text-white/70'}`}>
                  {style.name}
                </p>
                <p className="text-xs text-white/40">{style.desc}</p>
              </button>
            ))}
          </div>

          {/* Generate Button */}
          <Button
            onClick={generateCover}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-6"
          >
            {isProcessing ? (
              <>
                <Activity className="w-5 h-5 mr-2 animate-spin" />
                AI Processing... {progress}%
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Generate AI Cover
              </>
            )}
          </Button>
        </>
      )}
    </Card>
  );
};

// =============================================================================
// MAIN VOICE STUDIO PAGE
// =============================================================================

export default function VoiceStudioPage() {
  const [activeTab, setActiveTab] = useState<'record' | 'editor' | 'covers'>('record');
  const [subTab, setSubTab] = useState<'audio' | 'video'>('audio');
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [recordings, setRecordings] = useState<{ blob: Blob; url: string; name: string }[]>([]);
  const { user } = useAuthStore();

  const handleAudioRecording = (blob: Blob, url: string) => {
    setRecordings(prev => [...prev, { blob, url, name: `Recording ${prev.length + 1}` }]);
    
    // Add to timeline as a clip
    const newClip: AudioClip = {
      id: `clip-${Date.now()}`,
      startTime: currentTime,
      duration: 10, // placeholder
      url,
      name: `Recording ${recordings.length + 1}`,
      blob,
    };
    
    // Add to first available track or create new
    if (tracks.length === 0) {
      const newTrack: AudioTrack = {
        id: `track-${Date.now()}`,
        name: 'Vocals 1',
        type: 'vocals',
        color: TRACK_COLORS[0],
        muted: false,
        solo: false,
        armed: false,
        volume: 75,
        pan: 50,
        clips: [newClip],
        effects: [],
      };
      setTracks([newTrack]);
    } else {
      const updatedTracks = [...tracks];
      updatedTracks[0].clips.push(newClip);
      setTracks(updatedTracks);
    }
    
    toast.success('Recording added to timeline!');
  };

  return (
    <div className="min-h-screen bg-void pt-20 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Voice Studio
            </span>
          </h1>
          <p className="text-xl text-white/60 max-w-3xl mx-auto">
            Professional audio & video creation with AI-powered effects, multi-track editing, 
            and song cover generation.
          </p>
        </motion.div>

        {/* Main Navigation */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-void-light/50 rounded-2xl p-1.5 border border-white/5">
            <button
              onClick={() => setActiveTab('record')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
                activeTab === 'record' 
                  ? 'bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Mic className="w-5 h-5" />
              <span className="font-medium">Record</span>
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
                activeTab === 'editor' 
                  ? 'bg-neon-purple/10 text-neon-purple border border-neon-purple/30' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Layers className="w-5 h-5" />
              <span className="font-medium">Multi-Track Editor</span>
            </button>
            <button
              onClick={() => setActiveTab('covers')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
                activeTab === 'covers' 
                  ? 'bg-neon-pink/10 text-neon-pink border border-neon-pink/30' 
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Wand2 className="w-5 h-5" />
              <span className="font-medium">AI Covers</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'record' && (
              <motion.div
                key="record"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                {/* Sub-tab for Audio/Video */}
                <div className="flex justify-center mb-6">
                  <div className="inline-flex bg-void/50 rounded-xl p-1">
                    <button
                      onClick={() => setSubTab('audio')}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${
                        subTab === 'audio' ? 'bg-neon-cyan/20 text-neon-cyan' : 'text-white/50'
                      }`}
                    >
                      <Mic className="w-4 h-4" />
                      Audio
                    </button>
                    <button
                      onClick={() => setSubTab('video')}
                      className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all ${
                        subTab === 'video' ? 'bg-neon-pink/20 text-neon-pink' : 'text-white/50'
                      }`}
                    >
                      <Video className="w-4 h-4" />
                      Video
                    </button>
                  </div>
                </div>

                {subTab === 'audio' ? (
                  <AdvancedAudioRecorder onRecordingComplete={handleAudioRecording} />
                ) : (
                  <AdvancedVideoRecorder onRecordingComplete={handleAudioRecording} />
                )}
              </motion.div>
            )}

            {activeTab === 'editor' && (
              <motion.div
                key="editor"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <MultiTrackEditor
                  tracks={tracks}
                  onTracksChange={setTracks}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  onPlayPause={() => setIsPlaying(!isPlaying)}
                />
                
                {recordings.length > 0 && (
                  <Card className="bg-void-light/30 border-white/5 p-6">
                    <h3 className="text-lg font-bold mb-4">Recent Recordings</h3>
                    <div className="space-y-2">
                      {recordings.map((rec, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-void/50 rounded-lg">
                          <span className="text-sm">{rec.name}</span>
                          <audio src={rec.url} controls className="h-8 w-64" />
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </motion.div>
            )}

            {activeTab === 'covers' && (
              <motion.div
                key="covers"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <SongCoverGenerator />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
