import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
        <p className="text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {siteConfig.name}. Tous droits réservés.
        </p>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/contact" className="transition-colors hover:text-foreground">
            Contact
          </Link>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            CGU
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Confidentialité
          </Link>
        </nav>
      </div>
    </footer>
  );
}
