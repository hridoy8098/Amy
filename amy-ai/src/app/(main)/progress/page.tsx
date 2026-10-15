"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { UserProgress } from "@/lib/types";

interface DailyXpPoint {
  date: string; // YYYY-MM-DD
  xp: number;
  lessons: number;
}

// Progress page with charts — ported from the Vue version. Data comes from
// /progress (aggregate) and /analytics/me/daily-xp (per-day series).
export default function ProgressPage() {
  const { data: progress } = useQuery({
    queryKey: ["progress"],
    queryFn: () => api.get<UserProgress>("/progress"),
  });

  const { data: daily, isLoading } = useQuery({
    queryKey: ["daily-xp"],
    queryFn: () => api.get<DailyXpPoint[]>("/analytics/me/daily-xp"),
  });

  const chartData =
    daily?.map((d) => ({
      day: d.date.slice(5).replace("-", "/"), // MM/DD
      XP: d.xp,
      Lessons: d.lessons,
    })) ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-4">📈 My Progress</h1>

      {/* Summary cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total XP", value: progress?.xp_total ?? 0, icon: "⚡" },
          { label: "Streak", value: `${progress?.streak_days ?? 0} 🔥`, icon: "" },
          { label: "Lessons", value: progress?.lessons_completed ?? 0, icon: "✅" },
          { label: "XP Today", value: progress?.xp_today ?? 0, icon: "🎯" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-xl">{s.icon}</div>
            <div className="text-lg font-extrabold">{s.value}</div>
            <div className="text-[11px] text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      {isLoading && (
        <div className="grid gap-6">
          <div className="card h-64 animate-pulse" />
          <div className="card h-64 animate-pulse" />
        </div>
      )}

      {!isLoading && chartData.length === 0 && (
        <p className="card p-6 text-center text-sm text-muted">
          Ekhono kono activity nei. Amy sathe kotha bolun ba lesson complete korun!
        </p>
      )}

      {chartData.length > 0 && (
        <div className="grid gap-6">
          <div className="card p-4">
            <h2 className="font-bold mb-3 text-sm">XP over time</h2>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="xpFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={30} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="XP"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fill="url(#xpFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-4">
            <h2 className="font-bold mb-3 text-sm">Lessons completed per day</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--text-muted)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--text-muted)" }} width={30} />
                <Tooltip
                  cursor={{ fill: "var(--surface-2)" }}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="Lessons" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
