/**
 * Extraction d'actions depuis les emails par REGEX uniquement
 * Règle d'or : Si ambigu → aucune action
 * Méthode : Détection déterministe, pas d'IA opaque
 */

import { ActionType } from "@prisma/client";

import { safelyExecuteRegex } from "@/lib/actions/regex-executor";

const REGEX_RUNTIME_TIMEOUT_MS = 200;

/**
 * Type pour une action extraite.
 *
 * Trace de détection (CRITIQUE pour la confiance utilisateur — sinon "pourquoi
 * cette action a-t-elle été créée ?" reste sans réponse) :
 *  - `matchedSegment` : le segment exact qui a déclenché (= match[0] regex,
 *    ou le keyword pour custom KEYWORDS). Substring de `sourceSentence`.
 *  - `matchStart` / `matchEnd` : offsets dans `sourceSentence` (post-truncation),
 *    utilisés par l'UI pour highlighter le passage déclencheur.
 *  - `triggerLabel` : libellé du déclencheur (keyword exact en custom KEYWORDS,
 *    null sinon). Permet d'expliciter "ce mot a déclenché" dans l'UI.
 *
 * Tous nullable côté DB pour rétro-compat (actions antérieures à la migration
 * + actions manuelles créées sans regex).
 */
export type ExtractedAction = {
  title: string;
  type: ActionType;
  sourceSentence: string;
  matchedSegment: string | null;
  matchStart: number | null;
  matchEnd: number | null;
  triggerLabel: string | null;
  dueDate: Date | null;
  // Champs custom (présents uniquement quand type === "CUSTOM")
  customTypeId?: string | null;
  customTypeLabel?: string | null;
  customTypeColor?: string | null;
};

/**
 * Contexte de l'email pour l'analyse
 */
export type EmailContext = {
  from: string;
  subject: string | null;
  body: string;
  receivedAt: Date;
};

/**
 * Exclusion utilisateur passée à l'extraction (sans dépendance Prisma)
 */
export type UserExclusionData = {
  type: "SENDER" | "DOMAIN" | "SUBJECT";
  value: string;
};

/**
 * Type custom passé à l'extracteur (subset minimal de CustomActionType Prisma).
 *
 * Champs `mode`, `regexPattern`, `validated` sont optionnels pour la
 * rétro-compatibilité avec les callers qui ne les passent pas encore.
 * - `mode` absent → traité comme "KEYWORDS"
 * - `validated` absent → traité comme `true` (les anciens types KEYWORDS
 *   sont auto-validés par migration)
 */
export type CustomActionTypeData = {
  id: string;
  name: string;
  keywords: string[];
  color: string;
  isActive: boolean;
  mode?: "KEYWORDS" | "REGEX";
  regexPattern?: string | null;
  validated?: boolean;
};

// ============================================================================
// PATTERNS REGEX PAR TYPE D'ACTION
// ============================================================================

/**
 * Patterns pour détecter l'action SEND (Envoyer)
 * Formes impératives et demandes explicites
 */
const SEND_PATTERNS = [
  // Impératif direct
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)(?:\s+.{0,40}?)?\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  // Variante "merci d'envoyer" (apostrophe collée)
  /merci\s+d['']envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  /(?:envoie|envoyez)(?:-moi)?\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  /il (?:faut|faudrait)\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,

  // Avec objet explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)(?:\s+.{0,40}?)?\s+(?:m[''])?(?:transmettre|faire parvenir|adresser)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,

  // Questions = demande explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous)(?:\s+.{0,40}?)?\s+(?:m[''])?(?:transférer|faire suivre)\s+(.{1,100}?)(?:\.|$|\?)/i,
];

/**
 * Patterns pour détecter l'action CALL (Appeler/Rappeler)
 * Inclut téléphone et visio
 */
