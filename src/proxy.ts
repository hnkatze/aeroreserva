import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths reachable without a session.
const PUBLIC_PATHS = ["/login", "/conceptos"];

/**
 * Optimistic auth gate. Per Next 16 guidance, Proxy must NOT hit the database
 * or do full session validation — it only checks for the presence of the
 * session cookie and redirects. Real validation (DB lookup, expiry) happens in
 * pages and route handlers via getCurrentOperator().
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("session");
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on all pages except API routes, static assets, image optimization and
  // metadata files (API routes enforce their own auth).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
