import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// BFF proxy: /api/proxy/<path> → FASTAPI_URL/<path>
// - Injects the JWT from an httpOnly cookie (token never lives in JS on client)
// - On login responses (JSON containing access_token), sets it as httpOnly cookie
// - Streams SSE bodies through untouched (Amy chat streaming)

const COOKIE_NAME = "amy_token";

function backendUrl(path: string[]): string {
  const base = process.env.FASTAPI_URL ?? "http://localhost:8000";
  return `${base.replace(/\/$/, "")}/${path.join("/")}`;
}

async function proxy(
  req: NextRequest,
  ctx: { params?: { path?: string[] } },
) {
  // Defensive: Next.js passes dynamic segments via ctx.params; if the route
  // handler signature is ever mismatched we must not silently hit "/" on the
  // backend (that produced mysterious 404s).
  const path = ctx?.params?.path ?? [];
  if (path.length === 0) {
    return NextResponse.json(
      { detail: "Proxy usage: /api/proxy/<backend-path>" },
      { status: 400 },
    );
  }
  const url = backendUrl(path);
  const token = cookies().get(COOKIE_NAME)?.value;

  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const body =
    ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await fetch(url + (req.nextUrl.search ?? ""), {
      method: req.method,
      headers,
      body,
      // no caching — payments/chat must be live
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "Backend unreachable" },
      { status: 502 },
    );
  }

  // Auth endpoints: backend returns { access_token | token, user }.
  // Move it into an httpOnly cookie and strip it from the JSON body.
  const joined = path.join("/");
  if (
    upstream.ok &&
    (joined.startsWith("auth/login") || joined.startsWith("auth/register"))
  ) {
    const data = await upstream.json().catch(() => null);
    const tok =
      data && typeof data.access_token === "string"
        ? data.access_token
        : data && typeof data.token === "string"
          ? data.token
          : null;
    if (tok) {
      const res = NextResponse.json(
        { user: data.user ?? null, ok: true },
        { status: upstream.status },
      );
      res.cookies.set(COOKIE_NAME, tok, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return res;
    }
    return NextResponse.json(data ?? {}, { status: upstream.status });
  }

  // Pass-through for everything else (incl. SSE streams & SSLCommerz callbacks)
  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
