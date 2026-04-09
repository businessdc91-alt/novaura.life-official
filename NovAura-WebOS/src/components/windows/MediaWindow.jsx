import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music, Film, Upload, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';

// Helper to format time
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function MediaWindow() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState([0]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState('audio');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [audioFiles, setAudioFiles] = useState([]);
  const [videoFiles, setVideoFiles] = useState([]);
  const fileInputRef = useRef(null);
  const audioRef = useRef(null);
  const videoRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Sync volume with audio/video element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100;
    }
    if (videoRef.current) {
      videoRef.current.volume = volume[0] / 100;
    }
  }, [volume]);

  // Sync muted state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Handle play/pause
  const togglePlay = useCallback(() => {
    if (!selectedMedia) {
      toast.info('Upload or select a media file to play');
      return;
    }

    const mediaElement = activeTab === 'audio' ? audioRef.current : videoRef.current;
    if (!mediaElement) return;

    if (isPlaying) {
      mediaElement.pause();
      setIsPlaying(false);
    } else {
      mediaElement.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        toast.error('Playback failed', { description: err.message });
      });
    }
  }, [isPlaying, selectedMedia, activeTab]);

  // Handle media selection
  const handleMediaSelect = useCallback((media) => {
    // Stop current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress([0]);
    setDuration(0);
    setSelectedMedia(media);
    
    // Auto-play after a short delay to allow src to load
    setTimeout(() => {
      const mediaElement = media.type?.startsWith('video/') || activeTab === 'video' ? videoRef.current : audioRef.current;
      if (mediaElement) {
        mediaElement.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          // Auto-play blocked, user needs to click play
        });
      }
    }, 100);
    
    toast.success('Now playing', { description: media.title });
  }, [activeTab]);

  // Update progress while playing
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = setInterval(() => {
        const mediaElement = activeTab === 'audio' ? audioRef.current : videoRef.current;
        if (mediaElement) {
          setCurrentTime(mediaElement.currentTime);
          setDuration(mediaElement.duration || 0);
          const progressPercent = mediaElement.duration 
            ? (mediaElement.currentTime / mediaElement.duration) * 100 
            : 0;
          setProgress([progressPercent]);
        }
      }, 250);
    } else {
      clearInterval(progressIntervalRef.current);
    }
    
    return () => clearInterval(progressIntervalRef.current);
  }, [isPlaying, activeTab]);

  // Handle seeking
  const handleSeek = (value) => {
    setProgress(value);
    const mediaElement = activeTab === 'audio' ? audioRef.current : videoRef.current;
    if (mediaElement && mediaElement.duration) {
      const newTime = (value[0] / 100) * mediaElement.duration;
      mediaElement.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const isAudio = file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|flac|aac|m4a)$/i);
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i);

    // Get audio duration
    const getDuration = (url, callback) => {
      const tempAudio = new Audio();
      tempAudio.onloadedmetadata = () => {
        callback(tempAudio.duration);
      };
      tempAudio.onerror = () => {
        callback(0);
      };
      tempAudio.src = url;
    };

    const entry = {
      id: Date.now(),
      title: file.name.replace(/\.[^.]+$/, ''),
      artist: 'Local File',
      duration: '--:--',
      durationSeconds: 0,
      url,
      file,
      type: file.type,
    };

    if (isAudio) {
      getDuration(url, (dur) => {
        entry.duration = formatTime(dur);
        entry.durationSeconds = dur;
        setAudioFiles(prev => [...prev, entry]);
      });
      setActiveTab('audio');
    } else if (isVideo) {
      const tempVideo = document.createElement('video');
      tempVideo.onloadedmetadata = () => {
        entry.duration = formatTime(tempVideo.duration);
        entry.durationSeconds = tempVideo.duration;
        setVideoFiles(prev => [...prev, entry]);
      };
      tempVideo.src = url;
      setActiveTab('video');
    }

    handleMediaSelect(entry);
    toast.success('File loaded', { description: file.name });
  };

  const handleDelete = (e, id, type) => {
    e.stopPropagation();
    if (type === 'audio') {
      setAudioFiles(prev => prev.filter(f => f.id !== id));
    } else {
      setVideoFiles(prev => prev.filter(f => f.id !== id));
    }
    if (selectedMedia?.id === id) {
      setSelectedMedia(null);
      setIsPlaying(false);
    }
    toast.success('File removed');
  };

  // Handle track ended
  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setProgress([0]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Media Player */}
      <div className="p-6 border-b border-primary/20 bg-gradient-to-br from-window-bg to-window-header">
        {/* Now Playing */}
        <div className="text-center mb-6">
          <div className="w-32 h-32 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-primary/30">
            {activeTab === 'audio' ? (
              <Music className="w-16 h-16 text-primary" />
            ) : (
              <Film className="w-16 h-16 text-secondary" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {selectedMedia?.title || 'No media selected'}
          </h3>
          {selectedMedia?.artist && (
            <p className="text-sm text-muted-foreground">{selectedMedia.artist}</p>
          )}
        </div>

        {/* Hidden Audio/Video Elements */}
        <audio
          ref={audioRef}
          src={selectedMedia?.url && activeTab === 'audio' ? selectedMedia.url : ''}
          onEnded={handleEnded}
          onError={() => toast.error('Audio playback error')}
        />
        <video
          ref={videoRef}
          src={selectedMedia?.url && activeTab === 'video' ? selectedMedia.url : ''}
          onEnded={handleEnded}
          onError={() => toast.error('Video playback error')}
          className="hidden"
        />

        {/* Progress Bar */}
        <div className="mb-4">
          <Slider
            value={progress}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{formatTime(currentTime)}</span>
            <span>{selectedMedia?.duration || formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            className="hover:bg-primary/10 hover:text-primary"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          
          <Button
            size="icon"
            onClick={togglePlay}
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90 shadow-[0_0_30px_rgba(0,217,255,0.4)]"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-1" />
            )}
          </Button>
          
          <Button
            size="icon"
            variant="ghost"
            className="hover:bg-primary/10 hover:text-primary"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-3 mt-6 max-w-xs mx-auto">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            className="hover:bg-primary/10 hover:text-primary"
          >
            {isMuted || volume[0] === 0 ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
          <Slider
            value={volume}
            onValueChange={setVolume}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-8 text-right">{volume[0]}%</span>
        </div>
      </div>

      {/* Media Library */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-primary/20 bg-window-header">
          <TabsList className="bg-window-bg">
            <TabsTrigger value="audio" className="gap-2">
              <Music className="w-4 h-4" />
              Audio
            </TabsTrigger>
            <TabsTrigger value="video" className="gap-2">
              <Film className="w-4 h-4" />
              Video
            </TabsTrigger>
          </TabsList>
          
          <Button 
            size="sm" 
            onClick={handleFileUpload}
            className="gap-2 bg-primary hover:bg-primary/90"
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={activeTab === 'audio' ? 'audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a' : 'video/*,.mp4,.webm,.mov,.avi'}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <TabsContent value="audio" className="flex-1 m-0">
          <ScrollArea className="h-full scrollbar-custom">
            <div className="p-4 space-y-2">
              {audioFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Music className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">No audio files yet</p>
                  <button onClick={handleFileUpload} className="text-xs text-primary mt-1 hover:underline">Upload audio</button>
                </div>
              ) : audioFiles.map((track) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-2 p-3 rounded-lg hover:bg-primary/10 border transition-all group ${
                    selectedMedia?.id === track.id ? 'bg-primary/10 border-primary/40' : 'bg-window-bg border-primary/20 hover:border-primary/40'
                  }`}
                >
                  <button
                    onClick={() => handleMediaSelect(track)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {track.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">{track.artist}</p>
                      </div>
                      <span className="text-sm text-muted-foreground mr-2">{track.duration}</span>
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => handleDelete(e, track.id, 'audio')}
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="video" className="flex-1 m-0">
          <ScrollArea className="h-full scrollbar-custom">
            <div className="p-4 space-y-2">
              {videoFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Film className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">No video files yet</p>
                  <button onClick={handleFileUpload} className="text-xs text-primary mt-1 hover:underline">Upload video</button>
                </div>
              ) : videoFiles.map((video) => (
                <div
                  key={video.id}
                  className={`flex items-center gap-2 p-3 rounded-lg hover:bg-secondary/10 border transition-all group ${
                    selectedMedia?.id === video.id ? 'bg-secondary/10 border-secondary/40' : 'bg-window-bg border-primary/20 hover:border-secondary/40'
                  }`}
                >
                  <button
                    onClick={() => handleMediaSelect(video)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-16 h-12 rounded bg-secondary/20 flex items-center justify-center shrink-0">
                          <Film className="w-6 h-6 text-secondary" />
                        </div>
                        <h4 className="font-medium text-foreground group-hover:text-secondary transition-colors truncate">
                          {video.title}
                        </h4>
                      </div>
                      <span className="text-sm text-muted-foreground mr-2">{video.duration}</span>
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => handleDelete(e, video.id, 'video')}
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
