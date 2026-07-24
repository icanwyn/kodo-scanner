import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  GATE_COOKIE,
  gateTokenMatches,
  isGateEnabled,
} from "@/lib/auth-gate";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/status",
]);

export async function middleware(request: NextRequest) {
  const password = process.env.APP_PASSWORD?.trim();
  const { pathname } = request.nextUrl;

  // Gate off when APP_PASSWORD unset (local open mode)
  if (!isGateEnabled(password)) {
    return NextResponse.next();
  }

  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(GATE_COOKIE)?.value;
  const ok = await gateTokenMatches(password!, token);

  if (ok) {
    return NextResponse.next();
  }

  // API → 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Site password required. POST /api/auth/login",
        },
      },
      { status: 401 }
    );
  }

  // Pages → login with return path
  const login = new URL("/login", request.url);
  login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    /*
     * All routes except static assets
     */
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
