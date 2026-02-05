import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";

import { env } from "@/env.mjs";
import { prisma } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default {
  pages: {
    signIn: "/login",
    error: "/login", // Redirige les erreurs OAuth (PKCE, etc.) vers login
  },
  providers: [
    // Google OAuth for authentication only (no Gmail API access)
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
            // Basic scopes for authentication only - no Gmail API
          }),
        ]
      : []),
    // Microsoft OAuth (optional - only enabled if credentials are set)
    // For personal Microsoft accounts (outlook.com, hotmail.com, live.com):
    // - Set MICROSOFT_TENANT_ID=consumers in .env
    // - The actual issuer for personal accounts is always 9188040d-6c67-4c5b-b112-36a304b66dad
    // For organization accounts only:
    // - Use your specific tenant GUID
    //
    // NOTE: This is for AUTHENTICATION only. Mail.Read scope is requested separately
    // when the user chooses to connect Microsoft email in settings.
    ...(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && env.MICROSOFT_TENANT_ID
      ? [
          MicrosoftEntraID({
            clientId: env.MICROSOFT_CLIENT_ID,
            clientSecret: env.MICROSOFT_CLIENT_SECRET,
            // For personal accounts, use the fixed consumer tenant ID as issuer
            // For org accounts, use the configured tenant ID
            issuer:
              env.MICROSOFT_TENANT_ID === "consumers" || env.MICROSOFT_TENANT_ID === "common"
                ? "https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0"
                : `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/v2.0`,
            allowDangerousEmailAccountLinking: true,
            authorization: {
              // Use the configured tenant for authorization URL
              url: `https://login.microsoftonline.com/${env.MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
              params: {
                // Basic scopes for authentication only - NO Mail.Read here
                // Mail.Read is requested separately via /api/microsoft-graph/connect
                scope: [
                  "openid",
                  "email",
                  "profile",
                  "offline_access", // Required for refresh token
                ].join(" "),
              },
            },
          }),
        ]
      : []),
    // Credentials (email/password)
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          // User doesn't exist or doesn't have a password (OAuth only)
          return null;
        }

        const isPasswordValid = await compare(password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
} satisfies NextAuthConfig;
