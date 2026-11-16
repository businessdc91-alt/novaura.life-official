import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Image as ImageIcon, 
  Video, 
  Camera, 
  Monitor, 
  Palette, 
  Hammer,
  Eye,
  EyeOff,
  AlertTriangle,
  Plus,
  Heart,
  MessageCircle,
  Search,
  Shield,
  CheckCircle,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { getApprovedSubmissions, submissionTypeLabels, initializeGalleryStorage } from '@/services/galleryService';
import { db } from '@/config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { usePioneerBadgeStore } from '@/stores/pioneerBadgeStore';
import { SEOMeta } from '@/components/seo/SEOMeta';
import type { GallerySubmission, GallerySubmissionType } from '@/types';

const submissionTypes: { id: GallerySubmissionType | 'all'; label: string; icon: typeof ImageIcon }[] = [
  { id: 'all', label: 'All', icon: ImageIcon },
  { id: 'artwork', label: 'Artwork', icon: Palette },
  { id: 'video', label: 'Video', icon: Video },
  { id: 'screenshot', label: 'Screenshots', icon: Monitor },
  { id: 'photography', label: 'Photography', icon: Camera },
  { id: 'wip', label: 'Work in Progress', icon: Hammer },
  { id: 'other', label: 'Other', icon: ImageIcon },
];

