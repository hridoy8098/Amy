"use client";

import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatBDT } from "@/lib/api";
import { useUserStore } from "@/stores/user";
import type { Payment } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Admin Analytics — ported from the Vue admin dashboard.
// Includes the bKash/Nagad manual payment verification queue (the workflow
// where users submit a TrxID and an admin approves/rejects it).
interface AdminStats {
  total_users: number;
  active_today: number;
  total_revenue_poisha: number;
  pending_payments: number;
  total_enrollments: number;
}

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const qc = useQueryClient();

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user, router]);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/analytics/admin/summary"),
    enabled: user?.role === "admin",
  });

  // Pending manual payments (bKash/Nagad) awaiting verification
  const { data: pending, isLoading } = useQuery({
    queryKey: ["admin-payments-pending"],
    queryFn: () => api.get<Payment[]>("/payments/admin?status=pending"),
    enabled: user?.role === "admin",
  });

  const verify = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "verify" | "reject" }) =>
      api.post<Payment>(`/payments/admin/${id}/${action}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-payments-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  if (user?.role !== "admin") return null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-4">🛡️ Admin Analytics</h1>

      {/* KPI cards */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Users", value: stats?.total_users ?? "—", icon: "👥" },
          { label: "Active Today", value: stats?.active_today ?? "—", icon: "🟢" },
          { label: "Revenue", value: stats ? formatBDT(stats.total_revenue_poisha) : "—", icon: "💰" },
          { label: "Pending Pay.", value: stats?.pending_payments ?? "—", icon: "⏳" },
          { label: "Enrollments", value: stats?.total_enrollments ?? "—", icon: "📚" },
        ].map((k) => (
          <div key={k.label} className="card p-4 text-center">
            <div className="text-xl">{k.icon}</div>
            <div className="text-lg font-extrabold">{k.value}</div>
            <div className="text-[11px] text-muted">{k.label}</div>
          </div>
        ))}
      </section>

      {/* Verification queue */}
      <section className="card p-4">
        <h2 className="font-bold mb-3">
          ⏳ Payment Verification Queue{" "}
          <span className="text-xs text-muted">(bKash / Nagad manual)</span>
        </h2>

        {isLoading && <div className="h-24 animate-pulse rounded-xl bg-[var(--surface-2)]" />}

        {pending && pending.length === 0 && (
          <p className="text-sm text-muted py-4 text-center">
            Kono pending payment nei — sob verify hoyeche! 🎉
          </p>
        )}

        {pending && pending.length > 0 && (
          <ul className="divide-y divide-[var(--border)]">
            {pending.map((p) => (
              <li key={p.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold capitalize">
                    {p.method} · {formatBDT(p.amount_poisha)}
                  </p>
                  <p className="text-xs text-muted font-mono truncate">
                    TrxID: {p.trx_id ?? "—"} · User #{p.user_id} · Course #{p.course_id}
                  </p>
                  <p className="text-xs text-muted">
                    {new Date(p.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 text-white disabled:opacity-50"
                    disabled={verify.isPending}
                    onClick={() => verify.mutate({ id: p.id, action: "verify" })}
                  >
                    ✓ Verify
                  </button>
                  <button
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--danger)] text-white disabled:opacity-50"
                    )}
                    disabled={verify.isPending}
                    onClick={() => verify.mutate({ id: p.id, action: "reject" })}
                  >
                    ✕ Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
