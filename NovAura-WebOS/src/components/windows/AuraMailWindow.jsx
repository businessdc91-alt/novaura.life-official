import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  Mail, Inbox, Send, File, Trash2, 
  Plus, Search, Star, Archive, 
  MoreVertical, RefreshCw, ChevronLeft, 
  Maximize2, Minimize2, X, Sparkles, 
  ArrowLeft, Paperclip, Smile, Image as ImageIcon,
  Zap, Shield, Globe, User, Crown, Fingerprint, Loader2
} from 'lucide-react';

/**
 * AuraMail — Sovereign Email Client v1
 * A premium, Gmail-inspired interface for NovAura OS.
 * Supports custom domains, Aura-powered summaries, and frontier aesthetics.
 */
const AuraMailWindow = ({ onClose }) => {
  const { user: authUser } = useAuth();
  const [view, setView] = useState('inbox'); 
  const [selectedMail, setSelectedMail] = useState(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [handleInput, setHandleInput] = useState('');
  const [isClaiming, setIsClaiming] = useState(false);
  const [nativeAccount, setNativeAccount] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [summary, setSummary] = useState('');
  const [mails, setMails] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [userEmail, setUserEmail] = useState('operator@novaura.life');
  const [isPremium, setIsPremium] = useState(false);

  // Connection form state
  const [newAccount, setNewAccount] = useState({ provider: 'imap', email: '', host: '', port: 993, pass: '' });

  // Compose form state
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeError, setComposeError] = useState('');

  useEffect(() => {
    fetchEmails();
    fetchAccounts();
  }, [view, selectedAccount]);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const token = await authUser?.getIdToken?.();
      const res = await fetch(`/api/email/inbox?limit=50&folder=${view}&accountId=${selectedAccount}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) setMails(data.emails);
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const token = await authUser?.getIdToken?.();
      const res = await fetch('/api/email/accounts', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        setAccounts(data.accounts || []);
        const native = data.accounts?.find(a => a.provider === 'native');
        setNativeAccount(native || null);
      }
    } catch (e) {
      console.warn('Failed to fetch mail accounts');
    }
  };

  const handleClaimHandle = async (e) => {
    e.preventDefault();
    if (!handleInput.trim()) return;
    setIsClaiming(true);
    try {
      const token = await authUser?.getIdToken?.();
      const res = await fetch('/api/email/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ handle: handleInput })
      });
      const data = await res.json();
      if (data.success) {
        setHandleInput('');
        setIsClaimModalOpen(false);
        fetchAccounts();
      } else {
        alert(data.error || 'Claim failed');
      }
    } catch (err) {
      alert('Identity claim failed');
    } finally {
      setIsClaiming(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const token = await authUser?.getIdToken?.();
      await fetch('/api/email/sync', { 
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      await fetchEmails();
    } finally {
      setSyncing(false);
    }
  };

  const handleConnect = async () => {
    try {
      const token = await authUser?.getIdToken?.();
      await fetch('/api/email/accounts', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          provider: newAccount.provider,
          email: newAccount.email,
          credentials: {
            host: newAccount.host,
            port: newAccount.port,
            pass: newAccount.pass
          }
        })
      });
      setIsConnectOpen(false);
      fetchAccounts();
    } catch (err) {
      alert('Failed to connect account');
    }
  };


  const handleAuraSummary = async () => {
    if (!selectedMail) return;
    setSummarizing(true);
    setSummary('');
    
    // Simulate Aura Intelligence
    setTimeout(() => {
      setSummary(`Aura Analysis: This email confirms the successful deployment of the NovAura inference bridge. No critical action required.`);
      setSummarizing(false);
    }, 1500);
  };

  const handleSendEmail = async () => {
    setComposeError('');

    // Client-side validation
    const toTrimmed = composeTo.trim();
    if (!toTrimmed) {
      setComposeError('Recipient is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = toTrimmed.split(',').map(r => r.trim()).filter(Boolean);
    for (const r of recipients) {
      if (!emailRegex.test(r)) {
        setComposeError(`Invalid email: ${r}`);
        return;
      }
    }

    const subjectTrimmed = composeSubject.trim();
    if (!subjectTrimmed) {
      setComposeError('Subject is required');
      return;
    }

    const bodyTrimmed = composeBody.trim();
    if (!bodyTrimmed) {
      setComposeError('Body is required');
      return;
    }

    setComposeSending(true);
    try {
      const token = await authUser?.getIdToken?.();
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          to: toTrimmed,
          subject: subjectTrimmed,
          body: bodyTrimmed,
          html: bodyTrimmed.replace(/\n/g, '<br/>')
        })
      });
      const data = await res.json();
      if (data.success) {
        // Clear compose form and close
        setComposeTo('');
        setComposeSubject('');
        setComposeBody('');
        setIsComposeOpen(false);
        // Refresh sent folder if currently viewing it
        if (view === 'sent') fetchEmails();
      } else {
        setComposeError(data.error || data.detail || 'Failed to send email');
      }
    } catch (err) {
      console.error('Send email error:', err);
      setComposeError('Network error. Please try again.');
    } finally {
      setComposeSending(false);
    }
  };

  const filteredMails = mails.filter(m => 
    m.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.from?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.from?.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#050508] text-[#e0e0e0] font-sans overflow-hidden select-none border border-[#ffffff0a] rounded-lg shadow-2xl">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#08080c] border-b border-[#ffffff0a]">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-2 text-[#4c65ff]">
            <Zap className="w-5 h-5 fill-current" />
            <h1 className="text-sm font-bold tracking-widest uppercase">AuraMail</h1>
          </div>
          
          <div className="relative max-w-xl flex-1 ml-8">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input 
              type="text" 
              placeholder="Search across your sovereign domains..." 
              className="w-full bg-[#0f0f15] border border-[#ffffff11] rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#4c65ff44] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            <div className="w-8 h-8 rounded-full bg-[#4c65ff] border-2 border-[#08080c] flex items-center justify-center text-[10px] font-bold shadow-lg">NA</div>
          </div>
          <button 
            onClick={handleSync}
            disabled={syncing}
            className={`p-2 hover:bg-[#ffffff0a] rounded-full transition-all ${syncing ? 'animate-spin text-[#4c65ff]' : 'text-[#888]'}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 bg-[#08080c] border-r border-[#ffffff0a] flex flex-col p-4">
          <button 
            onClick={() => setIsComposeOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#4c65ff] hover:bg-[#5d75ff] text-white font-bold py-3 px-6 rounded-2xl mb-8 transition-all shadow-[0_8px_20px_-6px_rgba(76,101,255,0.4)]"
          >
            <Plus className="w-5 h-5" />
            Compose
          </button>

          <nav className="space-y-1">
            <SidebarItem icon={<Inbox className="w-4 h-4" />} label="Inbox" active={view === 'inbox'} count={2} onClick={() => setView('inbox')} />
            <SidebarItem icon={<Star className="w-4 h-4" />} label="Starred" active={view === 'starred'} onClick={() => setView('starred')} />
            <SidebarItem icon={<Send className="w-4 h-4" />} label="Sent" active={view === 'sent'} onClick={() => setView('sent')} />
            <SidebarItem icon={<File className="w-4 h-4" />} label="Drafts" active={view === 'drafts'} count={1} onClick={() => setView('drafts')} />
            <SidebarItem icon={<Trash2 className="w-4 h-4" />} label="Trash" active={view === 'trash'} onClick={() => setView('trash')} />
          </nav>

          <div className="mt-8 p-4 bg-[#4c65ff11] border border-[#4c65ff22] rounded-2xl">
            <div className="flex items-center gap-2 text-[#4c65ff] text-[10px] font-bold uppercase tracking-widest mb-2">
              <Sparkles className="w-3 h-3" /> Ambassador Status
            </div>
            <p className="text-[10px] text-[#888] leading-relaxed">
              You are representing the <strong>NovAura Frontier</strong>. Every email sent spreads the grid.
            </p>
          </div>

          <div className="mt-auto pt-8 border-t border-[#ffffff05]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-bold text-[#555] uppercase tracking-widest">Mailboxes</h3>
              <button 
                onClick={() => setIsConnectOpen(true)}
                className="p-1 hover:bg-[#ffffff0a] rounded text-[#4c65ff]"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            
            <div className="space-y-2 overflow-y-auto max-h-48 scrollbar-hide">
              <div 
                onClick={() => setSelectedAccount('all')}
                className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-lg transition-all ${selectedAccount === 'all' ? 'bg-[#4c65ff11] text-white' : 'text-[#888] hover:bg-[#ffffff05]'}`}
              >
                <Globe className="w-3 h-3 text-[#4c65ff]" />
                All Accounts
              </div>

              <div 
                onClick={() => setSelectedAccount('internal')}
                className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-lg transition-all ${selectedAccount === 'internal' ? 'bg-[#4c65ff11] text-white' : 'text-[#888] hover:bg-[#ffffff05]'}`}
              >
                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                {nativeAccount ? nativeAccount.email : '@novaura.life'}
              </div>

              {!nativeAccount && (
                <button 
                  onClick={() => setIsClaimModalOpen(true)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-bold text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/10 border border-cyan-400/20 rounded-lg transition-all uppercase tracking-widest mt-2"
                >
                  <Fingerprint className="w-3 h-3" />
                  Claim Identity
                </button>
              )}

              {accounts.filter(a => a.provider !== 'native').map(acc => (
                <div 
                  key={acc.id}
                  onClick={() => setSelectedAccount(acc.id)}
                  className={`flex items-center gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-lg transition-all ${selectedAccount === acc.id ? 'bg-[#4c65ff11] text-white' : 'text-[#888] hover:bg-[#ffffff05]'}`}
                >
                  <User className="w-3 h-3 text-[#00f0ff]" />
                  <span className="truncate">{acc.email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mail List */}
        <div className={`w-96 border-r border-[#ffffff0a] overflow-y-auto bg-[#050508] transition-all ${selectedMail ? 'hidden xl:block' : 'flex-1'}`}>
          <div className="flex items-center justify-between p-4 border-b border-[#ffffff0a] sticky top-0 bg-[#050508] z-10">
            <div className="flex items-center gap-4">
              <input type="checkbox" className="accent-[#4c65ff]" />
              <button className="text-[#888] hover:text-white"><Archive className="w-4 h-4" /></button>
              <button className="text-[#888] hover:text-white"><Trash2 className="w-4 h-4" /></button>
            </div>
            <button className="text-[#888] hover:text-white"><MoreVertical className="w-4 h-4" /></button>
          </div>

          <div className="divide-y divide-[#ffffff05]">
            {loading ? (
              <div className="p-8 text-center text-[#555] text-xs">Accessing encrypted grid...</div>
            ) : filteredMails.length === 0 ? (
              <div className="p-8 text-center text-[#555] text-xs">Your inbox is clear.</div>
            ) : filteredMails.map((mail) => (
              <div 
                key={mail.id}
                onClick={() => setSelectedMail(mail)}
                className={`p-4 cursor-pointer transition-all hover:bg-[#ffffff03] relative group ${selectedMail?.id === mail.id ? 'bg-[#4c65ff0a] border-l-2 border-[#4c65ff]' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${!mail.isRead ? 'text-white' : 'text-[#888]'}`}>
                    {mail.from.name || mail.from.address.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-[#555]">
                    {new Date(mail.receivedAt?.seconds * 1000).toLocaleDateString()}
                  </span>
                </div>
                <div className={`text-xs truncate mb-1 ${!mail.isRead ? 'text-[#ddd] font-semibold' : 'text-[#888]'}`}>{mail.subject}</div>
                <div className="text-[11px] text-[#555] truncate">{mail.snippet}</div>
                
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Star className={`w-3.5 h-3.5 ${mail.starred ? 'text-amber-400 fill-current' : 'text-[#333]'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content View */}
        <div className="flex-1 bg-[#08080c] flex flex-col">
          {selectedMail ? (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Mail Actions */}
              <div className="flex items-center justify-between p-4 border-b border-[#ffffff0a]">
                <div className="flex items-center gap-6">
                  <button onClick={() => setSelectedMail(null)} className="xl:hidden p-2 hover:bg-[#ffffff0a] rounded-full">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-[#ffffff0a] rounded-full text-[#888] hover:text-white transition-colors"><Archive className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-[#ffffff0a] rounded-full text-[#888] hover:text-white transition-colors"><Trash2 className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-[#ffffff0a] rounded-full text-[#888] hover:text-white transition-colors"><Mail className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#555]">1 of 1,245</span>
                  <div className="flex border border-[#ffffff11] rounded-lg overflow-hidden">
                    <button className="p-2 hover:bg-[#ffffff0a] border-r border-[#ffffff11] disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                    <button className="p-2 hover:bg-[#ffffff0a] rotate-180 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>

              {/* Mail Header */}
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h1 className="text-2xl font-bold tracking-tight text-white">{selectedMail.subject}</h1>
                  <button 
                    onClick={handleAuraSummary}
                    disabled={summarizing}
                    className="flex items-center gap-2 px-4 py-2 bg-[#4c65ff1a] border border-[#4c65ff33] rounded-xl text-[#4c65ff] text-xs font-bold hover:bg-[#4c65ff2a] transition-all"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${summarizing ? 'animate-spin' : ''}`} />
                    {summarizing ? 'Analyzing...' : 'Aura Summary'}
                  </button>
                </div>

                {summary && (
                  <div className="mb-8 p-4 bg-[#4c65ff0a] border border-[#4c65ff22] rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center gap-2 text-[#4c65ff] text-[10px] font-bold uppercase tracking-widest mb-2">
                      <Zap className="w-3 h-3" /> Aura Intelligence
                    </div>
                    <p className="text-sm text-[#aaa] italic leading-relaxed">{summary}</p>
                  </div>
                )}

                <div className="flex items-start gap-4 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4c65ff] to-[#00f0ff] flex items-center justify-center font-bold text-white shadow-lg">
                    {(selectedMail.from.name || selectedMail.from.address)[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white mr-2">{selectedMail.from.name || selectedMail.from.address.split('@')[0]}</span>
                        <span className="text-xs text-[#555]">&lt;{selectedMail.from.address}&gt;</span>
                      </div>
                      <span className="text-xs text-[#555]">{new Date(selectedMail.receivedAt?.seconds * 1000).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-[#555] mt-1">to me</div>
                  </div>
                </div>

                {/* Body */}
                <div className="text-[#bbb] leading-relaxed text-[15px] whitespace-pre-wrap min-h-[300px]">
                  {selectedMail.body}
                </div>

                {/* Footer Controls */}
                <div className="mt-12 pt-8 border-t border-[#ffffff0a] flex items-center gap-4">
                  <button className="px-6 py-2.5 bg-[#ffffff05] hover:bg-[#ffffff0a] border border-[#ffffff11] rounded-xl text-sm font-medium transition-all flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 rotate-180" /> Reply
                  </button>
                  <button className="px-6 py-2.5 bg-[#ffffff05] hover:bg-[#ffffff0a] border border-[#ffffff11] rounded-xl text-sm font-medium transition-all flex items-center gap-2">
                    Forward
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
              <div className="w-24 h-24 bg-[#ffffff03] rounded-3xl border border-[#ffffff08] flex items-center justify-center mb-6">
                <Mail className="w-10 h-10 text-[#333]" />
              </div>
              <h3 className="text-xl font-bold text-[#888]">No mail selected</h3>
              <p className="text-sm text-[#555] max-w-xs mt-2">Select an email from the thread list to view its contents and use Aura Intelligence.</p>
            </div>
          )}
        </div>
      </div>

      {/* Compose Modal */}
      {isComposeOpen && (
        <div className="absolute bottom-0 right-12 w-[600px] h-[500px] bg-[#0a0a0f] border border-[#ffffff1a] rounded-t-2xl shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[100] flex flex-col animate-in slide-in-from-bottom-12 duration-300">
          <div className="flex items-center justify-between px-6 py-3 bg-[#111118] border-b border-[#ffffff11] rounded-t-2xl cursor-default">
            <span className="text-xs font-bold uppercase tracking-widest text-[#aaa]">New Message</span>
            <div className="flex items-center gap-4">
              <button onClick={() => setIsComposeOpen(false)} className="text-[#555] hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
          </div>
          
          <div className="flex-1 p-6 space-y-4 flex flex-col overflow-hidden">
            <div className="flex items-center border-b border-[#ffffff0a] py-2">
              <span className="text-xs text-[#555] w-12 font-medium">To</span>
              <input 
                type="text" 
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
                className="flex-1 bg-transparent border-none text-sm text-[#ddd] focus:outline-none placeholder-[#333]" 
              />
              <div className="flex gap-2 text-[10px] text-[#4c65ff] font-bold">
                <span className="cursor-pointer hover:underline">Cc</span>
                <span className="cursor-pointer hover:underline">Bcc</span>
              </div>
            </div>
            <div className="flex items-center border-b border-[#ffffff0a] py-2">
              <span className="text-xs text-[#555] w-12 font-medium">Subject</span>
              <input 
                type="text" 
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Email subject"
                className="flex-1 bg-transparent border-none text-sm text-[#ddd] focus:outline-none placeholder-[#333]" 
              />
            </div>
            <textarea 
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm text-[#ddd] focus:outline-none resize-none py-4 scrollbar-hide"
              placeholder="Start typing your vision..."
            />
            {composeError && (
              <div className="text-xs text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">
                {composeError}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[#ffffff11] bg-[#08080c] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSendEmail}
                disabled={composeSending}
                className="bg-[#4c65ff] hover:bg-[#5d75ff] disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all flex items-center gap-2"
              >
                {composeSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  'Send'
                )}
              </button>
              <div className="flex items-center gap-3 text-[#555]">
                <button className="hover:text-white transition-colors"><Paperclip className="w-4 h-4" /></button>
                <button className="hover:text-white transition-colors"><ImageIcon className="w-4 h-4" /></button>
                <button className="hover:text-white transition-colors"><Smile className="w-4 h-4" /></button>
              </div>
            </div>
            <button 
              onClick={() => {
                setComposeTo('');
                setComposeSubject('');
                setComposeBody('');
                setComposeError('');
                setIsComposeOpen(false);
              }}
              className="p-2 text-[#555] hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Connect Account Modal */}
      {isConnectOpen && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#0a0a0f] border border-[#ffffff1a] rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 bg-[#111118] border-b border-[#ffffff11] flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-white">Connect External Inbox</h2>
              <button onClick={() => setIsConnectOpen(false)} className="text-[#555] hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {['imap', 'gmail', 'outlook'].map(p => (
                  <button 
                    key={p}
                    onClick={() => setNewAccount({...newAccount, provider: p})}
                    className={`py-2 text-[10px] font-bold uppercase rounded-xl border transition-all ${newAccount.provider === p ? 'bg-[#4c65ff] border-[#4c65ff] text-white shadow-lg' : 'bg-[#ffffff05] border-[#ffffff11] text-[#555]'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#555] uppercase ml-1">Email Address</label>
                <input 
                  type="email" 
                  value={newAccount.email}
                  onChange={e => setNewAccount({...newAccount, email: e.target.value})}
                  placeholder="e.g. name@gmail.com"
                  className="w-full bg-[#0f0f15] border border-[#ffffff11] rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#4c65ff44]" 
                />
              </div>

              {newAccount.provider === 'imap' && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[10px] font-bold text-[#555] uppercase ml-1">IMAP Host</label>
                    <input 
                      type="text" 
                      value={newAccount.host}
                      onChange={e => setNewAccount({...newAccount, host: e.target.value})}
                      placeholder="imap.gmail.com"
                      className="w-full bg-[#0f0f15] border border-[#ffffff11] rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#4c65ff44]" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-[#555] uppercase ml-1">Port</label>
                    <input 
                      type="number" 
                      value={newAccount.port}
                      onChange={e => setNewAccount({...newAccount, port: parseInt(e.target.value)})}
                      className="w-full bg-[#0f0f15] border border-[#ffffff11] rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#4c65ff44]" 
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#555] uppercase ml-1">App Password / Key</label>
                <input 
                  type="password" 
                  value={newAccount.pass}
                  onChange={e => setNewAccount({...newAccount, pass: e.target.value})}
                  placeholder="••••••••••••••••"
                  className="w-full bg-[#0f0f15] border border-[#ffffff11] rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:border-[#4c65ff44]" 
                />
              </div>
            </div>

            <div className="p-6 bg-[#08080c] border-t border-[#ffffff11]">
              <button 
                onClick={handleConnect}
                className="w-full bg-[#4c65ff] hover:bg-[#5d75ff] text-white py-3 rounded-2xl font-bold shadow-xl transition-all"
              >
                Authorize Grid Sync
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Claim Native Identity Modal */}
      {isClaimModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c12] border border-[#ffffff11] rounded-2xl p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setIsClaimModalOpen(false)}
              className="absolute top-4 right-4 text-[#555] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <Fingerprint className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Claim Your Identity</h2>
              <p className="text-[#888] text-sm">
                Reserve your sovereign handle on the **NovAura Grid**. This will be your permanent, ad-free, AI-powered address.
              </p>
            </div>

            <form onSubmit={handleClaimHandle} className="space-y-6">
              <div className="relative">
                <input 
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  placeholder="your-handle"
                  className="w-full bg-[#14141c] border border-[#ffffff11] rounded-xl px-4 py-4 text-white placeholder-[#444] outline-none focus:border-cyan-500/50 transition-all text-lg font-medium pr-32"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-500/50 font-bold tracking-tight">
                  @novaura.life
                </span>
              </div>

              <button 
                type="submit"
                disabled={isClaiming || !handleInput.trim()}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 disabled:pointer-events-none text-white font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2"
              >
                {isClaiming ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Secure Identity
                  </>
                )}
              </button>
            </form>
            
            <p className="mt-6 text-[10px] text-center text-[#444] uppercase tracking-widest font-bold">
              Identity established on the Frontier
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const SidebarItem = ({ icon, label, active, count, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer transition-all group ${
      active 
        ? 'bg-[#4c65ff11] text-[#4c65ff] font-bold shadow-[inset_0_0_10px_rgba(76,101,255,0.05)]' 
        : 'text-[#888] hover:bg-[#ffffff05] hover:text-[#ddd]'
    }`}
  >
    <div className="flex items-center gap-3 text-sm">
      <span className={active ? 'text-[#4c65ff]' : 'text-[#555] group-hover:text-[#888]'}>{icon}</span>
      {label}
    </div>
    {count && (
      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
        active ? 'bg-[#4c65ff22] text-[#4c65ff]' : 'bg-[#1a1a24] text-[#555]'
      }`}>
        {count}
      </span>
    )}
  </div>
);

export default AuraMailWindow;
