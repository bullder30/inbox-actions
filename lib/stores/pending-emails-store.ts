import { create } from 'zustand';

interface PendingEmailsState {
  count: number;
  lastUpdate: Date | null;
  setCount: (count: number) => void;
  reset: () => void;
}

/**
 * Store Zustand pour gérer le nombre d'emails en attente
 * Mis à jour en temps réel via SSE (Server-Sent Events)
 */
export const usePendingEmailsStore = create<PendingEmailsState>((set) => ({
  count: 0,
  lastUpdate: null,

  setCount: (count: number) =>
    set({
      count,
      lastUpdate: new Date(),
    }),

  reset: () =>
    set({
      count: 0,
      lastUpdate: null,
    }),
}));
