import { describe, it, expect } from "vitest";
import { LENS_KITS, nearestFocal } from "@/lib/lensKits";

describe("lens kits", () => {
  it("every kit has a sane T-stop and an ascending focal ladder", () => {
    for (const k of LENS_KITS) {
      expect(k.tStop).toBeGreaterThan(0.9);
      expect(k.tStop).toBeLessThan(5);
      expect(k.focals.length).toBeGreaterThan(3);
      for (let i = 1; i < k.focals.length; i++) {
        expect(k.focals[i]).toBeGreaterThan(k.focals[i - 1]); // strictly ascending, no dupes
      }
    }
  });

  it("nearestFocal snaps to the closest marked prime", () => {
    const mp = LENS_KITS.find((k) => k.id === "arri-master-prime")!;
    expect(nearestFocal(mp, 34)).toBe(35);
    expect(nearestFocal(mp, 11)).toBe(12);
    expect(nearestFocal(mp, 1000)).toBe(150); // longest in set
  });

  it("flags the anamorphic sets", () => {
    expect(LENS_KITS.find((k) => k.id === "cooke-anamorphic-i")!.anamorphic).toBe(true);
    expect(LENS_KITS.find((k) => k.id === "arri-master-prime")!.anamorphic).toBeFalsy();
  });
});
