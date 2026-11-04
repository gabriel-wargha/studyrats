import { afterEach, describe, expect, it, vi } from "vitest";
import { MissingEnvError } from "@/lib/env";
import { deleteObjectQuietly, getStorage } from "@/lib/storage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("lib/storage without env", () => {
  it("imports fine and getStorage throws MissingEnvError when called", () => {
    vi.stubEnv("AWS_ENDPOINT_URL_S3", "");
    expect(() => getStorage()).toThrow(MissingEnvError);
  });

  it("deleteObjectQuietly never throws", async () => {
    vi.stubEnv("AWS_ENDPOINT_URL_S3", "");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(deleteObjectQuietly("u/x/s/y/z.jpg")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    await expect(deleteObjectQuietly(null)).resolves.toBeUndefined();
  });
});
