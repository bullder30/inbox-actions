/**
 * Input invisible (honey-pot) à inclure dans les formulaires publics.
 *
 * Visuellement et A11y caché — un humain ne peut pas l'atteindre, mais
 * un bot scrapant le DOM le remplit. Le serveur rejette 400 si rempli.
 *
 * Usage :
 *   <form>
 *     <Input name="email" />
 *     <HoneypotInput />
 *     <button type="submit" />
 *   </form>
 *
 * Récupération côté client : `formData.get(HONEYPOT_FIELD_NAME)` ou via
 * react-hook-form `register(HONEYPOT_FIELD_NAME)`.
 */

import type { InputHTMLAttributes } from "react";

export const HONEYPOT_FIELD_NAME = "_hp_website";

interface HoneypotInputProps {
  /**
   * Props additionnels à spread sur l'input. Typiquement le résultat
   * de `register("_hp_website")` de react-hook-form. Si fourni, écrase
   * `name` et `defaultValue`.
   */
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

/**
 * Champ honey-pot anti-bot — invisible visuellement et A11y.
 * Voir lib/honeypot.ts pour la détection serveur.
 */
export function HoneypotInput({ inputProps }: HoneypotInputProps = {}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        width: "1px",
        height: "1px",
        overflow: "hidden",
      }}
    >
      <label htmlFor={HONEYPOT_FIELD_NAME}>Ne pas remplir (champ anti-spam)</label>
      <input
        type="text"
        id={HONEYPOT_FIELD_NAME}
        name={HONEYPOT_FIELD_NAME}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
        {...inputProps}
      />
    </div>
  );
}
