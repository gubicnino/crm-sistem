import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "authjs.session-token";
const SESSION_COOKIE_SECURE = "__Secure-authjs.session-token";

const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];

// Public, session-independent pages that must never be redirected to /login —
// e.g. an email recipient clicking an unsubscribe link has no session at all.
const PUBLIC_PAGES = ["/unsubscribe"];

/**
 * Cookie-presence check ONLY — this is a UX redirect, not the authorization
 * boundary. Next 16 dispatches Server Actions as POSTs to the page route they
 * were called from, so a proxy matcher cannot be trusted to gate them (the
 * matcher below excludes /api, but even an included path wouldn't reliably
 * cover every Server Action call). Every Server Action and data-access
 * function authorizes independently via lib/tenant.ts's requireTrainer() /
 * requireTrainerOrThrow(). Do not add real authorization logic here.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession =
    request.cookies.has(SESSION_COOKIE) || request.cookies.has(SESSION_COOKIE_SECURE);
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));
  const isPublicPage = PUBLIC_PAGES.some((p) => pathname.startsWith(p));

  if (!hasSession && !isAuthPage && !isPublicPage && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL("/leads", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-z]+$).*)"],
};
