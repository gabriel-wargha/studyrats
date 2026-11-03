import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "migrations");
const file = readdirSync(dir).find((f) => /^0000_.*\.sql$/.test(f));
const sql = file ? readFileSync(join(dir, file), "utf8") : "";

describe("migration 0000", () => {
  it("exists", () => {
    expect(file).toBeDefined();
  });

  it("creates the enums", () => {
    expect(sql).toContain('CREATE TYPE "public"."group_type"');
    expect(sql).toContain('CREATE TYPE "public"."member_role"');
    expect(sql).toContain('CREATE TYPE "public"."reaction_kind"');
  });

  it("has the partial unique index for one running timer per user", () => {
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "study_sessions_one_running_per_user" ON "study_sessions"[^;]*\("user_id"\) WHERE [^;]*"ended_at" is null/,
    );
  });

  it("has the check constraints", () => {
    for (const name of [
      "profiles_display_name_len",
      "groups_name_len",
      "study_sessions_subject_len",
      "study_sessions_minutes_range",
      "study_sessions_ended_iff_minutes",
      "study_sessions_ended_after_started",
    ]) {
      expect(sql).toContain(`CONSTRAINT "${name}" CHECK`);
    }
    expect(sql).toContain("between 0 and 360");
  });

  it("has the unique invite code and indexes", () => {
    expect(sql).toContain('CONSTRAINT "groups_invite_code_unique" UNIQUE');
    expect(sql).toContain('"memberships_user_id_idx"');
    expect(sql).toContain('"study_sessions_user_ended_idx"');
  });
});
