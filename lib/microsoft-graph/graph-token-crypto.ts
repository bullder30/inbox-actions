/**
 * Chiffrement des tokens OAuth Microsoft Graph stockes en BDD.
 *
 * Pattern aligne sur lib/imap/imap-credentials.ts (AES-256-CBC, IV
 * aleatoire prefixe). Cle distincte (`GRAPH_MASTER_KEY`) pour permettre
 * une rotation independante des credentials IMAP.
 *
 * Format en BDD : "ivHex:cipherHex" (avec separateur ':')
 * Migration : isEncryptedToken() detecte les tokens plain-text legacy.
 *
 * Voir security-audit.md M-1 pour le rationale.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const ENCRYPTED_PREFIX_LENGTH = IV_LENGTH * 2 + 1; // 32 hex chars + ':'

function getMasterKey(): Buffer {
  const masterKeyHex = process.env.GRAPH_MASTER_KEY;
  if (!masterKeyHex) {
    throw new Error(
      "GRAPH_MASTER_KEY environment variable is not set. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  if (masterKeyHex.length !== 64) {
    throw new Error("GRAPH_MASTER_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(masterKeyHex, "hex");
}

/**
 * Chiffre un token OAuth pour stockage securise en BDD.
 * @returns Token chiffre au format "ivHex:cipherHex"
 */
export function encryptToken(plainToken: string): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, new Uint8Array(masterKey), new Uint8Array(iv));
  let encrypted = cipher.update(plainToken, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

/**
 * Dechiffre un token recupere depuis la BDD. Throw si format invalide
 * ou cle inadequate.
 */
export function decryptToken(encryptedToken: string): string {
  const masterKey = getMasterKey();
  const parts = encryptedToken.split(":");
  if (parts.length !== 2) throw new Error("Invalid encrypted token format");
  const [ivHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  if (iv.length !== IV_LENGTH) throw new Error("Invalid IV length");
  const decipher = crypto.createDecipheriv(ALGORITHM, new Uint8Array(masterKey), new Uint8Array(iv));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Detecte si une chaine est un token chiffre (format "ivHex:cipherHex" avec
 * 32 chars hex avant le ':'). Permet la migration progressive : un token
 * legacy plain-text retourne false et reste utilisable comme tel.
 */
export function isEncryptedToken(value: string | null | undefined): boolean {
  if (!value || value.length < ENCRYPTED_PREFIX_LENGTH) return false;
  if (value[IV_LENGTH * 2] !== ":") return false;
  // Verifie que les 32 premiers chars sont hex
  return /^[0-9a-f]{32}$/i.test(value.slice(0, IV_LENGTH * 2));
}

/**
 * Lit un token : dechiffre si chiffre, sinon retourne tel quel (legacy).
 * Utiliser pour les reads transitionnels pendant la migration.
 */
export function readToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (isEncryptedToken(stored)) {
    try {
      return decryptToken(stored);
    } catch (err) {
      console.error("[GraphTokenCrypto] Failed to decrypt token:", err);
      return null;
    }
  }
  // Format legacy plain-text — toleree pendant la migration. La couche appelante
  // doit re-encrypter au prochain refresh.
  return stored;
}
