/**
 * Exemples concrets d'emails analysés par le système de regex
 * Chaque exemple montre : email → actions extraites
 */

import { extractActionsFromEmail, EmailContext } from "./extract-actions-regex";

// ============================================================================
// EXEMPLES POSITIFS (emails avec actions détectées)
// ============================================================================

/**
 * Exemple 1 : SEND - Demande simple d'envoi
 */
const example1: EmailContext = {
  from: "boss@company.com",
  subject: "Rapport Q4",
  body: `Bonjour,

Peux-tu m'envoyer le rapport Q4 avant vendredi ?

Merci,
Jean`,
  receivedAt: new Date("2026-01-06T10:00:00"),
};

/**
 * Exemple 2 : CALL - Demande de rappel
 */
const example2: EmailContext = {
  from: "client@example.com",
  subject: "Devis urgent",
  body: `Bonjour,

J'ai bien reçu votre devis.

Pourriez-vous me rappeler demain pour discuter des détails ?

Cordialement,
Marie Dupont`,
  receivedAt: new Date("2026-01-06T14:00:00"),
};

/**
 * Exemple 3 : FOLLOW_UP - Relance
 */
const example3: EmailContext = {
  from: "manager@company.com",
  subject: "Projet Alpha",
  body: `Bonjour,

Le client attend une réponse.

Peux-tu relancer l'équipe technique d'ici mercredi ?

Merci,
Sophie`,
  receivedAt: new Date("2026-01-06T09:00:00"),
};

/**
 * Exemple 4 : PAY - Paiement de facture
 */
const example4: EmailContext = {
  from: "comptabilite@company.com",
  subject: "Facture 2024-001",
  body: `Bonjour,

La facture du prestataire est arrivée.

Merci de régler la facture avant fin de mois.

Cordialement,
Service Comptabilité`,
  receivedAt: new Date("2026-01-06T11:00:00"),
};

/**
 * Exemple 5 : VALIDATE - Validation de document
 */
const example5: EmailContext = {
  from: "rh@company.com",
  subject: "Contrat nouveau stagiaire",
  body: `Bonjour,

Le contrat du nouveau stagiaire est prêt.

Peux-tu valider le contrat avant lundi ?

Merci,
RH`,
  receivedAt: new Date("2026-01-06T15:00:00"),
};

/**
 * Exemple 6 : Actions multiples dans un seul email
 */
const example6: EmailContext = {
  from: "director@company.com",
  subject: "Préparation réunion client",
  body: `Bonjour,

Pour préparer la réunion client de jeudi :

1. Peux-tu m'envoyer la présentation PowerPoint avant mercredi ?
2. Merci de rappeler le client pour confirmer l'heure.
3. Il faudrait aussi valider le budget avec la compta.

Merci,
Directeur`,
  receivedAt: new Date("2026-01-06T16:00:00"),
};

// ============================================================================
// EXEMPLES NÉGATIFS (emails SANS actions ou exclus)
// ============================================================================

/**
 * Exemple 7 : Newsletter (exclu)
 */
const example7: EmailContext = {
  from: "newsletter@techcompany.com",
  subject: "Newsletter Janvier 2026",
  body: `Bonjour,

Découvrez nos nouveautés ce mois-ci !

Pour vous désinscrire, cliquez ici.`,
  receivedAt: new Date("2026-01-06T08:00:00"),
};

/**
 * Exemple 8 : No-reply (exclu)
 */
const example8: EmailContext = {
  from: "no-reply@service.com",
  subject: "Confirmation de commande",
  body: `Bonjour,

Votre commande a été confirmée.

Ne pas répondre à cet email.`,
  receivedAt: new Date("2026-01-06T12:00:00"),
};

/**
 * Exemple 9 : Action conditionnelle (ambigu → aucune action)
 */
const example9: EmailContext = {
  from: "colleague@company.com",
  subject: "Question rapide",
  body: `Salut,

Si tu as le temps, tu pourrais m'envoyer le fichier Excel ?

Pas urgent.`,
  receivedAt: new Date("2026-01-06T13:00:00"),
};

/**
 * Exemple 10 : Information seulement (pas d'action)
 */
const example10: EmailContext = {
  from: "info@company.com",
  subject: "FYI : Nouveau process",
  body: `Bonjour,

Pour info, le nouveau process de validation est en place.

À bientôt,
Équipe Process`,
  receivedAt: new Date("2026-01-06T17:00:00"),
};

/**
 * Exemple 11 : Action faite par l'expéditeur (pas une demande)
 */
