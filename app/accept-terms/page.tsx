"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { InboxActionsIcon } from "@/components/shared/inbox-actions-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Icons } from "@/components/shared/icons";

export default function AcceptTermsPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleAccept() {
    if (!accepted) return;
    setIsLoading(true);
    try {
      const response = await fetch("/api/user/accept-terms", { method: "POST" });

      if (!response.ok) {
        toast.error("Une erreur est survenue. Veuillez réessayer.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-[380px] space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <InboxActionsIcon size="md" />
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Inbox Actions
            </h1>
          </div>
        </div>

        {/* Card */}
        <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-6 shrink-0 text-primary" />
            <div>
              <h2 className="text-base font-semibold">Conditions d&apos;utilisation</h2>
              <p className="text-xs text-muted-foreground">Une dernière étape avant de commencer</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Pour utiliser Inbox Actions, vous devez accepter nos conditions générales
            d&apos;utilisation et notre politique de confidentialité.
          </p>

          <div className="flex items-start gap-2.5">
            <Checkbox
              id="terms"
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              className="mt-0.5"
            />
            <label htmlFor="terms" className="text-sm leading-relaxed text-muted-foreground">
              J&apos;accepte les{" "}
              <Link href="/terms" target="_blank" className="underline underline-offset-4 hover:text-primary">
                CGU
              </Link>{" "}
              et la{" "}
              <Link href="/privacy" target="_blank" className="underline underline-offset-4 hover:text-primary">
                Politique de confidentialité
              </Link>
            </label>
          </div>

          <Button
            className="w-full"
            onClick={handleAccept}
            disabled={!accepted || isLoading}
          >
            {isLoading && <Icons.spinner className="mr-2 size-4 animate-spin" />}
            Continuer vers l&apos;application
          </Button>
        </div>
      </div>
    </div>
  );
}
