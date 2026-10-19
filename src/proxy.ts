import { NextResponse, type NextRequest } from "next/server";
import { resolveLocaleRoute } from "@/i18n/config";

export function proxy(request: NextRequest) {
  const route = resolveLocaleRoute(request.nextUrl.pathname);
  if (route.action === "next") return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = route.pathname;
  return route.action === "redirect" ? NextResponse.redirect(url, 308) : NextResponse.rewrite(url);
}

export const config = {
  // Pages only: skip API routes, Next.js internals and any file with an extension
  // (sitemap.xml, robots.txt, icons, /brand/* images).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
