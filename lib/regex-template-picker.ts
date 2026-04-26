/**
 * Helpers du picker templates regex métier (UI Step 2/3 regex-power).
 *
 * Voir docs/features/regex-power.md (US-6).
 */

import type { DialogState } from "@/lib/custom-action-types/dialog-state";
import type {
  RegexTemplate,
  RegexTemplateCategory,
} from "@/lib/regex-templates";

export type GroupedTemplates = Partial<Record<RegexTemplateCategory, RegexTemplate[]>>;

/**
 * Groupe une liste de templates par catégorie en préservant l'ordre source.
 */
export function groupTemplatesByCategory(
  templates: ReadonlyArray<RegexTemplate>
): GroupedTemplates {
  const grouped: GroupedTemplates = {};
  for (const tpl of templates) {
    const bucket = grouped[tpl.category];
    if (bucket) {
      bucket.push(tpl);
    } else {
      grouped[tpl.category] = [tpl];
    }
  }
  return grouped;
}

/**
 * Applique un template au state du dialog :
 *   - force `mode: "REGEX"` (clear keywords)
 *   - écrase pattern + color avec ceux du template
 *   - pré-remplit `name` SEULEMENT si vide / whitespace (préserve choix user)
 *   - préserve `isActive`
 */
export function applyTemplateToState(
  state: DialogState,
  template: RegexTemplate
): DialogState {
  const nameIsEmpty = state.name.trim().length === 0;
  return {
    ...state,
    mode: "REGEX",
    keywords: [],
    regexPattern: template.pattern,
    color: template.color,
    name: nameIsEmpty ? template.name : state.name,
  };
}
