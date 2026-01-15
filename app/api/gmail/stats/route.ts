import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const analyzedCount = await prisma.emailMetadata.count({
      where: {
        userId: user.id,
        status: "ANALYZED",
      },
    });

    return NextResponse.json({ analyzedCount });
  } catch (error) {
    console.error("Error fetching Gmail stats:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }
}
