import { NextRequest, NextResponse } from "next/server";

// Verify the Authorization header matches CRON_SECRET.
// Returns a 401 response if verification fails, null if it passes.
// Every cron route must call this before doing any work.
export function verifyCronSecret(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
