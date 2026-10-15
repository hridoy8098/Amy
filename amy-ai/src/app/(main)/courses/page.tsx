"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useQuery } from "@tanstack/react-query";
import { api, formatBDT } from "@/lib/api";
import type { Course } from "@/lib/types";

const CATEGORIES = [
  "All",
  "SSC",
  "HSC",
  "University",
  "Job Prep",
  "Programming",
  "Language",
];

// Courses listing — Bangladesh-specific categories (SSC/HSC/Job Prep) kept
// in sync with the FastAPI /courses router.
export default function CoursesPage() {
  const [category, setCategory] = useState("All");

  const { data: courses, isLoading, isError } = useQuery({
    queryKey: ["courses", category],
    queryFn: () =>
      api.get<Course[]>(
        category === "All" ? "/courses" : `/courses?category=${encodeURIComponent(category)}`,
      ),
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl font-extrabold">📚 Courses</h1>
        <p className="text-sm text-muted">
          Bangla medium courses for students across Bangladesh
        </p>
      </header>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={clsx(
              "shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors",
              category === c
                ? "bg-[var(--primary)] text-white border-transparent"
                : "border-[var(--border)] hover:bg-[var(--surface-2)]",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-44 animate-pulse" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-6 text-sm text-red-500">
          Courses load korte somossa hoyeche. Pore abar try korun.
        </p>
      )}

      {courses && courses.length === 0 && (
        <p className="mt-6 text-sm text-muted">Ei category te kono course nei.</p>
      )}

      {courses && courses.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="card p-4 flex flex-col gap-2 hover:shadow-lg transition-shadow"
            >
              {course.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="h-32 w-full object-cover rounded-lg"
                />
              ) : (
                <div className="h-32 w-full rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-3xl">
                  🎓
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--primary)]">
                  {course.category}
                </span>
                <span className="text-xs text-muted">{course.lesson_count} lessons</span>
              </div>
              <h2 className="font-bold leading-snug">{course.title}</h2>
              <p className="text-sm text-muted line-clamp-2 flex-1">
                {course.description}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="font-extrabold">{formatBDT(course.price_poisha)}</span>
                {course.price_poisha === 0 && (
                  <span className="text-xs font-bold text-green-600">FREE</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
