// Client-side API wrapper. All requests go through the Next.js BFF proxy
// at /api/proxy/[...path] → FastAPI, so the backend URL & tokens never
// appear on the client network layer directly.

import type { ApiError } from "./types";

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api/proxy${path}`, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiError;
      if (body.detail) detail = body.detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiRequestError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(data ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/** Format integer poisha → "৳ 499" or "৳ 499.50" */
export function formatBDT(poisha: number): string {
  const taka = poisha / 100;
  return `৳ ${Number.isInteger(taka) ? taka : taka.toFixed(2)}`;
}