const example11: EmailContext = {
  from: "sender@company.com",
  subject: "Compte-rendu réunion",
  body: `Bonjour,

Je vais envoyer le compte-rendu à l'équipe.
Je rappellerai le client demain.

Bonne journée,
Paul`,
  receivedAt: new Date("2026-01-06T18:00:00"),
};

// ============================================================================
// FONCTION DE TEST
// ============================================================================

/**
 * Teste tous les exemples et affiche les résultats
 */
export function runExamples() {
  const examples = [
    { name: "Exemple 1 : SEND simple", context: example1, expectedCount: 1 },
    { name: "Exemple 2 : CALL rappel", context: example2, expectedCount: 1 },
    { name: "Exemple 3 : FOLLOW_UP relance", context: example3, expectedCount: 1 },
    { name: "Exemple 4 : PAY facture", context: example4, expectedCount: 1 },
    { name: "Exemple 5 : VALIDATE contrat", context: example5, expectedCount: 1 },
    { name: "Exemple 6 : Actions multiples", context: example6, expectedCount: 3 },
    { name: "Exemple 7 : Newsletter (exclu)", context: example7, expectedCount: 0 },
    { name: "Exemple 8 : No-reply (exclu)", context: example8, expectedCount: 0 },
    { name: "Exemple 9 : Conditionnel (ambigu)", context: example9, expectedCount: 0 },
    { name: "Exemple 10 : Info seulement", context: example10, expectedCount: 0 },
    { name: "Exemple 11 : Action par expéditeur", context: example11, expectedCount: 0 },
  ];

  console.log("========================================");
  console.log("TESTS D'EXTRACTION D'ACTIONS PAR REGEX");
  console.log("========================================\n");

  let passed = 0;
  let failed = 0;

  for (const { name, context, expectedCount } of examples) {
    const actions = extractActionsFromEmail(context);
    const success = actions.length === expectedCount;

    console.log(`\n${success ? "✅" : "❌"} ${name}`);
    console.log(`   Expéditeur: ${context.from}`);
    console.log(`   Sujet: ${context.subject}`);
    console.log(`   Actions détectées: ${actions.length} (attendu: ${expectedCount})`);

    if (actions.length > 0) {
      actions.forEach((action, i) => {
        console.log(`   ${i + 1}. [${action.type}] ${action.title}`);
        console.log(`      Source: "${action.sourceSentence}"`);
        if (action.dueDate) {
          console.log(`      Échéance: ${action.dueDate.toLocaleDateString("fr-FR")}`);
        }
      });
    }

    if (success) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log("\n========================================");
  console.log(`Résultats: ${passed} réussis, ${failed} échoués`);
  console.log("========================================\n");
}

// ============================================================================
// EXEMPLES DE REGEX PATTERNS
// ============================================================================

export const REGEX_DOCUMENTATION = `
# PATTERNS REGEX PAR TYPE D'ACTION

## SEND (Envoyer)
- "peux-tu m'envoyer le rapport"
- "envoie-moi la présentation"
- "merci de transmettre le document"
- "pourriez-vous faire parvenir le fichier"

## CALL (Appeler/Rappeler)
- "peux-tu me rappeler"
- "merci de rappeler le client"
- "appelle Jean demain"
- "pourriez-vous contacter Marie"

## FOLLOW_UP (Relancer)
- "peux-tu relancer l'équipe"
- "merci de faire un suivi"
- "il faut relancer le fournisseur"

## PAY (Payer)
- "peux-tu régler la facture"
- "merci de payer le prestataire"
- "il faut faire un virement"

## VALIDATE (Valider)
- "peux-tu valider le document"
- "merci d'approuver la proposition"
- "il faut confirmer le devis"

# RÈGLES D'EXCLUSION

## Expéditeurs exclus
- no-reply@*
- noreply@*
- newsletter@*
- notifications@*

## Sujets exclus
- "Newsletter"
- "Unsubscribe"
- "Confirmation de commande"
- "Votre facture"

## Conditions qui annulent l'action
- "si tu peux"
- "si tu as le temps"
- "si c'est possible"
- "éventuellement"

# DATES D'ÉCHÉANCE DÉTECTÉES

## Relatif
- "avant vendredi" → Prochain vendredi
- "d'ici lundi" → Prochain lundi
- "demain" → Jour suivant
- "dans 3 jours" → Date + 3 jours

## Absolu
- "avant le 15 janvier" → 15/01/année courante ou suivante
- "pour le 30 décembre" → 30/12/année courante ou suivante

## Périodes
- "cette semaine" → Vendredi de cette semaine
- "fin de semaine" → Vendredi
- "fin de mois" → Dernier jour du mois
`;
