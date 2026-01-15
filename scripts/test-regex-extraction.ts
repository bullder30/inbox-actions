#!/usr/bin/env tsx

/**
 * Script de test pour l'extraction d'actions par regex
 * Lance tous les exemples et affiche les résultats
 */

import { runExamples } from "../lib/actions/extract-actions-examples";

console.log("Démarrage des tests d'extraction d'actions par regex...\n");

try {
  runExamples();
} catch (error) {
  console.error("Erreur lors de l'exécution des tests:", error);
  process.exit(1);
}
