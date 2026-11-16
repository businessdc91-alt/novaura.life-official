import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Inbox, 
  Send, 
  Terminal, 
  Trash2, 
  Plus, 
  Search, 
  MoreVertical, 
  Reply, 
  Forward, 
  RefreshCw,
  User,
  X,
  Database,
  Lock,
  Shield,
  Sparkles,
  Command,
  Paperclip,
  Key,
  Globe,
  Zap,
  CheckSquare,
  Archive,
  ChevronLeft,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOMeta } from '@/components/seo/SEOMeta';
import { useAuthStore } from '@/stores/authStore';
import { AuroraBackground } from '@/components/ui/AuroraBackground';
import { sovereignEmailService, EmailMessage, MailAccount } from '@/services/SovereignEmailService';
import { toast } from 'sonner';

export default function WebmailPage() {
  const { user } = useAuthStore();
  const [selectedFolder, setSelectedFolder] = useState<EmailMessage['folder']>('inbox');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [showIdentityPanel, setShowIdentityPanel] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [newHandle, setNewHandle] = useState('');
  
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [auraIntel, setAuraIntel] = useState<{ summary: string; intent: string; loading: boolean }>({ summary: '', intent: '', loading: false });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (user) {
      fetchEmails();
    }
  }, [selectedFolder]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const accs = await sovereignEmailService.getAccounts();
      setAccounts(accs);
      
      // If user has no accounts, suggest claiming one
      if (accs.length === 0) {
        setShowClaimModal(true);
      }
      
      await fetchEmails();
    } catch (error) {
      console.error('Failed to load email data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEmails = async () => {
    setIsLoading(true);
    try {
      const data = await sovereignEmailService.getInbox(selectedFolder);
      setEmails(data);
    } catch (error) {
      toast.error('Failed to sync with grid');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectEmail = async (email: EmailMessage) => {
    setSelectedEmail(email);
    if (!email.isRead) {
      await sovereignEmailService.markAsRead(email.id, true);
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
    }

    // Get AI Insight
    setAuraIntel({ summary: '', intent: '', loading: true });
    try {
      const insight = await sovereignEmailService.getAuraInsight(email.id);
      setAuraIntel({ ...insight, loading: false });
    } catch (error) {
      setAuraIntel({ summary: 'Aura analysis unavailable for this thread.', intent: 'Unknown', loading: false });
    }
  };

  const handleSend = async () => {
    if (!composeData.to || !composeData.subject) return;
    
    setIsLoading(true);
    try {
      await sovereignEmailService.sendEmail({
        to: composeData.to,
        subject: composeData.subject,
        body: composeData.body,
        fromName: user?.username
      });
      toast.success('Message transmitted');
      setShowCompose(false);
      setComposeData({ to: '', subject: '', body: '' });
      fetchEmails();
    } catch (error: any) {
      toast.error(error.message || 'Transmission failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimHandle = async () => {
    if (!newHandle) return;
    setIsLoading(true);
    try {
      await sovereignEmailService.claimHandle(newHandle);
      toast.success(`Identity @novaura.life secured`);
      setShowClaimModal(false);
      fetchInitialData();
    } catch (error: any) {
      toast.error(error.message || 'Claim failed');
    } finally {
      setIsLoading(false);
    }
  };

  const activeAccount = accounts.find(a => a.isDefault) || accounts[0];

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans selection:bg-cyan-500/30">
      <SEOMeta 
        title="NovAura Webmail | Sovereign Communication Hub" 
        description="Professional-grade sovereign email service with Aura AI thread analysis and encrypted routing."
      />
      
      <AuroraBackground />

      <div className="relative z-10 min-h-[100dvh] flex flex-col backdrop-blur-[2px]">
        {/* Top Header */}
        <header className="h-20 border-b border-white/5 bg-black/40 flex items-center justify-between px-6 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <MailAccountIcon className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-400">NovAura ESP</h2>
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Sovereign Portal // {activeAccount?.email || 'Provisioning...'}</p>
            </div>
          </div>

          <div className="flex-1 max-w-xl px-12">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-cyan-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search the grid..." 
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-white/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right mr-4 hidden md:block">
              <p className="text-xs font-bold text-white">{user?.username || 'Ambassador'}</p>
              <p className="text-[10px] text-cyan-500/60 font-mono">Resident // {user?.id?.slice(0, 8)}</p>
            </div>
            <button 
              onClick={() => setShowIdentityPanel(true)}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:border-cyan-500/50 transition-all group"
            >
              <User className="w-5 h-5 text-white/40 group-hover:text-cyan-400 transition-colors" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Rail */}
          <aside className="w-64 bg-void-light/20 backdrop-blur-sm border-r border-white/5 p-4 flex flex-col gap-6 shrink-0">
            <Button 
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-6 rounded-2xl shadow-xl shadow-cyan-500/10"
              onClick={() => setShowCompose(true)}
            >
              <Plus className="w-5 h-5 mr-2" /> New Message
            </Button>

            <nav className="space-y-1">
              {[
                { id: 'inbox', label: 'Inbox', icon: Inbox, count: emails.filter(e => !e.isRead).length },
                { id: 'sent', label: 'Sent', icon: Send },
                { id: 'drafts', label: 'Drafts', icon: Terminal },
                { id: 'trash', label: 'Trash', icon: Trash2 },
              ].map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id as any)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium transition-all group ${
                    selectedFolder === folder.id
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-inner'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <folder.icon className={`w-4 h-4 ${selectedFolder === folder.id ? 'text-cyan-400' : 'text-white/20 group-hover:text-white/40'}`} />
                  <span className="flex-1 text-left">{folder.label}</span>
                  {folder.count > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-cyan-500 text-black text-[10px] font-black">
                      {folder.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="mt-auto space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-3 h-3 text-cyan-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">Storage Usage</span>
                </div>
                <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 w-[12%]" />
                </div>
                <p className="text-[9px] text-white/30 mt-2 font-mono">1.2GB of 10GB utilized</p>
              </div>
              <p className="text-[10px] text-center text-white/20 font-mono">Build v2.4.0-SOVEREIGN</p>
            </div>
          </aside>

          {/* Message Vault (Email List) */}
          <main className={`flex-1 flex overflow-hidden transition-all duration-500 ${selectedEmail ? 'gap-1' : ''}`}>
            <section className={`${selectedEmail ? 'w-[40%]' : 'w-full'} bg-void-light/10 flex flex-col border-r border-white/5 transition-all shrink-0`}>
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
                    <CheckSquare className="w-4 h-4" />
                  </button>
                  <button className="p-2 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors" onClick={fetchEmails}>
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
                  </button>
                </div>
                <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
                  {selectedFolder} // {emails.length} messages
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {isLoading && emails.length === 0 ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-4" />
                    <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Synchronizing grid...</p>
                  </div>
                ) : emails.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 p-12 text-center">
                    <Inbox className="w-16 h-16 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Grid is silent</p>
                  </div>
                ) : (
                  emails.map(email => (
                    <button
                      key={email.id}
                      onClick={() => handleSelectEmail(email)}
                      className={`w-full p-6 flex flex-col gap-2 border-b border-white/5 text-left transition-all relative overflow-hidden group ${
                        selectedEmail?.id === email.id ? 'bg-cyan-500/[0.03]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {selectedEmail?.id === email.id && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500" />
                      )}
                      
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${email.isRead ? 'bg-white/5 text-white/40' : 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'}`}>
                            {(email.from.name || email.from.address)[0].toUpperCase()}
                          </div>
                          <span className={`text-sm ${email.isRead ? 'text-white/40' : 'text-white font-bold'}`}>
                            {email.from.name || email.from.address}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-white/20 uppercase">
                          {new Date(email.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      <p className={`text-sm tracking-tight truncate ${email.isRead ? 'text-white/30' : 'text-white/80'}`}>
                        {email.subject}
                      </p>
                      
                      <p className="text-xs text-white/20 line-clamp-1 font-mono italic">
                        {email.snippet}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>

            {/* Secure Reader (Email Detail) */}
            <AnimatePresence mode="wait">
              {selectedEmail && (
                <motion.section 
                  key={selectedEmail.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex-1 flex overflow-hidden bg-void-light/5 backdrop-blur-xl"
                >
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Reader Header */}
                    <div className="p-8 border-b border-white/5 bg-black/20 shrink-0">
                      <div className="flex items-center justify-between mb-8">
                        <button 
                          onClick={() => setSelectedEmail(null)}
                          className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-white/40 hover:text-white"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                          <button className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors"><Trash2 className="w-5 h-5" /></button>
                          <button className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors"><Archive className="w-5 h-5" /></button>
                          <button className="p-2 rounded-xl hover:bg-white/5 text-white/40 hover:text-white transition-colors"><MoreVertical className="w-5 h-5" /></button>
                        </div>
                      </div>

                      <h1 className="text-3xl font-black text-white tracking-tighter mb-6 leading-tight">
                        {selectedEmail.subject}
                      </h1>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-black text-lg">
                            {(selectedEmail.from.name || selectedEmail.from.address)[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{selectedEmail.from.name || 'External User'}</p>
                            <p className="text-[10px] font-mono text-cyan-500/50">{selectedEmail.from.address}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono text-white/20 uppercase">{new Date(selectedEmail.receivedAt).toLocaleDateString()}</p>
                          <p className="text-[10px] font-mono text-white/10 uppercase tracking-widest mt-1">E2E Verification: Pass</p>
                        </div>
                      </div>
                    </div>

                    {/* Reader Content */}
                    <div className="flex-1 overflow-y-auto p-12 custom-scrollbar flex flex-col bg-black/10">
                      {selectedEmail.html ? (
                        <div 
                          className="text-white/80 leading-relaxed font-medium prose prose-invert max-w-none"
                          dangerouslySetInnerHTML={{ __html: selectedEmail.html }}
                        />
                      ) : (
                        <div className="text-white/80 whitespace-pre-wrap leading-relaxed text-base font-medium font-serif italic border-l-2 border-cyan-500/20 pl-6 py-2">
                          {selectedEmail.body}
                        </div>
                      )}

                      {/* Quick Reply Area */}
                      <div className="mt-12 pt-8 border-t border-white/5">
                        <p className="text-xs text-white/30 font-mono mb-4 uppercase tracking-widest">End of message // Aura Standby</p>
                        <div className="flex gap-4">
                          <Button className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-8 rounded-2xl text-white/60">
                            <Reply className="w-4 h-4 mr-2" /> Reply
                          </Button>
                          <Button className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-8 rounded-2xl text-white/60">
                            <Forward className="w-4 h-4 mr-2" /> Forward
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Aura Operational Intelligence Side-panel */}
                  <aside className="w-80 border-l border-white/5 bg-black/20 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
                    <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                      </div>
                      <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-3">Aura Insight</h4>
                      
                      {auraIntel.loading ? (
                        <div className="space-y-2">
                          <div className="h-3 w-full bg-white/5 rounded animate-pulse" />
                          <div className="h-3 w-4/5 bg-white/5 rounded animate-pulse" />
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-xs text-white/80 leading-relaxed font-medium">
                            {auraIntel.summary || 'Analyze this thread for automated intent identification.'}
                          </p>
                          {auraIntel.intent && (
                            <div className="pt-3 border-t border-white/5">
                              <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest block mb-1">Intent Category</span>
                              <span className="text-xs text-cyan-400 font-mono">{auraIntel.intent}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Actions</h4>
                      <Button variant="outline" className="w-full justify-start text-[10px] py-2 bg-transparent border-white/10 hover:border-cyan-500/50 text-white/60 uppercase tracking-widest">
                        <Archive className="w-3 h-3 mr-2" /> Archive message
                      </Button>
                      <Button variant="outline" className="w-full justify-start text-[10px] py-2 bg-transparent border-white/10 hover:border-purple-500/50 text-white/60 uppercase tracking-widest">
                        <Zap className="w-3 h-3 mr-2" /> AI Reply
                      </Button>
                      <Button variant="outline" className="w-full justify-start text-[10px] py-2 bg-transparent border-white/10 hover:border-red-500/50 text-white/60 uppercase tracking-widest">
                        <Shield className="w-3 h-3 mr-2" /> Report Spam
                      </Button>
                    </div>

                    <div className="mt-auto p-4 rounded-xl bg-void-light border border-white/5">
                       <div className="flex items-center gap-2 mb-2">
                         <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                         <span className="text-[10px] font-mono text-white/40 uppercase">Connection Secure</span>
                       </div>
                       <p className="text-[9px] text-white/20 font-mono">TLS 1.3 // AES-256 Enabled</p>
                    </div>
                  </aside>
                </motion.section>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Account & Identity Panel (Slide-over) */}
      <AnimatePresence>
        {showIdentityPanel && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowIdentityPanel(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[#050508] border-l border-white/10 z-[101] shadow-2xl p-8 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold text-white tracking-tight">Account Identity</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowIdentityPanel(false)}>
                  <X className="w-6 h-6" />
                </Button>
              </div>

              <div className="space-y-8">
                <section>
                  <h4 className="text-xs font-black text-cyan-400 uppercase tracking-[0.2em] mb-4">Linked Addresses</h4>
                  <div className="space-y-3">
                    {accounts.map(acc => (
                      <div key={acc.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black ${acc.provider === 'native' ? 'bg-cyan-500 text-black' : 'bg-white/10 text-white'}`}>
                            {acc.provider === 'native' ? 'NA' : 'EX'}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{acc.email}</p>
                            <p className="text-[9px] text-white/40 uppercase font-mono">{acc.provider}</p>
                          </div>
                        </div>
                        {acc.isDefault && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[8px] font-black text-cyan-400 uppercase">Primary</span>
                        )}
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      className="w-full py-4 border-white/5 bg-white/2 text-[10px] font-black uppercase tracking-widest"
                      onClick={() => setShowClaimModal(true)}
                    >
                      + Add Address
                    </Button>
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-black text-white/20 uppercase tracking-[0.2em] mb-4">Management</h4>
                  <div className="space-y-3">
                    <button className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-all flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/30 group-hover:text-cyan-400 transition-colors">
                        <Key className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white">Security Keys</p>
                        <p className="text-[10px] text-white/40">Manage your access tokens</p>
                      </div>
                    </button>
                    <button className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all flex items-center gap-4 group">
                      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-white/30 group-hover:text-purple-400 transition-colors">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white">Domain Routing</p>
                        <p className="text-[10px] text-white/40">Configure custom domains</p>
                      </div>
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Claim Handle Modal */}
      <AnimatePresence>
        {showClaimModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-void-light border border-cyan-500/20 rounded-[32px] w-full max-w-md p-8 text-center shadow-[0_0_100px_rgba(6,182,212,0.2)]"
            >
              <div className="w-20 h-20 bg-cyan-500 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl shadow-cyan-500/40">
                <Sparkles className="w-10 h-10 text-black" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Secure your Identity</h3>
              <p className="text-white/40 text-sm mb-8">Claim your native @novaura.life handle to activate sovereign communication.</p>
              
              <div className="relative mb-8">
                <Input 
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  placeholder="your-handle"
                  className="bg-white/5 border-white/10 py-8 pl-6 pr-32 rounded-2xl text-xl font-bold focus:border-cyan-500 h-auto"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-cyan-500 font-black tracking-tighter">@novaura.life</span>
              </div>

              <div className="flex gap-4">
                <Button variant="ghost" onClick={() => setShowClaimModal(false)} className="flex-1 text-white/40 font-black">Later</Button>
                <Button onClick={handleClaimHandle} disabled={!newHandle || isLoading} className="flex-1 bg-cyan-500 text-black font-black py-7 rounded-2xl h-auto">Claim Identity</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Compose Message Modal */}
      <AnimatePresence>
        {showCompose && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-void-light border border-white/10 rounded-[32px] w-full max-w-3xl overflow-hidden shadow-[0_0_100px_rgba(6,182,212,0.15)]"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center">
                    <Send className="w-4 h-4 text-black" />
                  </div>
                  <h3 className="text-white font-bold tracking-tight">New Message</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowCompose(false)} className="rounded-full hover:bg-red-500/20 hover:text-red-500 transition-all">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">To</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <Input
                        placeholder="handle@novaura.life"
                        value={composeData.to}
                        onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                        className="pl-12 bg-white/5 border-white/10 py-6 rounded-2xl focus:border-cyan-500/50 transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Subject</label>
                    <div className="relative">
                      <Command className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <Input
                        placeholder="What's this about?"
                        value={composeData.subject}
                        onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                        className="pl-12 bg-white/5 border-white/10 py-6 rounded-2xl focus:border-cyan-500/50 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Message</label>
                  <div className="relative group">
                    <textarea
                      placeholder="Write your message..."
                      value={composeData.body}
                      onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                      rows={10}
                      className="w-full bg-white/5 border border-white/10 rounded-[24px] p-6 text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-cyan-500/50 transition-all font-serif italic text-lg leading-relaxed"
                    />
                    <div className="absolute bottom-4 right-4 flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20">
                        <Sparkles className="w-5 h-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-white/5 text-white/30">
                        <Paperclip className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-4 text-white/30 text-[10px] font-mono">
                    <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> E2E Encrypted</span>
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> AI Protected</span>
                  </div>
                  <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => setShowCompose(false)} className="text-white/40 hover:text-white font-bold tracking-widest text-[10px] uppercase">
                      Discard
                    </Button>
                    <Button 
                      onClick={handleSend}
                      disabled={isLoading}
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-black px-12 py-7 rounded-2xl shadow-2xl shadow-cyan-500/20 tracking-[0.15em] uppercase text-[11px]"
                    >
                      Send Message
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MailAccountIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="M18 16v6" />
      <path d="M15 19h6" />
    </svg>
  );
}
