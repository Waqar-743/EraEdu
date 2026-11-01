import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Preferences = {
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

export const usePreferencesStore = create<Preferences>()(persist((set) => ({
  theme: 'light',
  sidebarCollapsed: false,
  setTheme: (theme) => set({ theme }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
}), { name: 'eraedu-display-preferences' }));
