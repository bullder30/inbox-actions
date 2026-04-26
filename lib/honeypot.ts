/**
 * Anti-bot honey-pot pour formulaires publics.
 *
 * Principe : un champ caché (CSS `display:none` + `tabindex=-1` +
 * `aria-hidden=true` + `autocomplete=off`) est ajouté au formulaire.
 * Un humain ne le voit pas et ne le remplit pas. La plupart des bots
 * naïfs (qui scrapent le DOM et remplissent tous les inputs) le
 * remplissent → on détecte et on rejette en 400 (sans révéler la cause).
 *
 * MVP : suffit contre les bots de spam basiques. Pour des bots avancés
 * ou un trafic adversarial soutenu, upgrader vers Cloudflare Turnstile
 * (gratuit, RGPD-friendly). Voir security-audit.md M-3.
 *
 * Convention : champ `_hp_website` (nom plausible pour un bot) côté UI
 * et serveur. **Ne jamais** logger la valeur (peut leaker la source).
 */

export const HONEYPOT_FIELD_NAME = "_hp_website";

/**
 * Vérifie si le body contient le champ honey-pot rempli.
 * @returns `true` si comportement bot détecté (champ rempli ou type incorrect)
 */
export function isHoneypotTriggered(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD_NAME];
  // Bot a rempli le champ avec n'importe quelle valeur non-vide
  if (typeof value === "string" && value.trim().length > 0) return true;
  // Bot a passé un type inattendu (number, object, etc.)
  if (value !== undefined && typeof value !== "string") return true;
  return false;
}

/**
 * Réponse 400 générique sans dévoiler la détection (un bot peut
 * adapter son comportement si on lui dit qu'il a échoué le honey-pot).
 */
export function honeypotRejectResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Requête invalide." }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}
