"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, formatBDT, ApiRequestError } from "@/lib/api";
import type { Course, Payment, PaymentMethod } from "@/lib/types";

// Payment page — BD rails:
//  • SSLCommerz → backend creates a hosted-gateway session, we redirect.
//  • bKash / Nagad → manual send-money flow: user pays to our number and
//    submits TrxID; payment stays `pending` until admin verifies it.
function PaymentForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const courseId = Number(params.get("course_id"));

  const [method, setMethod] = useState<PaymentMethod>("bkash");
  const [trxId, setTrxId] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => api.get<Course>(`/courses/${courseId}`),
    enabled: Number.isFinite(courseId),
  });

  const { data: myPayments } = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.get<Payment[]>("/payments/mine"),
  });

  const createPayment = useMutation({
    mutationFn: async (): Promise<Payment | { redirect_url: string }> => {
      if (method === "sslcommerz") {
        return api.post<{ redirect_url: string }>("/payments/sslcommerz/init", {
          course_id: courseId,
        });
      }
      return api.post<Payment>("/payments/manual", {
        course_id: courseId,
        method, // bkash | nagad
        trx_id: trxId.trim(),
        sender_number: senderNumber.trim(),
      });
    },
    onSuccess: (res) => {
      if (method === "sslcommerz" && "redirect_url" in res) {
        // Full-page redirect to the SSLCommerz hosted gateway;
        // return URLs are handled by FastAPI /payments/sslcommerz/ipn + /return
        window.location.href = res.redirect_url;
        return;
      }
      qc.invalidateQueries({ queryKey: ["payments"] });
      setSuccessMsg(
        "Payment request joma hoyeche! Admin verification er por enrollment active hobe."
      );
      setTrxId("");
      setSenderNumber("");
    },
    onError: (e: unknown) => {
      setError(e instanceof ApiRequestError ? e.message : "Something went wrong.");
    },
  });

  const methods: { id: PaymentMethod; label: string; icon: string; note: string }[] = [
    { id: "bkash", label: "bKash", icon: "📱", note: "Personal/Agent number-e money send kore TrxID din" },
    { id: "nagad", label: "Nagad", icon: "🟠", note: "Nagad wallet-e pay kore TrxID din" },
    { id: "sslcommerz", label: "SSLCommerz", icon: "💳", note: "Card / Net Banking — instant enrollment" },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-1">💳 Payment</h1>
      {!course && !Number.isFinite(courseId) && (
        <p className="text-sm text-muted mb-4">
          Course theke &ldquo;Buy &amp; Enroll&rdquo; click korun, taholei payment start hobe.
        </p>
      )}

      {course && (
        <div className="card p-4 mb-5 flex items-center justify-between">
          <div>
            <p className="font-bold leading-snug">{course.title}</p>
            <p className="text-xs text-muted">{course.category} · {course.lesson_count} lessons</p>
          </div>
          <span className="text-lg font-extrabold">{formatBDT(course.price_poisha)}</span>
        </div>
      )}

      {/* Method picker */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => setMethod(m.id)}
            className={clsx(
              "card p-3 flex flex-col items-center gap-1 text-sm font-semibold transition-all",
              method === m.id
                ? "ring-2 ring-[var(--primary)] scale-[1.02]"
                : "opacity-70 hover:opacity-100",
            )}
          >
            <span className="text-2xl">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted mb-4">{methods.find((m) => m.id === method)?.note}</p>

      {method === "sslcommerz" ? (
        <button
          className="btn-primary w-full"
          disabled={!course || createPayment.isPending}
          onClick={() => createPayment.mutate()}
        >
          {createPayment.isPending ? "Redirecting…" : `Pay ${course ? formatBDT(course.price_poisha) : ""} with SSLCommerz`}
        </button>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createPayment.mutate();
          }}
        >
          <label className="text-sm font-semibold">
            Apnar {method === "bkash" ? "bKash" : "Nagad"} Number
            <input
              className="input mt-1"
              placeholder="01XXXXXXXXX"
              value={senderNumber}
              onChange={(e) => setSenderNumber(e.target.value)}
              pattern="01[0-9]{9}"
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Transaction ID (TrxID)
            <input
              className="input mt-1 font-mono uppercase"
              placeholder="e.g. 8N3F7A2Q1X"
              value={trxId}
              onChange={(e) => setTrxId(e.target.value)}
              minLength={6}
              required
            />
          </label>
          <button
            className="btn-primary w-full"
            disabled={!course || createPayment.isPending}
            type="submit"
          >
            {createPayment.isPending ? "Submitting…" : "Submit for Verification"}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-500">⚠️ {error}</p>}
      {successMsg && <p className="mt-3 text-sm text-green-600">✅ {successMsg}</p>}

      {/* Payment history */}
      {myPayments && myPayments.length > 0 && (
        <section className="mt-8">
          <h2 className="font-bold mb-2">Your Payments</h2>
          <ul className="flex flex-col gap-2">
            {myPayments.slice(0, 5).map((p) => (
              <li key={p.id} className="card p-3 flex items-center justify-between text-sm">
                <span className="capitalize">{p.method}</span>
                <span className="font-mono text-xs text-muted">{p.trx_id ?? p.trans_id ?? "—"}</span>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <button onClick={() => router.back()} className="mt-6 text-sm text-muted hover:underline">
        ← Fire jan
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: Payment["status"] }) {
  const map: Record<Payment["status"], string> = {
    pending: "bg-yellow-500/15 text-yellow-600",
    processing: "bg-blue-500/15 text-blue-600",
    verified: "bg-green-500/15 text-green-600",
    failed: "bg-red-500/15 text-red-600",
    rejected: "bg-red-500/15 text-red-600",
  };
  return (
    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-bold capitalize", map[status])}>
      {status}
    </span>
  );
}

// useSearchParams() must sit inside a Suspense boundary for static prerender
export default function PaymentPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted">Loading…</div>}>
      <PaymentForm />
    </Suspense>
  );
}
