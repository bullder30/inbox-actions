import { Github, Star } from "lucide-react";
import Link from "next/link";

const REPO_URL = "https://github.com/bullder30/inbox-actions";
const REPO_API = "https://api.github.com/repos/bullder30/inbox-actions";

interface GitHubRepo {
  stargazers_count?: number;
}

async function getStars(): Promise<number | null> {
  try {
    const res = await fetch(REPO_API, {
      next: { revalidate: 86_400 }, // 24h cache
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as GitHubRepo;
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

/**
 * Bouton GitHub avec compteur d'étoiles (server component, cache 24h).
 * Fallback gracieux si l'API GitHub est indisponible.
 */
export async function GitHubStars() {
  const stars = await getStars();

  return (
    <Link
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
      aria-label={stars !== null ? `Inbox Actions sur GitHub, ${stars} étoiles` : "Inbox Actions sur GitHub"}
    >
      <Github className="size-4" />
      <span className="hidden sm:inline">Star</span>
      {stars !== null && (
        <span className="flex items-center gap-1 border-l pl-2 text-muted-foreground">
          <Star className="size-3 fill-current text-amber-500" />
          <span className="tabular-nums">{stars}</span>
        </span>
      )}
    </Link>
  );
}
