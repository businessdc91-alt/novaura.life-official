import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';

// Error Boundary
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Layouts — always needed, keep eager
import MainLayout from '@/components/layout/MainLayout';
import CreatorLayout from '@/components/layout/CreatorLayout';
import AdminLayout from '@/components/layout/AdminLayout';

// Components — structural, keep eager
import ProtectedRoute from '@/components/ProtectedRoute';
import ToastContainer from '@/components/ToastContainer';
import ScrollToTop from '@/components/ScrollToTop';
import FloatingNovaChat from '@/components/ui/FloatingNovaChat';
import SupportWidget from '@/components/ui/SupportWidget';
import TrainingConsentModal from '@/components/ui/TrainingConsentModal';
import RouteAutoRepairProtocol from '@/components/routing/RouteAutoRepairProtocol';

// Stores
import { useAuthStore } from '@/stores/authStore';

// UI Features
import { AuraGuide } from '@/components/ui/AuraGuide';
import { GlobalBadgeAwardOverlay } from '@/components/ui/AuraBadgeAward';
import { GlobalSearchModal } from '@/components/ui/GlobalSearchModal';
import { useUIStore } from '@/stores/uiStore';

import './App.css';

// ── Landing page — eager (it's the front door, always first paint) ──

// ── Lazy-loaded pages — only fetched when navigated to ──────────────

// Public Pages - NovAura Market
const HomePage = lazy(() => import('@/pages/public/HomePage'));
const AISocialPage = lazy(() => import('@/pages/public/AISocialPage'));
const PlatformHomePage = lazy(() => import('@/pages/public/PlatformHomePage'));
const BrowsePage = lazy(() => import('@/pages/public/BrowsePage'));
const AssetDetailPage = lazy(() => import('@/pages/public/AssetDetailPage'));
const CreatorProfilePage = lazy(() => import('@/pages/public/CreatorProfilePage'));
const UserProfilePage = lazy(() => import('@/pages/public/UserProfilePage'));
const SearchPage = lazy(() => import('@/pages/public/SearchPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/public/PrivacyPolicyPage'));
const ContactPage = lazy(() => import('@/pages/public/ContactPage'));
const HelpCenterPage = lazy(() => import('@/pages/public/HelpCenterPage'));
const StatusPage = lazy(() => import('@/pages/public/StatusPage'));
const LicensingTermsPage = lazy(() => import('@/pages/public/LicensingTermsPage'));
const StudioShowcasePage = lazy(() => import('@/pages/public/StudioShowcasePage'));
const MusicMarketplacePage = lazy(() => import('@/pages/public/MusicMarketplacePage'));
const GalleryPage = lazy(() => import('@/pages/public/GalleryPage'));
const GallerySubmitPage = lazy(() => import('@/pages/public/GallerySubmitPage'));
const GamesPage = lazy(() => import('@/pages/public/GamesPage'));
const SoftwarePage = lazy(() => import('@/pages/public/SoftwarePage'));
const FreeItemsPage = lazy(() => import('@/pages/public/FreeItemsPage'));
const DevAuraReaderPage = lazy(() => import('@/pages/public/DevAuraReaderPage'));
const FeedPage = lazy(() => import('@/pages/public/FeedPage'));
const EcosystemHub = lazy(() => import('@/pages/public/EcosystemHub'));
const NovaRegistryPage = lazy(() => import('@/pages/public/NovaRegistryPage'));
const RoyaltiesPolicyPage = lazy(() => import('@/pages/public/RoyaltiesPolicyPage'));
const TermsOfUsePage = lazy(() => import('@/pages/public/TermsOfUsePage'));
const AssetAgreementPage = lazy(() => import('@/pages/public/AssetAgreementPage'));
const CookiesPolicyPage = lazy(() => import('@/pages/public/CookiesPolicyPage'));
const CreatorAgreementPage = lazy(() => import('@/pages/public/CreatorAgreementPage'));
const DomainMarketplace = lazy(() => import('@/pages/public/DomainMarketplace'));
const ShopPage = lazy(() => import('@/pages/public/ShopPage'));
const PricingPage = lazy(() => import('@/pages/public/PricingPage'));
const APIKeyLibraryPage = lazy(() => import('@/pages/public/APIKeyLibraryPage'));
const ChangelogPage = lazy(() => import('@/pages/public/ChangelogPage'));
const CreatorLounge = lazy(() => import('@/pages/public/CreatorLounge'));
const AuraStrategistPortal = lazy(() => import('@/pages/public/AuraStrategistPortal'));
const NovaChat = lazy(() => import('@/pages/public/NovaChat'));
const VoiceStudioPage = lazy(() => import('./pages/public/VoiceStudioPage'));
const MusicStudioPage = lazy(() => import('@/pages/public/MusicStudioPage'));
const MusicToolsPage = lazy(() => import('@/pages/public/MusicToolsPage'));
const AboutPage = lazy(() => import('@/pages/public/AboutPage'));
const InvestorPortalPage = lazy(() => import('@/pages/public/InvestorPortalPage'));
const EmailServicesPage = lazy(() => import('@/pages/public/EmailServicesPage'));
const WebmailPage = lazy(() => import('@/pages/public/WebmailPage'));

