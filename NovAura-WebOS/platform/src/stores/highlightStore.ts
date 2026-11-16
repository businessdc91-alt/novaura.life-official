import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface HighlightState {
  staffPicks: string[]; // Asset IDs
  paidPromotions: string[]; // Asset IDs
  
  // Actions
  setStaffPicks: (ids: string[]) => void;
  setPaidPromotions: (ids: string[]) => void;
  addStaffPick: (id: string) => void;
  removeStaffPick: (id: string) => void;
}

export const useHighlightStore = create<HighlightState>()(
  persist(
    (set) => ({
      staffPicks: [],
      paidPromotions: [],

      setStaffPicks: (ids) => set({ staffPicks: ids }),
      setPaidPromotions: (ids) => set({ paidPromotions: ids }),
      
      addStaffPick: (id) => set((state) => ({ 
        staffPicks: state.staffPicks.includes(id) ? state.staffPicks : [...state.staffPicks, id] 
      })),
      
      removeStaffPick: (id) => set((state) => ({ 
        staffPicks: state.staffPicks.filter(pickId => pickId !== id) 
      })),
    }),
    {
      name: 'novaura-highlights',
    }
  )
);
