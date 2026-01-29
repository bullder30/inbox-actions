import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

/**
 * Get the master key for IMAP password encryption.
 * In production, this should be a securely stored environment variable.
 */
function getMasterKey(): Buffer {
  const masterKeyHex = process.env.IMAP_MASTER_KEY;

  if (!masterKeyHex) {
    throw new Error(
      "IMAP_MASTER_KEY environment variable is not set. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  if (masterKeyHex.length !== 64) {
    throw new Error(
      "IMAP_MASTER_KEY must be a 64-character hex string (32 bytes)"
    );
  }

  return Buffer.from(masterKeyHex, "hex");
}

/**
 * Encrypt a password for secure storage in the database.
 * Uses AES-256-CBC with a random IV prepended to the ciphertext.
 *
 * @param plainPassword - The plain text password to encrypt
 * @returns The encrypted password as "iv:ciphertext" hex string
 */
export function encryptPassword(plainPassword: string): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  // Use Uint8Array for type compatibility with Node.js crypto
  const cipher = crypto.createCipheriv(ALGORITHM, new Uint8Array(masterKey), new Uint8Array(iv));
  let encrypted = cipher.update(plainPassword, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Decrypt a password retrieved from the database.
 *
 * @param encryptedPassword - The encrypted password as "iv:ciphertext" hex string
 * @returns The decrypted plain text password
 */
export function decryptPassword(encryptedPassword: string): string {
  const masterKey = getMasterKey();

  const parts = encryptedPassword.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid encrypted password format");
  }

  const [ivHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error("Invalid IV length in encrypted password");
  }

  // Use Uint8Array for type compatibility with Node.js crypto
  const decipher = crypto.createDecipheriv(ALGORITHM, new Uint8Array(masterKey), new Uint8Array(iv));
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Validate that a master key is properly configured.
 * Call this at startup to fail fast if encryption won't work.
 *
 * @returns true if the master key is valid
 * @throws Error if the master key is missing or invalid
 */
export function validateMasterKey(): boolean {
  getMasterKey();
  return true;
}

/**
 * Generate a new master key for IMAP password encryption.
 * This is a utility function for setup - the generated key should
 * be stored securely as IMAP_MASTER_KEY environment variable.
 *
 * @returns A 64-character hex string suitable for IMAP_MASTER_KEY
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
