import { create } from 'zustand';
import { User } from 'firebase/auth';
import { auth, db } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { setUserPresence } from '../services/chatService';

export type Panel = 'dashboard' | 'chat' | 'voice' | 'tasks' | 'ai' | 'editor' | 'assets' | 'support' | 'phone' | 'admin';

export interface StaffProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'owner' | 'partner' | 'admin' | 'dev' | 'staff';
  permissions: string[];
  onboarded?: boolean;
}

export interface PendingNovaCall {
  callId: string;
  novaAlertId?: string;
  novaMessage?: string;
}

interface AppStore {
  // Auth
  user: User | null;
  profile: StaffProfile | null;
  authLoading: boolean;
  // Navigation
  activePanel: Panel;
  setActivePanel: (p: Panel) => void;
  // Notifications
  unreadMessages: number;
  setUnreadMessages: (n: number) => void;
  pendingTasks: number;
  setPendingTasks: (n: number) => void;
  newTickets: number;
  setNewTickets: (n: number) => void;
  novaAlerts: number;
  setNovaAlerts: (n: number) => void;
  // Nova pending call context (set when answering a Nova call)
  pendingNovaCall: PendingNovaCall | null;
  setPendingNovaCall: (c: PendingNovaCall | null) => void;
  // File editor state
  openFiles: string[];
  activeFile: string | null;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  // Chat state
  activeChannelId: string | null;
  setActiveChannelId: (id: string) => void;
  // Voice state
  inVoiceCall: boolean;
  activeVoiceRoom: string | null;
  setVoiceRoom: (id: string | null) => void;
  // Init
  init: () => () => void;
}

export const useAppStore = create<AppStore>((set, get) => ({
  user: null,
  profile: null,
  authLoading: true,
  activePanel: 'dashboard',
  unreadMessages: 0,
  pendingTasks: 0,
  newTickets: 0,
  novaAlerts: 0,
  pendingNovaCall: null,
  openFiles: [],
  activeFile: null,
  activeChannelId: null,
  inVoiceCall: false,
  activeVoiceRoom: null,

  setActivePanel: p => set({ activePanel: p }),
  setUnreadMessages: n => set({ unreadMessages: n }),
  setPendingTasks: n => set({ pendingTasks: n }),
  setNewTickets: n => set({ newTickets: n }),
  setNovaAlerts: n => set({ novaAlerts: n }),
  setPendingNovaCall: c => set({ pendingNovaCall: c }),
  setActiveChannelId: id => set({ activeChannelId: id }),
  setVoiceRoom: id => set({ inVoiceCall: !!id, activeVoiceRoom: id }),

  openFile: path => set(s => ({
    openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
    activeFile: path,
    activePanel: 'editor',
  })),

  closeFile: path => set(s => {
    const files = s.openFiles.filter(f => f !== path);
    return { openFiles: files, activeFile: files[files.length - 1] || null };
  }),

  init: () => {
    const unsub = onAuthStateChanged(auth, async user => {
      if (user) {
        const staffRef = doc(db, 'ops_staff', user.uid);
        const profileSnap = await getDoc(staffRef);

        let profile: StaffProfile;

        if (profileSnap.exists()) {
          profile = profileSnap.data() as StaffProfile;
        } else {
          // Auto-create profile — novaura.xyz gets partner, others get staff
          const { resolveRole } = await import('../App');
          const role = resolveRole(user.email || '');
          const ALL_PERMS = ['chat', 'voice', 'tasks', 'editor', 'ai', 'admin', 'deploy'];
          profile = {
            uid: user.uid,
            displayName: user.displayName || user.email || 'Team Member',
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            role,
            permissions: role === 'owner' || role === 'admin'
              ? ALL_PERMS
              : role === 'partner' || role === 'dev'
                ? ['chat', 'voice', 'tasks', 'editor', 'ai']
                : ['chat', 'voice', 'tasks'],
          };
          // Persist so role sticks on next login
          await setDoc(staffRef, profile);
        }

        set({ user, profile, authLoading: false });
        setUserPresence('online');
        import('../services/timeService').then(({ clockIn }) => clockIn(true)).catch(() => {});
        // Live new-ticket badge
        import('../services/supportService').then(({ subscribeNewTicketCount }) => {
          subscribeNewTicketCount(n => set({ newTickets: n }));
        }).catch(() => {});
        // Nova unacknowledged alert badge
        import('../services/novaService').then(({ subscribeUnacknowledgedCount }) => {
          subscribeUnacknowledgedCount(n => set({ novaAlerts: n }));
        }).catch(() => {});
      } else {
        // Auto clock-out on sign-out
        import('../services/timeService').then(({ clockOut }) => clockOut()).catch(() => {});
        set({ user: null, profile: null, authLoading: false });
      }
    });
    return unsub;
  },
}));
