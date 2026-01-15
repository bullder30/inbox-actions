/**
 * Extraction d'actions depuis les emails par REGEX uniquement
 * Règle d'or : Si ambigu → aucune action
 * Méthode : Détection déterministe, pas d'IA opaque
 */

import { ActionType } from "@prisma/client";

/**
 * Type pour une action extraite
 */
export type ExtractedAction = {
  title: string;
  type: ActionType;
  sourceSentence: string;
  dueDate: Date | null;
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

// ============================================================================
// PATTERNS REGEX PAR TYPE D'ACTION
// ============================================================================

/**
 * Patterns pour détecter l'action SEND (Envoyer)
 * Formes impératives et demandes explicites
 */
const SEND_PATTERNS = [
  // Impératif direct
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  /(?:envoie|envoyez)(?:-moi)?\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,
  /il (?:faut|faudrait)\s+(?:m[''])?envoyer\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,

  // Avec objet explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+(?:m[''])?(?:transmettre|faire parvenir|adresser)\s+(.{1,100}?)(?:\.|$|avant|d'ici|pour)/i,

  // Questions = demande implicite
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:m[''])?(?:transférer|faire suivre)\s+(.{1,100}?)(?:\.|$|\?)/i,
];

/**
 * Patterns pour détecter l'action CALL (Appeler/Rappeler)
 * Inclut téléphone et visio
 */
