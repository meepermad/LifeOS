import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parseMiddlewareEnv } from "@/lib/security/middleware-env";

const DASHBOARD_PATHS = [
  "/today",
  "/week",
  "/work",
  "/tasks",
  "/chat",
  "/settings",
  "/imports",
  "/events",
  "/work",
  "/assistant",
];

export function shouldRunMiddleware(pathname: string): boolean {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;

  if (normalized.startsWith("/_next/static")) return false;
  if (normalized.startsWith("/_next/image")) return false;
  if (normalized === "/favicon.ico" || normalized === "/favicon.png") return false;
  if (normalized.startsWith("/icons/")) return false;
  if (normalized === "/offline.html") return false;
  if (normalized === "/manifest.webmanifest") return false;
  if (normalized === "/sw.js") return false;

  return true;
}

function configurationUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "LifeOS is not configured for this environment.",
      },
    },
    { status: 503 },
  );
}

function isDashboardPath(pathname: string): boolean {
  return DASHBOARD_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isProtectedApiPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/cron/") &&
    !pathname.startsWith("/api/shortcuts/") &&
    pathname !== "/api/health" &&
    pathname !== "/api/readiness"
  );
}

export async function middleware(request: NextRequest) {
  const envResult = parseMiddlewareEnv();
  if (!envResult.success) {
    return configurationUnavailableResponse();
  }

  const env = envResult.data;
  const allowedEmail = env.APP_ALLOWED_EMAIL.toLowerCase();

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected =
    isDashboardPath(pathname) || isProtectedApiPath(pathname);

  if (pathname === "/login" && user) {
    if (user.email?.toLowerCase() === allowedEmail) {
      return NextResponse.redirect(new URL("/today", request.url));
    }
  }

  if (isProtected && !user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "AUTHENTICATION_ERROR", message: "Authentication required" } },
        { status: 401 },
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isProtected && user) {
    if (user.email?.toLowerCase() !== allowedEmail) {
      await supabase.auth.signOut();

      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            error: {
              code: "AUTHORIZATION_ERROR",
              message: "This account is not authorized to access LifeOS",
            },
          },
          { status: 403 },
        );
      }

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon.png|icons/|offline.html|manifest.webmanifest|sw.js).*)",
  ],
};
