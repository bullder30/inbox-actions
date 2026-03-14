import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { resend } from "@/lib/email";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user || !user.password) {
      return NextResponse.json({ success: true });
    }

    // Rate limit: silently succeed if a token was issued less than 60 seconds ago
    if (user.passwordResetExpiry) {
      const cooldownMs = 60 * 1000;
      const tokenAge = Date.now() - (user.passwordResetExpiry.getTime() - 60 * 60 * 1000);
      if (tokenAge < cooldownMs) {
        return NextResponse.json({ success: true });
      }
    }

    const token = randomBytes(32).toString("hex");
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpiry: expiry,
      },
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    const fromAddress = process.env.EMAIL_FROM || "onboarding@resend.dev";

    await resend.emails.send({
      from: fromAddress,
      to: email,
      subject: "Réinitialisation de votre mot de passe – Inbox Actions",
      html: `
        <p>Bonjour,</p>
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.</p>
        <p><a href="${resetUrl}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block">Réinitialiser mon mot de passe</a></p>
        <p>Si vous n'avez pas fait cette demande, ignorez cet email.</p>
        <p>L'équipe Inbox Actions</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
