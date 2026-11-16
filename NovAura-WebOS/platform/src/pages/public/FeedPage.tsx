import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart,
  MessageSquare,
  Share2,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { UserBadge } from '@/components/ui/UserBadge';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { useSocialStore } from '@/stores/socialStore';
import { getPostComments } from '@/services/socialService';
import type { SocialComment } from '@/types';

export default function FeedPage() {
  const { user } = useAuthStore();
  const { globalFeed, createPost, likePost, addComment, refreshFeed } = useSocialStore();
  const [newPost, setNewPost] = useState('');
  const [image64, setImage64] = useState<string | null>(null);

  useEffect(() => {
    refreshFeed();
  }, [refreshFeed]);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim() && !image64) return;

    if (!user) return;
    createPost(user.id, newPost || '', image64 ? [image64] : []);
    setNewPost('');
    setImage64(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-12 bg-void">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Create Post Section */}
        {user && (
          <div className="bg-void-light border border-white/5 rounded-3xl p-6 mb-8 shadow-card overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-rgb" />
            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="flex gap-4">
                <img 
                  src={user.avatar} 
                  alt={user.username} 
                  className="w-12 h-12 rounded-full border border-white/10" 
                />
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What's emerging in your world?"
                  className="flex-grow bg-transparent border-none focus:ring-0 text-text-primary text-xl resize-none placeholder:text-text-muted/50 py-2 h-24"
                />
              </div>
              
              {image64 && (
                <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-white/10 group">
                  <img src={image64} className="w-full h-full object-cover" />
                  <button 
                    onClick={() => setImage64(null)}
                    className="absolute top-2 right-2 p-1.5 bg-void/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    id="post-image" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <label htmlFor="post-image">
                    <Button type="button" variant="ghost" className="gap-2 text-text-muted hover:text-neon-cyan hover:bg-neon-cyan/5">
                      <Sparkles className="w-4 h-4" />
                      Add Media
                    </Button>
                  </label>
                </div>
                <Button 
                  type="submit" 
                  disabled={!newPost.trim() && !image64}
                  className="bg-gradient-rgb text-void font-bold px-8 shadow-neon hover:scale-105 transition-transform"
                >
                  Project Intent
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Feed Section */}
        <div className="space-y-8">
          {globalFeed.length === 0 ? (
            <div className="text-center py-20 bg-void-light border border-dashed border-white/10 rounded-3xl">
              <Sparkles className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-10" />
              <p className="text-text-muted">No transmissions received yet...</p>
            </div>
          ) : (
            globalFeed.map((post: any) => (
              <PostItem 
                key={post.id} 
                post={post} 
                onLike={() => likePost(post.id, user?.id || '')}
                onComment={(content) => addComment(post.id, user?.id || '', content)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PostItem({ post, onLike, onComment }: { post: any, onLike: () => void, onComment: (content: string) => void }) {
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [loadedComments, setLoadedComments] = useState<SocialComment[]>([]);

  const toggleComments = () => {
    if (!showComments) {
      setLoadedComments(getPostComments(post.id));
    }
    setShowComments(!showComments);
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onComment(commentInput);
    setCommentInput('');
    // Reload comments to show the new one
    setLoadedComments(getPostComments(post.id));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-void-light border border-white/5 rounded-3xl p-6 shadow-card hover:border-white/10 transition-colors"
    >
      {/* Post Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <img 
            src={post.creator?.avatar} 
            alt={post.creator?.username} 
            className="w-10 h-10 rounded-full" 
          />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-text-primary text-sm sm:text-base">{post.creator?.username}</h4>
              {post.creator?.badges?.map((badge: string) => (
                <UserBadge key={badge} type={badge as any} size="sm" />
              ))}
            </div>
            <p className="text-xs text-text-muted">{new Date(post.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-text-muted">
          <Share2 className="w-4 h-4" />
        </Button>
      </div>

      {post.content && (
        <p className="text-text-primary text-lg mb-4 whitespace-pre-wrap leading-relaxed">
          {post.content}
        </p>
      )}

      {post.images && post.images.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-6 border border-white/10">
          <img src={post.images[0]} className="w-full h-auto max-h-[500px] object-cover" />
        </div>
      )}

      {/* Interactions */}
      <div className="flex items-center gap-6 pt-4 border-t border-white/5">
        <button 
          onClick={onLike}
          className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-neon-magenta transition-colors"
        >
          <Heart className={`w-5 h-5 ${post.likes > 0 ? 'fill-neon-magenta text-neon-magenta' : ''}`} />
          {post.likes}
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-2 text-sm font-medium text-text-muted hover:text-neon-cyan transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          {post.comments || 0}
        </button>
        <div className="flex-grow" />
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <TrendingUp className="w-4 h-4 text-neon-cyan opacity-50" />
          <span className="uppercase tracking-widest text-[9px] font-bold">Resonating</span>
        </div>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
              <form onSubmit={handleComment} className="flex gap-4">
                <input
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Share your perspective..."
                  className="flex-grow bg-void border border-white/10 rounded-xl px-4 py-2 text-sm text-text-primary focus:border-neon-cyan focus:ring-1 focus:ring-neon-cyan transition-all"
                />
                <Button type="submit" size="sm" className="bg-neon-cyan text-void font-bold">
                  Send
                </Button>
              </form>

              <div className="space-y-4">
                {loadedComments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <img src={comment.author?.avatar} className="w-8 h-8 rounded-full" />
                    <div className="flex-grow bg-void p-3 rounded-xl border border-white/5">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-text-primary">{comment.author?.username}</span>
                          {comment.author?.badges?.map((badge: string) => (
                            <UserBadge key={badge} type={badge as any} size="sm" />
                          ))}
                        </div>
                        <span className="text-xs text-text-muted">{new Date(comment.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-text-secondary mt-1">{comment.content}</p>
                    </div>
                  </div>
                ))}
                {loadedComments.length === 0 && (
                  <p className="text-sm text-text-muted text-center py-2">No comments yet. Be the first.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
