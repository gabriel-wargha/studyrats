import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { requireEnv } from "@/lib/env";

type Db = ReturnType<typeof createDb>;

function createDb() {
  const pool = new Pool({ connectionString: requireEnv("DATABASE_URL") });
  return drizzle({ client: pool });
}

let db: Db | undefined;

/** Builds the client on first call. Throws MissingEnvError if DATABASE_URL is unset. */
export function getDb(): Db {
  db ??= createDb();
  return db;
}
