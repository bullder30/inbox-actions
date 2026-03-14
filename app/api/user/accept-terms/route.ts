import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { termsAcceptedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[accept-terms] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
