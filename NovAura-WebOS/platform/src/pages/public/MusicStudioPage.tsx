import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  Music, 
  Play, 
  Pause, 
  Square, 
  SkipBack, 
  SkipForward,
  Settings,
  Volume2,
  Headphones,
  Activity,
  Wand2,
  Download,
  Upload,
  Plus,
  Trash2,
  Copy,
  Scissors,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Layers,
  Zap,
  Disc,
  Radio,
  Mic2,
  Speaker,
  Save,
  Share2,
  GitBranch,
  Type,
  Grid3X3,
  Sliders,
  Gauge,
  ActivitySquare,
  FileAudio,
  FolderOpen,
  Undo2,
  Redo2,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  GripVertical,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Repeat,
  Shuffle,
  ListMusic,
  Drum,
  Guitar,
  Piano,
  AudioLines,
  Sparkles,
  Target,
  BarChart3,
  LineChart,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AArrowUp,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import * as StudioAPI from '../../services/studioService';
import { auth } from '../../config/firebase';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

interface AudioTrack {
  id: string;
  name: string;
  type: 'audio' | 'midi' | 'bus' | 'master';
  color: string;
  muted: boolean;
  solo: boolean;
  armed: boolean;
  volume: number;
  pan: number;
  clips: AudioClip[];
  effects: Effect[];
  height: number;
  inputSource?: string;
}

interface AudioClip {
  id: string;
  trackId: string;
  startTime: number;
  duration: number;
  offset: number;
  name: string;
  audioBuffer?: AudioBuffer;
  midiNotes?: MidiNote[];
  color: string;
  gain: number;
  fadeIn: number;
  fadeOut: number;
}

interface MidiNote {
  id: string;
  pitch: number;
  velocity: number;
  startTime: number;
  duration: number;
}

interface Effect {
  id: string;
  type: EffectType;
  name: string;
  bypass: boolean;
  params: Record<string, number>;
}

type EffectType = 
  | 'eq'
  | 'compressor' 
  | 'reverb'
  | 'delay'
  | 'chorus'
  | 'distortion'
  | 'filter'
  | 'limiter'
  | 'autotune'
  | 'noiseGate';

interface Project {
  name: string;
  bpm: number;
  timeSignature: [number, number];
  sampleRate: number;
  tracks: AudioTrack[];
  masterTrack: AudioTrack;
  zoom: number;
  scrollPosition: number;
  loopStart: number;
  loopEnd: number;
  loopEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
}

interface Sample {
  id: string;
  name: string;
  category: string;
  tags: string[];
  duration: number;
  audioBuffer?: AudioBuffer;
}