export default function GalleryPage() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const performSearch = usePioneerBadgeStore((s) => s.performSearch);
  const [submissions, setSubmissions] = useState<GallerySubmission[]>([]);
  const [activeType, setActiveType] = useState<GallerySubmissionType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNsfw, setShowNsfw] = useState(user?.preferences?.showNsfw || false);
  const [showAgeVerify, setShowAgeVerify] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  useEffect(() => {
    initializeGalleryStorage();
    loadSubmissions();
  }, [activeType, showNsfw]);

  const loadSubmissions = () => {
    const options: any = { type: activeType === 'all' ? undefined : activeType };
    if (!showNsfw) {
      options.contentRating = 'sfw';
    }
    setSubmissions(getApprovedSubmissions(options));
  };

  const handleNsfwToggle = async () => {
    if (!showNsfw) {
      // Trying to enable NSFW
      if (user?.preferences?.ageVerified) {
        setShowNsfw(true);
        await updateDoc(doc(db, 'users', user.id), { 'preferences.showNsfw': true });
      } else {
        setShowAgeVerify(true);
      }
    } else {
      // Disabling NSFW
      setShowNsfw(false);
      if (user) {
        await updateDoc(doc(db, 'users', user.id), { 'preferences.showNsfw': false });
      }
    }
  };

  const handleAgeVerification = async () => {
    if (!ageConfirmed) {
      addToast({
        type: 'error',
        title: 'Confirmation Required',
        message: 'You must confirm that you are 18 or older.',
      });
      return;
    }

    if (user) {
      await updateDoc(doc(db, 'users', user.id), { 
        'preferences.ageVerified': true,
        'preferences.showNsfw': true 
      });
    }
    setShowNsfw(true);
    setShowAgeVerify(false);
    addToast({
      type: 'success',
      title: 'Age Verified',
      message: 'You can now view NSFW content.',
    });
  };

  // Called when user submits a search (Enter key) — awards pioneer badges
  const handleSearchSubmit = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || !user) return;
    performSearch(trimmed, user.id);
  };

  const filteredSubmissions = submissions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen pt-24 pb-12">
      <SEOMeta
        title="Community Gallery"
        description="Browse community-created artwork, screenshots, photography, and work-in-progress from NovAura creators. Discover and share your creative work."
        keywords={['creator gallery', 'community art', 'game art showcase', 'indie art', 'creator showcase', 'NovAura gallery']}
        url="https://novaura.life/gallery"
      />
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon-violet/10 border border-neon-violet/30 mb-6">
              <ImageIcon className="w-4 h-4 text-neon-violet" />
              <span className="text-sm text-neon-violet font-medium">Community Gallery</span>
            </div>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold text-text-primary mb-4">
              Creator <span className="text-gradient-rgb">Showcase</span>
            </h1>
            <p className="text-text-secondary max-w-2xl mx-auto">
              Discover what the community is creating. Share your work-in-progress, 
              finished projects, art, and more.
            </p>
          </motion.div>

          {/* Content Warning */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl"
          >
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-500 mb-1">Content Guidelines</p>
                <p className="text-yellow-500/80 text-sm">
                  All content is reviewed before going live. Illegal content is strictly prohibited 
                  and will result in immediate ban. NSFW content is allowed for verified adults only 
                  and must comply with our terms of service.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            {/* Type Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              {submissionTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setActiveType(type.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      activeType === type.id
                        ? 'bg-neon-violet text-void'
                        : 'bg-void-light text-text-muted border border-white/5 hover:border-white/20'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search & NSFW Toggle */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative flex-grow max-w-md">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <Input
                  type="text"
                  placeholder="Search submissions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit(searchQuery)}
                  className="pl-12 py-5 bg-void-light border-white/10 text-text-primary placeholder:text-text-muted rounded-xl"
                />
              </div>

              <div className="flex gap-3">
                {/* NSFW Toggle */}
                <button
                  onClick={handleNsfwToggle}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    showNsfw
                      ? 'bg-neon-magenta/20 text-neon-magenta border border-neon-magenta/30'
                      : 'bg-void-light text-text-muted border border-white/5 hover:border-white/20'
                  }`}
                >
                  {showNsfw ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  <span>NSFW {showNsfw ? 'On' : 'Off'}</span>
                </button>

                {/* Submit Button */}
                <Link to="/gallery/submit">
                  <Button className="bg-gradient-rgb text-void font-bold">
                    <Plus className="w-4 h-4 mr-2" />
                    Submit
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Gallery Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {filteredSubmissions.map((submission, index) => (
              <motion.div
                key={submission.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <Link to={`/gallery/${submission.id}`}>
                  <div className="group relative aspect-square bg-void-light border border-white/5 rounded-xl overflow-hidden hover:border-neon-violet/30 transition-all">
                    {/* Thumbnail */}
                    {submission.thumbnailUrl ? (
                      <img
                        src={submission.thumbnailUrl}
                        alt={submission.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-void">
                        <ImageIcon className="w-10 h-10 text-text-muted" />
                      </div>
                    )}

                    {/* NSFW Blur */}
                    {(submission.contentRating === 'mature' || submission.contentRating === 'explicit') && (
                      <div className="absolute inset-0 bg-void/90 flex items-center justify-center">
                        <div className="text-center">
                          <AlertTriangle className="w-8 h-8 text-neon-magenta mx-auto mb-2" />
                          <p className="text-neon-magenta text-xs font-medium">NSFW</p>
                        </div>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-void via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <h3 className="font-medium text-text-primary text-sm truncate">{submission.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {submission.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3 h-3" />
                            {submission.comments}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Type Badge */}
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 bg-void/80 rounded text-xs text-text-muted">
                        {submissionTypeLabels[submission.type]}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>

          {/* Empty State */}
          {filteredSubmissions.length === 0 && (
            <div className="text-center py-20">
              <ImageIcon className="w-16 h-16 text-text-muted mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                No submissions found
              </h3>
              <p className="text-text-secondary">
                {showNsfw 
                  ? 'Try adjusting your filters or be the first to submit!'
                  : 'Try enabling NSFW content or adjusting your filters.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Age Verification Modal */}
      <AnimatePresence>
        {showAgeVerify && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-void-light border border-white/10 rounded-2xl p-8 max-w-md w-full"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-full bg-neon-magenta/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-neon-magenta" />
                </div>
                <button
                  onClick={() => setShowAgeVerify(false)}
                  className="p-2 text-text-muted hover:text-text-primary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="font-heading text-2xl font-bold text-text-primary mb-4">
                Age Verification Required
              </h2>

              <p className="text-text-secondary mb-6">
                NSFW content is only available to users who are 18 years of age or older. 
                By enabling this setting, you confirm that:
              </p>

              <label className="flex items-start gap-3 p-4 bg-void rounded-lg cursor-pointer mb-6">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="custom-checkbox mt-1"
                />
                <span className="text-text-secondary text-sm">
                  I am 18 years of age or older and agree to view adult content. 
                  I understand that all content is subject to review and must comply 
                  with platform guidelines.
                </span>
              </label>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 border-white/20"
                  onClick={() => setShowAgeVerify(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-neon-magenta text-white font-bold"
                  onClick={handleAgeVerification}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Verify Age
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
