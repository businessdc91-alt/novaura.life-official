import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore, Panel } from '../../stores/appStore';
import Sidebar from './Sidebar';
import Dashboard from '../dashboard/Dashboard';
import ChatPanel from '../chat/ChatPanel';
import VoiceCall from '../voice/VoiceCall';
import TaskBoard from '../tasks/TaskBoard';
import AIOrchestrator from '../ai/AIOrchestrator';
import LiveEditor from '../editor/LiveEditor';
import AdminPanel from '../admin/AdminPanel';
import AssetManager from '../assets/AssetManager';
import SupportPanel from '../support/SupportPanel';
import PhonePanel from '../phone/PhonePanel';
import IncomingCallOverlay from '../phone/IncomingCallOverlay';
import ClockWidget from './ClockWidget';
import { voiceService } from '../../services/voiceService';

const PANELS: Record<Panel, React.ComponentType> = {
  dashboard: Dashboard,
  chat: ChatPanel,
  voice: VoiceCall,
  tasks: TaskBoard,
  ai: AIOrchestrator,
  editor: LiveEditor,
  assets: AssetManager,
  support: SupportPanel,
  phone: PhonePanel,
  admin: AdminPanel,
};

export default function AppShell() {
  const { activePanel, inVoiceCall } = useAppStore();
  const ActivePanel = PANELS[activePanel];

  return (
    <div className="w-screen h-screen bg-void flex overflow-hidden">
      <IncomingCallOverlay />
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with clock widget */}
        <div className="flex-shrink-0 h-10 bg-void-light border-b border-white/5 flex items-center px-4 gap-3">
          <span className="text-white/20 text-xs">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <div className="ml-auto">
            <ClockWidget />
          </div>
        </div>

        {/* Persistent voice call bar when in a call but viewing another panel */}
        <AnimatePresence>
          {inVoiceCall && activePanel !== 'voice' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 40, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex-shrink-0 bg-neon-cyan/10 border-b border-neon-cyan/20 flex items-center px-4 gap-3 text-neon-cyan text-xs font-semibold"
            >
              <span className="w-2 h-2 rounded-full bg-neon-cyan animate-pulse" />
              Voice call active
              <button
                onClick={() => voiceService.leaveRoom()}
                className="ml-auto text-red-400 hover:text-red-300 transition-colors"
              >
                Leave call
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePanel}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full"
            >
              <ActivePanel />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