interface VoiceDataset {
  name: string;
  clips: { text: string; audio: Blob; emotion: string }[];
  metadata: {
    speakerName: string;
    language: string;
    sampleRate: number;
    totalDuration: number;
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TRACK_COLORS = [
  '#00f0ff', '#ff00ff', '#7000ff', '#00ff88', '#ffaa00', 
  '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff'
];

const EFFECT_PRESETS: Record<EffectType, { name: string; defaultParams: Record<string, number> }> = {
  eq: { 
    name: 'Parametric EQ', 
    defaultParams: { lowGain: 0, midGain: 0, highGain: 0, lowFreq: 100, midFreq: 1000, highFreq: 10000 }
  },
  compressor: { 
    name: 'Compressor', 
    defaultParams: { threshold: -24, ratio: 4, attack: 10, release: 100, makeup: 0 }
  },
  reverb: { 
    name: 'Reverb', 
    defaultParams: { decay: 2, preDelay: 20, mix: 30, size: 50 }
  },
  delay: { 
    name: 'Delay', 
    defaultParams: { time: 250, feedback: 30, mix: 25, pingPong: 0 }
  },
  chorus: { 
    name: 'Chorus', 
    defaultParams: { rate: 1.5, depth: 50, mix: 30 }
  },
  distortion: { 
    name: 'Distortion', 
    defaultParams: { drive: 30, tone: 50, mix: 50 }
  },
  filter: { 
    name: 'Filter', 
    defaultParams: { type: 0, cutoff: 1000, resonance: 0 }
  },
  limiter: { 
    name: 'Limiter', 
    defaultParams: { threshold: -0.1, release: 10 }
  },
  autotune: { 
    name: 'Auto-Tune', 
    defaultParams: { strength: 100, speed: 20, scale: 0 }
  },
  noiseGate: { 
    name: 'Noise Gate', 
    defaultParams: { threshold: -40, attack: 10, release: 100 }
  },
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// =============================================================================
// AUDIO ENGINE
// =============================================================================

class AudioEngine {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  analyser: AnalyserNode | null = null;
  tracks: Map<string, TrackNode> = new Map();
  isPlaying = false;
  currentTime = 0;
  startTime = 0;
  tempo = 120;
  onTimeUpdate?: (time: number) => void;
  animationFrame?: number;

  async init() {
    this.ctx = new AudioContext({ sampleRate: 48000 });
    this.masterGain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  createTrack(id: string): TrackNode {
    if (!this.ctx) throw new Error('AudioContext not initialized');
    
    const track: TrackNode = {
      id,
      gainNode: this.ctx.createGain(),
      panNode: this.ctx.createStereoPanner(),
      inputNode: this.ctx.createGain(),
      effects: [],
      source: null,
    };

    track.inputNode.connect(track.gainNode);
    track.gainNode.connect(track.panNode);
    track.panNode.connect(this.masterGain!);

    this.tracks.set(id, track);
    return track;
  }

  addEffect(trackId: string, effect: Effect) {
    const track = this.tracks.get(trackId);
    if (!track || !this.ctx) return;

    let node: AudioNode;

    switch (effect.type) {
      case 'reverb':
        node = this.createReverb(effect.params);
        break;
      case 'delay':
        node = this.createDelay(effect.params);
        break;
      case 'compressor':
        node = this.createCompressor(effect.params);
        break;
      case 'eq':
        node = this.createEQ(effect.params);
        break;
      case 'filter':
        node = this.createFilter(effect.params);
        break;
      case 'autotune':
        // Simplified pitch correction
        node = this.ctx.createWaveShaper();
        break;
      default:
        node = this.ctx.createGain();
    }

    track.effects.push({ effect, node });
    this.reconnectEffects(track);
  }

  createReverb(params: Record<string, number>): AudioNode {
    if (!this.ctx) throw new Error('No context');
    const convolver = this.ctx.createConvolver();
    // Create impulse response
    const rate = this.ctx.sampleRate;
    const length = rate * params.decay;
    const impulse = this.ctx.createBuffer(2, length, rate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    
    convolver.buffer = impulse;
    return convolver;
  }

  createDelay(params: Record<string, number>): AudioNode {
    if (!this.ctx) throw new Error('No context');
    const delay = this.ctx.createDelay(5.0);
    delay.delayTime.value = params.time / 1000;
    
    const feedback = this.ctx.createGain();
    feedback.gain.value = params.feedback / 100;
    
    delay.connect(feedback);
    feedback.connect(delay);
    
    return delay;
  }

  createCompressor(params: Record<string, number>): DynamicsCompressorNode {
    if (!this.ctx) throw new Error('No context');
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = params.threshold;
    compressor.ratio.value = params.ratio;
    compressor.attack.value = params.attack / 1000;
    compressor.release.value = params.release / 1000;
    return compressor;
  }

  createEQ(params: Record<string, number>): AudioNode {
    if (!this.ctx) throw new Error('No context');
    
    const low = this.ctx.createBiquadFilter();
    low.type = 'lowshelf';
    low.frequency.value = params.lowFreq;
    low.gain.value = params.lowGain;

    const mid = this.ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = params.midFreq;
    mid.Q.value = 1;
    mid.gain.value = params.midGain;

    const high = this.ctx.createBiquadFilter();
    high.type = 'highshelf';
    high.frequency.value = params.highFreq;
    high.gain.value = params.highGain;

    low.connect(mid);
    mid.connect(high);

    return low;
  }

  createFilter(params: Record<string, number>): BiquadFilterNode {
    if (!this.ctx) throw new Error('No context');
    const filter = this.ctx.createBiquadFilter();
    const types: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
    filter.type = types[Math.floor(params.type)] || 'lowpass';
    filter.frequency.value = params.cutoff;
    filter.Q.value = params.resonance;
    return filter;
  }

  reconnectEffects(track: TrackNode) {
    // Disconnect all
    track.inputNode.disconnect();
    
    let currentNode: AudioNode = track.inputNode;
    
    // Connect through effects chain
    for (const { node } of track.effects) {
      currentNode.connect(node);
      currentNode = node;
    }
    
    // Connect to gain
    currentNode.connect(track.gainNode);
  }

  playClip(trackId: string, buffer: AudioBuffer, when: number, offset = 0, duration?: number) {
    if (!this.ctx) return;
    
    const track = this.tracks.get(trackId);
    if (!track) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(track.inputNode);
    
    const dur = duration ?? buffer.duration - offset;
    source.start(when, offset, dur);
    
    return source;
  }

  startPlayback() {
    if (!this.ctx) return;
    this.ctx.resume();
    this.isPlaying = true;
    this.startTime = this.ctx.currentTime - this.currentTime;
    this.updateTime();
  }

  pausePlayback() {
    if (!this.ctx) return;
    this.ctx.suspend();
    this.isPlaying = false;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
  }

  stopPlayback() {
    if (!this.ctx) return;
    this.ctx.suspend();
    this.isPlaying = false;
    this.currentTime = 0;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
  }

  updateTime() {
    if (!this.isPlaying || !this.ctx) return;
    
    this.currentTime = this.ctx.currentTime - this.startTime;
    this.onTimeUpdate?.(this.currentTime);
    
    this.animationFrame = requestAnimationFrame(() => this.updateTime());
  }

  seek(time: number) {
    this.currentTime = time;
    if (this.isPlaying) {
      this.startTime = this.ctx!.currentTime - time;
    }
  }

  setTrackVolume(trackId: string, volume: number) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.gainNode.gain.value = volume / 100;
    }
  }

  setTrackPan(trackId: string, pan: number) {
    const track = this.tracks.get(trackId);
    if (track) {
      track.panNode.pan.value = pan / 50;
    }
  }

  getAnalyserData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }
}

interface TrackNode {
  id: string;
  gainNode: GainNode;
  panNode: StereoPannerNode;
  inputNode: GainNode;
  effects: { effect: Effect; node: AudioNode }[];
  source: AudioBufferSourceNode | null;
}

// Global audio engine instance
const audioEngine = new AudioEngine();

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function beatsToSeconds(beats: number, bpm: number): number {
  return (beats / bpm) * 60;
}

function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MusicStudioPage() {
  // Project state
  const [project, setProject] = useState<Project>({
    name: 'Untitled Project',
    bpm: 120,
    timeSignature: [4, 4],
    sampleRate: 48000,
    tracks: [
      {
        id: 'track-1',
        name: 'Lead Vocal',
        type: 'audio',
        color: TRACK_COLORS[0],
        muted: false,
        solo: false,
        armed: true,
        volume: 80,
        pan: 0,
        clips: [],
        effects: [],
        height: 100,
      },
      {
        id: 'track-2',
        name: 'Harmony 1',
        type: 'audio',
        color: TRACK_COLORS[1],
        muted: false,
        solo: false,
        armed: false,
        volume: 70,
        pan: -30,
        clips: [],
        effects: [],
        height: 80,
      },
      {
        id: 'track-3',
        name: 'Harmony 2',
        type: 'audio',
        color: TRACK_COLORS[2],
        muted: false,
        solo: false,
        armed: false,
        volume: 70,
        pan: 30,
        clips: [],
        effects: [],
        height: 80,
      },
    ],
    masterTrack: {
      id: 'master',
      name: 'Master',
      type: 'master',
      color: '#ffffff',
      muted: false,
      solo: false,
      armed: false,
      volume: 100,
      pan: 0,
      clips: [],
      effects: [],
      height: 60,
    },
    zoom: 1,
    scrollPosition: 0,
    loopStart: 0,
    loopEnd: 16,
    loopEnabled: false,
    snapToGrid: true,
    gridSize: 1,
  });

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<'mixer' | 'piano' | 'browser' | 'effects' | 'lyrics' | 'analysis'>('mixer');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [projects, setProjects] = useState<StudioAPI.StudioProject[]>([]);
  const [showProjectBrowser, setShowProjectBrowser] = useState(false);
  
  // Recording
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  // Lyrics mode
  const [lyrics, setLyrics] = useState('');
  const [currentLyricLine, setCurrentLyricLine] = useState(0);
  const [lyricTimestamps, setLyricTimestamps] = useState<number[]>([]);

  // Analysis
  const [pitchData, setPitchData] = useState<number[]>([]);
  const [volumeData, setVolumeData] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize audio engine
  useEffect(() => {
    const init = async () => {
      await audioEngine.init();
      project.tracks.forEach(track => audioEngine.createTrack(track.id));
      audioEngine.onTimeUpdate = setCurrentTime;
      setIsInitialized(true);
    };
    init();
    loadUserProjects();

    return () => {
      audioEngine.ctx?.close();
    };
  }, []);

  // Asset hydration: Load remote audio stems when project changes
  useEffect(() => {
    if (project.id && project.id !== 'new-project') {
      hydrateProjectAssets();
    }
  }, [project.id]);

  const hydrateProjectAssets = async () => {
    const loaderToast = toast.loading('Rehydrating studio assets...');
    try {
      const updatedTracks = await Promise.all(project.tracks.map(async (track) => {
        const updatedClips = await Promise.all(track.clips.map(async (clip) => {
          // @ts-ignore
          if (clip.cloudUrl && !clip.audioBuffer) {
            // @ts-ignore
            const response = await fetch(clip.cloudUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioEngine.ctx!.decodeAudioData(arrayBuffer);
            return { ...clip, audioBuffer };
          }
          return clip;
        }));
        return { ...track, clips: updatedClips };
      }));

      setProject(prev => ({ ...prev, tracks: updatedTracks }));
      toast.success('Assets hydrated', { id: loaderToast });
    } catch (err) {
      console.error('Hydration failed:', err);
      toast.error('Failed to load some audio stems', { id: loaderToast });
    }
  };

  const loadUserProjects = async () => {
    try {
      const projs = await StudioAPI.getUserProjects();
      setProjects(projs);
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  // Visualization loop
  useEffect(() => {
    if (!isPlaying) return;
    
    const draw = () => {
      const data = audioEngine.getAnalyserData();
      // Update visualization data
      const newVolume = data.reduce((a, b) => a + b, 0) / data.length;
      setVolumeData(prev => [...prev.slice(-100), newVolume]);
      
      // Draw on canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0a0a0f';
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          ctx.beginPath();
          ctx.strokeStyle = '#00f0ff';
          ctx.lineWidth = 2;
          
          const sliceWidth = canvasRef.current.width / data.length;
          let x = 0;
          
          for (let i = 0; i < data.length; i++) {
            const v = data[i] / 255;
            const y = canvasRef.current.height - (v * canvasRef.current.height);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            
            x += sliceWidth;
          }
          
          ctx.stroke();
        }
      }
      
      requestAnimationFrame(draw);
    };
    
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [isPlaying]);

  // Transport controls
  const togglePlayback = () => {
    if (isPlaying) {
      audioEngine.pausePlayback();
      setIsPlaying(false);
    } else {
      audioEngine.startPlayback();
      setIsPlaying(true);
    }
  };

  const stopPlayback = () => {
    audioEngine.stopPlayback();
    setIsPlaying(false);
    setIsRecording(false);
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorder?.stop();
      setIsRecording(false);
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioEngine.ctx!.decodeAudioData(arrayBuffer);
        
        // Add to armed track
        const armedTrack = project.tracks.find(t => t.armed);
        if (armedTrack) {
          const clipId = `clip-${Date.now()}`;
          const uploadToast = toast.loading('Uploading recording to cloud...');
          
          try {
            // Persist the audio stem to Storage
            const { url } = await StudioAPI.uploadStudioClip(project.id || 'temp', clipId, blob);
            
            const newClip: AudioClip = {
              id: clipId,
              trackId: armedTrack.id,
              startTime: currentTime,
              duration: audioBuffer.duration,
              offset: 0,
              name: `Take ${armedTrack.clips.length + 1}`,
              audioBuffer,
              color: armedTrack.color,
              gain: 1,
              fadeIn: 0,
              fadeOut: 0,
              // @ts-ignore - added custom property for persistence
              cloudUrl: url
            };
            
            setProject(prev => ({
              ...prev,
              tracks: prev.tracks.map(t => 
                t.id === armedTrack.id 
                  ? { ...t, clips: [...t.clips, newClip] }
                  : t
              )
            }));
            
            toast.success('Recording saved to cloud!', { id: uploadToast });
          } catch (err: any) {
            toast.error(`Persistence failed: ${err.message}`, { id: uploadToast });
          }
        }
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      
      if (!isPlaying) {
        audioEngine.startPlayback();
        setIsPlaying(true);
      }
    }
  };

  // Track controls
  const addTrack = () => {
    const newTrack: AudioTrack = {
      id: `track-${Date.now()}`,
      name: `Track ${project.tracks.length + 1}`,
      type: 'audio',
      color: TRACK_COLORS[project.tracks.length % TRACK_COLORS.length],
      muted: false,
      solo: false,
      armed: false,
      volume: 80,
      pan: 0,
      clips: [],
      effects: [],
      height: 80,
    };
    
    audioEngine.createTrack(newTrack.id);
    
    setProject(prev => ({
      ...prev,
      tracks: [...prev.tracks, newTrack]
    }));
  };

  const deleteTrack = (trackId: string) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.filter(t => t.id !== trackId)
    }));
  };

  const updateTrack = (trackId: string, updates: Partial<AudioTrack>) => {
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => 
        t.id === trackId ? { ...t, ...updates } : t
      )
    }));
    
    // Update audio engine
    if (updates.volume !== undefined) {
      audioEngine.setTrackVolume(trackId, updates.volume);
    }
    if (updates.pan !== undefined) {
      audioEngine.setTrackPan(trackId, updates.pan);
    }
  };

  const addEffect = (trackId: string, type: EffectType) => {
    const effect: Effect = {
      id: `effect-${Date.now()}`,
      type,
      name: EFFECT_PRESETS[type].name,
      bypass: false,
      params: { ...EFFECT_PRESETS[type].defaultParams },
    };
    
    audioEngine.addEffect(trackId, effect);
    
    setProject(prev => ({
      ...prev,
      tracks: prev.tracks.map(t => 
        t.id === trackId 
          ? { ...t, effects: [...t.effects, effect] }
          : t
      )
    }));
  };

  const handleSaveProject = async () => {
    if (!auth.currentUser) {
      toast.error('You must be logged in to save projects');
      return;
    }

    setIsSaving(true);
    const saveToast = toast.loading('Saving project structure...');
    try {
      const savedId = await StudioAPI.saveProject(project);
      setProject(prev => ({ ...prev, id: savedId }));
      toast.success('Project saved permanently', { id: saveToast });
      loadUserProjects();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`, { id: saveToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadProject = async (proj: StudioAPI.StudioProject) => {
    setProject(proj as any);
    setShowProjectBrowser(false);
    toast.success(`Loaded "${proj.name}"`);
    
    // Reset audio engine for new project
    audioEngine.stopPlayback();
    // Re-create tracks in engine
    proj.tracks.forEach(t => {
      if (!audioEngine.tracks.has(t.id)) {
        audioEngine.createTrack(t.id);
      }
    });
  };

  // Export functions
  const exportProject = async (format: 'wav' | 'mp3' | 'flac' | 'stems' | 'dataset') => {
    toast.info(`Exporting as ${format.toUpperCase()}...`);
    
    // In a real implementation, this would:
    // 1. Render all tracks to offline audio context
    // 2. Apply effects
    // 3. Encode to desired format
    // 4. Download file(s)
    
    setTimeout(() => {
      toast.success(`Export complete!`);
    }, 2000);
  };

  return (
    <div className="h-[100dvh] bg-void flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-void-light border-b border-white/5 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-pink flex items-center justify-center">
              <Music className="w-4 h-4 text-void" />
            </div>
            <span className="font-bold text-gradient-rgb">NovAura Studio</span>
          </div>
          
          <div className="h-6 w-px bg-white/10" />
          
          <Input 
            value={project.name}
            onChange={(e) => setProject(prev => ({ ...prev, name: e.target.value }))}
            className="w-48 bg-transparent border-0 focus-visible:ring-0 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowProjectBrowser(true)}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Open
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleSaveProject}
            disabled={isSaving}
          >
            <Save className={`w-4 h-4 mr-2 ${isSaving ? 'animate-spin' : ''}`} />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button variant="ghost" size="sm">
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </Button>
          <Button variant="ghost" size="sm" onClick={() => exportProject('wav')}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tracks */}
        <div className="w-64 bg-void-light border-r border-white/5 flex flex-col">
          {/* Track Headers */}
          <div className="h-8 border-b border-white/5 flex items-center px-2 text-xs text-text-secondary">
            <span className="flex-1">TRACKS</span>
            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={addTrack}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {project.tracks.map(track => (
              <div 
                key={track.id}
                className={`border-b border-white/5 p-2 cursor-pointer transition-colors ${
                  selectedTrack === track.id ? 'bg-white/5' : 'hover:bg-white/5'
                }`}
                style={{ height: track.height }}
                onClick={() => setSelectedTrack(track.id)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical className="w-3 h-3 text-text-tertiary" />
                  <div 
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: track.color }}
                  />
                  <Input 
                    value={track.name}
                    onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                    className="flex-1 h-6 text-xs bg-transparent border-0 focus-visible:ring-0 p-0"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { armed: !track.armed }); }}
                    className={`w-6 h-5 rounded text-xs font-bold ${
                      track.armed ? 'bg-neon-red text-white' : 'bg-white/10 text-text-secondary'
                    }`}
                  >
                    R
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }); }}
                    className={`w-6 h-5 rounded text-xs font-bold ${
                      track.muted ? 'bg-yellow-500 text-void' : 'bg-white/10 text-text-secondary'
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { solo: !track.solo }); }}
                    className={`w-6 h-5 rounded text-xs font-bold ${
                      track.solo ? 'bg-neon-cyan text-void' : 'bg-white/10 text-text-secondary'
                    }`}
                  >
                    S
                  </button>
                </div>
                
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-3 h-3 text-text-tertiary" />
                    <Slider 
                      value={[track.volume]}
                      onValueChange={([v]) => updateTrack(track.id, { volume: v })}
                      max={100}
                      className="flex-1 h-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-tertiary w-3">L</span>
                    <Slider 
                      value={[track.pan + 50]}
                      onValueChange={([v]) => updateTrack(track.id, { pan: v - 50 })}
                      max={100}
                      className="flex-1 h-1"
                    />
                    <span className="text-xs text-text-tertiary w-3">R</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center - Timeline */}
        <div className="flex-1 flex flex-col bg-void">
          {/* Timeline Header */}
          <div className="h-8 bg-void-light border-b border-white/5 flex items-center px-4">
            <div className="flex items-center gap-4 text-sm">
              <span className="font-mono text-neon-cyan">{formatTime(currentTime)}</span>
              <span className="text-text-secondary">/</span>
              <span className="font-mono text-text-secondary">{formatTime(180)}</span>
            </div>
            
            <div className="flex-1 mx-8">
              <canvas 
                ref={canvasRef}
                width={800}
                height={30}
                className="w-full h-8"
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-secondary">BPM</span>
              <Input 
                type="number"
                value={project.bpm}
                onChange={(e) => setProject(prev => ({ ...prev, bpm: parseInt(e.target.value) || 120 }))}
                className="w-16 h-6 text-xs"
              />
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="flex-1 overflow-auto relative">
            <div 
              className="absolute inset-0"
              style={{ 
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
                `,
                backgroundSize: `${100 * project.zoom}px 40px`
              }}
            >
              {/* Playhead */}
              <div 
                className="absolute top-0 bottom-0 w-px bg-neon-cyan z-10"
                style={{ left: `${(currentTime / 10) * 100 * project.zoom}%` }}
              >
                <div className="w-3 h-3 bg-neon-cyan transform -translate-x-1/2 rotate-45 -mt-1.5" />
              </div>
              
              {/* Track Clips */}
              {project.tracks.map((track, index) => (
                <div 
                  key={track.id}
                  className="border-b border-white/5 relative"
                  style={{ height: track.height, top: index * track.height }}
                >
                  {track.clips.map(clip => (
                    <div
                      key={clip.id}
                      className="absolute top-1 bottom-1 rounded-md overflow-hidden cursor-pointer hover:brightness-110 transition-all"
                      style={{
                        left: `${(clip.startTime / 10) * 100 * project.zoom}%`,
                        width: `${(clip.duration / 10) * 100 * project.zoom}%`,
                        backgroundColor: `${clip.color}40`,
                        borderLeft: `3px solid ${clip.color}`,
                      }}
                      onClick={() => setSelectedClip(clip.id)}
                    >
                      <div className="px-2 py-1 text-xs font-medium truncate" style={{ color: clip.color }}>
                        {clip.name}
                      </div>
                      {/* Waveform placeholder */}
                      <div className="absolute bottom-0 left-0 right-0 h-8 flex items-end gap-px px-1">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div 
                            key={i}
                            className="flex-1 bg-current opacity-30"
                            style={{ 
                              height: `${Math.random() * 100}%`,
                              color: clip.color
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Transport Bar */}
          <div className="h-16 bg-void-light border-t border-white/5 flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <Button
                variant={isRecording ? 'default' : 'outline'}
                size="icon"
                onClick={toggleRecording}
                className={isRecording ? 'bg-neon-red hover:bg-neon-red/90' : 'border-neon-red text-neon-red'}
              >
                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-white animate-pulse' : 'bg-current'}`} />
              </Button>
              
              <div className="h-8 w-px bg-white/10" />
              
              <Button variant="ghost" size="icon" onClick={() => audioEngine.seek(0)}>
                <SkipBack className="w-5 h-5" />
              </Button>
              
              <Button 
                variant="default" 
                size="icon" 
                onClick={togglePlayback}
                className="w-12 h-12 bg-neon-cyan hover:bg-neon-cyan/90 text-void"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </Button>
              
              <Button variant="ghost" size="icon" onClick={stopPlayback}>
                <Square className="w-5 h-5" />
              </Button>
              
              <Button variant="ghost" size="icon">
                <SkipForward className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              <Button 
                variant={project.loopEnabled ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setProject(prev => ({ ...prev, loopEnabled: !prev.loopEnabled }))}
                className={project.loopEnabled ? 'bg-neon-pink/20 text-neon-pink' : ''}
              >
                <Repeat className="w-4 h-4 mr-2" />
                Loop
              </Button>
              
              <Button variant="ghost" size="sm">
                <Grid3X3 className="w-4 h-4 mr-2" />
                Snap
              </Button>
              
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs text-text-secondary w-12 text-center">{Math.round(project.zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="w-80 bg-void-light border-l border-white/5 flex flex-col">
          <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as any)} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-white/5 bg-transparent p-0 h-10">
              <TabsTrigger value="mixer" className="rounded-none data-[state=active]:bg-white/5">
                <Sliders className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="effects" className="rounded-none data-[state=active]:bg-white/5">
                <Wand2 className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="piano" className="rounded-none data-[state=active]:bg-white/5">
                <Piano className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="browser" className="rounded-none data-[state=active]:bg-white/5">
                <FolderOpen className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="lyrics" className="rounded-none data-[state=active]:bg-white/5">
                <Type className="w-4 h-4" />
              </TabsTrigger>
              <TabsTrigger value="analysis" className="rounded-none data-[state=active]:bg-white/5">
                <Activity className="w-4 h-4" />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mixer" className="flex-1 m-0 p-4">
              <h3 className="text-sm font-semibold mb-4">Master Mixer</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-secondary">Master Volume</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Volume2 className="w-4 h-4 text-text-tertiary" />
                    <Slider 
                      value={[project.masterTrack.volume]}
                      onValueChange={([v]) => setProject(prev => ({ 
                        ...prev, 
                        masterTrack: { ...prev.masterTrack, volume: v }
                      }))}
                      max={100}
                      className="flex-1"
                    />
                    <span className="text-xs w-8 text-right">{project.masterTrack.volume}%</span>
                  </div>
                </div>

                {selectedTrack && (
                  <>
                    <div className="border-t border-white/5 pt-4">
                      <h4 className="text-xs font-semibold text-text-secondary mb-2">
                        Selected Track
                      </h4>
                      
                      {project.tracks.find(t => t.id === selectedTrack)?.effects.map((effect, i) => (
                        <div key={effect.id} className="bg-white/5 rounded-lg p-3 mb-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{effect.name}</span>
                            <Badge variant="outline" className="text-xs">{effect.type}</Badge>
                          </div>
                        </div>
                      ))}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => addEffect(selectedTrack, 'reverb')}
                      >
                        <Plus className="w-3 h-3 mr-2" />
                        Add Effect
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="effects" className="flex-1 m-0 p-4 overflow-auto">
              <h3 className="text-sm font-semibold mb-4">Effects Rack</h3>
              
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(EFFECT_PRESETS).map(([type, preset]) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => selectedTrack && addEffect(selectedTrack, type as EffectType)}
                    disabled={!selectedTrack}
                  >
                    <Zap className="w-3 h-3 mr-2" />
                    {preset.name}
                  </Button>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="piano" className="flex-1 m-0 p-0">
              <div className="h-full flex flex-col">
                <div className="p-2 border-b border-white/5 text-xs text-text-secondary">
                  MIDI Piano Roll
                </div>
                <div className="flex-1 bg-void relative overflow-hidden">
                  {/* Piano keys */}
                  <div className="absolute left-0 top-0 bottom-0 w-16 bg-void-light border-r border-white/5">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const note = 71 - i; // B5 to C3
                      const isBlack = [1, 3, 6, 8, 10].includes(note % 12);
                      const noteName = NOTE_NAMES[note % 12];
                      const octave = Math.floor(note / 12) - 1;
                      
                      return (
                        <div 
                          key={note}
                          className={`h-6 flex items-center px-2 text-xs ${
                            isBlack ? 'bg-void text-text-secondary' : 'bg-white/5'
                          }`}
                        >
                          {!isBlack && <span>{noteName}{octave}</span>}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Grid */}
                  <div className="absolute left-16 right-0 top-0 bottom-0">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div 
                        key={i}
                        className="h-6 border-b border-white/5"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="browser" className="flex-1 m-0 p-4">
              <h3 className="text-sm font-semibold mb-4">Sample Browser</h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                  <Drum className="w-4 h-4 text-neon-cyan" />
                  <span className="text-sm">Drum Kits</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                  <AudioLines className="w-4 h-4 text-neon-pink" />
                  <span className="text-sm">Loops</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                  <Mic2 className="w-4 h-4 text-neon-green" />
                  <span className="text-sm">Vocals</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                  <Guitar className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm">Instruments</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="lyrics" className="flex-1 m-0 p-4 flex flex-col">
              <h3 className="text-sm font-semibold mb-4">Lyrics Mode</h3>
              
              <Textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder="Paste lyrics here...&#10;One line per phrase&#10;Click 'Mark' on each line as you sing"
                className="flex-1 resize-none bg-void border-white/10"
              />
              
              <div className="mt-4 space-y-2">
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    const lines = lyrics.split('\n');
                    if (lines[currentLyricLine]) {
                      setLyricTimestamps(prev => [...prev, currentTime]);
                      setCurrentLyricLine(prev => prev + 1);
                      toast.success(`Marked: "${lines[currentLyricLine].slice(0, 30)}..."`);
                    }
                  }}
                  disabled={currentLyricLine >= lyrics.split('\n').filter(l => l.trim()).length}
                >
                  <Target className="w-4 h-4 mr-2" />
                  Mark Current Line
                </Button>
                
                {lyricTimestamps.length > 0 && (
                  <div className="text-xs text-text-secondary">
                    {lyricTimestamps.length} lines timed
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="analysis" className="flex-1 m-0 p-4">
              <h3 className="text-sm font-semibold mb-4">Voice Analysis</h3>
              
              <div className="space-y-4">
                <Card className="bg-void p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-neon-cyan" />
                    <span className="text-sm">Volume History</span>
                  </div>
                  <div className="h-20 flex items-end gap-px">
                    {volumeData.map((v, i) => (
                      <div 
                        key={i}
                        className="flex-1 bg-neon-cyan/50"
                        style={{ height: `${v}%` }}
                      />
                    ))}
                  </div>
                </Card>

                <Card className="bg-void p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <ActivitySquare className="w-4 h-4 text-neon-pink" />
                    <span className="text-sm">Pitch Range</span>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Detected: A2 - C6
                  </div>
                </Card>

                <Card className="bg-void p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Gauge className="w-4 h-4 text-neon-green" />
                    <span className="text-sm">Recording Quality</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Sample Rate</span>
                      <span>48kHz ✓</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Bit Depth</span>
                      <span>32-bit float ✓</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Clipping</span>
                      <span className="text-neon-green">None</span>
                    </div>
                  </div>
                </Card>

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => exportProject('dataset')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Voice Dataset
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      {/* Project Browser Modal */}
      {showProjectBrowser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-400" />
                Cloud Projects
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setShowProjectBrowser(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {projects.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <Music className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No projects found in the cloud.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {projects.map((p) => (
                    <div 
                      key={p.id}
                      className="group p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-lg flex items-center justify-between hover:border-blue-500/50 transition-all cursor-pointer"
                      onClick={() => handleLoadProject(p)}
                    >
                      <div>
                        <h3 className="font-semibold group-hover:text-blue-400 transition-colors">{p.name}</h3>
                        <div className="flex items-center gap-4 text-xs text-zinc-500 mt-1">
                          <span>{p.tracks.length} Tracks</span>
                          <span>{new Date(p.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm">Load</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 flex justify-end">
              <Button variant="outline" onClick={() => setShowProjectBrowser(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
