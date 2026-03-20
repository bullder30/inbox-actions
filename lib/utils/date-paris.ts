/**
 * Utilitaires de calcul de dates dans le fuseau horaire Europe/Paris.
 *
 * Utilisés pour les filtres "Aujourd'hui" / "À venir" dans l'API Actions.
 * On évite date-fns-tz en utilisant l'API Intl native (Node ≥ 13).
 */

const TZ = "Europe/Paris";

/**
 * Retourne l'offset UTC de Paris à la date courante (en heures entières).
 * Ex : +1 en hiver (CET), +2 en été (CEST).
 *
 * Technique : on formate midi UTC dans le fuseau Paris pour lire l'heure Paris.
 * Midi UTC → 13h Paris (hiver) ou 14h Paris (été) ⇒ offset = heureParis - 12.
 */
function getParisDayInfo(): { year: number; month: number; day: number; offsetHours: number } {
  const now = new Date();

  // Date du jour à Paris sous forme "YYYY-MM-DD"
  const parisDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
  const [y, mo, d] = parisDateStr.split("-").map(Number);

  // Offset : on prend midi UTC pour éviter les ambiguïtés DST
  const noonUTC = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  const noonHourParis = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "numeric",
      hour12: false,
    }).format(noonUTC),
    10
  );
  const offsetHours = noonHourParis - 12; // +1 ou +2

  return { year: y, month: mo, day: d, offsetHours };
}

/**
 * Retourne la fin du jour courant en heure Paris (23:59:59.999), exprimée en UTC.
 * Utilisé comme borne supérieure pour le filtre "Aujourd'hui".
 */
export function getEndOfTodayParis(): Date {
  const { year, month, day, offsetHours } = getParisDayInfo();
  // 23:59:59 Paris = (23 - offsetHours):59:59 UTC
  return new Date(Date.UTC(year, month - 1, day, 23 - offsetHours, 59, 59, 999));
}

/**
 * Retourne le début du jour courant en heure Paris (00:00:00.000), exprimée en UTC.
 * Utilisé pour refuser les dates dans le passé dans l'endpoint /schedule.
 */
export function getStartOfTodayParis(): Date {
  const { year, month, day, offsetHours } = getParisDayInfo();
  // 00:00:00 Paris = (0 - offsetHours):00:00 UTC → JS Date.UTC gère les heures négatives
  return new Date(Date.UTC(year, month - 1, day, -offsetHours, 0, 0, 0));
}
