import { randomInt } from "node:crypto";

/** Crockford base32 without I, L, O, U. */
export const INVITE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const INVITE_CODE_LENGTH = 8;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)];
  }
  return code;
}

/** Cleans user input (case, spaces, dashes, look-alike letters). Null if not a valid code. */
export function normalizeInviteCode(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  if (cleaned.length !== INVITE_CODE_LENGTH) return null;
  for (const ch of cleaned) if (!INVITE_ALPHABET.includes(ch)) return null;
  return cleaned;
}
