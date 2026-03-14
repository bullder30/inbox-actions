import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function MissingActionCardSkeleton() {
  return (
    <Card>
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-full max-w-md" />
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="size-7" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs sm:gap-2 sm:text-xs">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-0 sm:px-6">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-1 h-4 w-3/4" />
      </CardContent>
      <CardFooter className="flex justify-end px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
        <Skeleton className="h-8 w-32 sm:h-9" />
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
