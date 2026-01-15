import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  loading?: boolean;
  trend?: {
    value: number;
    label: string;
  };
  action?: React.ReactNode;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  loading = false,
  trend,
  action,
}: StatsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            {description && <Skeleton className="h-4 w-32" />}
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
            {trend && (
              <div className="mt-2 flex items-center text-xs">
                <span
                  className={
                    trend.value > 0
                      ? "text-green-600"
                      : trend.value < 0
                        ? "text-red-600"
                        : "text-muted-foreground"
                  }
                >
                  {trend.value > 0 ? "+" : ""}
                  {trend.value}
                </span>
                <span className="ml-1 text-muted-foreground">{trend.label}</span>
              </div>
            )}
            {action && (
              <div className="mt-3 flex justify-end">
                {action}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
