import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt — no external dependencies.
 * Stored format: "<saltHex>:<derivedKeyHex>".
 */
const KEY_LENGTH = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(plain, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(":");
  if (!salt || !keyHex) return false;

  const storedKey = Buffer.from(keyHex, "hex");
  const candidate = scryptSync(plain, salt, KEY_LENGTH);
  // Constant-time comparison to avoid timing attacks.
  return (
    storedKey.length === candidate.length &&
    timingSafeEqual(storedKey, candidate)
  );
}