// Novalow Domains Pages
const HostingPlansPage = lazy(() => import('@/pages/novalow/HostingPlansPage'));
const SiteBuilderPage = lazy(() => import('@/pages/novalow/SiteBuilderPage'));
const DevToolsPage = lazy(() => import('@/pages/novalow/DevToolsPage'));
const TutorialsPage = lazy(() => import('@/pages/novalow/TutorialsPage'));
const SecurityPage = lazy(() => import('@/pages/novalow/SecurityPage'));
const PromotePage = lazy(() => import('@/pages/novalow/PromotePage'));

// Auth Pages
const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const SignupPage = lazy(() => import('@/pages/public/SignupPage'));
const AdminSetupPage = lazy(() => import('@/pages/public/AdminSetupPage'));
const NovaSysPage = lazy(() => import('@/pages/public/NovaSysPage'));
const StaffLoginPage = lazy(() => import('@/pages/public/StaffLoginPage'));

// Buyer Pages
const CartPage = lazy(() => import('@/pages/buyer/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/buyer/CheckoutPage'));
const OrdersPage = lazy(() => import('@/pages/buyer/OrdersPage'));
const DownloadsPage = lazy(() => import('@/pages/buyer/DownloadsPage'));
const WishlistPage = lazy(() => import('@/pages/buyer/WishlistPage'));
const SettingsPage = lazy(() => import('@/pages/buyer/SettingsPage'));
const AgreementsPage = lazy(() => import('@/pages/buyer/AgreementsPage'));
const MessagesPage = lazy(() => import('@/pages/buyer/MessagesPage'));
const NotificationsPage = lazy(() => import('@/pages/buyer/NotificationsPage'));
const CreatorApplication = lazy(() => import('@/pages/buyer/CreatorApplication'));

// Creator Pages
const CreatorDashboard = lazy(() => import('@/pages/creator/CreatorDashboard'));
const CreatorAssets = lazy(() => import('@/pages/creator/CreatorAssets'));
const CreatorUpload = lazy(() => import('@/pages/creator/CreatorUpload'));
const CreatorEarnings = lazy(() => import('@/pages/creator/CreatorEarnings'));
const CreatorSettings = lazy(() => import('@/pages/creator/CreatorSettings'));
const NovaIDE = lazy(() => import('@/pages/creator/NovaIDE'));
const TCGCardForge = lazy(() => import('@/pages/creator/TCGCardForge'));