const CALL_PATTERNS = [
  // Rappeler
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)(?:\s+.{0,40}?)?\s+(?:me\s+)?(?:rappeler|me rappeler)(?:\s+(.{1,50}?))?(?:\.|$|avant|d'ici|pour)/i,
  /^(?:rappelle|rappelez)(?:-moi)?(?:\s+(.{1,50}?))?(?:\.|$|avant|d'ici|pour)/i,  // impératif en début de phrase
  /(?:rappelle|rappelez)-moi(?:\s+(.{1,50}?))?(?:\.|$|avant|d'ici|pour)/i,        // rappelle-moi n'importe où

  // Appeler
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)(?:\s+.{0,40}?)?\s+(?:appeler|contacter|joindre)\s+(.{1,50}?)(?:\.|$|avant|d'ici|pour)/i,
  /^(?:appelle|appelez|contacte|contactez)\s+(.{1,50}?)(?:\.|$|avant|d'ici|pour)/i,

  // Visio/réunion
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:organiser|planifier)\s+(?:une\s+)?(?:visio|réunion|call)\s+(?:avec\s+)?(.{1,50}?)(?:\.|$|avant|d'ici|pour)/i,

  // ⚠️ Pattern trop vague supprimé (créait "Appeler" sans cible)
  // /il (?:faut|faudrait)\s+(?:qu['']on|que tu)\s+(?:appelle|contacte)/i,
];

/**
 * Patterns pour détecter l'action FOLLOW_UP (Relancer)
 */
const FOLLOW_UP_PATTERNS = [
  // Relancer explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)(?:\s+.{0,40}?)?\s+relancer\s+(.{1,50}?)(?:\.|$|avant|d'ici|pour|sur)/i,
  /^(?:relance|relancez)\s+(.{1,50}?)(?:\.|$|avant|d'ici|pour|sur)/i,

  // Faire un suivi
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+faire\s+(?:un\s+)?(?:suivi|point)\s+(?:sur|avec|de)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /il (?:faut|faudrait)\s+relancer\s+(.{1,50}?)(?:\.|$|sur)/i,

  // Rappel
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:me\s+)?(?:faire\s+un\s+)?rappel\s+(?:pour|sur|de)\s+(.{1,50}?)(?:\.|$|avant)/i,

  // ⚠️ Pattern trop vague supprimé (créait "Faire un suivi" sans cible)
  // /(?:n['']oublie|n['']oubliez)\s+pas\s+de\s+(?:relancer|faire un suivi)/i,
];

/**
 * Patterns pour détecter l'action PAY (Payer)
 */
const PAY_PATTERNS = [
  // Payer explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)(?:\s+.{0,40}?)?\s+(?:régler|payer)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /^(?:règle|réglez|paie|payez)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,

  // Procéder au paiement/règlement
  /(?:merci de|veuillez)\s+procéder\s+au\s+(?:paiement|règlement)(?:\s+(.{1,50}?))?(?:\.|$|avant|d'ici)/i,
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+procéder\s+au\s+(?:paiement|règlement)(?:\s+(.{1,50}?))?(?:\.|$|avant|d'ici)/i,

  // Facture
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:régler|payer)\s+(?:la\s+)?facture(?:\s+(.{1,30}?))?(?:\.|$|avant|d'ici)/i,
  /il (?:faut|faudrait)\s+(?:régler|payer)\s+(.{1,50}?)(?:\.|$|avant)/i,

  // Virement
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+faire\s+(?:un\s+)?virement\s+(?:de|pour)\s+(.{1,50}?)(?:\.|$|avant)/i,

  // Somme due / avis de paiement (factures établissements, organismes)
  /(?:une\s+)?somme\s+(?:est\s+)?due(?:\s+(?:à|de|pour|au)\s+(.{1,60}?))?(?:\.|$)/i,
  /(?:ci-joint|en\s+pièce[\s-]jointe)[^.]{0,80}(?:facture|avis\s+de\s+paiement)(.{0,50}?)(?:\.|$)/i,
];

/**
 * Patterns pour détecter l'action VALIDATE (Valider)
 */
const VALIDATE_PATTERNS = [
  // Valider explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)(?:\s+.{0,40}?)?\s+valider\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /^(?:valide|validez)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /il (?:faut|faudrait)\s+(?:aussi\s+)?valider\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,

  // Approuver/confirmer
  /(?:peux-tu|pourrais-tu|pourriez-vous)(?:\s+.{0,40}?)?\s+(?:approuver|confirmer)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /^(?:approuve|approuvez|confirme|confirmez)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,

  // Donner avis/OK
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:me\s+)?(?:donner\s+(?:ton|votre)\s+)?(?:avis|OK|accord|validation)\s+(?:sur|pour)\s+(.{1,50}?)(?:\.|$|avant)/i,

  // ⚠️ Pattern trop vague supprimé (créait "Valider" sans objet)
  // /il (?:faut|faudrait)\s+(?:que tu|qu['']on)\s+valide/i,
];

/**
 * Patterns pour détecter PAY directement depuis le sujet de l'email
 * (factures d'établissements, avis de paiement automatiques)
 */
const SUBJECT_PAY_PATTERNS = [
  /\bfacture\b(?!\s+automatique)/i,
  /avis\s+de\s+paiement/i,
  /somme\s+due/i,
  /appel\s+de\s+(?:fonds?|cotisation)/i,
];

// ============================================================================
// RÈGLES D'EXCLUSION
// ============================================================================

/**
 * Patterns pour identifier les emails à exclure (newsletters, no-reply, etc.)
 */
const EXCLUSION_PATTERNS = {
  // Expéditeurs à exclure
  fromExclusions: [
    /no-?reply@/i,
    /noreply@/i,
    /mailer-daemon@/i,
    /bounce@/i,
    /automated@/i,
    /do-?not-?reply@/i,
    /notifications?@/i,
    /newsletter@/i,
    /jobs?-?listings?@/i,   // LinkedIn job alerts
    /alerts?@/i,            // Alertes automatiques génériques
    /digest@/i,             // Digest automatiques
    /updates?@/i,           // Mises à jour automatiques
    /marketing@/i,          // Emails marketing
    /promo(?:tions?)?@/i,   // Promotions
  ],

  // Sujets à exclure
  subjectExclusions: [
    /newsletter/i,
    /unsubscribe/i,
    /désabonnement/i,
    /notification/i,
    /confirmation\s+(?:de\s+)?(?:commande|inscription|réservation)/i,
    /votre\s+commande/i,
    /facture\s+automatique/i,
    /re(?:çu|cu)\s+(?:de\s+)?paiement/i,
  ],

  // Contenu à exclure (footers, liens de désinscription)
  bodyExclusions: [
    /cliquez\s+ici\s+pour\s+vous\s+désabonner/i,
    /si\s+vous\s+ne\s+souhaitez\s+plus\s+recevoir/i,
    /pour\s+vous\s+désinscrire/i,
    /cet\s+email\s+a\s+été\s+envoyé\s+automatiquement/i,
    /ne\s+pas\s+répondre\s+à\s+cet\s+email/i,
  ],
};

/**
 * Patterns conditionnels "faibles" (annulent l'action uniquement si pas de deadline)
 * On évite d'annuler les tournures polies courantes ("si possible", "si tu peux") quand une échéance existe.
 */
const WEAK_CONDITIONAL_PATTERNS = [
  /éventuellement/i,
  /si\s+jamais/i,
  /quand\s+tu\s+(?:auras|as)\s+(?:le\s+)?temps/i,
  /lorsque\s+tu\s+(?:auras|as)\s+(?:le\s+)?temps/i,
  // Contextes hypothétiques / offres de service (pas une demande directe)
  /en\s+cas\s+de/i,
  /n['']hésitez\s+pas/i,
  /si\s+vous\s+avez\s+(?:des\s+)?(?:questions?|besoin)/i,
  /pour\s+(?:toute\s+)?(?:question|information|renseignement)/i,
];

// ============================================================================
// DÉTECTION DE DATES D'ÉCHÉANCE
// ============================================================================

/**
 * Patterns pour extraire les dates d'échéance
 */
const DEADLINE_PATTERNS = [
  // Date absolue (jour + mois)
  { pattern: /avant\s+(?:le\s+)?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i, type: "absolute" },
  { pattern: /pour\s+(?:le\s+)?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i, type: "absolute" },
  { pattern: /d['']ici\s+(?:le\s+)?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i, type: "absolute" },

  // Jour de la semaine
  { pattern: /avant\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i, type: "weekday" },
  { pattern: /pour\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i, type: "weekday" },
  { pattern: /d['']ici\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i, type: "weekday" },

  // Relatif simple
  { pattern: /(?:d['']ici|dans)\s+(\d+)\s+jours?/i, type: "days" },
  { pattern: /(?:d['']ici|dans)\s+(\d+)\s+semaines?/i, type: "weeks" },

  // Moments de la journée
  { pattern: /(?:avant|pour)\s+midi/i, type: "before_noon" },
  { pattern: /ce\s+matin/i, type: "this_morning" },
  { pattern: /cet?\s+après[-\s]midi/i, type: "this_afternoon" },
  { pattern: /ce\s+soir/i, type: "this_evening" },
  { pattern: /(?:en\s+)?fin\s+de\s+(?:la\s+)?journée/i, type: "end_of_day" },

  // Jours relatifs
  { pattern: /(?:aujourd['']hui|ce\s+jour)/i, type: "today" },
  { pattern: /demain/i, type: "tomorrow" },

  // Semaine
  { pattern: /cette\s+semaine/i, type: "this_week" },
  { pattern: /la\s+semaine\s+prochaine/i, type: "next_week" },
  { pattern: /fin\s+de\s+(?:la\s+)?semaine/i, type: "end_of_week" },

  // Mois
  { pattern: /ce\s+mois(?:-ci)?/i, type: "this_month" },
  { pattern: /fin\s+(?:du\s+)?mois/i, type: "end_of_month" },
];

const MONTH_NAMES: { [key: string]: number } = {
  janvier: 0,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
};

const WEEKDAY_NAMES: { [key: string]: number } = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 0,
};

/**
 * Parse une date d'échéance depuis un texte
 */
function parseDueDate(text: string, receivedAt: Date): Date | null {
  for (const { pattern, type } of DEADLINE_PATTERNS) {
    const match = text.match(pattern);
    if (!match) continue;

    const now = new Date(receivedAt);

    switch (type) {
      case "before_noon": {
        const date = new Date(now);
        date.setHours(12, 0, 0, 0);
        return date;
      }

      case "this_morning": {
        const date = new Date(now);
        date.setHours(12, 0, 0, 0);
        return date;
      }

      case "this_afternoon": {
        const date = new Date(now);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "this_evening": {
        const date = new Date(now);
        date.setHours(20, 0, 0, 0);
        return date;
      }

      case "end_of_day": {
        const date = new Date(now);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "today": {
        const date = new Date(now);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "tomorrow": {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(18, 0, 0, 0);
        return tomorrow;
      }

      case "days": {
        const days = parseInt(match[1], 10);
        if (Number.isNaN(days)) return null;
        const date = new Date(now);
        date.setDate(date.getDate() + days);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "weeks": {
        const weeks = parseInt(match[1], 10);
        if (Number.isNaN(weeks)) return null;
        const date = new Date(now);
        date.setDate(date.getDate() + weeks * 7);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "weekday": {
        const targetWeekday = WEEKDAY_NAMES[match[1].toLowerCase()];
        const currentWeekday = now.getDay();
        let daysToAdd = targetWeekday - currentWeekday;
        if (daysToAdd <= 0) daysToAdd += 7;
        const date = new Date(now);
        date.setDate(date.getDate() + daysToAdd);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "end_of_week": {
        // Fin de semaine → Vendredi 18h (prochaine occurrence si déjà passé)
        const date = new Date(now);
        const current = now.getDay();
        const friday = 5;
        let daysToFriday = friday - current;
        if (daysToFriday < 0) daysToFriday += 7;
        date.setDate(date.getDate() + daysToFriday);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "this_week": {
        // Cette semaine → Vendredi 18h ; si on est samedi/dimanche, on prend vendredi prochain
        const date = new Date(now);
        const current = now.getDay();
        const friday = 5;
        let daysToFriday = friday - current;
        if (daysToFriday < 0) daysToFriday += 7;
        date.setDate(date.getDate() + daysToFriday);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "next_week": {
        // Semaine prochaine → Lundi suivant 18h
        const date = new Date(now);
        const daysToNextMonday = (8 - now.getDay()) % 7 || 7;
        date.setDate(date.getDate() + daysToNextMonday);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "end_of_month": {
        const date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "this_month": {
        const date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "absolute": {
        // match[1] = day, match[2] = monthName
        const day = parseInt(match[1], 10);
        const monthName = match[2]?.toLowerCase();
        if (!monthName || Number.isNaN(day)) return null;

        const month = MONTH_NAMES[monthName];
        const year = now.getFullYear();

        const date = new Date(year, month, day);
        if (date < now) {
          date.setFullYear(year + 1);
        }
        date.setHours(18, 0, 0, 0);
        return date;
      }
    }
  }

  return null;
}

// ============================================================================
// FONCTION D'EXCLUSION
// ============================================================================

/**
 * Vérifie si un email doit être exclu de l'analyse
 */
function shouldExcludeEmail(context: EmailContext): boolean {
  for (const pattern of EXCLUSION_PATTERNS.fromExclusions) {
    if (pattern.test(context.from)) return true;
  }

  if (context.subject) {
    // Normaliser le sujet avant vérification
    const normalizedSubject = normalizeText(context.subject);
    for (const pattern of EXCLUSION_PATTERNS.subjectExclusions) {
      if (pattern.test(normalizedSubject)) return true;
    }
  }

  // Normaliser le body avant vérification
  const normalizedBody = normalizeText(context.body);
  for (const pattern of EXCLUSION_PATTERNS.bodyExclusions) {
    if (pattern.test(normalizedBody)) return true;
  }

  return false;
}

/**
 * Détecte un conditionnel faible.
 * Règle : si conditionnel faible ET pas de deadline → on ignore la phrase.
 */
function hasWeakConditional(sentence: string): boolean {
  for (const pattern of WEAK_CONDITIONAL_PATTERNS) {
    if (pattern.test(sentence)) return true;
  }
  return false;
}

// ============================================================================
// GATING ANTI-AMBIGUÏTÉ
// ============================================================================

/**
 * Marqueurs "forts" par type : permettent d'accepter une action même sans objet capturé,
 * uniquement si la phrase est suffisamment explicite et non vague.
 */
const STRONG_MARKERS: Record<ActionType, RegExp[]> = {
  SEND: [
    /devis/i,
    /contrat/i,
    /document/i,
    /pi[eè]ce\s+jointe/i,
    /fichier/i,
    /pdf/i,
    /rapport/i,
  ],
  CALL: [
    /\b\d{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?\d{2}\b/i, // téléphone FR simple
    /visi?o/i,
    /\bmeet\b/i,
    /\bteams\b/i,
    /\bzoom\b/i,
    /rappeler/i,
  ],
  FOLLOW_UP: [
    /client/i,
    /devis/i,
    /facture/i,
    /dossier/i,
    /commande/i,
    /relancer/i,
    /suivi/i,
  ],
  PAY: [
    /facture/i,
    /\bfa[-\s]?\d+/i,
    /r[iè]glement/i,
    /virement/i,
    /iban/i,
    /tva/i,
    /somme\s+due/i,
    /ci-?joint/i,
  ],
  VALIDATE: [
    /contrat/i,
    /devis/i,
    /version/i,
    /document/i,
    /maquette/i,
    /proposition/i,
    /bon\s+pour\s+accord/i,
  ],
  // CUSTOM : marqueurs forts non utilisés (le gating custom s'appuie sur dueDate).
  CUSTOM: [],
};

/**
 * Détermine si une phrase est suffisamment concrète pour créer une action
 * quand l'objet capturé est vide.
 *
 * Règle MVP "spec-tight":
 * - Si dueDate existe → on peut accepter plus facilement
 * - Sinon, il faut un marqueur fort selon le type
 */
function isConcreteEnough(type: ActionType, sentence: string, dueDate: Date | null): boolean {
  if (dueDate) return true;

  const markers = STRONG_MARKERS[type] || [];
  return markers.some((re) => re.test(sentence));
}

// ============================================================================
// NORMALISATION DE TEXTE
// ============================================================================

/**
 * Décode les entités HTML courantes en caractères normaux
 * Gère les entités nommées et numériques (décimales et hexadécimales)
 */
function decodeHtmlEntities(text: string): string {
  // Entités nommées courantes
  const namedEntities: { [key: string]: string } = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
    "&copy;": "©",
    "&reg;": "®",
    "&euro;": "€",
    "&pound;": "£",
    "&yen;": "¥",
    "&cent;": "¢",
    "&deg;": "°",
    "&plusmn;": "±",
    "&times;": "×",
    "&divide;": "÷",
    "&frac12;": "½",
    "&frac14;": "¼",
    "&frac34;": "¾",
    "&ndash;": "–",
    "&mdash;": "—",
    "&lsquo;": "\u2018",
    "&rsquo;": "\u2019",
    "&ldquo;": "\u201c",
    "&rdquo;": "\u201d",
    "&bull;": "•",
    "&hellip;": "…",
    "&trade;": "™",
    "&agrave;": "à",
    "&acirc;": "â",
    "&auml;": "ä",
    "&egrave;": "è",
    "&eacute;": "é",
    "&ecirc;": "ê",
    "&euml;": "ë",
    "&igrave;": "ì",
    "&icirc;": "î",
    "&iuml;": "ï",
    "&ograve;": "ò",
    "&ocirc;": "ô",
    "&ouml;": "ö",
    "&ugrave;": "ù",
    "&ucirc;": "û",
    "&uuml;": "ü",
    "&ccedil;": "ç",
    "&ntilde;": "ñ",
    "&Agrave;": "À",
    "&Acirc;": "Â",
    "&Auml;": "Ä",
    "&Egrave;": "È",
    "&Eacute;": "É",
    "&Ecirc;": "Ê",
    "&Euml;": "Ë",
    "&Igrave;": "Ì",
    "&Icirc;": "Î",
    "&Iuml;": "Ï",
    "&Ograve;": "Ò",
    "&Ocirc;": "Ô",
    "&Ouml;": "Ö",
    "&Ugrave;": "Ù",
    "&Ucirc;": "Û",
    "&Uuml;": "Ü",
    "&Ccedil;": "Ç",
    "&Ntilde;": "Ñ",
  };

  let result = text;

  // Décoder les entités numériques décimales (&#39; → ')
  result = result.replace(/&#(\d+);/g, (_, code) => {
    const charCode = parseInt(code, 10);
    return String.fromCharCode(charCode);
  });

  // Décoder les entités numériques hexadécimales (&#x27; → ')
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
    const charCode = parseInt(code, 16);
    return String.fromCharCode(charCode);
  });

  // Décoder les entités nommées
  for (const [entity, char] of Object.entries(namedEntities)) {
    result = result.replace(new RegExp(entity, "gi"), char);
  }

  return result;
}

/**
 * Normalise les apostrophes typographiques en apostrophes standard
 * Cela permet aux regex d'utiliser uniquement ' et de matcher les deux formes
 */
function normalizeApostrophes(text: string): string {
  return text
    .replace(/'/g, "'")  // Apostrophe typographique → standard
    .replace(/ʼ/g, "'")  // Autre variante apostrophe
    .replace(/`/g, "'"); // Backtick → apostrophe
}

/**
 * Normalise les guillemets pour uniformiser le texte
 */
function normalizeQuotes(text: string): string {
  return text
    .replace(/[«»""„]/g, '"')  // Guillemets typographiques → standard
    .replace(/[''‚]/g, "'");   // Apostrophes/guillemets simples → standard
}

/**
 * Normalise un texte complet (entités HTML + apostrophes + guillemets)
 */
function normalizeText(text: string): string {
  // 1. Décoder les entités HTML (&#39; → ', &amp; → &, etc.)
  // 2. Normaliser les apostrophes typographiques
  // 3. Normaliser les guillemets
  return normalizeQuotes(normalizeApostrophes(decodeHtmlEntities(text)));
}

// ============================================================================
// EXTRACTION D'ACTIONS
// ============================================================================

/**
 * Bornes "spec-tight" pour filtrer les phrases analysables et tronquer les sorties.
 * - SENTENCE_*  : limites avant analyse (élimine bruit / fragments / lignes très longues)
 * - TITLE_*     : tronque le titre généré pour rester compact en UI
 * - SOURCE_*    : tronque la source affichée à l'utilisateur
 */
const SENTENCE_MIN_LENGTH = 10;
const SENTENCE_MAX_LENGTH = 500;
const TITLE_MAX_LENGTH = 100;
const TITLE_TRUNCATE_AT = 97;
const SOURCE_MAX_LENGTH = 200;
const SOURCE_TRUNCATE_AT = 197;

/**
 * Nettoie une phrase en enlevant les tirets, guillemets, etc.
 */
function cleanSentence(sentence: string): string {
  return sentence
    .trim()
    .replace(/^[-•*]\s*/, "")
    .replace(/^["'"«»]\s*/, "")
    .replace(/\s*["'"«»]$/, "")
    .trim();
}

/**
 * Découpe un body email en phrases analysables.
 * Découpage robuste : ligne par ligne, puis ponctuation (`.!?`) puis séparateurs `;:`.
 * Utilisé à la fois par l'extracteur natif et l'extracteur custom.
 */
function splitIntoSentences(normalizedBody: string): string[] {
  const lines = normalizedBody.split(/\r?\n/);
  const sentences: string[] = [];

  for (const line of lines) {
    const parts = line.split(/[.!?]+(?:\s+|$)/).filter(Boolean);
    for (const part of parts) {
      sentences.push(...part.split(/[;:]+(?:\s+|$)/).filter(Boolean));
    }
  }

  return sentences;
}

/**
 * Tronque une chaîne en respectant la limite UI (point de coupure < limite, suivi de "...").
 */
function truncate(text: string, max: number, cutAt: number): string {
  return text.length > max ? text.substring(0, cutAt) + "..." : text;
}

/**
 * Construit la fenêtre `sourceSentence` affichée à l'utilisateur, centrée sur
 * le segment qui a déclenché l'action. Calcule également les offsets du match
 * dans cette fenêtre (utilisés par l'UI pour highlighter).
 *
 * Invariants :
 *  - `sourceSentence.length <= SOURCE_MAX_LENGTH`
 *  - Si offsets non null : `sourceSentence.substring(matchStart, matchEnd) === matchedSegment`
 *    (sauf cas extrême où le match est plus long que la fenêtre cible)
 *  - Si offsets fournis hors borne (devrait jamais arriver) : retourne null offsets
 *    avec un fallback truncate classique pour ne pas casser l'extraction.
 *
 * Stratégies :
 *  - Phrase ≤ 200 chars  → retourne tel quel + offsets directs
 *  - Match ≥ 198 chars   → tronque le match, suffixe "…", offsets [0, 198]
 *  - Sinon               → fenêtre 198 chars centrée sur le match,
 *                           "…" préfixé/suffixé selon les bords coupés
 */
function buildSourceWindow(
  sentence: string,
  rawMatchStart: number,
  matchLength: number
): { sourceSentence: string; matchStart: number | null; matchEnd: number | null } {
  // Sanity : offsets cohérents avec sentence
  if (rawMatchStart < 0 || rawMatchStart + matchLength > sentence.length) {
    return {
      sourceSentence: truncate(sentence, SOURCE_MAX_LENGTH, SOURCE_TRUNCATE_AT),
      matchStart: null,
      matchEnd: null,
    };
  }

  if (sentence.length <= SOURCE_MAX_LENGTH) {
    return {
      sourceSentence: sentence,
      matchStart: rawMatchStart,
      matchEnd: rawMatchStart + matchLength,
    };
  }

  const ELLIPSIS = "…";
  // -2 pour réserver l'espace de 2 ellipsis potentielles
  const TARGET_LEN = SOURCE_MAX_LENGTH - 2;

  // Cas extrême : le match seul est plus long que la cible
  if (matchLength >= TARGET_LEN) {
    const truncated = sentence.substring(rawMatchStart, rawMatchStart + TARGET_LEN) + ELLIPSIS;
    return {
      sourceSentence: truncated,
      matchStart: 0,
      matchEnd: TARGET_LEN,
    };
  }

  const remainingSpace = TARGET_LEN - matchLength;
  const halfBefore = Math.floor(remainingSpace / 2);

  let windowStart = Math.max(0, rawMatchStart - halfBefore);
  let windowEnd = windowStart + TARGET_LEN;

  if (windowEnd > sentence.length) {
    windowEnd = sentence.length;
    windowStart = Math.max(0, windowEnd - TARGET_LEN);
  }

  let windowText = sentence.substring(windowStart, windowEnd);
  let newMatchStart = rawMatchStart - windowStart;
  let newMatchEnd = newMatchStart + matchLength;

  if (windowStart > 0) {
    windowText = ELLIPSIS + windowText;
    newMatchStart += 1;
    newMatchEnd += 1;
  }
  if (windowEnd < sentence.length) {
    windowText = windowText + ELLIPSIS;
  }

  return {
    sourceSentence: windowText,
    matchStart: newMatchStart,
    matchEnd: newMatchEnd,
  };
}

/**
 * Extrait les actions d'un type spécifique
 */
function extractActionsByType(
  type: ActionType,
  patterns: RegExp[],
  context: EmailContext
): ExtractedAction[] {
  const actions: ExtractedAction[] = [];
  const sentences = splitIntoSentences(normalizeText(context.body));

  for (let sentence of sentences) {
    sentence = cleanSentence(sentence);

    if (sentence.length < SENTENCE_MIN_LENGTH || sentence.length > SENTENCE_MAX_LENGTH) continue;

    // Détecter une échéance (utile pour lever certaines ambiguïtés)
    const dueDate = parseDueDate(sentence, context.receivedAt);

    // Conditionnels faibles : annuler seulement si pas de deadline
    if (!dueDate && hasWeakConditional(sentence)) continue;

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (!match) continue;

      const object = match[1]?.trim() || "";

      // Gating anti-ambiguïté: si pas d'objet, n'accepter que si la phrase est concrète
      if (!object && !isConcreteEnough(type, sentence, dueDate)) {
        break; // pattern matché, mais trop vague -> aucune action
      }

      // Trace de détection : segment exact + position dans la phrase trimée
      const matchedSegment = match[0];
      const rawMatchStart = match.index ?? sentence.indexOf(matchedSegment);
      const trimmedSentence = sentence.trim();

      const title = truncate(buildNativeTitle(type, object), TITLE_MAX_LENGTH, TITLE_TRUNCATE_AT);
      const window = buildSourceWindow(trimmedSentence, rawMatchStart, matchedSegment.length);

      actions.push({
        title,
        type,
        sourceSentence: window.sourceSentence,
        matchedSegment,
        matchStart: window.matchStart,
        matchEnd: window.matchEnd,
        triggerLabel: null,
        dueDate,
      });

      // Une seule action par phrase
      break;
    }
  }

  return actions;
}

/**
 * Construit le titre d'une action native selon son type et l'objet capturé.
 * Si `object` est vide, retourne un libellé fallback générique.
 */
function buildNativeTitle(type: ActionType, object: string): string {
  switch (type) {
    case "SEND":
      return object ? `Envoyer ${object}` : "Envoyer un document";
    case "CALL":
      return object ? `Appeler ${object}` : "Appeler";
    case "FOLLOW_UP":
      return object ? `Relancer ${object}` : "Faire un suivi";
    case "PAY":
      return object ? `Payer ${object}` : "Effectuer un paiement";
    case "VALIDATE":
      return object ? `Valider ${object}` : "Valider";
    default:
      return object || "Action";
  }
}

/**
 * Vérifie si un email doit être exclu selon les règles personnalisées de l'utilisateur
 */
function shouldExcludeByUserRules(context: EmailContext, exclusions: UserExclusionData[]): boolean {
  const raw = context.from;
  const angleMatch = raw.match(/<([^>]+)>/);
  const emailLower = (angleMatch ? angleMatch[1] : raw).trim().toLowerCase();
  const subjectLower = context.subject?.toLowerCase() ?? "";

  for (const exclusion of exclusions) {
    const val = exclusion.value.toLowerCase();
    if (exclusion.type === "SENDER" && emailLower === val) return true;
    if (exclusion.type === "DOMAIN" && emailLower.endsWith(`@${val}`)) return true;
    if (exclusion.type === "SUBJECT" && subjectLower.includes(val)) return true;
  }
  return false;
}

/**
 * Fonction principale d'extraction d'actions depuis un email
 * Règle : Si ambigu → aucune action
 *
 * @param context Contexte email (from, subject, body, receivedAt)
 * @param userExclusions Règles d'exclusion utilisateur (par défaut vide)
 * @param customTypes Types d'actions custom de l'utilisateur (par défaut vide)
 */
export function extractActionsFromEmail(
  context: EmailContext,
  userExclusions: UserExclusionData[] = [],
  customTypes: CustomActionTypeData[] = []
): ExtractedAction[] {
  if (userExclusions.length > 0 && shouldExcludeByUserRules(context, userExclusions)) return [];
  if (shouldExcludeEmail(context)) return [];

  const actions: ExtractedAction[] = [];

  actions.push(...extractActionsByType("SEND", SEND_PATTERNS, context));
  actions.push(...extractActionsByType("CALL", CALL_PATTERNS, context));
  actions.push(...extractActionsByType("FOLLOW_UP", FOLLOW_UP_PATTERNS, context));
  actions.push(...extractActionsByType("PAY", PAY_PATTERNS, context));
  actions.push(...extractActionsByType("VALIDATE", VALIDATE_PATTERNS, context));

  // Détection PAY depuis le sujet (factures, avis de paiement) — fallback si body n'a rien détecté
  if (context.subject && !actions.some((a) => a.type === "PAY")) {
    const normalizedSubject = normalizeText(context.subject);
    for (const pattern of SUBJECT_PAY_PATTERNS) {
      const subjectMatch = normalizedSubject.match(pattern);
      if (subjectMatch) {
        const trimmedSubject = context.subject.trim();
        const matchedSegment = subjectMatch[0];
        // Mapper l'offset du subject normalisé vers le subject trimé : approximation
        // par recherche directe (les normalisations changent rarement la longueur).
        const rawMatchStart = trimmedSubject
          .toLowerCase()
          .indexOf(matchedSegment.toLowerCase());
        const window =
          rawMatchStart >= 0
            ? buildSourceWindow(trimmedSubject, rawMatchStart, matchedSegment.length)
            : { sourceSentence: trimmedSubject, matchStart: null, matchEnd: null };

        actions.push({
          title: truncate(`Payer – ${trimmedSubject}`, TITLE_MAX_LENGTH, TITLE_TRUNCATE_AT),
          type: "PAY",
          sourceSentence: window.sourceSentence,
          matchedSegment,
          matchStart: window.matchStart,
          matchEnd: window.matchEnd,
          triggerLabel: null,
          dueDate: null,
        });
        break;
      }
    }
  }

  // Custom action types (US-5) — n'écrase jamais une action native sur la même phrase
  if (customTypes.length > 0) {
    const customActions = extractCustomActionsFromEmail(context, customTypes);
    for (const customAction of customActions) {
      const collidesWithNative = actions.some(
        (native) => native.sourceSentence === customAction.sourceSentence
      );
      if (!collidesWithNative) {
        actions.push(customAction);
      }
    }
  }

  return deduplicateActions(actions);
}

/**
 * Échappe les caractères spéciaux regex dans un keyword utilisateur.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extrait les actions custom à partir des règles définies par l'utilisateur.
 *
 * Strategy pattern : switche selon `customType.mode`.
 *   - "KEYWORDS" (ou mode absent → backward-compat) : compile la liste de
 *     keywords en regex Unicode-aware
 *   - "REGEX" : exécute le pattern utilisateur dans un sandbox vm avec
 *     timeout 200ms (cf. ADR-005 + AC-6)
 *
 * Filtres communs :
 *   - `isActive: false` → skip
 *   - `validated: false` → skip (défense en profondeur, en plus du filtre DB)
 *
 * @param context Contexte email
 * @param customTypes Types custom (filtre interne sur isActive + validated)
 * @returns Actions custom détectées (avec snapshot label/color)
 */
export function extractCustomActionsFromEmail(
  context: EmailContext,
  customTypes: CustomActionTypeData[]
): ExtractedAction[] {
  if (customTypes.length === 0) return [];

  const activeTypes = customTypes.filter((t) => {
    if (!t.isActive) return false;
    // `validated` absent → traité comme valide (rétro-compat callers v0.5.0)
    if (t.validated === false) return false;
    return true;
  });
  if (activeTypes.length === 0) return [];

  if (shouldExcludeEmail(context)) return [];

  const actions: ExtractedAction[] = [];
  const normalizedBody = normalizeText(context.body);
  const sentences = splitIntoSentences(normalizedBody);

  for (const customType of activeTypes) {
    const mode = customType.mode ?? "KEYWORDS";

    if (mode === "REGEX") {
      const regexAction = extractCustomActionForRegexType(
        customType,
        sentences,
        context.receivedAt
      );
      if (regexAction) actions.push(regexAction);
    } else {
      const keywordAction = extractCustomActionForKeywordsType(
        customType,
        sentences,
        context.receivedAt
      );
      if (keywordAction) actions.push(keywordAction);
    }
  }

  return actions;
}

/**
 * Détection custom mode KEYWORDS (compileKeywordsRegex existant).
 *
 * Capture en plus le keyword exact qui a déclenché (group 1 de la regex
 * compilée) pour le stocker en `triggerLabel`. C'est ce qui permet à l'UI
 * d'afficher "déclenché par : facture" au lieu d'une ambiguïté.
 */
function extractCustomActionForKeywordsType(
  customType: CustomActionTypeData,
  sentences: string[],
  receivedAt: Date
): ExtractedAction | null {
  const keywordRegex = compileKeywordsRegex(customType.keywords);
  if (!keywordRegex) return null;

  for (let sentence of sentences) {
    sentence = cleanSentence(sentence);
    if (sentence.length < SENTENCE_MIN_LENGTH || sentence.length > SENTENCE_MAX_LENGTH) continue;

    const dueDate = parseDueDate(sentence, receivedAt);
    if (!dueDate && hasWeakConditional(sentence)) continue;

    const match = sentence.match(keywordRegex);
    if (!match) continue;

    // Gating anti-ambiguïté : exiger une dueDate (faute de marqueurs forts)
    if (!dueDate) continue;

    // match[0] = keyword (le lookbehind/lookahead ne consomment rien)
    // match[1] = capture group = même keyword (gardé pour clarté)
    const matchedSegment = match[0];
    const triggerLabel = match[1] ?? matchedSegment;
    const rawMatchStart = match.index ?? sentence.indexOf(matchedSegment);

    return buildCustomAction(
      customType,
      sentence,
      dueDate,
      matchedSegment,
      rawMatchStart,
      triggerLabel
    );
  }

  return null;
}

/**
 * Détection custom mode REGEX via sandbox vm (ADR-005).
 * Skip l'email pour ce type sur timeout (US-5.4 / AC-6) sans crasher le scan.
 *
 * Utilise la PREMIÈRE occurrence (`result.matches[0]`) pour le segment trace.
 * Cohérent avec l'endpoint /test-regex qui renvoie tous les ranges au user.
 */
function extractCustomActionForRegexType(
  customType: CustomActionTypeData,
  sentences: string[],
  receivedAt: Date
): ExtractedAction | null {
  const pattern = customType.regexPattern;
  if (!pattern) return null;

  for (let sentence of sentences) {
    sentence = cleanSentence(sentence);
    if (sentence.length < SENTENCE_MIN_LENGTH || sentence.length > SENTENCE_MAX_LENGTH) continue;

    const dueDate = parseDueDate(sentence, receivedAt);
    if (!dueDate && hasWeakConditional(sentence)) continue;

    const result = safelyExecuteRegex(pattern, sentence, REGEX_RUNTIME_TIMEOUT_MS);
    if (result.timedOut) {
      console.warn(
        `[extractCustomActionsFromEmail] Regex timeout for customTypeId=${customType.id} (pattern length=${pattern.length}). Skipping email for this type.`
      );
      return null;
    }
    if (result.matches.length === 0) continue;

    // Gating anti-ambiguïté partagé : exiger une dueDate
    if (!dueDate) continue;

    const firstMatch = result.matches[0];
    const matchedSegment = sentence.substring(
      firstMatch.index,
      firstMatch.index + firstMatch.length
    );

    return buildCustomAction(
      customType,
      sentence,
      dueDate,
      matchedSegment,
      firstMatch.index,
      null // pas de "keyword" en mode REGEX, l'UI s'appuiera sur le matchedSegment
    );
  }

  return null;
}

/**
 * Construit une action CUSTOM avec les snapshots label/color requis par AC-7,
 * et la trace de détection (segment exact + position + libellé déclencheur).
 */
function buildCustomAction(
  customType: CustomActionTypeData,
  sentence: string,
  dueDate: Date,
  matchedSegment: string,
  rawMatchStart: number,
  triggerLabel: string | null
): ExtractedAction {
  const title = truncate(customType.name, TITLE_MAX_LENGTH, TITLE_TRUNCATE_AT);
  const trimmedSentence = sentence.trim();
  // Si la sentence passée n'est pas trimée, recalibrer rawMatchStart
  const trimOffset = sentence.indexOf(trimmedSentence);
  const adjustedStart = trimOffset > 0 ? rawMatchStart - trimOffset : rawMatchStart;
  const window = buildSourceWindow(
    trimmedSentence,
    Math.max(0, adjustedStart),
    matchedSegment.length
  );

  return {
    title,
    type: "CUSTOM" as ActionType,
    sourceSentence: window.sourceSentence,
    matchedSegment,
    matchStart: window.matchStart,
    matchEnd: window.matchEnd,
    triggerLabel,
    dueDate,
    customTypeId: customType.id,
    customTypeLabel: customType.name,
    customTypeColor: customType.color,
  };
}

/**
 * Compile la liste de keywords d'un type custom en une regex Unicode-aware
 * insensible à la casse. Frontières via lookbehind/lookahead Unicode pour
 * matcher correctement les mots FR commençant par accent (éditer, écrire, etc.).
 * `\b` natif JS échoue sur les frontières accent/espace.
 * Retourne `null` si aucun keyword utilisable après trim.
 */
function compileKeywordsRegex(keywords: string[]): RegExp | null {
  const validKeywords = keywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map(escapeRegex);
  if (validKeywords.length === 0) return null;
  return new RegExp(
    `(?<![\\p{L}\\p{N}_])(${validKeywords.join("|")})(?![\\p{L}\\p{N}_])`,
    "iu"
  );
}

/**
 * Déduplique les actions similaires (même type + titre + source)
 */
function deduplicateActions(actions: ExtractedAction[]): ExtractedAction[] {
  const seen = new Set<string>();
  const unique: ExtractedAction[] = [];

  for (const action of actions) {
    const key = `${action.type}:${action.title}:${action.sourceSentence}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(action);
    }
  }

  return unique;
}
