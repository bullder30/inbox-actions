/**
 * POST /api/imap/connect
 * Configure et teste une connexion IMAP
 * Note: Only password authentication is supported. Microsoft users should use Graph API.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
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
  label: z.string().max(50).optional(),
});

export async function POST(req: NextRequest) {
  console.log("[IMAP Connect] POST request received");

  try {
    const session = await auth();
    if (!session?.user?.id) {
      console.log("[IMAP Connect] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[IMAP Connect] User: ${session.user.email}, ID: ${session.user.id}`);

    const body = await req.json();
    console.log(`[IMAP Connect] Request body:`, {
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      imapUsername: body.imapUsername,
      imapFolder: body.imapFolder,
      useTLS: body.useTLS,
      hasPassword: !!body.imapPassword,
      passwordLength: body.imapPassword?.length,
    });

    const validationResult = connectSchema.safeParse(body);

    if (!validationResult.success) {
      console.log("[IMAP Connect] Validation failed:", validationResult.error.errors);
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
      label,
    } = validationResult.data;

    console.log(`[IMAP Connect] Attempting connection to ${imapHost}:${imapPort} (TLS: ${useTLS})`);
    console.log(`[IMAP Connect] Username: ${imapUsername}`);

    // Build auth object
    const imapAuth = {
      user: imapUsername,
      pass: imapPassword,
    };

    // Vérifier que cette boîte n'est pas déjà utilisée par un autre utilisateur
    const takenByOther = await prisma.iMAPCredential.findFirst({
      where: { imapHost, imapUsername, userId: { not: session.user.id } },
    });
    if (takenByOther) {
      return NextResponse.json(
        { error: "Cette boîte mail est déjà utilisée par un autre compte." },
        { status: 409 }
      );
    }

    // Tester la connexion IMAP avant de sauvegarder
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: useTLS,
      auth: imapAuth,
      logger: {
        debug: (info) => console.log(`[IMAP Connect DEBUG] ${JSON.stringify(info)}`),
        info: (info) => console.log(`[IMAP Connect INFO] ${JSON.stringify(info)}`),
        warn: (info) => console.warn(`[IMAP Connect WARN] ${JSON.stringify(info)}`),
        error: (info) => console.error(`[IMAP Connect ERROR] ${JSON.stringify(info)}`),
      },
    });

    try {
      console.log("[IMAP Connect] Connecting...");
      await client.connect();
      console.log("[IMAP Connect] Connected successfully!");
      await client.logout();
      console.log("[IMAP Connect] Logged out");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      console.error(`[IMAP Connect] Connection failed: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        console.error(`[IMAP Connect] Stack: ${error.stack}`);
      }

      // Provide more helpful error messages
      let userFriendlyMessage = errorMessage;
      if (errorMessage.includes("AUTHENTICATIONFAILED") || errorMessage.includes("Invalid credentials") || errorMessage.includes("AUTHENTICATE failed")) {
        userFriendlyMessage = "Échec d'authentification. Vérifiez votre email et mot de passe d'application.";
      } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("getaddrinfo")) {
        userFriendlyMessage = "Serveur IMAP introuvable. Vérifiez l'adresse du serveur.";
      } else if (errorMessage.includes("ECONNREFUSED")) {
        userFriendlyMessage = "Connexion refusée. Vérifiez le port et les paramètres TLS.";
      } else if (errorMessage.includes("certificate")) {
        userFriendlyMessage = "Erreur de certificat SSL. Essayez de désactiver TLS ou contactez votre fournisseur.";
      }

      return NextResponse.json(
        {
          error: "IMAP connection failed",
          details: userFriendlyMessage,
          technicalDetails: errorMessage,
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
        authMethod: "PASSWORD",
        isConnected: true,
        connectionError: null,
        lastErrorAt: null,
        ...(label !== undefined && { label }),
      },
      create: {
        userId: session.user.id,
        imapHost,
        imapPort,
        imapUsername,
        imapPassword: encryptedPassword,
        imapFolder,
        useTLS,
        authMethod: "PASSWORD",
        isConnected: true,
        label: label ?? null,
      },
    });

    console.log(`[IMAP Connect] Success! Credential ID: ${credential.id}`);

    revalidatePath("/dashboard");

    return NextResponse.json({
      success: true,
      message: "IMAP connection configured successfully",
      credentialId: credential.id,
    });
  } catch (error) {
    console.error("[IMAP Connect] Unexpected error:", error);
    if (error instanceof Error && error.stack) {
      console.error(`[IMAP Connect] Stack: ${error.stack}`);
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
