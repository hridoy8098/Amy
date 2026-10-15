"use client";

import { useEffect } from "react";

// Register the network-first service worker (PWA). Skipped in dev to avoid
// stale-cache headaches; active on production builds.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .catch(() => {/* SW is progressive enhancement */});
    }
  }, []);
  return null;
}
