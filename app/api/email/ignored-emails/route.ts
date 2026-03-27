import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getIgnoredEmails } from "@/lib/cache/dashboard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
    const limit = Math.min(Number.isNaN(rawLimit) ? 20 : rawLimit, 100);
    const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
    const offset = Number.isNaN(rawOffset) ? 0 : rawOffset;

    const allIgnored = await getIgnoredEmails(user.id);
    const page = allIgnored.slice(offset, offset + limit);

    return NextResponse.json({
      emails: page,
      total: allIgnored.length,
      hasMore: offset + limit < allIgnored.length,
    });
  } catch (error) {
    console.error("Error fetching ignored emails:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des emails" },
      { status: 500 }
    );
  }
}
