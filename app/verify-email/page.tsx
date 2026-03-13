"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "loading" | "success" | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token) {
      setErrorMessage("Lien de vérification invalide.");
      setStatus("error");
      return;
    }

    async function verify() {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Une erreur est survenue.");
        setStatus("error");
        return;
      }

      setStatus("success");
      setTimeout(() => router.push("/dashboard"), 3000);
    }

    verify();
  }, [token, router]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {status === "loading" && (
        <>
          <Loader2 className="size-12 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Vérification en cours...</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="size-12 text-green-500" />
          <h2 className="text-lg font-semibold">Email vérifié !</h2>
          <p className="text-sm text-muted-foreground">
            Votre adresse email a bien été confirmée. Redirection vers le tableau de bord...
          </p>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Aller au tableau de bord
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="size-12 text-destructive" />
          <h2 className="text-lg font-semibold">Lien invalide</h2>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Retour au tableau de bord
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-[350px] space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <InboxActionsIcon size="md" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Inbox Actions
            </h1>
          </div>
        </div>
        <Suspense fallback={
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="size-12 animate-spin text-muted-foreground" />
          </div>
        }>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
