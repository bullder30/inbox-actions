/**
 * Génère un slug déterministe à partir d'un nom libre.
 *
 * Règles (ADR-003) :
 * - Décompose les diacritiques (NFD) puis les supprime (U+0300 → U+036F)
 * - Lowercase
 * - Tout caractère non alphanumérique → underscore (collapsé)
 * - Trim des underscores en bordure
 *
 * @param name Nom libre (1-50 chars typiquement)
 * @returns Slug (peut être vide si le nom ne contient aucun caractère alphanum)
 */
export function nameToSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
