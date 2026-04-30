"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Sparkles } from "lucide-react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import {
  REGEX_TEMPLATES,
  type RegexTemplate,
  type RegexTemplateCategory,
} from "@/lib/regex-templates";
import { groupTemplatesByCategory } from "@/lib/regex-template-picker";
import { colorToBadgeClasses } from "@/lib/custom-action-colors";
import { cn } from "@/lib/utils";

interface RegexTemplatePickerProps {
  onSelect: (template: RegexTemplate) => void;
}

const CATEGORY_ORDER: RegexTemplateCategory[] = ["Compta", "Juridique", "IT", "RH"];

/**
 * Picker des templates regex métier (US-6 regex-power).
 *
 * Affiche un Popover groupé par catégorie. Sur sélection, appelle
 * `onSelect(template)` et ferme le Popover. Le composant parent
 * (`RegexSection` du dialog Settings) propage au state via
 * `applyTemplateToState`.
 */
export function RegexTemplatePicker({ onSelect }: RegexTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const grouped = useMemo(() => groupTemplatesByCategory(REGEX_TEMPLATES), []);

  function handleSelect(tpl: RegexTemplate) {
    onSelect(tpl);
    setOpen(false);
  }

  /**
   * Scroll PROGRAMMATIQUE de la liste au lieu de compter sur le scroll
   * natif du browser.
   *
   * Pourquoi : ce picker est rendu dans des Dialogs Radix modaux. Radix
   * Dialog attache un listener wheel (capture-phase, niveau document) qui
   * `preventDefault()` les events outside du DialogContent — ce qui
   * empeche le navigateur de scroller meme une zone scrollable interne.
   * Un simple `stopPropagation()` cote bubble n'arrive PAS a temps.
   *
   * En modifiant `scrollTop` manuellement, on contourne completement le
   * `preventDefault()` du browser. Notre script tourne quand meme dans
   * le handler React et le scroll a lieu visuellement.
   */
  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const el = contentRef.current;
    if (!el) return;
    // Pas la peine de scroll si le contenu tient deja dans la fenetre
    if (el.scrollHeight <= el.clientHeight) return;

    // Normalisation du deltaMode (rare en desktop modern, mais robuste) :
    //  - mode 0 : pixels (par defaut sur Chrome/Firefox/Safari modernes)
    //  - mode 1 : lignes (~16px par ligne)
    //  - mode 2 : pages (hauteur du viewport)
    const lineHeight = 16;
    const delta =
      e.deltaMode === 1
        ? e.deltaY * lineHeight
        : e.deltaMode === 2
        ? e.deltaY * el.clientHeight
        : e.deltaY;

    el.scrollTop += delta;
    e.stopPropagation();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="size-3.5" />
            Templates métier
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      {/*
       * IMPORTANT : on utilise <PopoverPrimitive.Content> directement (sans le
       * wrapper shadcn `PopoverContent`) pour BYPASSER le Portal.
       *
       * Pourquoi : ce picker est rendu dans des Dialogs Radix modals (settings +
       * missing-action). Quand le Dialog est `modal=true` (default), Radix isole
       * son arbre via inert/aria-hidden sur le reste du document. Un Popover
       * portalé au niveau body se retrouve "outside" du Dialog et peut perdre
       * la délégation des events wheel.
       *
       * En rendant le Popover inline (enfant DOM du DialogContent), il reste
       * dans le scope du Dialog modal et le scroll fonctionne normalement.
       *
       * Trade-off : si un parent du picker a `overflow:hidden`, le Popover peut
       * être visuellement clippé. Pas le cas ici (les Dialogs ont overflow auto).
       */}
      <PopoverPrimitive.Content
        ref={contentRef}
        align="start"
        sideOffset={4}
        // Marge minimale avec les bords du viewport (Radix collision detection).
        // Evite que le Popover colle aux bords sur mobile petit (320px viewport).
        collisionPadding={12}
        // Scroll programmatique — voir handleWheel pour le pourquoi.
        onWheel={handleWheel}
        // Touch : on arrete la propagation pour eviter que le Dialog parent
        // ne reagisse au geste. Le scroll natif tactile fonctionne
        // generalement meme dans les Dialogs (les browsers le gerent
        // differemment du wheel). Si bug remonte sur mobile, basculer
        // aussi en scroll programmatique via touchstart/touchmove.
        onTouchMove={(e) => e.stopPropagation()}
        className={cn(
          // Largeur responsive : un peu plus etroit sur mobile pour respirer
          // par rapport aux bords du viewport (sm:w-[320px] declare en suffixe
          // pour respecter l'ordre canonique tailwindcss/classnames-order).
          "z-50 max-h-80 w-[290px] overflow-y-auto overscroll-contain rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none sm:w-[320px]",
          // Scrollbar persistante (cf. globals.css) — indispensable mobile
          // ou la scrollbar overlay ne s'affiche pas avec scroll programmatique.
          "scrollbar-visible",
          "animate-in data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
        )}
      >
        {CATEGORY_ORDER.map((cat) => {
          const items = grouped[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat} className="py-1">
              <p className="sticky top-0 z-10 bg-popover px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-3">
                {cat}
              </p>
              <ul>
                {items.map((tpl) => {
                  const colors = colorToBadgeClasses[tpl.color];
                  return (
                    <li key={tpl.name}>
                      <button
                        type="button"
                        onClick={() => handleSelect(tpl)}
                        // Padding mobile : 16px gauche/droite + 10px haut/bas pour
                        // - donner de l'air au badge (sinon il colle au bord)
                        // - atteindre une touch target ≥ 44px (Apple HIG / WCAG 2.5.5)
                        // Desktop (sm+) : on resserre pour densifier la liste.
                        className="flex w-full flex-col items-start gap-1 px-4 py-2.5 text-left text-sm hover:bg-accent sm:px-3 sm:py-2"
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate font-medium">{tpl.name}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "shrink-0 text-[10px]",
                              colors.bg,
                              colors.text,
                              "border-transparent"
                            )}
                          >
                            {tpl.color}
                          </Badge>
                        </span>
                        <code className="block w-full truncate font-mono text-[11px] text-muted-foreground">
                          {tpl.pattern}
                        </code>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </PopoverPrimitive.Content>
    </Popover>
  );
}
