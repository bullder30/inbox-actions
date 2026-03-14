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

    // Rate limit: silently succeed if a token was issued less than 60 seconds ago.
    // Token lifetime is 1h, so a fresh token has expires > now + 59min.
    const existingToken = await prisma.verificationToken.findFirst({
      where: { identifier: dbUser.email },
      select: { expires: true },
    });

    if (existingToken?.expires) {
      const TOKEN_LIFETIME_MS = 60 * 60 * 1000;
      const COOLDOWN_MS = 60 * 1000;
      const ageMs = TOKEN_LIFETIME_MS - (existingToken.expires.getTime() - Date.now());
      if (ageMs < COOLDOWN_MS) {
        return NextResponse.json({ success: true });
      }
    }

    await sendVerificationEmail(dbUser.email);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[send-verification] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
