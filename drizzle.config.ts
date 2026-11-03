import { defineConfig } from "drizzle-kit";

// Migrations run over the direct (unpooled) connection.
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
});
