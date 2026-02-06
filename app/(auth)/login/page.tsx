import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";

import { BackButton } from "@/components/shared/back-button";
import { UserAuthForm } from "@/components/forms/user-auth-form";
import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte",
};

export default function LoginPage() {
  return (
    <div className="relative flex h-dvh flex-col items-center justify-center overflow-hidden px-4">
      <BackButton
        href="/"
        className="absolute left-4 top-4"
      />
      <div className="w-full max-w-[320px] space-y-4 sm:max-w-[350px] sm:space-y-6">
        {/* Logo + Title */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <InboxActionsIcon size="md" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Inbox Actions
            </h1>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Connectez-vous pour accéder à vos emails
          </p>
        </div>

        {/* Auth Form */}
        <Suspense>
          <UserAuthForm />
        </Suspense>

        {/* Register Link */}
        <p className="text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/register"
            className="font-medium underline underline-offset-4 hover:text-primary"
          >
            Créer un compte
          </Link>
        </p>

        {/* Legal Links */}
        <p className="text-center text-xs text-muted-foreground">
          En continuant, vous acceptez nos{" "}
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-primary"
          >
            CGU
          </Link>{" "}
          et notre{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-primary"
          >
            Politique de confidentialité
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
