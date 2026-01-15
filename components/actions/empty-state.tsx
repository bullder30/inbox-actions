import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  emailsAnalyzed?: number;
}

export function EmptyState({ emailsAnalyzed = 0 }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Rien à faire aujourd&apos;hui.</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Nous avons analysé {emailsAnalyzed} email{emailsAnalyzed > 1 ? "s" : ""}.<br />
        Aucune action explicite détectée.
      </p>
      <Link href="/missing-action" className="mt-6">
        <Button>Il manque une action</Button>
      </Link>
    </div>
  );
}
