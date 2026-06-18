import { NextResponse } from "next/server";

import { detectSyncBackend } from "@/lib/cloud/sync-storage";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export async function GET() {
  const serverBackend = detectSyncBackend();
  const firebase = isFirebaseConfigured;

  const available = serverBackend !== "none" || firebase;

  return NextResponse.json({
    available,
    serverBackend,
    firebase,
  });
}