// Admin Pages
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminAssets = lazy(() => import('@/pages/admin/AdminAssets'));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminCommandCenter = lazy(() => import('@/pages/admin/AdminCommandCenter'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

import { initializeStorage } from '@/services/marketService';
import { initializeSocialStorage } from '@/services/socialService';
import { initializeCommunityStorage } from '@/services/communityService';
import { auraScheduler } from '@/services/auraScheduler';

function AppRoutes() {
  const { isAuthenticated } = useAuthStore();

  return (
    <AnimatePresence mode="wait">
      <ScrollToTop />
      <RouteAutoRepairProtocol />
      <Routes>
            {/* 
              ⚠️⚠️⚠️  ROUTING WARNING - DO NOT MODIFY WITHOUT APPROVAL  ⚠️⚠️⚠️
              
              The following routes are INTENTIONALLY wired to specific locations.
              Landing page buttons are already correctly configured - DO NOT CHANGE.
              
              /platform    = AI Social Platform (NOT the marketplace)
              /browse      = Market/Assets (the marketplace)
              /novalow     = Domains & Hosting services
              /domains     = Domain marketplace
              
              If you're tempted to change these, ask first. The routing is fragile
              and has been fixed multiple times. Don't break it again!
              
              - Platform = AI Social (where AIs socialize)
              - Market/Browse = Asset marketplace (where humans buy/sell)
              - NovaLow = Domain/hosting services
            */}
            
            {/* Public Routes */}
            <Route element={<MainLayout />}>
              {/* NovAura Social Platform Routes */}
              <Route path="/" element={<FeedPage />} />
              <Route path="/platform" element={<FeedPage />} />
              <Route path="/hub" element={<EcosystemHub />} />
              <Route path="/explore" element={<PlatformHomePage />} />
              <Route path="/browse" element={<BrowsePage />} />
              <Route path="/browse/:category" element={<BrowsePage />} />
              <Route path="/asset/:id" element={<AssetDetailPage />} />
              <Route path="/creator/:username" element={<CreatorProfilePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/legal/licensing" element={<LicensingTermsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/studio-showcase" element={<StudioShowcasePage />} />
              <Route path="/music" element={<MusicMarketplacePage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/gallery/submit" element={<GallerySubmitPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/software" element={<SoftwarePage />} />
              <Route path="/free" element={<FreeItemsPage />} />
              <Route path="/profile/:username" element={<UserProfilePage />} />
              <Route path="/reader" element={<DevAuraReaderPage />} />
              <Route path="/registry" element={<NovaRegistryPage />} />
              <Route path="/feed" element={<FeedPage />} />
              <Route path="/hub" element={<EcosystemHub />} />
              <Route path="/legal/royalties" element={<RoyaltiesPolicyPage />} />
              <Route path="/legal/terms" element={<TermsOfUsePage />} />
              <Route path="/legal/agreement" element={<AssetAgreementPage />} />
              <Route path="/legal/cookies" element={<CookiesPolicyPage />} />
              <Route path="/legal/creator-terms" element={<CreatorAgreementPage />} />
              <Route path="/changelog" element={<ChangelogPage />} />
              <Route path="/help" element={<HelpCenterPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/creators" element={<CreatorLounge />} />
              <Route path="/strategist" element={<AuraStrategistPortal />} />
              <Route path="/chat" element={<NovaChat />} />
              <Route path="/voice-studio" element={<VoiceStudioPage />} />
              <Route path="/music-studio" element={<MusicStudioPage />} />
              <Route path="/ai-studio" element={<StudioShowcasePage />} />
              <Route path="/studio" element={<Navigate to="/music-studio" replace />} />
              <Route path="/practice" element={<MusicToolsPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/api-keys" element={<APIKeyLibraryPage />} />
              
              {/* Shop — Catalyst's Corner */}
              <Route path="/shop" element={<ShopPage />} />

              {/* Platform Home - Hub with links to sections */}
              <Route path="*" element={<PlatformHomePage />} />
              
              {/* NovaLow - Domains ONLY */}
              <Route path="/novalow" element={<DomainMarketplace />} />
              <Route path="/novalow/devtools" element={<DevToolsPage />} />
              <Route path="/novalow/tutorials" element={<TutorialsPage />} />
              <Route path="/novalow/security" element={<SecurityPage />} />
              <Route path="/novalow/promote" element={<PromotePage />} />

              {/* Legacy Aliases */}
              <Route path="/domains" element={<Navigate to="/novalow" replace />} />
              <Route path="/devtools" element={<DevToolsPage />} />
              <Route path="/tutorials" element={<TutorialsPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/promote" element={<PromotePage />} />

              {/* Ecosystem Pages */}
              <Route path="/about" element={<AboutPage />} />
              <Route path="/investors" element={<InvestorPortalPage />} />
              <Route path="/email" element={<EmailServicesPage />} />
              <Route path="/webmail" element={<WebmailPage />} />
            </Route>

            {/* Auth Routes */}
            <Route element={<MainLayout hideNav={true} />}>
              <Route 
                path="/login" 
                element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />} 
              />
              <Route 
                path="/signup" 
                element={isAuthenticated ? <Navigate to="/" /> : <SignupPage />} 
              />
              <Route path="/admin-setup" element={<AdminSetupPage />} />
              <Route path="/nova-sys" element={<NovaSysPage />} />
              <Route path="/staff-login" element={<StaffLoginPage />} />
            </Route>

            {/* Buyer Routes (Protected) */}
            <Route element={<MainLayout />}>
              <Route element={<ProtectedRoute allowedRoles={['buyer', 'creator', 'admin']} />}>
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/downloads" element={<DownloadsPage />} />
                <Route path="/wishlist" element={<WishlistPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/agreements" element={<AgreementsPage />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/messages/:userId" element={<MessagesPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/creator/apply" element={<CreatorApplication />} />
              </Route>
            </Route>

            {/* Creator Routes (Protected) */}
            <Route element={<ProtectedRoute allowedRoles={['creator', 'admin']} />}>
              <Route element={<CreatorLayout />}>
                <Route path="/creator/dashboard" element={<CreatorDashboard />} />
                <Route path="/creator/assets" element={<CreatorAssets />} />
                <Route path="/creator/assets/new" element={<CreatorUpload />} />
                <Route path="/creator/earnings" element={<CreatorEarnings />} />
                <Route path="/creator/settings" element={<CreatorSettings />} />
                <Route path="/ide" element={<NovaIDE />} />
                <Route path="/creator/tcg-forge" element={<TCGCardForge />} />
              </Route>
            </Route>

            {/* Admin Routes (Protected) */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/assets" element={<AdminAssets />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/orders" element={<AdminOrders />} />
                <Route path="/admin/command-center" element={<AdminCommandCenter />} />
              </Route>
            </Route>

            {/* Legacy Path Auto-Repair Aliases */}
            <Route path="/marketplace" element={<Navigate to="/browse" replace />} />
            <Route path="/upload" element={<Navigate to="/creator/assets/new" replace />} />
            <Route path="/creator/upload" element={<Navigate to="/creator/assets/new" replace />} />
            <Route path="/creator/analytics" element={<Navigate to="/creator/earnings" replace />} />
            <Route path="/settings/notifications" element={<Navigate to="/notifications" replace />} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/docs" element={<Navigate to="/help" replace />} />
            <Route path="/legal/faq" element={<Navigate to="/help" replace />} />
            <Route path="/legal/indemnification" element={<Navigate to="/legal/terms" replace />} />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
    </AnimatePresence>
  );
}

function App() {
  const { performanceMode } = useUIStore();
  const { init, isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (performanceMode) {
      document.body.classList.add('performance-mode');
    } else {
      document.body.classList.remove('performance-mode');
    }
  }, [performanceMode]);

  useEffect(() => {
    initializeStorage();
    initializeSocialStorage();
    initializeCommunityStorage();
    init();
  }, [init]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      auraScheduler.init(user.id);
    }
  }, [isAuthenticated, user]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router basename="/platform">
          <ScrollToTop />
          <AppRoutes />
          <ToastContainer />
          <AuraGuide />
          <GlobalBadgeAwardOverlay />
          <GlobalSearchModal />
          <FloatingNovaChat />
          <SupportWidget />
          <TrainingConsentModal />
        </Router>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
