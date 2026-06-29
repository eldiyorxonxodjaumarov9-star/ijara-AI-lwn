import { NextRequest, NextResponse } from "next/server";

import {
  handleInstagramCallback,
  InstagramError,
} from "@/lib/api-server/integrations/instagram-service";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectBase = `${appUrl}/settings?tab=posting`;

  if (error) {
    return NextResponse.redirect(
      `${redirectBase}&instagram=error&message=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${redirectBase}&instagram=error&message=${encodeURIComponent("Authorization code yo'q")}`
    );
  }

  try {
    const result = await handleInstagramCallback(code);
    return NextResponse.redirect(
      `${redirectBase}&instagram=connected&username=${encodeURIComponent(result.username ?? "")}`
    );
  } catch (err) {
    const message =
      err instanceof InstagramError ? err.message : "Instagram ulanish xatosi";
    return NextResponse.redirect(
      `${redirectBase}&instagram=error&message=${encodeURIComponent(message)}`
    );
  }
}
