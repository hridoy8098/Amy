"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useUserStore } from "@/stores/user";
import type { User } from "@/lib/types";

// Profile page — ported from the Vue profile/streak router work.
// PATCH /users/me updates the FastAPI User row; theme + language are local prefs.
export default function ProfilePage() {
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const logout = useUserStore((s) => s.logout);
  const qc = useQueryClient();
  const { resolvedTheme, setTheme } = useTheme();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProfile = useMutation({
    mutationFn: () =>
      api.patch<User>("/users/me", {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      }),
    onSuccess: (u) => {
      setUser(u);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setError(null);
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Update failed"),
  });

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-extrabold mb-4">👤 Profile</h1>

      {/* Identity card */}
      <div className="card p-4 mb-5 flex items-center gap-4">
        {user?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-xl font-extrabold">
            {(user?.full_name ?? "?").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{user?.full_name}</p>
          <p className="text-sm text-muted truncate">{user?.email}</p>
          {user?.role === "admin" && (
            <span className="inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-500">
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Edit form */}
      <form
        className="card p-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          updateProfile.mutate();
        }}
      >
        <label className="text-sm font-semibold">
          Full Name
          <input
            className="input mt-1"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            minLength={2}
          />
        </label>

        <label className="text-sm font-semibold">
          Phone (BD)
          <input
            className="input mt-1"
            placeholder="01XXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            pattern="01[0-9]{9}"
          />
        </label>

        <div>
          <p className="text-sm font-semibold mb-1">Language Preference</p>
          <div className="flex gap-2">
            {[
              { id: "en", label: "English" },
              { id: "bn", label: "বাংলা" },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                className={clsx(
                  "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors",
                  (user?.preferred_language ?? "en") === l.id
                    ? "bg-[var(--primary)] text-white border-transparent"
                    : "border-[var(--border)] hover:bg-[var(--surface-2)]",
                )}
                onClick={async () => {
                  const u = await api.patch<User>("/users/me", {
                    preferred_language: l.id,
                  });
                  setUser(u);
                  qc.invalidateQueries();
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-1">Theme</p>
          <div className="flex gap-2">
            {[
              { id: "light", label: "☀️ Light" },
              { id: "dark", label: "🌙 Dark" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                className={clsx(
                  "px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors",
                  resolvedTheme === t.id
                    ? "bg-[var(--accent)] text-white border-transparent"
                    : "border-[var(--border)] hover:bg-[var(--surface-2)]",
                )}
                onClick={() => setTheme(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">⚠️ {error}</p>}
        {saved && <p className="text-sm text-green-600">✅ Saved!</p>}

        <button className="btn-primary" disabled={updateProfile.isPending} type="submit">
          {updateProfile.isPending ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <button
        onClick={logout}
        className="mt-5 w-full py-2.5 rounded-xl font-semibold text-sm text-[var(--danger)] border border-[var(--danger)]/30 hover:bg-[var(--danger)]/10"
      >
        Log out
      </button>
    </div>
  );
}
