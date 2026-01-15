interface DashboardHeaderProps {
  heading: string;
  text?: string;
  children?: React.ReactNode;
}

export function DashboardHeader({
  heading,
  text,
  children,
}: DashboardHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="grid gap-1">
        <h1 className="font-heading text-xl font-semibold sm:text-2xl">{heading}</h1>
        {text && <p className="text-sm text-muted-foreground sm:text-base">{text}</p>}
      </div>
      {children}
    </div>
  );
}
