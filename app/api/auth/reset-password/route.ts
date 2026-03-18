import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { createHash } from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(12, "Le mot de passe doit contenir au moins 12 caractères"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides" }, { status: 400 });
    }

    const { token, password } = parsed.data;

    const tokenHash = createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findUnique({
      where: { passwordResetToken: tokenHash },
      select: { id: true, passwordResetExpiry: true },
    });

    if (!user || !user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      return NextResponse.json(
        { error: "Ce lien est invalide ou expiré" },
        { status: 400 }
      );
    }

    const hashedPassword = await hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[reset-password] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
