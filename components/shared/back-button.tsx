"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** Label to display (default: "Retour") */
  label?: string;
  /** Fixed URL to navigate to (bypasses router.back()) */
  href?: string;
  /** Fallback URL if there's no history (only used when href is not set) */
  fallbackUrl?: string;
  className?: string;
}

export function BackButton({
  label = "Retour",
  href,
  fallbackUrl = "/",
  className,
}: BackButtonProps) {
  const router = useRouter();

  // If href is provided, use a Link for direct navigation
  if (href) {
    return (
      <Button
        variant="ghost"
        size="sm"
        asChild
        className={cn("gap-2", className)}
      >
        <Link href={href} className="inline-flex items-center gap-2">
          <ArrowLeft className="size-4" />
          {label}
        </Link>
      </Button>
    );
  }

  function handleBack() {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={cn("gap-2", className)}
    >
      <ArrowLeft className="size-4" />
      {label}
    </Button>
  );
}
