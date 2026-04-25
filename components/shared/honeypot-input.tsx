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

export const HONEYPOT_FIELD_NAME = "_hp_website";

interface HoneypotInputProps {
  /** Permet de surcharger la valeur par défaut (utile en test). */
  name?: string;
}

export function HoneypotInput({ name = HONEYPOT_FIELD_NAME }: HoneypotInputProps) {
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
      <label htmlFor={name}>Ne pas remplir (champ anti-spam)</label>
      <input
        type="text"
        id={name}
        name={name}
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}
