"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AppNotification } from "@/lib/types";
import { useNotificationStore } from "@/stores/notifications";

// Polling-based notification bell (same strategy as the Vue app today).
// Upgrade path: SSE endpoint on FastAPI → replace refetchInterval.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { items, unreadCount, setItems, markRead, markAllRead } =
    useNotificationStore();
  const qc = useQueryClient();

  useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const list = await api.get<AppNotification[]>("/notifications/");
      setItems(list);
      return list;
    },
    refetchInterval: 30_000, // 30s poll, like current implementation
  });

  const readMut = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: (_d, id) => {
      markRead(id);
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-full p-2 hover:bg-[var(--surface-2)]"
      >
        🔔
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
            style={{ background: "var(--danger)" }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto card z-50"
          role="menu"
        >
          <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
            <span className="font-bold text-sm">Notifications</span>
            <button
              className="text-xs text-muted hover:underline"
              onClick={() => markAllRead()}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted">No notifications yet.</p>
          ) : (
            items.slice(0, 20).map((n) => (
              <button
                key={n.id}
                onClick={() => !n.read && readMut.mutate(n.id)}
                className={`w-full text-left p-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <div className="text-sm font-semibold">{n.title}</div>
                <div className="text-xs text-muted mt-0.5">{n.body}</div>
              </button>
            ))
          )}
          <Link
            href="/profile"
            className="block p-3 text-xs text-center text-muted hover:underline"
          >
            View all activity →
          </Link>
        </div>
      )}
    </div>
  );
}
