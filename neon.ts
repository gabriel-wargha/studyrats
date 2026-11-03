import { defineConfig } from "@neon/config/v1";

// Lakebase Postgres is part of every Neon project, so it is not declared here.
// A human runs `neon deploy` after any change to this file.
export default defineConfig({
  auth: true,
  buckets: {
    // Private: every read and write needs a credential (presigned URLs).
    // TODO(CORS): @neon/config's BucketDef has no CORS option yet (only `access`),
    // so browser PUT CORS for localhost and the Vercel domains cannot be declared here.
    photos: { access: "private" },
  },
});
