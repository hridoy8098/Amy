"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Suspense } from "react";
import { api, ApiRequestError } from "@/lib/api";
import type { User } from "@/lib/types";
import { useUserStore } from "@/stores/user";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Minimum 6 characters"),
});
type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const setUser = useUserStore((s) => s.setUser);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(v: FormValues) {
    try {
      // FastAPI login returns { access_token, user } — proxy converts the
      // token into an httpOnly cookie and gives us back just { ok, user }
      const res = await api.post<{ ok: boolean; user: User | null }>(
        "/auth/login",
        v,
      );
      setUser(res.user ?? null);
      router.replace(params.get("next") ?? "/dashboard");
    } catch (e) {
      setError("password", {
        message:
          e instanceof ApiRequestError ? e.message : "Login failed. Try again.",
      });
    }
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="text-center">
        <div className="text-3xl">🦉</div>
        <h1 className="text-xl font-extrabold mt-1">
          Amy<span style={{ color: "var(--primary)" }}>AI</span>
        </h1>
        <p className="text-sm text-muted">Your AI tutor for Bangladesh</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="text-xs font-bold">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-xl px-4 py-2.5 text-sm bg-[var(--surface)] border border-[var(--border)] outline-none focus:border-[var(--primary)]"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="text-xs font-bold">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-xl px-4 py-2.5 text-sm bg-[var(--surface)] border border-[var(--border)] outline-none focus:border-[var(--primary)]"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.password.message}</p>
          )}
        </div>
        <button disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? "Signing in…" : "Log in"}
        </button>
      </form>

      <p className="text-xs text-center text-muted">
        New here?{" "}
        <Link href="/register" className="font-bold" style={{ color: "var(--accent)" }}>
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
