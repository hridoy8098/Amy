"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { useUserStore } from "@/stores/user";

// (main) route group layout — everything here sits inside AppLayout.
// Also bootstraps the current user once per session via /auth/me.
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const status = useUserStore((s) => s.status);
  const setStatus = useUserStore((s) => s.setStatus);

  useEffect(() => {
    if (status !== "idle") return;
    setStatus("loading");
    api
      .get<User>("/auth/me")
      .then((u) => setUser(u))
      .catch(() => {
        setStatus("unauthenticated");
        router.replace("/login");
      });
  }, [status, setUser, setStatus, router]);

  return <AppLayout>{children}</AppLayout>;
}
