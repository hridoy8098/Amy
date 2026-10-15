import { create } from "zustand";
import type { UserProgress } from "@/lib/types";

// Pinia progress store equivalent — XP bar & streak shown in AppLayout.
interface ProgressState {
  progress: UserProgress | null;
  setProgress: (p: UserProgress) => void;
  /** optimistic local XP add (e.g. after completing a quiz) */
  addXp: (xp: number) => void;
}

const DAILY_GOAL_XP = 50; // Duolingo-style daily goal, tune later

export const useProgressStore = create<ProgressState>((set) => ({
  progress: null,
  setProgress: (progress) => set({ progress }),
  addXp: (xp) =>
    set((s) =>
      s.progress
        ? {
            progress: {
              ...s.progress,
              xp_total: s.progress.xp_total + xp,
              xp_today: s.progress.xp_today + xp,
            },
          }
        : s,
    ),
}));

export function xpPercentToday(p: UserProgress | null): number {
  if (!p) return 0;
  return Math.min(100, Math.round((p.xp_today / DAILY_GOAL_XP) * 100));
}

export { DAILY_GOAL_XP };
