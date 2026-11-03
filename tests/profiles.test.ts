import { describe, expect, it, vi } from "vitest";

const onConflictDoNothing = vi.fn(async () => undefined);
const values = vi.fn<(row: unknown) => unknown>(() => ({ onConflictDoNothing }));
const insert = vi.fn(() => ({ values }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ insert }) }));

import { displayNameFor, ensureProfile } from "@/server/profiles";

describe("ensureProfile", () => {
  it("upserts without overwriting", async () => {
    await ensureProfile({ id: "u1", email: "ann@b.c", name: "Ann" });
    expect(values).toHaveBeenCalledWith({ userId: "u1", displayName: "Ann" });
    expect(onConflictDoNothing).toHaveBeenCalled();
  });

  it("falls back to the email name and truncates to 40", () => {
    expect(displayNameFor({ email: "ann@b.c", name: " " })).toBe("ann");
    expect(displayNameFor({ email: "a@b.c", name: "x".repeat(60) })).toHaveLength(40);
  });
});
