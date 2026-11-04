import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/image-resize";

describe("fitWithin", () => {
  it("shrinks a landscape photo to 1600 on the long edge", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  it("shrinks a portrait photo to 1600 on the long edge", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("does not scale up small images", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("respects a custom max and keeps at least 1 px", () => {
    expect(fitWithin(1000, 500, 100)).toEqual({ width: 100, height: 50 });
    expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 });
  });

  it("rejects invalid sizes", () => {
    expect(() => fitWithin(0, 100)).toThrow(RangeError);
    expect(() => fitWithin(100, NaN)).toThrow(RangeError);
  });
});
