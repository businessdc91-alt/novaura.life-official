import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, Image, Video, Film, Camera, Palette, 
  AlertTriangle, Tag, X, Check, Info, EyeOff 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { createSubmission } from '@/services/galleryService';
import type { GallerySubmissionType, GalleryContentRating } from '@/types';

const submissionTypes: { value: GallerySubmissionType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'artwork', label: 'Artwork', icon: Palette, description: 'Digital art, illustrations, concept art' },
  { value: 'video', label: 'Video', icon: Video, description: 'Short films, animations, trailers' },
  { value: 'screenshot', label: 'Screenshot', icon: Image, description: 'In-game screenshots, captures' },
  { value: 'photography', label: 'Photography', icon: Camera, description: 'Behind-the-scenes, cosplay, events' },
  { value: 'wip', label: 'Work in Progress', icon: Film, description: 'Development updates, timelapses' },
  { value: 'other', label: 'Other', icon: Upload, description: 'Anything else creative' },
];

const contentRatings: { value: GalleryContentRating; label: string; description: string; color: string }[] = [
  { value: 'safe', label: 'Safe for All', description: 'Appropriate for all audiences', color: 'text-neon-lime' },
  { value: 'suggestive', label: 'Suggestive', description: 'Mild suggestive themes', color: 'text-yellow-400' },
  { value: 'mature', label: 'Mature', description: 'Adult themes, violence, or nudity', color: 'text-orange-400' },
  { value: 'explicit', label: 'Explicit', description: 'Sexually explicit or extreme content', color: 'text-neon-magenta' },
];

