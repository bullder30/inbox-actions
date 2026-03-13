import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/auth/send-verification-email";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, emailVerified: true },
    });

    if (!dbUser?.email) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    if (dbUser.emailVerified) {
      return NextResponse.json({ error: "Email déjà vérifié" }, { status: 400 });
    }

    await sendVerificationEmail(dbUser.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[send-verification] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
