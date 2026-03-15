import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ActionCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2 pb-3">
        {/* Ligne 1 : titre + badges + menu */}
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-6 w-3/4" />
          <div className="flex shrink-0 items-center gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="size-7 rounded" />
          </div>
        </div>
        {/* Ligne 2 : métadonnées groupées */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-1">
            <Skeleton className="size-3" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="size-3" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="size-3" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Échéance */}
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <Skeleton className="size-4 shrink-0" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Phrase source */}
        <div className="overflow-hidden rounded-lg border-l-4 bg-muted/50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <Skeleton className="size-7 shrink-0 rounded" />
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Skeleton className="h-9 w-full sm:w-20" />
        <Skeleton className="h-9 w-full sm:w-24" />
      </CardFooter>
    </Card>
  );
}

export function ActionCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ActionCardSkeleton key={i} />
      ))}
    </div>
  );
}
