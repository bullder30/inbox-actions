import authConfig from "@/auth.config";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { UserRole } from "@prisma/client";
import NextAuth, { type DefaultSession } from "next-auth";

import { prisma } from "@/lib/db";
import { getUserById } from "@/lib/user";

// More info: https://authjs.dev/getting-started/typescript#module-augmentation
declare module "next-auth" {
  interface Session {
    user: {
      role: UserRole;
    } & DefaultSession["user"];
  }
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user, account, profile }) {
      // Si c'est une connexion OAuth (Google)
      if (account?.provider === "google") {
        // Vérifier si un utilisateur existe déjà avec cet email
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
          include: { accounts: true },
        });

        if (existingUser) {
          // Vérifier si le compte Google est déjà lié
          const googleAccount = existingUser.accounts.find(
            (acc) => acc.provider === "google"
          );

          if (!googleAccount) {
            // Lier le compte Google à l'utilisateur existant
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
            console.log(`[Auth] Compte Google lié à l'utilisateur existant: ${user.email}`);
          }
        }
      }
      return true;
    },

    async redirect({ url, baseUrl }) {
      // Après le login, rediriger vers le dashboard
      // Si l'URL contient déjà une redirection spécifique, la respecter
      if (url.startsWith("/")) {
        // URL relative
        if (url === "/" || url === "/login" || url === "/register") {
          return `${baseUrl}/dashboard`;
        }
        return `${baseUrl}${url}`;
      } else if (new URL(url).origin === baseUrl) {
        // URL absolue sur le même domaine
        const pathname = new URL(url).pathname;
        if (pathname === "/" || pathname === "/login" || pathname === "/register") {
          return `${baseUrl}/dashboard`;
        }
        return url;
      }
      // Par défaut, aller au dashboard
      return `${baseUrl}/dashboard`;
    },

    async session({ token, session }) {
      if (session.user) {
        if (token.sub) {
          session.user.id = token.sub;
        }

        if (token.email) {
          session.user.email = token.email;
        }

        if (token.role) {
          session.user.role = token.role;
        }

        session.user.name = token.name;
        session.user.image = token.picture;
      }

      return session;
    },

    async jwt({ token }) {
      if (!token.sub) return token;

      const dbUser = await getUserById(token.sub);

      if (!dbUser) return token;

      token.name = dbUser.name;
      token.email = dbUser.email;
      token.picture = dbUser.image;
      token.role = dbUser.role;

      return token;
    },
  },
});
