"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UserProgress } from "@/lib/types";
import { useProgressStore, xpPercentToday, DAILY_GOAL_XP } from "@/stores/progress";

// Streak flame + XP bar shown in the top control strip (AppLayout).
export default function XpBar() {
  const { progress, setProgress } = useProgressStore();

  useQuery({
    queryKey: ["progress"],
    queryFn: async () => {
      const p = await api.get<UserProgress>("/profile/me/progress");
      setProgress(p);
      return p;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const pct = xpPercentToday(progress);

  return (
    <div className="flex items-center gap-3" title={`${progress?.xp_today ?? 0}/${DAILY_GOAL_XP} XP today`}>
      <span className="font-bold" style={{ color: "var(--streak-orange)" }}>
        🔥 {progress?.streak_days ?? 0}
      </span>
      <div
        className="h-3 w-24 sm:w-32 rounded-full overflow-hidden"
        style={{ background: "var(--xp-bar-bg)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "var(--primary)" }}
        />
      </div>
      <span className="text-xs text-muted hidden sm:inline">
        {progress?.xp_today ?? 0} XP
      </span>
    </div>
  );
}
