/** Crockford base32: no I, L, O or U. 32 symbols, so a random byte maps without bias. */
export const INVITE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const INVITE_CODE_LENGTH = 8;

export function generateInviteCode(): string {
  const bytes = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += INVITE_ALPHABET[b % INVITE_ALPHABET.length];
  return code;
}

/**
 * Cleans what a user typed: uppercases, drops spaces and dashes, and applies
 * the Crockford look-alike rules (I and L become 1, O becomes 0).
 */
export function normalizeInviteCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]+/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
}

export function isValidInviteCode(code: string): boolean {
  return (
    code.length === INVITE_CODE_LENGTH &&
    [...code].every((c) => INVITE_ALPHABET.includes(c))
  );
}
