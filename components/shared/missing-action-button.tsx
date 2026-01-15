"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

interface MissingActionButtonProps {
  ignoredEmailsCount: number;
}

export function MissingActionButton({ ignoredEmailsCount }: MissingActionButtonProps) {
  const pathname = usePathname();

  // Masquer le bouton sur /settings et /missing-action
  const shouldHide =
    pathname.startsWith("/settings") || pathname.startsWith("/missing-action");

  if (ignoredEmailsCount === 0 || shouldHide) {
    return null;
  }

  return (
    <Link href="/missing-action">
      <Button variant="outline" size="sm" className="shrink-0">
        Il manque une action
      </Button>
    </Link>
  );
}
