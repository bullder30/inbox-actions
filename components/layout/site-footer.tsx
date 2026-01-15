import Link from "next/link";

import { siteConfig } from "@/config/site";
import packageJson from "@/package.json";

export function SiteFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex flex-col items-center justify-between gap-4 py-6 md:flex-row">
        <div className="flex flex-col items-center gap-1 md:flex-row md:gap-2">
          <p className="text-center text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}
          </p>
          <span className="hidden text-muted-foreground md:inline">·</span>
          <p className="text-center text-xs text-muted-foreground">
            v{packageJson.version}
          </p>
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link
            href="https://github.com/bullder30/inbox-actions"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            AGPL-3.0
          </Link>
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
