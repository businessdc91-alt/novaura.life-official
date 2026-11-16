import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield as ShieldIcon, 
  Users as UsersIcon, 
  FileText as FileTextIcon, 
  CheckCircle as CheckCircleIcon, 
  XCircle as XCircleIcon, 
  Crown as CrownIcon,
  Globe as GlobeIcon,
  Star as StarIcon,
  Package as PackageIcon,
  Lock as LockIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import {
  getAssets,
  getPendingAssets,
  approveAsset,
  rejectAsset
} from '@/services/marketService';

// Sub-components
import { OverviewTab } from './components/OverviewTab';
import { SiteContentEditor } from './components/SiteContentEditor';
import { AssetSubmissions } from './components/AssetSubmissions';
import { MarketHighlights } from './components/MarketHighlights';
import { AgreementsTab } from './components/AgreementsTab';
import { UserManagement } from './components/UserManagement';
import { RolesManagement } from './components/RolesManagement';
import { CouncilManagement } from './components/CouncilManagement';
import { StatCard, RoleCard } from './components/shared';

export default function AdminCommandCenter() {
  const { user } = useAuthStore();
  const { addToast } = useUIStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [pendingAssets, setPendingAssets] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [staffOnboarding, setStaffOnboarding] = useState(true);

  // Site Content State
  const [siteContent, setSiteContent] = useState({
    homepage: { heroTitle: '', heroSubtitle: '' },
    about: { content: '' },
    footer: { copyright: '' }
  });
  const [editingContent, setEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState(siteContent);

  // Highlighting State
  const [staffPicks, setStaffPicks] = useState<string[]>([]);
  const [paidPromotions, setPaidPromotions] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [usersSnap, assets, pending, agreementsSnap, siteSnap, highlightsSnap, configSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getAssets(),
        getPendingAssets(),
        getDocs(collection(db, 'royalty_agreements')),
        getDoc(doc(db, 'site_content', 'main')),
        getDoc(doc(db, 'site_highlights', 'main')),
        getDoc(doc(db, 'platform_config', 'onboarding'))
      ]);

      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setAllAssets(assets);
      setPendingAssets(pending);
      setAgreements(agreementsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      if (siteSnap.exists()) {
        const data = siteSnap.data() as any;
        setSiteContent(data);
        setEditedContent(data);
      }

      if (highlightsSnap.exists()) {
        const data = highlightsSnap.data();
        setStaffPicks(data.staffPicks || []);
        setPaidPromotions(data.paidPromotions || []);
      }

      if (configSnap.exists()) {
        setStaffOnboarding(configSnap.data().staffRegistrationOpen ?? true);
      }
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveContent = async () => {
    try {
      await updateDoc(doc(db, 'site_content', 'main'), editedContent);
      setSiteContent(editedContent);
      setEditingContent(false);
      addToast({ type: 'success', title: 'Content Updated', message: 'The site content has been successfully updated.' });
    } catch (error) {
      addToast({ type: 'error', title: 'Update Failed', message: 'Could not save site content.' });
    }
  };

  const handleApproveAsset = async (id: string) => {
    try {
      await approveAsset(id);
      addToast({ type: 'success', title: 'Asset Approved', message: 'Asset is now live in the marketplace.' });
      loadData();
    } catch (error) {
      addToast({ type: 'error', title: 'Approval Failed', message: 'An error occurred during approval.' });
    }
  };

  const handleRejectAsset = async (id: string) => {
    try {
      await rejectAsset(id);
      addToast({ type: 'info', title: 'Asset Rejected', message: 'The asset has been rejected.' });
      loadData();
    } catch (error) {
      addToast({ type: 'error', title: 'Rejection Failed', message: 'An error occurred.' });
    }
  };

  const toggleStaffOnboarding = async (value: boolean) => {
    try {
      await updateDoc(doc(db, 'platform_config', 'onboarding'), { staffRegistrationOpen: value });
      setStaffOnboarding(value);
      addToast({ type: 'info', title: 'Config Updated', message: `Staff onboarding is now ${value ? 'OPEN' : 'CLOSED'}.` });
    } catch (error) {
      addToast({ type: 'error', title: 'Update Failed', message: 'Could not update configuration.' });
    }
  };

  const handleUpdateUserRole = async (role: string) => {
    if (!selectedUser) return;
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { role });
      addToast({ type: 'success', title: 'Role Updated', message: `${selectedUser.username} is now a ${role}.` });
      setShowRoleModal(false);
      loadData();
    } catch (error) {
      addToast({ type: 'error', title: 'Update Failed', message: 'Could not update user role.' });
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredAssets = allAssets.filter(a => 
    a.title?.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.creator?.username?.toLowerCase().includes(assetSearch.toLowerCase())
  );

  if (!user || user.role !== 'admin' && user.email !== 'the.lost.catalyst@gmail.com') {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center p-6 text-center">
        <LockIcon className="w-16 h-16 text-neon-red mb-4" />
        <h1 className="font-heading text-3xl font-bold text-text-primary mb-2">ACCESS DENIED</h1>
        <p className="text-text-muted max-w-md">The NovAura High Command only grants access to verified Administrators and Council Members. Your attempt has been logged.</p>
        <Button variant="outline" className="mt-6 border-white/10" onClick={() => window.location.href = '/'}>Return to Surface</Button>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ShieldIcon },
    { id: 'content', label: 'Site Content', icon: GlobeIcon },
    { id: 'submissions', label: 'Submissions', icon: PackageIcon },
    { id: 'highlights', label: 'Highlights', icon: StarIcon },
    { id: 'agreements', label: 'Agreements', icon: CheckCircleIcon },
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'roles', label: 'Roles', icon: ShieldIcon },
    { id: 'council', label: 'Council', icon: CrownIcon },
  ];

  return (
    <div className="min-h-screen bg-void pt-24 pb-12 px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-neon-cyan/20 rounded-xl flex items-center justify-center border border-neon-cyan/30">
              <ShieldIcon className="w-6 h-6 text-neon-cyan" />
            </div>
            <h1 className="font-heading text-4xl font-bold bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent uppercase tracking-tight">
              Command Center
            </h1>
          </div>
          <p className="text-text-muted">Centralized platform oversight and governance.</p>
        </header>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 custom-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id 
                ? 'bg-neon-cyan text-void shadow-[0_0_20px_rgba(0,255,249,0.2)]' 
                : 'text-text-muted hover:text-text-primary hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loader"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-20 text-center"
            >
              <div className="w-12 h-12 border-4 border-neon-cyan border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-text-muted animate-pulse">Establishing secure link...</p>
            </motion.div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab 
                  usersCount={users.length}
                  assetsCount={allAssets.length}
                  pendingAssets={pendingAssets}
                  agreementsCount={agreements.length}
                  setActiveTab={setActiveTab}
                  StatCard={StatCard}
                />
              )}

              {activeTab === 'content' && (
                <SiteContentEditor 
                  siteContent={siteContent}
                  editedContent={editedContent}
                  editingContent={editingContent}
                  setEditingContent={setEditingContent}
                  setEditedContent={setEditedContent}
                  handleSaveContent={handleSaveContent}
                />
              )}

              {activeTab === 'submissions' && (
                <AssetSubmissions 
                  pendingAssets={pendingAssets}
                  filteredAssets={filteredAssets}
                  assetSearch={assetSearch}
                  setAssetSearch={setAssetSearch}
                  handleApproveAsset={handleApproveAsset}
                  handleRejectAsset={handleRejectAsset}
                />
              )}

              {activeTab === 'highlights' && (
                <MarketHighlights 
                  filteredAssets={filteredAssets}
                  assetSearch={assetSearch}
                  setAssetSearch={setAssetSearch}
                  staffPicks={staffPicks}
                  setStaffPicks={setStaffPicks}
                  paidPromotions={paidPromotions}
                  setPaidPromotions={setPaidPromotions}
                />
              )}

              {activeTab === 'agreements' && (
                <AgreementsTab agreements={agreements} />
              )}

              {activeTab === 'users' && (
                <UserManagement 
                  filteredUsers={filteredUsers}
                  userSearch={userSearch}
                  setUserSearch={setUserSearch}
                  setSelectedUser={setSelectedUser}
                  setShowRoleModal={setShowRoleModal}
                />
              )}

              {activeTab === 'roles' && (
                <RolesManagement 
                  users={users}
                  staffOnboarding={staffOnboarding}
                  toggleStaffOnboarding={toggleStaffOnboarding}
                  setActiveTab={setActiveTab}
                  RoleCard={RoleCard}
                />
              )}

              {activeTab === 'council' && (
                <CouncilManagement users={users} />
              )}
            </>
          )}
        </AnimatePresence>

        {/* ROLE MODAL */}
        {showRoleModal && selectedUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-void/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-void-light border border-white/10 rounded-2xl p-8 max-w-md w-full"
            >
              <h3 className="font-heading text-2xl font-bold text-text-primary mb-2">Adjust Authority</h3>
              <p className="text-text-muted mb-6">Modify system permissions for <span className="text-text-primary font-bold">{selectedUser.username}</span>.</p>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleUpdateUserRole('admin')}
                  className="w-full p-4 rounded-xl border border-white/5 bg-void hover:border-neon-magenta/50 transition-all text-left"
                >
                  <p className="font-bold text-neon-magenta">Administrator</p>
                  <p className="text-xs text-text-muted">Full access to site content and user management.</p>
                </button>
                <button
                  onClick={() => handleUpdateUserRole('moderator')}
                  className="w-full p-4 rounded-xl border border-white/5 bg-void hover:border-neon-violet/50 transition-all text-left"
                >
                  <p className="font-bold text-neon-violet">Moderator</p>
                  <p className="text-xs text-text-muted">Review and manage asset submissions.</p>
                </button>
                <button
                  onClick={() => handleUpdateUserRole('creator')}
                  className="w-full p-4 rounded-xl border border-white/5 bg-void hover:border-neon-cyan/50 transition-all text-left"
                >
                  <p className="font-bold text-neon-cyan">Verified Creator</p>
                  <p className="text-xs text-text-muted">Ability to publish assets to the marketplace.</p>
                </button>
                <button
                  onClick={() => handleUpdateUserRole('user')}
                  className="w-full p-4 rounded-xl border border-white/5 bg-void hover:border-white/20 transition-all text-left"
                >
                  <p className="font-bold text-text-primary">Standard Citizen</p>
                  <p className="text-xs text-text-muted">Regular user permissions.</p>
                </button>
                
                <div className="pt-4 border-t border-white/5">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest mb-3">Council Governance</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        updateDoc(doc(db, 'users', selectedUser.id), { equityTier: 'Series A', shares: 25000 });
                        addToast({ type: 'success', title: 'Equity Assigned', message: 'User is now a Series A Shareholder.' });
                        setShowRoleModal(false);
                        loadData();
                      }}
                      className="flex-1 p-2 bg-neon-magenta/10 border border-neon-magenta/20 text-neon-magenta rounded-lg text-xs font-bold hover:bg-neon-magenta/20"
                    >
                      Make Series A
                    </button>
                    <button
                      onClick={() => {
                        updateDoc(doc(db, 'users', selectedUser.id), { equityTier: 'Series B', shares: 5000 });
                        addToast({ type: 'success', title: 'Equity Assigned', message: 'User is now a Series B Shareholder.' });
                        setShowRoleModal(false);
                        loadData();
                      }}
                      className="flex-1 p-2 bg-neon-violet/10 border border-neon-violet/20 text-neon-violet rounded-lg text-xs font-bold hover:bg-neon-violet/20"
                    >
                      Make Series B
                    </button>
                  </div>
                  
                  {selectedUser.equityTier && (
                    <Button
                      variant="ghost"
                      className="w-full mt-2 text-xs text-neon-red hover:bg-neon-red/10"
                      onClick={() => {
                        updateDoc(doc(db, 'users', selectedUser.id), { equityTier: null, shares: 0 });
                        addToast({ type: 'info', title: 'Equity Removed', message: 'User is no longer in the council.' });
                        loadData();
                      }}
                    >
                      Remove from Council
                    </Button>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full mt-4 border-white/20"
                onClick={() => setShowRoleModal(false)}
              >
                Cancel
              </Button>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
