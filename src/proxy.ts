import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") || "";
  
  // Resolve platform root domain (fall back to Vercel auto-injected URLs or localhost)
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN || vercelUrl || "localhost:3000";

  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  // Create response headers to propagate
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  // Strip any spoofed internal headers sent by clients
  requestHeaders.delete("x-sf-tenant-id");
  requestHeaders.delete("x-sf-user-id");
  requestHeaders.delete("x-sf-customer-id");
  requestHeaders.delete("x-sf-platform-role");
  requestHeaders.delete("x-sf-tenant-role");

  const hostNoPort = host.split(":")[0].toLowerCase();
  const rootNoPort = rootDomain.split(":")[0].toLowerCase();

  // Any vercel.app domain (production or preview deployments) or localhost is the platform root
  const isRootPlatformHost =
    hostNoPort === rootNoPort ||
    hostNoPort === "localhost" ||
    hostNoPort === "127.0.0.1" ||
    hostNoPort.endsWith(".vercel.app");

  // Reserved application paths that must NEVER be rewritten
  const isReservedPath =
    url.pathname.startsWith("/_next") ||
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/platform") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/store") ||
    url.pathname.includes(".");

  let response: NextResponse;

  // Only rewrite if it's NOT a reserved path and NOT the root platform domain
  if (!isReservedPath && !isRootPlatformHost) {
    if (hostNoPort.endsWith(`.${rootNoPort}`)) {
      const subdomain = hostNoPort.slice(0, hostNoPort.length - rootNoPort.length - 1);
      if (subdomain && !subdomain.includes(".")) {
        // Rewrite subdomain to /store/[subdomain]/...
        url.pathname = `/store/${subdomain}${url.pathname === "/" ? "" : url.pathname}`;
        response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
      } else {
        response = NextResponse.next({ request: { headers: requestHeaders } });
      }
    } else {
      // Custom domain: rewrite to /store/~custom-domain/...
      url.pathname = `/store/~${hostNoPort}${url.pathname === "/" ? "" : url.pathname}`;
      response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    }
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Set OWASP Security Headers
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