const CALL_PATTERNS = [
  // Rappeler
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+(?:me\s+)?(?:rappeler|me rappeler)(?:\s+(.{1,50}?))?(?:\.|$|avant|d'ici|pour)/i,
  /(?:rappelle|rappelez)(?:-moi)?(?:\s+(.{1,50}?))?(?:\.|$|avant|d'ici|pour)/i,

  // Appeler
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+(?:appeler|contacter|joindre)\s+(.{1,50}?)(?:\.|$|avant|d'ici|pour)/i,
  /(?:appelle|appelez|contacte|contactez)\s+(.{1,50}?)(?:\.|$|avant|d'ici|pour)/i,

  // Visio/réunion
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:organiser|planifier)\s+(?:une\s+)?(?:visio|réunion|call)\s+(?:avec\s+)?(.{1,50}?)(?:\.|$|avant|d'ici|pour)/i,
  /il (?:faut|faudrait)\s+(?:qu['']on|que tu)\s+(?:appelle|contacte)/i,
];

/**
 * Patterns pour détecter l'action FOLLOW_UP (Relancer)
 */
const FOLLOW_UP_PATTERNS = [
  // Relancer explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+relancer\s+(.{1,50}?)(?:\.|$|avant|d'ici|pour|sur)/i,
  /(?:relance|relancez)\s+(.{1,50}?)(?:\.|$|avant|d'ici|pour|sur)/i,

  // Faire un suivi
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+faire\s+(?:un\s+)?(?:suivi|point)\s+(?:sur|avec|de)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /il (?:faut|faudrait)\s+relancer\s+(.{1,50}?)(?:\.|$|sur)/i,

  // Rappel
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:me\s+)?(?:faire\s+un\s+)?rappel\s+(?:pour|sur|de)\s+(.{1,50}?)(?:\.|$|avant)/i,
  /(?:n['']oublie|n['']oubliez)\s+pas\s+de\s+(?:relancer|faire un suivi)/i,
];

/**
 * Patterns pour détecter l'action PAY (Payer)
 */
const PAY_PATTERNS = [
  // Payer explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+(?:régler|payer)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /(?:règle|réglez|paie|payez)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,

  // Facture
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:régler|payer)\s+(?:la\s+)?facture(?:\s+(.{1,30}?))?(?:\.|$|avant|d'ici)/i,
  /il (?:faut|faudrait)\s+(?:régler|payer)\s+(.{1,50}?)(?:\.|$|avant)/i,

  // Virement
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+faire\s+(?:un\s+)?virement\s+(?:de|pour)\s+(.{1,50}?)(?:\.|$|avant)/i,
];

/**
 * Patterns pour détecter l'action VALIDATE (Valider)
 */
const VALIDATE_PATTERNS = [
  // Valider explicite
  /(?:peux-tu|pourrais-tu|pourriez-vous|merci de|veuillez)\s+valider\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /(?:valide|validez)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /il (?:faut|faudrait)\s+(?:aussi\s+)?valider\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,

  // Approuver/confirmer
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:approuver|confirmer)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  /(?:approuve|approuvez|confirme|confirmez)\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,

  // Donner avis/OK
  /(?:peux-tu|pourrais-tu|pourriez-vous)\s+(?:me\s+)?(?:donner\s+(?:ton|votre)\s+)?(?:avis|OK|accord|validation)\s+(?:sur|pour)\s+(.{1,50}?)(?:\.|$|avant)/i,
  /il (?:faut|faudrait)\s+(?:que tu|qu['']on)\s+valide/i,
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
    /notifications?@/i,
    /newsletter@/i,
    /info@/i,
    /contact@/i,
    /support@/i,
    /automated@/i,
    /bounce@/i,
    /mailer-daemon@/i,
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
 * Patterns conditionnels (phrases qui peuvent annuler une action)
 */
const CONDITIONAL_PATTERNS = [
  /si\s+(?:tu\s+)?(?:peux|as le temps|c['']est possible)/i,
  /(?:quand|lorsque)\s+tu\s+(?:auras|as)\s+(?:le\s+)?temps/i,
  /si\s+jamais/i,
  /éventuellement/i,
];

// ============================================================================
// DÉTECTION DE DATES D'ÉCHÉANCE
// ============================================================================

/**
 * Patterns pour extraire les dates d'échéance
 */
const DEADLINE_PATTERNS = [
  // Relatif
  { pattern: /avant\s+(?:le\s+)?(\d{1,2})\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i, type: "absolute" },
  { pattern: /pour\s+(?:le\s+)?(\d{1,2})\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i, type: "absolute" },
  { pattern: /d['']ici\s+(?:le\s+)?(\d{1,2})\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)/i, type: "absolute" },

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
  { pattern: /(?:en\s+)?fin\s+de\s+journée/i, type: "end_of_day" },

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
  janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11,
};

const WEEKDAY_NAMES: { [key: string]: number } = {
  lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6, dimanche: 0,
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
        // Avant midi → 12h aujourd'hui
        const date = new Date(now);
        date.setHours(12, 0, 0, 0);
        return date;
      }

      case "this_morning": {
        // Ce matin → 12h aujourd'hui
        const date = new Date(now);
        date.setHours(12, 0, 0, 0);
        return date;
      }

      case "this_afternoon": {
        // Cet après-midi → 18h aujourd'hui
        const date = new Date(now);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "this_evening": {
        // Ce soir → 20h aujourd'hui
        const date = new Date(now);
        date.setHours(20, 0, 0, 0);
        return date;
      }

      case "end_of_day": {
        // Fin de journée → 18h aujourd'hui
        const date = new Date(now);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "today": {
        // Aujourd'hui → 18h aujourd'hui
        const date = new Date(now);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "tomorrow": {
        // Demain → 18h demain
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(18, 0, 0, 0);
        return tomorrow;
      }

      case "days": {
        // Dans X jours → 18h
        const days = parseInt(match[1]);
        const date = new Date(now);
        date.setDate(date.getDate() + days);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "weeks": {
        // Dans X semaines → 18h
        const weeks = parseInt(match[1]);
        const date = new Date(now);
        date.setDate(date.getDate() + weeks * 7);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "weekday": {
        // Jour de la semaine spécifique → 18h
        const targetWeekday = WEEKDAY_NAMES[match[1].toLowerCase()];
        const currentWeekday = now.getDay();
        let daysToAdd = targetWeekday - currentWeekday;
        if (daysToAdd <= 0) daysToAdd += 7; // Prochaine occurrence
        const date = new Date(now);
        date.setDate(date.getDate() + daysToAdd);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "end_of_week": {
        // Fin de semaine → Vendredi 18h
        const date = new Date(now);
        const daysToFriday = 5 - now.getDay();
        date.setDate(date.getDate() + (daysToFriday >= 0 ? daysToFriday : 7 + daysToFriday));
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "end_of_month": {
        // Fin du mois → Dernier jour à 18h
        const date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "this_week": {
        // Cette semaine → Vendredi 18h
        const date = new Date(now);
        const daysToFriday = 5 - now.getDay();
        date.setDate(date.getDate() + (daysToFriday >= 0 ? daysToFriday : 0));
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "next_week": {
        // Semaine prochaine → Lundi suivant 18h
        const date = new Date(now);
        const daysToNextMonday = 8 - now.getDay();
        date.setDate(date.getDate() + daysToNextMonday);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "this_month": {
        // Ce mois → Fin du mois à 18h
        const date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        date.setHours(18, 0, 0, 0);
        return date;
      }

      case "absolute": {
        // Date absolue (ex: "15 mars") → 18h
        const day = parseInt(match[1]);
        const monthName = match[0].match(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/i)?.[0].toLowerCase();
        if (!monthName) return null;

        const month = MONTH_NAMES[monthName];
        const year = now.getFullYear();

        // Si le mois est passé cette année, prendre l'année suivante
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
  // Vérifier l'expéditeur
  for (const pattern of EXCLUSION_PATTERNS.fromExclusions) {
    if (pattern.test(context.from)) {
      return true;
    }
  }

  // Vérifier le sujet
  if (context.subject) {
    for (const pattern of EXCLUSION_PATTERNS.subjectExclusions) {
      if (pattern.test(context.subject)) {
        return true;
      }
    }
  }

  // Vérifier le contenu
  for (const pattern of EXCLUSION_PATTERNS.bodyExclusions) {
    if (pattern.test(context.body)) {
      return true;
    }
  }

  return false;
}

/**
 * Vérifie si la phrase contient une condition qui annule l'action
 */
function hasConditional(sentence: string): boolean {
  for (const pattern of CONDITIONAL_PATTERNS) {
    if (pattern.test(sentence)) {
      return true;
    }
  }
  return false;
}

// ============================================================================
// EXTRACTION D'ACTIONS
// ============================================================================

/**
 * Nettoie une phrase en enlevant les tirets, guillemets, etc.
 */
function cleanSentence(sentence: string): string {
  return sentence
    .trim()
    // Enlever les tirets au début
    .replace(/^[-•*]\s*/, "")
    // Enlever les guillemets au début et à la fin
    .replace(/^["'"«»]\s*/, "")
    .replace(/\s*["'"«»]$/, "")
    .trim();
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

  // Découper en phrases : par ponctuation ET par retours à la ligne
  const lines = context.body.split(/\n/);
  const sentences: string[] = [];

  for (const line of lines) {
    // Splitter chaque ligne par ponctuation aussi
    const lineSentences = line.split(/[.!?]\s+/);
    sentences.push(...lineSentences);
  }

  for (let sentence of sentences) {
    // Nettoyer la phrase
    sentence = cleanSentence(sentence);

    // Ignorer les phrases trop courtes ou trop longues
    if (sentence.length < 10 || sentence.length > 500) continue;

    // Vérifier si la phrase contient une condition
    if (hasConditional(sentence)) continue;

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (!match) continue;

      // Extraire l'objet de l'action (groupe de capture)
      const object = match[1]?.trim() || "";

      // Créer le titre de l'action
      let title = "";
      switch (type) {
        case "SEND":
          title = object ? `Envoyer ${object}` : "Envoyer un document";
          break;
        case "CALL":
          title = object ? `Appeler ${object}` : "Appeler";
          break;
        case "FOLLOW_UP":
          title = object ? `Relancer ${object}` : "Faire un suivi";
          break;
        case "PAY":
          title = object ? `Payer ${object}` : "Effectuer un paiement";
          break;
        case "VALIDATE":
          title = object ? `Valider ${object}` : "Valider";
          break;
      }

      // Limiter le titre à 100 caractères
      if (title.length > 100) {
        title = title.substring(0, 97) + "...";
      }

      // Extraire la phrase source (max 200 caractères)
      let sourceSentence = sentence.trim();
      if (sourceSentence.length > 200) {
        sourceSentence = sourceSentence.substring(0, 197) + "...";
      }

      // Extraire la date d'échéance
      const dueDate = parseDueDate(sentence, context.receivedAt);

      actions.push({
        title,
        type,
        sourceSentence,
        dueDate,
      });

      // Une seule action par phrase
      break;
    }
  }

  return actions;
}

/**
 * Fonction principale d'extraction d'actions depuis un email
 * Règle : Si ambigu → aucune action
 */
export function extractActionsFromEmail(context: EmailContext): ExtractedAction[] {
  // Vérifier les exclusions
  if (shouldExcludeEmail(context)) {
    return [];
  }

  const actions: ExtractedAction[] = [];

  // Extraire chaque type d'action
  actions.push(...extractActionsByType("SEND", SEND_PATTERNS, context));
  actions.push(...extractActionsByType("CALL", CALL_PATTERNS, context));
  actions.push(...extractActionsByType("FOLLOW_UP", FOLLOW_UP_PATTERNS, context));
  actions.push(...extractActionsByType("PAY", PAY_PATTERNS, context));
  actions.push(...extractActionsByType("VALIDATE", VALIDATE_PATTERNS, context));

  // Dédupliquer les actions similaires
  const uniqueActions = deduplicateActions(actions);

  return uniqueActions;
}

/**
 * Déduplique les actions similaires (même titre et source)
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
