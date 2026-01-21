import { cn } from "@/lib/utils";
import { Mail } from "lucide-react";

interface InboxActionsLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    container: "size-5",
    icon: "size-3",
    text: "text-sm",
    gap: "gap-1.5",
  },
  md: {
    container: "size-6",
    icon: "size-4",
    text: "text-lg",
    gap: "gap-2",
  },
  lg: {
    container: "size-8",
    icon: "size-5",
    text: "text-xl",
    gap: "gap-2",
  },
};

export function InboxActionsLogo({
  size = "md",
  showText = false,
  className,
}: InboxActionsLogoProps) {
  const classes = sizeClasses[size];

  return (
    <div className={cn("flex items-center", classes.gap, className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md",
          classes.container
        )}
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        }}
      >
        <Mail className={cn(classes.icon, "text-white")} strokeWidth={2} />
      </div>
      {showText && (
        <span className={cn("font-urban font-bold", classes.text)}>
          Inbox Actions
        </span>
      )}
    </div>
  );
}

export function InboxActionsIcon({
  size = "md",
  className,
}: Omit<InboxActionsLogoProps, "showText">) {
  const classes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md",
        classes.container,
        className
      )}
      style={{
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      <Mail className={cn(classes.icon, "text-white")} strokeWidth={2} />
    </div>
  );
}
