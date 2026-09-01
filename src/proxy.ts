import { NextResponse, type NextRequest } from "next/server";
import { getExpectedToken, COOKIE_NAME } from "@/lib/pin";

export default async function pinMiddleware(request: NextRequest) {
  const expected = await getExpectedToken();

  // No APP_PIN configured -> app is open (fine for a purely local, single-user run)
  if (!expected) return NextResponse.next();

  const isUnlockPage = request.nextUrl.pathname === "/unlock";
  const unlocked = request.cookies.get(COOKIE_NAME)?.value === expected;

  if (isUnlockPage) {
    if (unlocked) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!unlocked) {
    const url = new URL("/unlock", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|icons|splash).*)",
  ],
};
