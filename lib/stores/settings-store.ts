import { create } from "zustand";
import type { IMAPMailboxData } from "@/components/imap";

interface SettingsState {
  loaded: boolean;
  emailNotifications: boolean;
  syncEnabled: boolean;
  mailboxes: IMAPMailboxData[];

  setLoaded: (loaded: boolean) => void;
  setPreferences: (prefs: { emailNotifications: boolean; syncEnabled: boolean }) => void;
  setMailboxes: (mailboxes: IMAPMailboxData[]) => void;
  invalidate: () => void;
}

/**
 * Store Zustand pour mettre en cache les settings utilisateur.
 * Évite de re-fetcher /api/imap/status et /api/user/preferences
 * à chaque navigation vers /settings (les settings ne changent que via l'appli elle-même).
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  loaded: false,
  emailNotifications: true,
  syncEnabled: true,
  mailboxes: [],

  setLoaded: (loaded) => set({ loaded }),

  setPreferences: ({ emailNotifications, syncEnabled }) =>
    set({ emailNotifications, syncEnabled }),

  setMailboxes: (mailboxes) => set({ mailboxes }),

  /** Force un rechargement au prochain montage (ex: après connect/disconnect IMAP/Graph) */
  invalidate: () => set({ loaded: false }),
}));
