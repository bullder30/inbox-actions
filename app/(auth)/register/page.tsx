import { Suspense } from "react";
import { Metadata } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { RegisterAuthForm } from "@/components/forms/register-auth-form";
import { SiteFooter } from "@/components/layout/site-footer";
import { Icons } from "@/components/shared/icons";
import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";

export const metadata: Metadata = {
  title: "Créer un compte",
  description: "Créez un compte pour commencer à utiliser Inbox Actions",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="container flex flex-1 flex-col items-center justify-center">
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "absolute left-4 top-4 md:left-8 md:top-8",
          )}
        >
          <>
            <Icons.chevronLeft className="mr-2 size-4" />
            Retour
          </>
        </Link>
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <InboxActionsIcon size="lg" className="mx-auto" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Créer un compte
            </h1>
            <p className="text-sm text-muted-foreground">
              Connectez-vous avec Google pour créer votre compte et accéder à vos emails
            </p>
          </div>
          <Suspense>
            <RegisterAuthForm />
          </Suspense>
          <p className="px-8 text-center text-sm text-muted-foreground">
            Vous avez déjà un compte ?{" "}
            <Link
              href="/login"
              className="font-medium underline underline-offset-4 hover:text-primary"
            >
              Se connecter
            </Link>
          </p>
          <p className="px-8 text-center text-xs text-muted-foreground">
            En continuant, vous acceptez nos{" "}
            <Link
              href="/terms"
              className="underline underline-offset-4 hover:text-primary"
            >
              Conditions d&apos;utilisation
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
      <SiteFooter />
    </div>
  );
}
