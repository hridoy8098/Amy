"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, ApiRequestError } from "@/lib/api";
import type { User } from "@/lib/types";
import { useUserStore } from "@/stores/user";

const schema = z.object({
  full_name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Minimum 6 characters"),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(v: FormValues) {
    try {
      const res = await api.post<{ ok: boolean; user: User | null }>(
        "/auth/register",
        v,
      );
      setUser(res.user ?? null);
      router.replace("/dashboard");
    } catch (e) {
      setError("email", {
        message:
          e instanceof ApiRequestError
            ? e.message
            : "Registration failed. Try again.",
      });
    }
  }

  const inputCls =
    "mt-1 w-full rounded-xl px-4 py-2.5 text-sm bg-[var(--surface)] border border-[var(--border)] outline-none focus:border-[var(--primary)]";

  return (
    <div className="card p-6 space-y-4">
      <div className="text-center">
        <div className="text-3xl">🦉</div>
        <h1 className="text-xl font-extrabold mt-1">Create your account</h1>
        <p className="text-sm text-muted">Start learning with Amy today</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="text-xs font-bold">Full name</label>
          <input autoComplete="name" className={inputCls} {...register("full_name")} />
          {errors.full_name && (
            <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.full_name.message}</p>
          )}
        </div>
        <div>
          <label className="text-xs font-bold">Email</label>
          <input type="email" autoComplete="email" className={inputCls} {...register("email")} />
          {errors.email && (
            <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.email.message}</p>
          )}
        </div>
        <div>
          <label className="text-xs font-bold">Password</label>
          <input type="password" autoComplete="new-password" className={inputCls} {...register("password")} />
          {errors.password && (
            <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.password.message}</p>
          )}
        </div>
        <button disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? "Creating…" : "Sign up"}
        </button>
      </form>

      <p className="text-xs text-center text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-bold" style={{ color: "var(--accent)" }}>
          Log in
        </Link>
      </p>
    </div>
  );
}
