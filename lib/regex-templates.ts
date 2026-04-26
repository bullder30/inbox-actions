/**
 * Catalogue statique de templates regex métier (US-6, AC-14).
 *
 * Chaque template doit :
 *   - être safe-regex compliant (vérifié par `tests/lib/regex-templates.test.ts`)
 *   - compiler en RegExp valide avec flag "gi"
 *   - avoir un `name` unique, une `category` parmi les 4 connues
 *
 * Au MVP, le catalogue est statique (pas en DB). En V2, on pourra l'exposer
 * en DB pour permettre aux users de partager leurs templates.
 */

import type { CustomActionColor } from "@/lib/custom-action-colors";

export type RegexTemplateCategory = "Compta" | "Juridique" | "IT" | "RH";

export interface RegexTemplate {
  name: string;
  pattern: string;
  color: CustomActionColor;
  category: RegexTemplateCategory;
  // Index signature pour permettre l'introspection générique dans les tests
  // (pattern `(tpl as Record<string, unknown>)[key]`).
  [key: string]: unknown;
}

export const REGEX_TEMPLATES: ReadonlyArray<RegexTemplate> = [
  // ─── Compta ────────────────────────────────────────────────────────────────
  {
    name: "Facture FAC-XXXX",
    pattern: "FAC-\\d{4}-\\d+",
    color: "amber",
    category: "Compta",
  },
  {
    name: "Devis DEV-XXXX",
    pattern: "DEV-\\d{4}-\\d+",
    color: "amber",
    category: "Compta",
  },
  {
    name: "Numero TVA intracommunautaire",
    pattern: "FR\\d{11}",
    color: "amber",
    category: "Compta",
  },
  {
    name: "IBAN francais",
    pattern: "FR\\d{25}",
    color: "amber",
    category: "Compta",
  },

  // ─── Juridique ─────────────────────────────────────────────────────────────
  {
    name: "Reference contrat CTR-XXXX",
    pattern: "CTR-\\d{4}-\\d+",
    color: "indigo",
    category: "Juridique",
  },
  {
    name: "Numero de dossier juridique",
    pattern: "DOS-\\d{4,}",
    color: "indigo",
    category: "Juridique",
  },
  {
    name: "Reference avenant",
    pattern: "AVN-\\d{4}-\\d+",
    color: "indigo",
    category: "Juridique",
  },

  // ─── IT ────────────────────────────────────────────────────────────────────
  {
    name: "Ticket Jira PROJ-123",
    pattern: "[A-Z]{2,10}-\\d+",
    color: "blue",
    category: "IT",
  },
  {
    name: "Pull Request GitHub",
    pattern: "PR\\s?#\\d+",
    color: "blue",
    category: "IT",
  },
  {
    name: "Issue GitHub",
    pattern: "(?:issue|bug)\\s?#\\d+",
    color: "blue",
    category: "IT",
  },
  {
    name: "Incident INC-XXXX",
    pattern: "INC-\\d{4,}",
    color: "rose",
    category: "IT",
  },

  // ─── RH ────────────────────────────────────────────────────────────────────
  {
    name: "Reference candidat CAND-XXXX",
    pattern: "CAND-\\d{4,}",
    color: "violet",
    category: "RH",
  },
  {
    name: "Numero de matricule employe",
    pattern: "EMP-\\d{4,6}",
    color: "violet",
    category: "RH",
  },
  {
    name: "Demande de conge CON-XXXX",
    pattern: "CON-\\d{4}-\\d+",
    color: "pink",
    category: "RH",
  },
  {
    name: "One-to-one meeting",
    pattern: "1[\\s:-]?(?:to|on|:)?[\\s-]?1",
    color: "pink",
    category: "RH",
  },
];
