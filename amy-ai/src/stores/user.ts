import { create } from "zustand";
import type { User } from "@/lib/types";

// Pinia userStore equivalent. Auth token itself lives in an httpOnly cookie
// managed by the BFF proxy — here we only keep the profile + status.
interface UserState {
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "unauthenticated";
  setUser: (u: User | null) => void;
  setStatus: (s: UserState["status"]) => void;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  status: "idle",
  setUser: (user) =>
    set({ user, status: user ? "authenticated" : "unauthenticated" }),
  setStatus: (status) => set({ status }),
  logout: async () => {
    await fetch("/api/logout", { method: "POST" });
    set({ user: null, status: "unauthenticated" });
    window.location.href = "/login";
  },
}));