export default function GallerySubmitPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedType, setSelectedType] = useState<GallerySubmissionType>('artwork');
  const [contentRating, setContentRating] = useState<GalleryContentRating>('safe');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNsfwWarning, setShowNsfwWarning] = useState(false);
  
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 flex items-center justify-center">
            <Upload className="w-10 h-10 text-neon-cyan" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">Sign In Required</h1>
          <p className="text-white/60 mb-8 max-w-md">
            Please sign in to submit content to the community gallery
          </p>
          <Button 
            className="bg-gradient-rgb text-void font-bold"
            onClick={() => navigate('/login', { state: { from: '/gallery/submit' } })}
          >
            Sign In to Continue
          </Button>
        </motion.div>
      </div>
    );
  }

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const isValidSize = file.size <= 100 * 1024 * 1024; // 100MB limit
      return (isImage || isVideo) && isValidSize;
    });
    
    if (validFiles.length < files.length) {
      addToast({ type: 'warning', title: 'Some files were skipped', message: 'Max 100MB, images/videos only' });
    }
    
    setMediaFiles(prev => [...prev, ...validFiles].slice(0, 10)); // Max 10 files
  };

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024) {
      setThumbnail(file);
    } else {
      addToast({ type: 'error', title: 'Invalid file', message: 'Please select an image under 10MB' });
    }
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleContentRatingChange = (rating: GalleryContentRating) => {
    if (rating === 'mature' || rating === 'explicit') {
      setShowNsfwWarning(true);
    }
    setContentRating(rating);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      addToast({ type: 'error', title: 'Title required', message: 'Please enter a title' });
      return;
    }
    if (!description.trim()) {
      addToast({ type: 'error', title: 'Description required', message: 'Please enter a description' });
      return;
    }
    if (mediaFiles.length === 0) {
      addToast({ type: 'error', title: 'Media required', message: 'Please upload at least one media file' });
      return;
    }

    setIsSubmitting(true);

    try {
      // In a real app, upload files to storage and get URLs
      // For now, create blob URLs as placeholders
      const mediaUrls = mediaFiles.map(file => URL.createObjectURL(file));
      const thumbnailUrl = thumbnail ? URL.createObjectURL(thumbnail) : mediaUrls[0];

      createSubmission(
        user.id,
        title.trim(),
        description.trim(),
        selectedType,
        contentRating,
        mediaUrls,
        thumbnailUrl,
        tags
      );

      addToast({ type: 'success', title: 'Submission sent!', message: 'It will appear once approved.' });
      navigate('/gallery');
    } catch (error) {
      addToast({ type: 'error', title: 'Submission failed', message: 'Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-void py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan text-sm font-medium mb-6">
            <Upload className="w-4 h-4" />
            Community Gallery
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Submit Your <span className="text-gradient">Creation</span>
          </h1>
          <p className="text-white/60 max-w-xl mx-auto">
            Share your artwork, videos, screenshots, and work-in-progress with the NovAura community
          </p>
        </motion.div>

        {/* Form */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-8"
        >
          {/* Content Type Selection */}
          <div className="glass-panel rounded-2xl p-6">
            <Label className="text-white font-semibold mb-4 block">Content Type</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {submissionTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      selectedType === type.value
                        ? 'border-neon-cyan bg-neon-cyan/10'
                        : 'border-white/10 hover:border-white/30 bg-white/5'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 ${selectedType === type.value ? 'text-neon-cyan' : 'text-white/60'}`} />
                    <div className="font-medium text-white text-sm">{type.label}</div>
                    <div className="text-xs text-white/40 mt-1">{type.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title & Description */}
          <div className="glass-panel rounded-2xl p-6 space-y-6">
            <div>
              <Label htmlFor="title" className="text-white font-semibold mb-2 block">
                Title <span className="text-neon-magenta">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your creation a catchy title"
                maxLength={100}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <div className="text-right text-xs text-white/40 mt-1">
                {title.length}/100
              </div>
            </div>

            <div>
              <Label htmlFor="description" className="text-white font-semibold mb-2 block">
                Description <span className="text-neon-magenta">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your creation, the process, tools used, etc."
                rows={4}
                maxLength={1000}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
              />
              <div className="text-right text-xs text-white/40 mt-1">
                {description.length}/1000
              </div>
            </div>
          </div>

          {/* Content Rating */}
          <div className="glass-panel rounded-2xl p-6">
            <Label className="text-white font-semibold mb-4 block">Content Rating</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contentRatings.map((rating) => (
                <button
                  key={rating.value}
                  onClick={() => handleContentRatingChange(rating.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    contentRating === rating.value
                      ? 'border-neon-cyan bg-neon-cyan/10'
                      : 'border-white/10 hover:border-white/30 bg-white/5'
                  }`}
                >
                  <div className={`font-medium ${rating.color}`}>{rating.label}</div>
                  <div className="text-xs text-white/50 mt-1">{rating.description}</div>
                </button>
              ))}
            </div>
            
            {(contentRating === 'mature' || contentRating === 'explicit') && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 p-4 rounded-xl bg-neon-magenta/10 border border-neon-magenta/30"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-neon-magenta flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-white/80">
                      NSFW content will be filtered and only visible to users who have verified they are 18+. 
                      All explicit content is subject to moderation review.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Tags */}
          <div className="glass-panel rounded-2xl p-6">
            <Label className="text-white font-semibold mb-4 block">Tags</Label>
            <div className="flex gap-2 mb-3">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tags (press Enter)"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={addTag}
                disabled={!tagInput.trim() || tags.length >= 10}
              >
                <Tag className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span 
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-neon-cyan/20 text-neon-cyan text-sm"
                >
                  #{tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="text-xs text-white/40 mt-2">
              {tags.length}/10 tags
            </div>
          </div>

          {/* Media Upload */}
          <div className="glass-panel rounded-2xl p-6">
            <Label className="text-white font-semibold mb-4 block">
              Media Files <span className="text-neon-magenta">*</span>
            </Label>
            
            {/* Media Files */}
            <div 
              onClick={() => mediaInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all"
            >
              <Upload className="w-12 h-12 text-white/40 mx-auto mb-4" />
              <p className="text-white font-medium mb-2">Click to upload media</p>
              <p className="text-sm text-white/50">
                Images or videos up to 100MB each • Max 10 files
              </p>
              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleMediaSelect}
                className="hidden"
              />
            </div>

            {/* Selected Media Preview */}
            {mediaFiles.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
                      {file.type.startsWith('image/') ? (
                        <img 
                          src={URL.createObjectURL(file)} 
                          alt="" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Video className="w-8 h-8 text-white/40" />
                      )}
                    </div>
                    <button
                      onClick={() => removeMediaFile(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-neon-magenta text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <p className="text-xs text-white/50 mt-1 truncate">{file.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thumbnail */}
          <div className="glass-panel rounded-2xl p-6">
            <Label className="text-white font-semibold mb-4 block">Thumbnail (Optional)</Label>
            <p className="text-sm text-white/50 mb-4">
              If not provided, the first media file will be used as thumbnail
            </p>
            
            <div 
              onClick={() => thumbnailInputRef.current?.click()}
              className="border-2 border-dashed border-white/20 rounded-xl p-6 text-center cursor-pointer hover:border-neon-cyan/50 hover:bg-neon-cyan/5 transition-all max-w-xs"
            >
              {thumbnail ? (
                <img 
                  src={URL.createObjectURL(thumbnail)} 
                  alt="Thumbnail" 
                  className="w-full aspect-video object-cover rounded-lg"
                />
              ) : (
                <>
                  <Image className="w-8 h-8 text-white/40 mx-auto mb-2" />
                  <p className="text-sm text-white/50">Click to select thumbnail</p>
                </>
              )}
              <input
                ref={thumbnailInputRef}
                type="file"
                accept="image/*"
                onChange={handleThumbnailSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Guidelines */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-neon-cyan flex-shrink-0 mt-0.5" />
              <div className="text-sm text-white/70 space-y-2">
                <p className="font-medium text-white">Submission Guidelines:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>All submissions require moderator approval before appearing publicly</li>
                  <li>You must own the rights to all content you submit</li>
                  <li>No AI-generated content without proper disclosure</li>
                  <li>NSFW content must be properly tagged and follows our content policy</li>
                  <li>Maximum 10 files per submission, 100MB per file</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/gallery')}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !title.trim() || !description.trim() || mediaFiles.length === 0}
              className="flex-1 bg-gradient-rgb text-void font-bold"
            >
              {isSubmitting ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Submit for Review
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* NSFW Warning Modal */}
      {showNsfwWarning && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-void-light border border-neon-magenta/30 rounded-2xl p-8 max-w-md"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-neon-magenta/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-neon-magenta" />
            </div>
            <h2 className="text-2xl font-bold text-white text-center mb-4">
              NSFW Content Warning
            </h2>
            <p className="text-white/70 text-center mb-6">
              You are about to submit content marked as Mature or Explicit. This content will:
            </p>
            <ul className="text-sm text-white/60 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-neon-magenta" />
                Be hidden from users who haven't verified their age
              </li>
              <li className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-neon-magenta" />
                Require additional moderator review
              </li>
              <li className="flex items-center gap-2">
                <Info className="w-4 h-4 text-neon-magenta" />
                Must comply with our NSFW content policy
              </li>
            </ul>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setContentRating('safe');
                  setShowNsfwWarning(false);
                }}
                className="flex-1"
              >
                Change to Safe
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowNsfwWarning(false)}
                className="flex-1"
              >
                I Understand
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
