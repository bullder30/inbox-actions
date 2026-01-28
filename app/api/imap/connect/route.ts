/**
 * POST /api/imap/connect
 * Configure et teste une connexion IMAP
 */

import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { encryptPassword } from "@/lib/imap/imap-credentials";

// Schéma de validation
const connectSchema = z.object({
  imapHost: z.string().min(1, "Host is required"),
  imapPort: z.number().int().positive().default(993),
  imapUsername: z.string().email("Invalid email address"),
  imapPassword: z.string().min(1, "Password is required"),
  imapFolder: z.string().default("INBOX"),
  useTLS: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validationResult = connectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const {
      imapHost,
      imapPort,
      imapUsername,
      imapPassword,
      imapFolder,
      useTLS,
    } = validationResult.data;

    // Tester la connexion IMAP avant de sauvegarder
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: useTLS,
      auth: {
        user: imapUsername,
        pass: imapPassword,
      },
      logger: false,
    });

    try {
      await client.connect();
      await client.logout();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      return NextResponse.json(
        {
          error: "IMAP connection failed",
          details: errorMessage,
        },
        { status: 400 }
      );
    }

    // Connexion réussie - chiffrer et sauvegarder les credentials
    const encryptedPassword = encryptPassword(imapPassword);

    // Upsert : créer ou mettre à jour les credentials existantes
    const credential = await prisma.iMAPCredential.upsert({
      where: {
        userId_imapHost_imapUsername: {
          userId: session.user.id,
          imapHost,
          imapUsername,
        },
      },
      update: {
        imapPort,
        imapPassword: encryptedPassword,
        imapFolder,
        useTLS,
        isConnected: true,
        connectionError: null,
        lastErrorAt: null,
      },
      create: {
        userId: session.user.id,
        imapHost,
        imapPort,
        imapUsername,
        imapPassword: encryptedPassword,
        imapFolder,
        useTLS,
        isConnected: true,
      },
    });

    // Mettre à jour le provider email de l'utilisateur
    await prisma.user.update({
      where: { id: session.user.id },
      data: { emailProvider: "IMAP" },
    });

    return NextResponse.json({
      success: true,
      message: "IMAP connection configured successfully",
      credentialId: credential.id,
    });
  } catch (error) {
    console.error("[IMAP Connect] Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
