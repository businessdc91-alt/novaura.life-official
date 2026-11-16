import { motion } from 'framer-motion';
import { 
  Users as UsersIcon, 
  Crown as CrownIcon, 
  Star as StarIcon, 
  Mail as MailIcon, 
  Layout as LayoutIcon, 
  MessageSquare as MessageSquareIcon, 
  Lock as LockIcon 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  username: string;
  email: string;
  equityTier?: string;
  shares?: number;
}

interface CouncilManagementProps {
  users: User[];
}

export const CouncilManagement = ({ users }: CouncilManagementProps) => {
  const councilMembers = users.filter(u => u.equityTier).sort((a, b) => (b.shares || 0) - (a.shares || 0));

  return (
    <motion.div
      key="council"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Council Members List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-void-light border border-white/5 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-heading text-xl font-bold text-text-primary">
                Council of Owners
              </h3>
              <div className="flex gap-2">
                <div className="px-3 py-1 bg-neon-magenta/10 text-neon-magenta rounded-full text-[10px] font-bold border border-neon-magenta/20">
                  10 High Roller Slots
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {councilMembers.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                  <UsersIcon className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-20" />
                  <p className="text-text-muted text-sm italic">No shareholders registered in the council yet.</p>
                </div>
              ) : (
                councilMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-4 p-4 bg-void border border-white/5 rounded-xl hover:border-neon-cyan/30 transition-all group">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold border-2 ${
                      member.equityTier === 'Series A' ? 'bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta shadow-[0_0_15px_rgba(255,0,255,0.1)]' : 'bg-neon-violet/10 border-neon-violet/30 text-neon-violet'
                    }`}>
                      {member.username.charAt(0)}
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <p className={`font-bold text-lg ${member.equityTier === 'Series A' ? 'animate-pulse bg-gradient-to-r from-neon-magenta to-neon-violet bg-clip-text text-transparent' : 'text-text-primary'}`}>
                          {member.username}
                        </p>
                        {member.equityTier === 'Series A' && <CrownIcon className="w-4 h-4 text-neon-magenta" />}
                        {member.equityTier === 'Series B' && <StarIcon className="w-4 h-4 text-neon-violet" />}
                      </div>
                      <p className="text-text-muted text-xs uppercase tracking-widest font-bold">
                        {member.equityTier} Shareholder · {member.shares?.toLocaleString()} Shares
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="h-8 border-white/10 hover:border-neon-cyan/50">
                        <MailIcon className="w-3.5 h-3.5 mr-2" />
                        Contact
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Governance Proposals - Placeholder */}
          <div className="bg-void-light border border-white/5 rounded-xl p-6">
            <h3 className="font-heading text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
              <LayoutIcon className="w-5 h-5 text-neon-magenta" />
              Governance Archive
            </h3>
            <p className="text-text-muted text-sm italic">Archive of council discussions and voting history will appear here.</p>
          </div>
        </div>

        {/* Shareholder Direct Inbox */}
        <div className="bg-void-light border border-white/5 rounded-xl p-6 h-[600px] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-neon-cyan/10 flex items-center justify-center">
              <MessageSquareIcon className="w-5 h-5 text-neon-cyan" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-text-primary">Direct Line</h3>
              <p className="text-text-muted text-xs">Shareholder Communications</p>
            </div>
          </div>
          <div className="flex-grow overflow-auto space-y-4 pr-2 custom-scrollbar">
            <div className="flex flex-col items-center justify-center h-full opacity-20">
              <LockIcon className="w-12 h-12 mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest">Secure Line Encrypted</p>
              <p className="text-[10px] italic mt-2">Awaiting new transmissions from the Council...</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
