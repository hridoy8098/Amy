"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Course, CourseEnrollment } from "@/lib/types";
import { useProgressStore } from "@/stores/progress";

// Dashboard: continue-learning cards + quick stats (XP/streak from store).
export default function DashboardPage() {
  const progress = useProgressStore((s) => s.progress);

  const { data: enrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => api.get<CourseEnrollment[]>("/courses/enrollments"),
  });
  const { data: courses } = useQuery({
    queryKey: ["courses"],
    queryFn: () => api.get<Course[]>("/courses/"),
  });

  const enrolled = (enrollments ?? []).slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="card p-5 flex items-center gap-4">
        <div className="text-4xl">🦉</div>
        <div>
          <h1 className="text-lg font-extrabold">
            Hi! Ready to learn today?
          </h1>
          <p className="text-sm text-muted">
            🔥 {progress?.streak_days ?? 0}-day streak · ⚡{" "}
            {progress?.xp_total ?? 0} total XP · ✅{" "}
            {progress?.lessons_completed ?? 0} lessons
          </p>
        </div>
        <div className="flex-1" />
        <Link href="/amy" className="btn-primary hidden sm:inline-block">
          Chat with Amy
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Continue learning</h2>
          <Link href="/courses" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>
            See all →
          </Link>
        </div>
        {enrolled.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">
            You haven&apos;t enrolled in any course yet.{" "}
            <Link href="/courses" className="font-bold" style={{ color: "var(--primary)" }}>
              Browse courses
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrolled.map((e) => {
              const c = (courses ?? []).find((x) => x.id === e.course_id);
              if (!c) return null;
              return (
                <Link key={e.id} href={`/courses/${c.id}`} className="card p-4 hover:scale-[1.01] transition-transform block">
                  <div className="font-bold text-sm">{c.title}</div>
                  <div className="text-xs text-muted mt-1">{c.category}</div>
                  <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "var(--xp-bar-bg)" }}>
                    <div className="h-full" style={{ width: `${e.progress_percent}%`, background: "var(--primary)" }} />
                  </div>
                  <div className="text-[11px] text-muted mt-1">{e.progress_percent}% complete</div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Today's XP", value: progress?.xp_today ?? 0, icon: "⚡" },
          { label: "Streak", value: `${progress?.streak_days ?? 0}d`, icon: "🔥" },
          { label: "Courses", value: enrollments?.length ?? 0, icon: "📚" },
          { label: "Lessons", value: progress?.lessons_completed ?? 0, icon: "✅" },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-xl">{s.icon}</div>
            <div className="text-lg font-extrabold">{s.value}</div>
            <div className="text-[11px] text-muted">{s.label}</div>
          </div>
        ))}
      </section>

      <Link href="/amy" className="btn-primary w-full text-center sm:hidden block">
        Chat with Amy
      </Link>
    </div>
  );
}
