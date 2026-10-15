import { NextRequest, NextResponse } from "next/server";

// Logout: clear the httpOnly JWT cookie (client-side cannot touch it).
export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("amy_token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
