import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SALT_LEN = 16;
const KEY_LEN = 32;

/** Hash a room password for storage (never persist plaintext). */
export function hashRoomPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(password, salt, KEY_LEN);
  return `scrypt:${salt.toString("base64")}:${hash.toString("base64")}`;
}

/** Constant-time compare of a plaintext password against a stored hash. */
export function verifyRoomPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  try {
    const salt = Buffer.from(parts[1], "base64");
    const expected = Buffer.from(parts[2], "base64");
    const actual = scryptSync(password, salt, expected.length);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function roomRequiresPassword(room: { passwordHash?: string }): boolean {
  return !!room.passwordHash;
}
