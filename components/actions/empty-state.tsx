import { Button } from "@/components/ui/button";
import { CalendarClock, Check, Inbox, X } from "lucide-react";
import Link from "next/link";

type StatusFilter = "TODO" | "SCHEDULED" | "DONE" | "IGNORED";

interface EmptyStateProps {
  emailsAnalyzed?: number;
  filter?: StatusFilter;
}

const filterContent: Record<
  StatusFilter,
  { icon: React.ReactNode; title: string; description: React.ReactNode; showCta: boolean }
> = {
  TODO: {
    icon: <Inbox className="size-8 text-muted-foreground" />,
    title: "Rien à faire aujourd'hui.",
    description: null,
    showCta: true,
  },
  SCHEDULED: {
    icon: <CalendarClock className="size-8 text-muted-foreground" />,
    title: "Aucune action à venir.",
    description: "Planifiez une action depuis l'onglet \"Aujourd'hui\" pour la retrouver ici.",
    showCta: false,
  },
  DONE: {
    icon: <Check className="size-8 text-muted-foreground" />,
    title: "Aucune action terminée.",
    description: "Les actions que vous marquez comme faites apparaîtront ici.",
    showCta: false,
  },
  IGNORED: {
    icon: <X className="size-8 text-muted-foreground" />,
    title: "Aucune action ignorée.",
    description: "Les actions que vous ignorez apparaîtront ici.",
    showCta: false,
  },
};

export function EmptyState({ emailsAnalyzed = 0, filter = "TODO" }: EmptyStateProps) {
  const { icon, title, description, showCta } = filterContent[filter];

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {showCta ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Nous avons analysé {emailsAnalyzed} email{emailsAnalyzed > 1 ? "s" : ""}.<br />
            Aucune action explicite détectée.
          </p>
          <Link href="/missing-action" className="mt-6">
            <Button>Il manque une action</Button>
          </Link>
        </>
      ) : (
        description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )
      )}
    </div>
  );
}
