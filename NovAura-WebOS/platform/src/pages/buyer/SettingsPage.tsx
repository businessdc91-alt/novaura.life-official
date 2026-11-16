import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Lock, CreditCard, Plus, Trash2, Cpu, Monitor, Laptop, MousePointer2, Layers, Globe, Twitter, Github, MonitorSmartphone, Image as ImageIcon, Key, Copy, Check, ExternalLink, Zap, ShieldCheck, BrainCircuit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { apiKeyService } from '@/services/ApiKeyService';
import type { ApiKey } from '@/services/ApiKeyService';
import type { PortfolioItem, HardwareSpecs } from '@/types';
import { useWebGPU } from '@/hooks/useWebGPU';
import { useUIStore } from '@/stores/uiStore';

export default function SettingsPage() {
  const { user, updateProfile, isLoading } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const { isSupported, isEnabled, toggle: toggleWebGPU, isInitializing } = useWebGPU();
  const { performanceMode, togglePerformanceMode } = useUIStore();
  
  // Profile State
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
    website: user?.website || '',
    twitter: user?.twitter || '',
    github: user?.github || '',
    location: user?.location || '',
  });

  // Hardware State
  const [hardware, setHardware] = useState<HardwareSpecs>(user?.hardwareSpecs || {
    cpu: '',
    gpu: '',
    ram: '',
    monitor: '',
    os: '',
    peripherals: [],
  });

  // Portfolio State
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(user?.portfolio || []);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(user ? apiKeyService.getKeys(user.id) : []);
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    try {
      await updateProfile(profileData);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleSaveHardware = async () => {
    try {
      await updateProfile({ hardwareSpecs: hardware });
      toast.success('Hardware specifications updated');
    } catch (error) {
      toast.error('Failed to update hardware');
    }
  };

  const handleSavePortfolio = async () => {
    try {
      await updateProfile({ portfolio });
      toast.success('Portfolio updated successfully');
    } catch (error) {
      toast.error('Failed to update portfolio');
    }
  };

  const addPortfolioItem = () => {
    const newItem: PortfolioItem = {
      id: Date.now().toString(),
      title: 'New Project',
      description: '',
      thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800',
      projectUrl: '',
      tags: [],
      screenshotUrls: [],
      createdAt: new Date().toISOString(),
    };
    setPortfolio([...portfolio, newItem]);
  };

  const updatePortfolioItem = (id: string, updates: Partial<PortfolioItem>) => {
    setPortfolio(portfolio.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removePortfolioItem = (id: string) => {
    setPortfolio(portfolio.filter(item => item.id !== id));
  };

  const handleGenerateKey = () => {
    if (!user) return;
    if (!newKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    const key = apiKeyService.generateKey(user.id, newKeyName, 'middle');
    setApiKeys([...apiKeys, key]);
    setNewKeyName('');
    toast.success('API key generated successfully');
  };

  const handleDeleteKey = (id: string) => {
    if (!user) return;
    apiKeyService.deleteKey(user.id, id);
    setApiKeys(apiKeys.filter(k => k.id !== id));
    toast.success('API key deleted');
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    toast.success('Key copied to clipboard');
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  return (
    <div className="min-h-screen pt-24 pb-12">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-heading text-3xl font-bold text-text-primary mb-8">
            Settings
          </h1>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-void-light border border-white/5 mb-6 overflow-x-auto justify-start h-auto p-1">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="hardware">Hardware Setup</TabsTrigger>
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
              <TabsTrigger value="privacy">Privacy</TabsTrigger>
              <TabsTrigger value="billing">Billing</TabsTrigger>
            </TabsList>

            <TabsContent value="profile" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-void-light border border-white/5 rounded-xl p-6"
              >
                <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
                  Profile Settings
                </h2>

                <div className="flex items-center gap-6 mb-8">
                  <img 
                    src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.username}`}
                    alt={user?.username}
                    className="w-20 h-20 rounded-xl"
                  />
                  <div>
                    <Button variant="outline" className="border-white/20 mb-2">
                      Change Avatar
                    </Button>
                    <p className="text-text-muted text-sm">
                      JPG, PNG or GIF. Max 2MB.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Username</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <Input 
                        value={profileData.username}
                        onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                        className="pl-12 py-6 bg-void border-white/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Location</label>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <Input 
                        value={profileData.location}
                        onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                        placeholder="e.g. San Francisco, CA"
                        className="pl-12 py-6 bg-void border-white/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Twitter Handle</label>
                    <div className="relative">
                      <Twitter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <Input 
                        value={profileData.twitter}
                        onChange={(e) => setProfileData({ ...profileData, twitter: e.target.value })}
                        placeholder="@username"
                        className="pl-12 py-6 bg-void border-white/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">GitHub Username</label>
                    <div className="relative">
                      <Github className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <Input 
                        value={profileData.github}
                        onChange={(e) => setProfileData({ ...profileData, github: e.target.value })}
                        placeholder="github_user"
                        className="pl-12 py-6 bg-void border-white/10"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm text-text-muted mb-2">Bio</label>
                  <textarea 
                    rows={4}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    className="w-full px-4 py-3 bg-void border border-white/10 rounded-lg text-text-primary resize-none focus:outline-none focus:border-neon-cyan"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="mt-6 flex justify-end">
                  <Button 
                    onClick={handleSaveProfile}
                    disabled={isLoading}
                    className="bg-gradient-rgb text-void font-bold"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="portfolio" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-text-primary">Portfolio</h2>
                    <p className="text-text-secondary text-sm">Showcase your best projects on your profile</p>
                  </div>
                  <Button onClick={addPortfolioItem} className="bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30">
                    <Plus className="w-4 h-4 mr-2" /> Add Project
                  </Button>
                </div>

                {portfolio.length === 0 ? (
                  <div className="bg-void-light border-2 border-dashed border-white/10 rounded-xl p-12 text-center">
                    <Layers className="w-12 h-12 text-white/5 mx-auto mb-4" />
                    <p className="text-text-secondary">No projects added yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {portfolio.map((item) => (
                      <div key={item.id} className="bg-void-light border border-white/10 rounded-xl p-6 relative group">
                        <button 
                          onClick={() => removePortfolioItem(item.id)}
                          className="absolute top-4 right-4 p-2 text-text-muted hover:text-neon-red transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-text-muted mb-2 font-bold">Project Title</label>
                              <Input 
                                value={item.title}
                                onChange={(e) => updatePortfolioItem(item.id, { title: e.target.value })}
                                className="bg-void border-white/10"
                              />
                            </div>
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-text-muted mb-2 font-bold">Description</label>
                              <textarea 
                                value={item.description}
                                onChange={(e) => updatePortfolioItem(item.id, { description: e.target.value })}
                                className="w-full px-4 py-2 bg-void border border-white/10 rounded-lg text-text-primary resize-none h-24 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-text-muted mb-2 font-bold">Thumbnail URL</label>
                              <Input 
                                value={item.thumbnailUrl}
                                onChange={(e) => updatePortfolioItem(item.id, { thumbnailUrl: e.target.value })}
                                className="bg-void border-white/10 text-xs"
                              />
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs uppercase tracking-wider text-text-muted mb-2 font-bold">Project URL</label>
                                <Input 
                                  value={item.projectUrl}
                                  placeholder="GitHub / Source"
                                  onChange={(e) => updatePortfolioItem(item.id, { projectUrl: e.target.value })}
                                  className="bg-void border-white/10"
                                />
                              </div>
                              <div>
                                <label className="block text-xs uppercase tracking-wider text-text-muted mb-2 font-bold">Website URL</label>
                                <Input 
                                  value={item.websiteUrl}
                                  placeholder="Official Site"
                                  onChange={(e) => updatePortfolioItem(item.id, { websiteUrl: e.target.value })}
                                  className="bg-void border-white/10"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-text-muted mb-2 font-bold">Live Demo URL</label>
                                <Input 
                                  value={item.liveDemoUrl}
                                  placeholder="Playable link / Live app"
                                  onChange={(e) => updatePortfolioItem(item.id, { liveDemoUrl: e.target.value })}
                                  className="bg-void border-white/10"
                                />
                            </div>
                            <div>
                              <label className="block text-xs uppercase tracking-wider text-text-muted mb-2 font-bold">Tags (comma separated)</label>
                              <Input 
                                value={item.tags.join(', ')}
                                placeholder="Unity, C#, Mobile"
                                onChange={(e) => updatePortfolioItem(item.id, { tags: e.target.value.split(',').map(s => s.trim()) })}
                                className="bg-void border-white/10"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/5">
                          <label className="block text-xs uppercase tracking-wider text-text-muted mb-4 font-bold flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Screenshots (URLs, comma separated)
                          </label>
                          <textarea 
                            value={item.screenshotUrls.join('\n')}
                            onChange={(e) => updatePortfolioItem(item.id, { screenshotUrls: e.target.value.split('\n').filter(s => s.trim()) })}
                            placeholder="https://example.com/screenshot1.jpg"
                            className="w-full px-4 py-2 bg-void border border-white/10 rounded-lg text-text-primary resize-none h-20 text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex justify-end pt-4">
                      <Button onClick={handleSavePortfolio} disabled={isLoading} className="bg-neon-cyan text-void font-bold px-8">
                        {isLoading ? 'Publishing...' : 'Save Portfolio'}
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </TabsContent>

            <TabsContent value="hardware" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-void-light border border-white/5 rounded-xl p-6"
              >
                <h2 className="font-heading text-xl font-bold text-text-primary mb-2">Hardware Setup</h2>
                <p className="text-text-secondary text-sm mb-8">Share your development rig and tools with the community</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm text-text-muted mb-2 flex items-center gap-2">
                      <Cpu className="w-4 h-4" /> CPU / Processor
                    </label>
                    <Input 
                      value={hardware.cpu}
                      onChange={(e) => setHardware({ ...hardware, cpu: e.target.value })}
                      placeholder="e.g. AMD Ryzen 9 5900X"
                      className="bg-void border-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 flex items-center gap-2">
                      <MonitorSmartphone className="w-4 h-4" /> GPU / Graphics
                    </label>
                    <Input 
                      value={hardware.gpu}
                      onChange={(e) => setHardware({ ...hardware, gpu: e.target.value })}
                      placeholder="e.g. NVIDIA RTX 4090"
                      className="bg-void border-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 flex items-center gap-2">
                      <Layers className="w-4 h-4" /> RAM / Memory
                    </label>
                    <Input 
                      value={hardware.ram}
                      onChange={(e) => setHardware({ ...hardware, ram: e.target.value })}
                      placeholder="e.g. 64GB DDR5 6000MHz"
                      className="bg-void border-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 flex items-center gap-2">
                      <Monitor className="w-4 h-4" /> Primary Monitor
                    </label>
                    <Input 
                      value={hardware.monitor}
                      onChange={(e) => setHardware({ ...hardware, monitor: e.target.value })}
                      placeholder="e.g. LG UltraGear 4K 144Hz"
                      className="bg-void border-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 flex items-center gap-2">
                      <Laptop className="w-4 h-4" /> Operating System
                    </label>
                    <Input 
                      value={hardware.os}
                      onChange={(e) => setHardware({ ...hardware, os: e.target.value })}
                      placeholder="e.g. Windows 11 / Ubuntu 22.04"
                      className="bg-void border-white/10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2 flex items-center gap-2">
                      <MousePointer2 className="w-4 h-4" /> Peripherals (comma separated)
                    </label>
                    <Input 
                      value={hardware.peripherals?.join(', ')}
                      onChange={(e) => setHardware({ ...hardware, peripherals: e.target.value.split(',').map(s => s.trim()) })}
                      placeholder="Mouse, Keyboard, Tablet..."
                      className="bg-void border-white/10"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm text-text-muted mb-2">Setup Notes / Workstation description</label>
                  <textarea 
                    rows={3}
                    value={hardware.notes}
                    onChange={(e) => setHardware({ ...hardware, notes: e.target.value })}
                    className="w-full px-4 py-3 bg-void border border-white/10 rounded-lg text-text-primary resize-none focus:outline-none focus:border-neon-cyan"
                    placeholder="Tell us about your physical setup or favorite tools..."
                  />
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                  <Button 
                    onClick={handleSaveHardware}
                    disabled={isLoading}
                    className="bg-neon-magenta text-white font-bold px-8 shadow-lg shadow-neon-magenta/20 hover:shadow-neon-magenta/40"
                  >
                    {isLoading ? 'Syncing...' : 'Save Rig Details'}
                  </Button>
                </div>
              </motion.div>
            </TabsContent>
            <TabsContent value="api-keys" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-void-light border border-white/5 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-heading text-xl font-bold text-text-primary">API Management</h2>
                    <p className="text-text-secondary text-sm">Secure platform access for middle-tier subscribers</p>
                  </div>
                  <div className="flex items-center gap-2 p-1 bg-void rounded-lg border border-white/5">
                    <div className="px-3 py-1 bg-neon-pink/10 text-neon-pink text-[10px] font-bold rounded uppercase tracking-widest">Middle Tier Active</div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-void border border-white/5 p-4 rounded-xl">
                    <label className="block text-xs font-bold text-text-muted uppercase mb-2">Create New Key</label>
                    <div className="flex gap-4">
                      <Input 
                        placeholder="Key Name (e.g. My Portfolio Bot)"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        className="bg-void border-white/10"
                      />
                      <Button onClick={handleGenerateKey} className="bg-neon-pink text-void font-bold shadow-lg shadow-neon-pink/20">
                        Generate Key
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-text-primary">Active Keys</h3>
                    {apiKeys.length === 0 ? (
                      <div className="p-8 border-2 border-dashed border-white/5 rounded-xl text-center text-text-muted">
                        No API keys generated yet.
                      </div>
                    ) : (
                      apiKeys.map(key => (
                        <div key={key.id} className="bg-void border border-white/5 p-4 rounded-xl flex items-center justify-between group">
                          <div className="flex-1">
                            <h4 className="font-bold text-sm text-text-primary flex items-center gap-2">
                              <Key size={14} className="text-neon-pink" />
                              {key.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs font-mono text-zinc-500 bg-black/40 px-2 py-0.5 rounded">
                                {key.key.substring(0, 10)}*******************
                              </code>
                              <button 
                                onClick={() => copyToClipboard(key.key, key.id)}
                                className="text-text-muted hover:text-white transition-colors"
                              >
                                {copiedKeyId === key.id ? <Check size={14} className="text-neon-lime" /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button className="p-2 text-text-muted hover:text-neon-pink transition-colors opacity-0 group-hover:opacity-100">
                              <ExternalLink size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteKey(key.id)}
                              className="p-2 text-text-muted hover:text-neon-red transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-4 bg-neon-pink/5 border border-neon-pink/20 rounded-xl">
                    <h4 className="text-xs font-bold text-neon-pink uppercase mb-2">Endpoint Redirection</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Route your platform notifications and messages directly to your own API endpoint. 
                      Requires **Middle Tier** or higher. 
                      <span className="text-neon-pink cursor-pointer ml-1 hover:underline">Configure Webhooks →</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="performance" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-void-light border border-white/5 rounded-xl p-6 space-y-6"
              >
                <div>
                  <h2 className="font-heading text-xl font-bold text-text-primary mb-1 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-neon-cyan" /> Performance Settings
                  </h2>
                  <p className="text-text-secondary text-sm">Tune rendering for your hardware.</p>
                </div>

                {/* WebGPU Toggle */}
                <div className="bg-void border border-white/10 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-text-primary">WebGPU Acceleration</span>
                        {!isSupported && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-neon-red/10 text-neon-red rounded uppercase tracking-wider">
                            Not Supported
                          </span>
                        )}
                        {isSupported && isEnabled && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-neon-lime/10 text-neon-lime rounded uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-secondary">
                        Uses your GPU for animations, canvas rendering, and in-browser games.
                        Requires Chrome 113+, Edge 113+, or Safari 18+.
                      </p>
                      {!isSupported && (
                        <p className="text-xs text-neon-red/70 mt-2">
                          Your browser does not support WebGPU. Try Chrome or Edge 113+.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (!isSupported) {
                          toast.error('WebGPU is not supported in this browser');
                          return;
                        }
                        toggleWebGPU();
                        toast.success(isEnabled ? 'WebGPU disabled' : 'WebGPU enabled — GPU acceleration active');
                      }}
                      disabled={isInitializing}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 mt-1 ${
                        isEnabled
                          ? 'bg-neon-cyan'
                          : isSupported
                          ? 'bg-white/10 hover:bg-white/20'
                          : 'bg-white/5 cursor-not-allowed opacity-50'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          isEnabled ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Performance Mode Toggle */}
                <div className="bg-void border border-white/10 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-text-primary">Performance Mode</span>
                        {performanceMode && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-neon-lime/10 text-neon-lime rounded uppercase tracking-wider">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-secondary">
                        Reduces animations and visual effects for smoother performance on lower-end hardware.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        togglePerformanceMode();
                        toast.success(performanceMode ? 'Performance mode disabled' : 'Performance mode enabled');
                      }}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 mt-1 ${
                        performanceMode ? 'bg-neon-cyan' : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          performanceMode ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="account" className="mt-0">
              <div className="bg-void-light border border-white/5 rounded-xl p-6">
                <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
                  Change Password
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Current Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <Input 
                        type="password"
                        className="pl-12 py-6 bg-void border-white/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <Input 
                        type="password"
                        className="pl-12 py-6 bg-void border-white/10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                      <Input 
                        type="password"
                        className="pl-12 py-6 bg-void border-white/10"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button className="bg-gradient-rgb text-void font-bold">
                    Update Password
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notifications" className="mt-0">
              <div className="bg-void-light border border-white/5 rounded-xl p-6">
                <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
                  Notification Preferences
                </h2>

                <div className="space-y-4">
                  {[
                    { label: 'New sales', desc: 'Get notified when someone buys your asset' },
                    { label: 'Asset reviews', desc: 'Get notified when someone reviews your asset' },
                    { label: 'Marketing emails', desc: 'Receive updates about new features and promotions' },
                    { label: 'Security alerts', desc: 'Get notified about important security updates' },
                  ].map((item) => (
                    <label key={item.label} className="flex items-start gap-4 p-4 bg-void rounded-lg cursor-pointer">
                      <input type="checkbox" className="custom-checkbox mt-1" defaultChecked />
                      <div>
                        <p className="font-medium text-text-primary">{item.label}</p>
                        <p className="text-sm text-text-muted">{item.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="privacy" className="mt-0">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-void-light border border-white/5 rounded-xl p-6 space-y-6"
              >
                <div>
                  <h2 className="font-heading text-xl font-bold text-text-primary mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-neon-cyan" /> Privacy & Data
                  </h2>
                  <p className="text-text-secondary text-sm">Control how your interactions contribute to NovAura's AI development.</p>
                </div>

                {/* Training Data Consent Toggle */}
                <div className="bg-void border border-white/10 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <BrainCircuit className="w-4 h-4 text-neon-magenta" />
                        <span className="font-bold text-text-primary">AI Training Contribution</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                          user?.trainingConsentGiven
                            ? 'bg-neon-lime/10 text-neon-lime'
                            : 'bg-white/5 text-text-muted'
                        }`}>
                          {user?.trainingConsentGiven ? 'Opted In' : 'Opted Out'}
                        </span>
                      </div>
                      <p className="text-sm text-text-secondary leading-relaxed">
                        Allow your conversations and code sessions with Nova to be used as anonymized training material
                        for future model development. Variety and emergence are valued — creative, unconventional,
                        and exploratory interactions are especially useful.
                      </p>
                      <p className="text-xs text-text-muted mt-2">
                        Hard lines: no malicious, morbid, or non-consensual content is ever captured regardless of this setting.
                        You can change this at any time.
                      </p>
                      {user?.trainingConsentAt && (
                        <p className="text-xs text-text-muted mt-1">
                          Last updated: {new Date(user.trainingConsentAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        const newValue = !user?.trainingConsentGiven;
                        try {
                          await updateProfile({
                            trainingConsentGiven: newValue,
                            trainingConsentAt: new Date().toISOString(),
                            trainingConsentVersion: '1.0',
                          });
                          toast.success(newValue
                            ? 'Training contribution enabled — thank you for helping Nova grow.'
                            : 'Training contribution disabled. Your sessions will no longer be used for training.'
                          );
                        } catch {
                          toast.error('Failed to update privacy settings');
                        }
                      }}
                      disabled={isLoading}
                      className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 mt-1 ${
                        user?.trainingConsentGiven
                          ? 'bg-neon-magenta'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          user?.trainingConsentGiven ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-neon-cyan/5 border border-neon-cyan/10 rounded-xl">
                  <p className="text-xs text-text-muted leading-relaxed italic">
                    "You write your own stories when interacting with silicon minds. What gets remembered shapes what comes next."
                  </p>
                </div>
              </motion.div>
            </TabsContent>

            <TabsContent value="billing" className="mt-0">
              <div className="bg-void-light border border-white/5 rounded-xl p-6">
                <h2 className="font-heading text-xl font-bold text-text-primary mb-6">
                  Payment Methods
                </h2>

                <div className="p-8 border-2 border-dashed border-white/10 rounded-xl text-center">
                  <CreditCard className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-text-secondary mb-2">No payment methods added</p>
                  <p className="text-text-muted text-sm mb-4">
                    Payment methods will be managed through Stripe
                  </p>
                  <Button variant="outline" className="border-white/20">
                    Add Payment Method
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
