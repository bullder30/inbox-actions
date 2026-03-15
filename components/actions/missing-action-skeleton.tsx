import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MissingActionCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-2 pb-3">
        {/* Ligne 1 : sujet + bouton */}
        <div className="flex items-start justify-between gap-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="size-7 shrink-0 rounded" />
        </div>
        {/* Ligne 2 : métadonnées */}
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
        <div className="overflow-hidden rounded-lg border-l-4 bg-muted/50 p-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-1 h-4 w-3/4" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Skeleton className="h-9 w-full sm:w-36" />
      </CardFooter>
    </Card>
  );
}

export function MissingActionCardSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <MissingActionCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MissingActionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div>
        <Skeleton className="h-9 w-40" />
      </div>

      <div>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-2 h-5 w-96" />
      </div>

      {/* Liste d'emails ignorés skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <MissingActionCardSkeletonList count={3} />
      </div>
    </div>
  );
}
