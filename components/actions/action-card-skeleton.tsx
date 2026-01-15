import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ActionCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-1">
            {/* Title */}
            <Skeleton className="h-7 w-3/4" />
            {/* Description: Mail icon + email + • + Clock icon + date */}
            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-2" />
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          {/* Type Badge only */}
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Source sentence blockquote with border-l-4 */}
        <div className="rounded-lg border-l-4 bg-muted/50 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
            {/* Gmail button */}
            <Skeleton className="size-7 shrink-0" />
          </div>
        </div>

        {/* Metadata line: De: email • date • (optional) Échéance */}
        <div className="flex items-center gap-2 text-xs">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-1" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-1" />
          <Skeleton className="h-3 w-32" />
        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        {/* Action buttons: 2 buttons for TODO status */}
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-24" />
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
