import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const userPrefs = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        emailNotifications: true,
        syncEnabled: true,
      },
    });

    return NextResponse.json({
      emailNotifications: userPrefs?.emailNotifications ?? true,
      syncEnabled: userPrefs?.syncEnabled ?? true,
    });
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des préférences" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { emailNotifications, syncEnabled } = body;

    // Mise à jour des préférences
    const updateData: { emailNotifications?: boolean; syncEnabled?: boolean } = {};

    if (typeof emailNotifications === "boolean") {
      updateData.emailNotifications = emailNotifications;
    }

    if (typeof syncEnabled === "boolean") {
      updateData.syncEnabled = syncEnabled;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour des préférences" },
      { status: 500 }
    );
  }
}
