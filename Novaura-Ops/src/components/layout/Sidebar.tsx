import { useAppStore, Panel } from '../../stores/appStore';
import { auth } from '../../services/firebase';
import { signOut } from 'firebase/auth';
import { setUserPresence } from '../../services/chatService';
import {
  LayoutDashboard, MessageSquare, Phone, CheckSquare,
  Bot, Code2, ShieldCheck, LogOut, FolderOpen, HeadphonesIcon, PhoneCall,
} from 'lucide-react';

interface NavItem { id: Panel; icon: React.ComponentType<any>; label: string; color: string; }

const NAV: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', color: '#00f0ff' },
  { id: 'chat',      icon: MessageSquare,   label: 'Chat',      color: '#8b5cf6' },
  { id: 'voice',     icon: Phone,           label: 'Voice',     color: '#22c55e' },
  { id: 'tasks',     icon: CheckSquare,     label: 'Tasks',     color: '#f59e0b' },
  { id: 'ai',        icon: Bot,             label: 'AI Ops',    color: '#ff0080' },
  { id: 'editor',    icon: Code2,           label: 'Editor',    color: '#cc785c' },
  { id: 'assets',    icon: FolderOpen,      label: 'Assets',    color: '#f59e0b' },
  { id: 'support',   icon: HeadphonesIcon,  label: 'Support',   color: '#ff0080' },
  { id: 'phone',     icon: PhoneCall,       label: 'Phone',     color: '#22c55e' },
  { id: 'admin',     icon: ShieldCheck,     label: 'Admin',     color: '#ef4444' },
];

export default function Sidebar() {
  const { activePanel, setActivePanel, user, profile, unreadMessages, pendingTasks, newTickets, novaAlerts, inVoiceCall } = useAppStore();

  const handleSignOut = async () => {
    await setUserPresence('offline');
    await signOut(auth);
  };

  return (
    <aside className="w-16 flex flex-col items-center py-4 gap-1 bg-void-light border-r border-white/5 flex-shrink-0">
      {/* Logo */}
      <div className="w-9 h-9 mb-4 relative flex-shrink-0">
        <div
          className="absolute inset-0 rounded-full border border-dashed border-neon-cyan/30"
          style={{ animation: 'spin 10s linear infinite' }}
        />
        <div className="absolute inset-1.5 rounded-full bg-void flex items-center justify-center">
          <span className="text-neon-cyan font-black text-xs">N</span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1 w-full px-2">
        {NAV.map(item => {
          const Icon = item.icon;
          const isActive = activePanel === item.id;
          const badge = item.id === 'chat' ? unreadMessages
            : item.id === 'tasks' ? pendingTasks
            : item.id === 'support' ? newTickets
            : item.id === 'ai' ? novaAlerts
            : item.id === 'voice' && inVoiceCall ? 1
            : 0;
          const isUrgentSupport = item.id === 'support' && newTickets > 0 && activePanel !== 'support';

          return (
            <button
              key={item.id}
              onClick={() => setActivePanel(item.id)}
              title={item.label}
              className={`relative w-full aspect-square rounded-xl flex items-center justify-center transition-all group ${
                isActive ? 'bg-white/5' : 'hover:bg-white/5'
              } ${isUrgentSupport ? 'animate-[urgentPulse_1.5s_ease-in-out_infinite]' : ''}`}
              style={isActive ? { boxShadow: `0 0 0 1px ${item.color}30, 0 0 12px ${item.color}20` } : {}}
            >
              <Icon
                className="w-5 h-5 transition-colors"
                style={{ color: isActive ? item.color : isUrgentSupport ? '#ff0080' : 'rgba(255,255,255,0.4)' }}
              />
              {badge > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-neon-magenta text-white text-[9px] font-black flex items-center justify-center">
                  {badge > 9 ? '9+' : badge}
                </span>
              )}
              {item.id === 'voice' && inVoiceCall && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              )}
              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2 py-1 bg-void-lighter border border-white/10 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* User avatar + signout */}
      <div className="flex flex-col items-center gap-2 mt-auto px-2 w-full">
        <div className="w-8 h-8 rounded-full bg-void-lighter border border-white/10 overflow-hidden flex-shrink-0">
          {user?.photoURL
            ? <img src={user.photoURL} alt="avatar" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-xs font-bold text-white/60">
                {(user?.displayName || user?.email || 'S').charAt(0).toUpperCase()}
              </span>
          }
        </div>
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="w-full aspect-square rounded-xl flex items-center justify-center hover:bg-red-500/10 transition-colors group"
        >
          <LogOut className="w-4 h-4 text-white/30 group-hover:text-red-400 transition-colors" />
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes urgentPulse {
          0%, 100% { background: rgba(255,0,128,0); box-shadow: none; }
          50% { background: rgba(255,0,128,0.12); box-shadow: 0 0 0 1px rgba(255,0,128,0.3), 0 0 12px rgba(255,0,128,0.2); }
        }
      `}</style>
    </aside>
  );
}
