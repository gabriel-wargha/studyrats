import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/image-size";

describe("fitWithin", () => {
  it("shrinks a landscape photo to 1600 on the long edge", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
  });

  it("shrinks a portrait photo to 1600 on the long edge", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: 1600 });
  });

  it("never scales up small images", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("keeps extreme panoramas at least 1 px thick", () => {
    expect(fitWithin(100000, 10)).toEqual({ width: 1600, height: 1 });
  });

  it("handles bad sizes without throwing", () => {
    expect(fitWithin(0, 0)).toEqual({ width: 1, height: 1 });
    expect(fitWithin(NaN, 10)).toEqual({ width: 1, height: 1 });
  });
});
