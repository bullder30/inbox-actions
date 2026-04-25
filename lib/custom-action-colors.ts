/**
 * Palette des 8 couleurs Tailwind admises pour les types custom.
 *
 * Source : docs/architecture/data-model.md
 */
export const CUSTOM_ACTION_COLORS = [
  "slate",
  "blue",
  "indigo",
  "violet",
  "pink",
  "rose",
  "orange",
  "amber",
] as const;

export type CustomActionColor = (typeof CUSTOM_ACTION_COLORS)[number];

/**
 * Mapping vers les classes Tailwind à appliquer sur un badge custom.
 */
export const colorToBadgeClasses: Record<CustomActionColor, { bg: string; text: string }> = {
  slate: {
    bg: "bg-slate-100 dark:bg-slate-900/40",
    text: "text-slate-800 dark:text-slate-300",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-300",
  },
  indigo: {
    bg: "bg-indigo-100 dark:bg-indigo-900/40",
    text: "text-indigo-800 dark:text-indigo-300",
  },
  violet: {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-800 dark:text-violet-300",
  },
  pink: {
    bg: "bg-pink-100 dark:bg-pink-900/40",
    text: "text-pink-800 dark:text-pink-300",
  },
  rose: {
    bg: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-800 dark:text-rose-300",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-800 dark:text-orange-300",
  },
  amber: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-300",
  },
};

/**
 * Sélectionne une couleur de la palette par rotation.
 *
 * @param index Indice (typiquement le nombre de types existants)
 * @returns Couleur de la palette à `index % 8`
 */
export function rotateColor(index: number): CustomActionColor {
  const safeIndex = ((index % CUSTOM_ACTION_COLORS.length) + CUSTOM_ACTION_COLORS.length) %
    CUSTOM_ACTION_COLORS.length;
  return CUSTOM_ACTION_COLORS[safeIndex];
}

/**
 * Type guard : vérifie que la valeur fournie est une couleur valide de la palette.
 */
export function isCustomActionColor(value: unknown): value is CustomActionColor {
  return typeof value === "string" && (CUSTOM_ACTION_COLORS as readonly string[]).includes(value);
}
