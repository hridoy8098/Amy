import { NextRequest, NextResponse } from "next/server";

// Middleware auth guard — mirrors the Vue router guards.
// Protected route groups live under (main): /dashboard, /amy, /courses,
// /progress, /profile, /payment, /admin
const PROTECTED = [
  "/dashboard",
  "/amy",
  "/courses",
  "/progress",
  "/profile",
  "/payment",
  "/admin",
];
const AUTH_PAGES = ["/login", "/register"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("amy_token")?.value;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  if (isProtected && !token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons).*)"],
};
