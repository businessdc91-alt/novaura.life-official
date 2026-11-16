import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Briefcase, 
  Search, 
  Plus, 
  MessageCircle, 
  TrendingUp, 
  Shield, 
  Clock, 
  ChevronRight,
  MapPin,
  DollarSign,
  Award
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserBadge } from '@/components/ui/UserBadge';
import { useSocialStore } from '@/stores/socialStore';

export default function EcosystemHub() {
  const [activeTab, setActiveTab] = useState<'forums' | 'jobs'>('forums');
  const { threads, jobs, refreshCommunity } = useSocialStore();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    refreshCommunity();
  }, [refreshCommunity]);

  return (
    <div className="min-h-screen pt-24 pb-12 bg-void">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-text-primary mb-4">
              Creative <span className="text-gradient-rgb">Hub</span>
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl">
              Discuss, collaborate, and find your next big opportunity within the Novaura ecosystem.
            </p>
          </div>
          <div className="flex bg-void-light border border-white/5 p-1 rounded-xl">
            <TabButton 
              active={activeTab === 'forums'} 
              onClick={() => setActiveTab('forums')} 
              icon={MessageSquare}
              label="Discourse" 
            />
            <TabButton 
              active={activeTab === 'jobs'} 
              onClick={() => setActiveTab('jobs')} 
              icon={Briefcase}
              label="Opportunities" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-9 space-y-6">
            
            {/* Search & Actions Bar */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <Input
                  placeholder={activeTab === 'forums' ? "Search discussions..." : "Search jobs & talent..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 bg-void-light border-white/5 h-12 text-text-primary text-lg"
                />
              </div>
              <Button className="h-12 px-6 bg-gradient-rgb text-void font-bold gap-2">
                <Plus className="w-5 h-5" />
                {activeTab === 'forums' ? "New Thread" : "Post Job"}
              </Button>
            </div>

            {/* Content Area */}
            <AnimatePresence mode="wait">
              {activeTab === 'forums' ? (
                <motion.div
                  key="forums"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {threads.length === 0 ? (
                    <EmptyState icon={MessageSquare} label="No discussions found" />
                  ) : (
                    threads.map(thread => <ThreadCard key={thread.id} thread={thread} />)
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="jobs"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {jobs.length === 0 ? (
                    <EmptyState icon={Briefcase} label="No job listings found" />
                  ) : (
                    jobs.map(job => <JobCard key={job.id} job={job} />)
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-void-light border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-neon-cyan" />
                Popular Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                <TagBadge label="#GameDesign" />
                <TagBadge label="#ArtWork" />
                <TagBadge label="#Hiring" />
                <TagBadge label="#Help" />
                <TagBadge label="#Showcase" />
                <TagBadge label="#DevLogs" />
              </div>
            </div>

            <div className="bg-void-light border border-white/5 rounded-2xl p-6">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-neon-magenta" />
                Community Rules
              </h3>
              <ul className="space-y-3 text-sm text-text-secondary">
                <li className="flex gap-2">
                  <span className="text-neon-cyan">•</span>
                  Be respectful to all creators.
                </li>
                <li className="flex gap-2">
                  <span className="text-neon-cyan">•</span>
                  No spam or excessive self-promotion.
                </li>
                <li className="flex gap-2">
                  <span className="text-neon-cyan">•</span>
                  Keep it professional in the job board.
                </li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm transition-all duration-300 ${
        active 
          ? 'bg-neon-cyan text-void shadow-[0_0_15px_rgba(0,240,255,0.4)]' 
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function EmptyState({ icon: Icon, label }: { icon: any, label: string }) {
  return (
    <div className="bg-void-light border border-white/5 border-dashed rounded-3xl p-16 text-center">
      <Icon className="w-16 h-16 text-text-muted mx-auto mb-4 opacity-20" />
      <p className="text-text-muted font-medium">{label}</p>
    </div>
  );
}

function TagBadge({ label }: { label: string }) {
  return (
    <span className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-text-secondary hover:border-neon-cyan/50 hover:text-neon-cyan cursor-pointer transition-colors">
      {label}
    </span>
  );
}

function ThreadCard({ thread }: { thread: any }) {
  return (
    <div className="group bg-void-light border border-white/5 rounded-2xl p-5 hover:border-neon-cyan/30 transition-all duration-300">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-1 min-w-[40px]">
          <TrendingUp className="w-5 h-5 text-text-muted group-hover:text-neon-cyan" />
          <span className="text-xs font-bold text-text-muted">{thread.views}</span>
        </div>
        <div className="flex-grow">
          <div className="flex flex-col mb-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                thread.category === 'announcement' ? 'bg-neon-magenta/20 text-neon-magenta' : 'bg-neon-cyan/10 text-neon-cyan'
              }`}>
                {thread.category}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <span>Posted by {thread.author?.username || 'Unknown'}</span>
                {thread.author?.badges?.map((badge: string) => (
                  <UserBadge key={badge} type={badge as any} size="sm" />
                ))}
              </div>
            </div>
          </div>
          <h3 className="text-lg font-bold text-text-primary group-hover:text-neon-cyan transition-colors line-clamp-1">
            {thread.title}
          </h3>
          <p className="text-sm text-text-secondary line-clamp-2 mt-1 opacity-70">
            {thread.content}
          </p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <MessageCircle className="w-4 h-4" />
              {thread.replyCount} replies
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Clock className="w-4 h-4" />
              Last active {new Date(thread.lastReplyAt).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div className="flex items-center self-center">
          <ChevronRight className="w-6 h-6 text-text-muted group-hover:text-neon-cyan transform group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
}

function JobCard({ job }: { job: any }) {
  return (
    <div className="group bg-void-light border border-white/5 rounded-2xl p-6 hover:border-neon-magenta/30 transition-all duration-300">
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-16 h-16 bg-void border border-white/5 rounded-xl flex items-center justify-center flex-shrink-0">
          <Award className="w-8 h-8 text-neon-magenta" />
        </div>
        <div className="flex-grow">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
            <h3 className="text-xl font-bold text-text-primary group-hover:text-neon-magenta transition-colors">
              {job.title}
            </h3>
            <span className="px-2 py-1 bg-white/5 text-[10px] font-bold text-text-muted rounded-md uppercase border border-white/10 shrink-0 self-start">
              {job.jobType.replace('_', ' ')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-text-secondary mb-4">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-neon-cyan" />
              Remote / Global
            </span>
            {job.budget && (
              <span className="flex items-center gap-1.5 font-medium text-text-primary">
                <DollarSign className="w-4 h-4 text-neon-green" />
                {job.budget.min} - {job.budget.max} / {job.budget.type}
              </span>
            )}
            <span className="text-text-muted">•</span>
            <span className="text-text-muted">Posted {new Date(job.createdAt).toLocaleDateString()}</span>
          </div>
          <p className="text-sm text-text-secondary line-clamp-2 opacity-80 mb-4">
            {job.description}
          </p>
          <div className="flex flex-wrap gap-2">
            {job.requirements.slice(0, 3).map((req: string, i: number) => (
              <span key={i} className="px-2 py-1 bg-void border border-white/5 rounded text-[11px] text-text-muted">
                {req}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between items-end gap-4 min-w-[120px]">
          <span className="text-xs text-text-muted font-medium bg-white/5 px-3 py-1 rounded-full">
            {job.applications} applications
          </span>
          <Button className="w-full sm:w-auto bg-neon-magenta text-white font-bold hover:scale-105 transition-transform">
            Apply Now
          </Button>
        </div>
      </div>
    </div>
  );
}
