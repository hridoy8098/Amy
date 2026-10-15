"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import clsx from "clsx";
import NotificationBell from "./NotificationBell";
import XpBar from "./XpBar";
import { useUserStore } from "@/stores/user";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/amy", label: "Amy Tutor", icon: "🤖" },
  { href: "/courses", label: "Courses", icon: "📚" },
  { href: "/progress", label: "Progress", icon: "📈" },
  { href: "/payment", label: "Payments", icon: "💳" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

// AppLayout redesign ported from Vue: top bar (XP + bell + theme), mobile
// hamburger → drawer sidebar, desktop persistent sidebar.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);

  const NavLinks = ({ compact = false }: { compact?: boolean }) => (
    <nav className={clsx("flex flex-col gap-1", compact && "mt-4")}>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setDrawerOpen(false)}
          className={clsx(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors",
            pathname.startsWith(item.href)
              ? "bg-[var(--primary)] text-white"
              : "hover:bg-[var(--surface-2)] text-[var(--text)]",
          )}
        >
          <span>{item.icon}</span> {item.label}
        </Link>
      ))}
      {user?.role === "admin" && (
        <Link
          href="/admin/analytics"
          onClick={() => setDrawerOpen(false)}
          className="flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-[var(--surface-2)]"
        >
          🛡️ Admin
        </Link>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-[var(--border)] p-4 bg-[var(--surface)]">
        <Link href="/dashboard" className="text-xl font-extrabold mb-6 px-2">
          🦉 Amy<span style={{ color: "var(--primary)" }}>AI</span>
        </Link>
        <NavLinks />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[var(--surface)] p-4 shadow-xl">
            <div className="text-xl font-extrabold px-2">
              🦉 Amy<span style={{ color: "var(--primary)" }}>AI</span>
            </div>
            <NavLinks compact />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top control strip */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)]">
          <button
            aria-label="Open menu"
            className="md:hidden rounded-lg p-2 hover:bg-[var(--surface-2)]"
            onClick={() => setDrawerOpen(true)}
          >
            ☰
          </button>
          <div className="flex-1" />
          <XpBar />
          <NotificationBell />
          <button
            aria-label="Toggle theme"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="rounded-full p-2 hover:bg-[var(--surface-2)]"
          >
            {resolvedTheme === "dark" ? "☀️" : "🌙"}
          </button>
          <button
            onClick={() => logout()}
            className="text-xs font-semibold text-muted hover:underline hidden sm:inline"
          >
            Logout
          </button>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
