/**
 * POST /api/microsoft-graph/activate
 * @deprecated Mailboxes are now created directly during OAuth callback.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use /api/microsoft-graph/connect instead." },
    { status: 410 }
  );
}
