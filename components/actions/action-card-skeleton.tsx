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
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            {/* Title */}
            <Skeleton className="h-6 w-3/4 sm:h-7" />
            {/* Description: Mail icon + email + Clock icon + date */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="flex items-center gap-1">
                <Skeleton className="size-3 sm:size-4" />
                <Skeleton className="h-3 w-32 sm:h-4 sm:w-40" />
              </div>
              <Skeleton className="hidden h-4 w-1 sm:block" />
              <div className="flex items-center gap-1">
                <Skeleton className="size-3 sm:size-4" />
                <Skeleton className="h-3 w-24 sm:h-4 sm:w-32" />
              </div>
            </div>
          </div>
          {/* Badges */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Source sentence blockquote */}
        <div className="overflow-hidden rounded-lg border-l-4 bg-muted/50 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            {/* Gmail button */}
            <Skeleton className="size-7 shrink-0 rounded" />
          </div>
        </div>

        {/* Due date indicator */}
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-40" />
        </div>

        {/* Metadata line */}
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="hidden h-3 w-1 sm:block" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {/* Action buttons */}
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
