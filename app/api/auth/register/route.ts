import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/auth/send-verification-email";
import { rateLimitOrFail } from "@/lib/rate-limit";
import { isHoneypotTriggered, honeypotRejectResponse } from "@/lib/honeypot";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z
    .string()
    .min(12, "Le mot de passe doit contenir au moins 12 caractères"),
});

export async function POST(req: NextRequest) {
  // Rate limit : 5 inscriptions / 10 min / IP (anti-spam comptes)
  const rl = rateLimitOrFail(req, "auth:register", { max: 5, windowMs: 10 * 60 * 1000 });
  if (rl) return rl;

  try {
    const body = await req.json();
    if (isHoneypotTriggered(body)) return honeypotRejectResponse();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // Always reject — merging credentials into an OAuth account must be done
      // from an authenticated session (settings page), never from a public endpoint.
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 }
      );
    }

    // Create new user with hashed password
    const hashedPassword = await hash(password, 12);

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        termsAcceptedAt: new Date(),
      },
    });

    // Send verification email (awaited so it completes before the response is sent)
    try {
      await sendVerificationEmail(email);
    } catch (err) {
      console.error("[Register] Failed to send verification email:", err);
    }

    return NextResponse.json({
      success: true,
      message: "Compte créé avec succès",
    });
  } catch (error) {
    console.error("[Register] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du compte" },
      { status: 500 }
    );
  }
}
