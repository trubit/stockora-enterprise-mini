import { create } from 'zustand';

interface CurrencyState {
  displayCurrency: string | null;
  setDisplayCurrency: (code: string | null) => void;
  resetDisplayCurrency: () => void;
}

const STORAGE_KEY = 'stockora_mini_display_currency';

export const useCurrencyStore = create<CurrencyState>((set) => ({
  displayCurrency: typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,

  setDisplayCurrency: (code: string | null) => {
    if (code) {
      const normalized = code.toUpperCase().trim();
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, normalized);
      }
      set({ displayCurrency: normalized });
    } else {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
      set({ displayCurrency: null });
    }
  },

  resetDisplayCurrency: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ displayCurrency: null });
  },
}));
