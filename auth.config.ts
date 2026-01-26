import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { env } from "@/env.mjs";

export default {
  pages: {
    signIn: "/login",
    error: "/login", // Redirige les erreurs OAuth (PKCE, etc.) vers login
  },
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
          ].join(" "),
        },
      },
    }),
  ],
} satisfies NextAuthConfig;
