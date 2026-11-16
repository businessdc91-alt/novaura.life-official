import { create } from 'zustand';
import { kernelStorage } from '@/kernel/kernelStorage.js';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface UIState {
  // Modals
  isLoginModalOpen: boolean;
  isSignupModalOpen: boolean;
  isLicenseModalOpen: boolean;
  selectedAssetId: string | null;
  
  // Toasts
  toasts: Toast[];
  
  // Mobile menu
  isMobileMenuOpen: boolean;
  
  // Search
  isSearchOpen: boolean;
  searchQuery: string;
  
  // Notifications
  isNotificationPanelOpen: boolean;
  
  // Performance
  performanceMode: boolean;
  togglePerformanceMode: () => void;
  webGPUEnabled: boolean;
  toggleWebGPU: () => void;
  
  // Actions
  openLoginModal: () => void;
  closeLoginModal: () => void;
  openSignupModal: () => void;
  closeSignupModal: () => void;
  openLicenseModal: (assetId: string) => void;
  closeLicenseModal: () => void;
  
  // Toast actions
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  
  // Mobile menu
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  
  // Search
  openSearch: () => void;
  closeSearch: () => void;
  setSearchQuery: (query: string) => void;
  
  // Notification panel
  openNotificationPanel: () => void;
  closeNotificationPanel: () => void;
  toggleNotificationPanel: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  // Performance
  performanceMode: kernelStorage.getItem('performance_mode') === 'true',
  togglePerformanceMode: () => {
    const newVal = !get().performanceMode;
    kernelStorage.setItem('performance_mode', String(newVal));
    set({ performanceMode: newVal });
  },
  webGPUEnabled: kernelStorage.getItem('webgpu_enabled') === 'true',
  toggleWebGPU: () => {
    const newVal = !get().webGPUEnabled;
    kernelStorage.setItem('webgpu_enabled', String(newVal));
    set({ webGPUEnabled: newVal });
  },

  // Modals
  isLoginModalOpen: false,
  isSignupModalOpen: false,
  isLicenseModalOpen: false,
  selectedAssetId: null,
  
  // Toasts
  toasts: [],
  
  // Mobile menu
  isMobileMenuOpen: false,
  
  // Search
  isSearchOpen: false,
  searchQuery: '',
  
  // Notifications
  isNotificationPanelOpen: false,

  // Modal actions
  openLoginModal: () => set({ 
    isLoginModalOpen: true, 
    isSignupModalOpen: false 
  }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),
  
  openSignupModal: () => set({ 
    isSignupModalOpen: true, 
    isLoginModalOpen: false 
  }),
  closeSignupModal: () => set({ isSignupModalOpen: false }),
  
  openLicenseModal: (assetId: string) => set({ 
    isLicenseModalOpen: true, 
    selectedAssetId: assetId 
  }),
  closeLicenseModal: () => set({ 
    isLicenseModalOpen: false, 
    selectedAssetId: null 
  }),

  // Toast actions
  addToast: (toast) => {
    const id = Date.now().toString();
    const newToast: Toast = { ...toast, id };
    
    set((state) => ({ toasts: [...state.toasts, newToast] }));
    
    // Auto-remove toast after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },
  
  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  // Mobile menu
  toggleMobileMenu: () => set((state) => ({ 
    isMobileMenuOpen: !state.isMobileMenuOpen 
  })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),

  // Search
  openSearch: () => set({ isSearchOpen: true }),
  closeSearch: () => set({ isSearchOpen: false, searchQuery: '' }),
  setSearchQuery: (query: string) => set({ searchQuery: query }),

  // Notification panel
  openNotificationPanel: () => set({ isNotificationPanelOpen: true }),
  closeNotificationPanel: () => set({ isNotificationPanelOpen: false }),
  toggleNotificationPanel: () => set((state) => ({ 
    isNotificationPanelOpen: !state.isNotificationPanelOpen 
  })),
}));
