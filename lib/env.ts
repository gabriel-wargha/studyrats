export class MissingEnvError extends Error {
  readonly varName: string;

  constructor(varName: string) {
    super(`Missing required environment variable: ${varName}`);
    this.name = "MissingEnvError";
    this.varName = varName;
  }
}

/** Reads an env var when called (never at import). Throws if unset or empty. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new MissingEnvError(name);
  return value;
}
