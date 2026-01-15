#!/usr/bin/env tsx

/**
 * Script de debug pour l'exemple 6
 */

import { extractActionsFromEmail, EmailContext } from "../lib/actions/extract-actions-regex";

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

console.log("=== DEBUG EXAMPLE 6 ===\n");
console.log("Email body:");
console.log(example6.body);
console.log("\n--- Sentence splitting ---");

const sentences = example6.body
  .split(/\.\s+/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && s.length <= 500);

sentences.forEach((sentence, i) => {
  console.log(`\nSentence ${i + 1}:`);
  console.log(`"${sentence}"`);
  console.log(`Length: ${sentence.length}`);

  // Test VALIDATE patterns
  const validatePattern = /il faut(?:rait)?\s+(?:aussi\s+)?valider\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i;
  const match = sentence.match(validatePattern);
  console.log(`Matches VALIDATE pattern: ${match ? 'YES' : 'NO'}`);
  if (match) {
    console.log(`Captured: "${match[1]}"`);
  }
});

console.log("\n--- Actions extracted ---");
const actions = extractActionsFromEmail(example6);
console.log(`Total actions: ${actions.length}`);
actions.forEach((action, i) => {
  console.log(`\n${i + 1}. [${action.type}] ${action.title}`);
  console.log(`   Source: "${action.sourceSentence}"`);
});
