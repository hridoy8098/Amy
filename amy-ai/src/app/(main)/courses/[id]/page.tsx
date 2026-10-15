"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, formatBDT } from "@/lib/api";
import type { Course, CourseEnrollment } from "@/lib/types";

// Course detail + enrollment CTA.
// Free course  → POST /enrollments (instant enrollment)
// Paid course  → redirect to /payment?course_id=N (SSLCommerz/bKash/Nagad)
export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = Number(id);
  const router = useRouter();

  const { data: course, isLoading, isError } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/courses/${courseId}`),
    enabled: Number.isFinite(courseId),
  });

  const { data: enrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => api.get<CourseEnrollment[]>("/enrollments"),
  });

  const enrollment = enrollments?.find((e) => e.course_id === courseId);

  async function enrollFree() {
    await api.post("/enrollments", { course_id: courseId });
    // refresh both lists so the dashboard/enrolled state updates immediately
    window.location.reload();
  }

  if (isLoading) return <div className="p-6 max-w-3xl mx-auto"><div className="card h-40 animate-pulse" /></div>;

  if (isError || !course) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center">
        <p className="text-muted mb-4">Course khuje pawa jayni.</p>
        <Link href="/courses" className="btn-primary inline-block">← Back to Courses</Link>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <Link href="/courses" className="text-sm text-muted hover:underline">
        ← All courses
      </Link>

      <article className="card mt-3 overflow-hidden">
        {course.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-48 object-cover" />
        ) : (
          <div className="w-full h-48 bg-[var(--surface-2)] flex items-center justify-center text-5xl">
            🎓
          </div>
        )}

        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
              {course.category}
            </span>
            <span className="text-xs text-muted">{course.lesson_count} lessons</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold mb-2">{course.title}</h1>
          <p className="text-sm text-muted leading-relaxed mb-6">{course.description}</p>

          {enrollment ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 rounded-xl bg-green-500/10 border border-green-500/30 p-3">
                <p className="text-sm font-bold text-green-600">✅ Enrolled</p>
                <div className="mt-2 h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all"
                    style={{ width: `${enrollment.progress_percent}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-1">
                  {enrollment.progress_percent}% complete
                </p>
              </div>
              <button className="btn-primary" onClick={() => router.push(`/amy?course=${courseId}`)}>
                Start Learning with Amy 🤖
              </button>
            </div>
          ) : course.price_poisha === 0 ? (
            <button className="btn-primary w-full" onClick={enrollFree}>
              Enroll for Free
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <span className="text-lg font-extrabold">{formatBDT(course.price_poisha)}</span>
              <button
                className="btn-primary flex-1"
                onClick={() => router.push(`/payment?course_id=${courseId}`)}
              >
                Buy & Enroll 💳
              </button>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}
