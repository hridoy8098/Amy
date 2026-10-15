import { create } from "zustand";
import type { AppNotification } from "@/lib/types";

// Pinia notifications store equivalent. The FastAPI notification router is
// polling-based today; TanStack Query drives the poll and pushes results in.
interface NotificationState {
  items: AppNotification[];
  unreadCount: number;
  setItems: (items: AppNotification[]) => void;
  markRead: (id: number) => void;
  markAllRead: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  setItems: (items) =>
    set({ items, unreadCount: items.filter((n) => !n.read).length }),
  markRead: (id) =>
    set((s) => {
      const items = s.items.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      return { items, unreadCount: items.filter((n) => !n.read).length };
    }),
  markAllRead: () =>
    set((s) => ({
      items: s.items.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}));
