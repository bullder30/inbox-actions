import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  email: z.string().email("Email invalide"),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      // If user exists but has no password (OAuth only), allow setting password
      if (!existingUser.password) {
        const hashedPassword = await hash(password, 12);
        await prisma.user.update({
          where: { email },
          data: {
            name: existingUser.name || name,
            password: hashedPassword,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Mot de passe ajouté à votre compte existant",
        });
      }

      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 }
      );
    }

    // Create new user with hashed password
    const hashedPassword = await hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

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
