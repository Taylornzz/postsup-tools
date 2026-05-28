import { describe, it, expect } from "vitest";
import {
  codecMbps,
  estimateFileSizeGB,
  cardRuntimeMinutes,
  offloadHours,
  computeExtraction,
  netflixStatusForCamera,
  lensAnamorphicMismatch,
  usedSensorDiagonalMm,
  aspectDecimalLabel,
  sourceDisplayed,
  LENSES,
  SOURCE_FORMATS,
  TARGETS,
  CARDS,
  type Codec,
  type SourceFormat,
  type TargetContainer,
} from "@/lib/formats";

// --- helpers to build minimal valid objects --------------------------------
const src = (over: Partial<SourceFormat>): SourceFormat => ({
  id: "test",
  camera: "Test Cam",
  mode: "Test Mode",
  width: 4000,
  height: 2000,
  squeeze: 1,
  ...over,
});

const tgt = (over: Partial<TargetContainer>): TargetContainer => ({
  id: "test-tgt",
  group: "Broadcast",
  name: "Test Target",
  width: 1000,
  height: 1000,
  ratioLabel: "1:1",
  ...over,
});

const codec = (over: Partial<Codec>): Codec => ({
  id: "test-codec",
  vendor: "Test",
  family: "RAW",
  name: "Test Codec",
  rateLabel: "test",
  ...over,
});

// --- estimateFileSizeGB -----------------------------------------------------
describe("estimateFileSizeGB", () => {
  it("converts Mbps × seconds to GB", () => {
    // 1024 Mbps for 8s = 8192 Mb = 1024 MB = 1 GB
    expect(estimateFileSizeGB(1024, 8)).toBe(1);
    // 8192 Mbps for 1h = 3600 GB
    expect(estimateFileSizeGB(8192, 3600)).toBe(3600);
  });
  it("is zero for zero duration", () => {
    expect(estimateFileSizeGB(5000, 0)).toBe(0);
  });
});

// --- cardRuntimeMinutes -----------------------------------------------------
describe("cardRuntimeMinutes", () => {
  it("computes minutes of runtime for a card at a bitrate", () => {
    // 900 GB at 1024 Mbps = 900*8192/1024/60 = 120 min
    expect(cardRuntimeMinutes(900, 1024)).toBeCloseTo(120, 6);
  });
  it("returns Infinity at non-positive bitrate", () => {
    expect(cardRuntimeMinutes(1024, 0)).toBe(Infinity);
    expect(cardRuntimeMinutes(1024, -5)).toBe(Infinity);
  });
});

// --- offloadHours -----------------------------------------------------------
describe("offloadHours", () => {
  it("scales with backup copies and bandwidth", () => {
    // 7200 GB/day × 2 copies @ 800 MB/s, 1 station = 5.12 h
    expect(offloadHours(7200, 2, 800, 1)).toBeCloseTo(5.12, 6);
  });
  it("divides by parallel offload stations", () => {
    expect(offloadHours(7200, 2, 800, 2)).toBeCloseTo(2.56, 6);
  });
  it("defaults to a single station", () => {
    expect(offloadHours(7200, 2, 800)).toBeCloseTo(5.12, 6);
  });
  it("floors and clamps station count to at least 1", () => {
    expect(offloadHours(7200, 2, 800, 0)).toBeCloseTo(5.12, 6); // clamps to 1
    expect(offloadHours(7200, 2, 800, 2.9)).toBeCloseTo(2.56, 6); // floors to 2
  });
  it("returns Infinity at non-positive bandwidth", () => {
    expect(offloadHours(100, 1, 0)).toBe(Infinity);
  });
});

// --- codecMbps --------------------------------------------------------------
describe("codecMbps", () => {
  it("uses bits-per-pixel model when bppx is set", () => {
    // ARRIRAW 12 bpp at 4.6K Open Gate 24p ≈ 4199 Mbps (the ~4.2 Gbps headline)
    expect(codecMbps(codec({ bppx: 12 }), 4608, 3164, 24)).toBeCloseTo(4198.957, 2);
  });
  it("scales a fixedMbps codec linearly with pixel-rate vs its reference", () => {
    const c = codec({ fixedMbps: 240, refRes: { width: 1920, height: 1080, fps: 25 } });
    expect(codecMbps(c, 1920, 1080, 25)).toBeCloseTo(240, 6); // at reference
    expect(codecMbps(c, 3840, 2160, 25)).toBeCloseTo(960, 6); // 4× the pixels
  });
  it("reads a rate table and scales for off-table fps", () => {
    const c = codec({ rateTable: { "1920": { 24: 100, 30: 200 } } });
    expect(codecMbps(c, 1920, 1080, 24)).toBeCloseTo(100, 6); // exact row+col
    expect(codecMbps(c, 1920, 1080, 25)).toBeCloseTo(104.167, 2); // nearest fps 24, scaled ×25/24
  });
});

// --- computeExtraction ------------------------------------------------------
describe("computeExtraction", () => {
  it("fit: crops a 2.0 source into a 1:1 target", () => {
    const s = src({ width: 4000, height: 2000, squeeze: 1 }); // aspect 2.0
    const t = tgt({ width: 1000, height: 1000 }); // aspect 1.0
    const r = computeExtraction(s, t, "fit");
    expect(r.extractW).toBeCloseTo(2000, 6);
    expect(r.extractH).toBeCloseTo(2000, 6);
    expect(r.cropPctH).toBeCloseTo(0.5, 6); // half the width discarded
    expect(r.cropPctV).toBeCloseTo(0, 6);
    expect(r.usedArea).toBeCloseTo(0.5, 6);
    expect(r.scale).toBeCloseTo(0.5, 6); // 1000 deliverable ÷ 2000 extract
    expect(r.sourceAspect).toBeCloseTo(2.0, 6);
    expect(r.targetAspect).toBeCloseTo(1.0, 6);
  });
  it("honours an active picture area for delivery scale", () => {
    const s = src({ width: 4000, height: 2000, squeeze: 1 });
    const t = tgt({ width: 1000, height: 1000, activeWidth: 500, activeHeight: 500 });
    const r = computeExtraction(s, t, "fit");
    expect(r.scale).toBeCloseTo(0.25, 6); // 500 deliverable ÷ 2000 extract
  });
  it("applies anamorphic squeeze to the displayed source aspect", () => {
    const s = src({ width: 2000, height: 2000, squeeze: 2 }); // displayed 4000×2000 → 2.0
    expect(sourceDisplayed(s).aspect).toBeCloseTo(2.0, 6);
  });
});

// --- netflixStatusForCamera -------------------------------------------------
describe("netflixStatusForCamera", () => {
  it("flags approved primary-capture cameras", () => {
    expect(netflixStatusForCamera("ARRI ALEXA 35")).toBe("approved");
    expect(netflixStatusForCamera("Sony VENICE 2")).toBe("approved");
    expect(netflixStatusForCamera("Sony FX9")).toBe("approved");
  });
  it("flags limited-use cameras", () => {
    expect(netflixStatusForCamera("Sony FX3")).toBe("limited");
    expect(netflixStatusForCamera("Canon EOS C70")).toBe("limited");
  });
  it("flags non-approved cameras", () => {
    expect(netflixStatusForCamera("Sony α7S III")).toBe("not-approved");
    expect(netflixStatusForCamera("iPhone 15 Pro")).toBe("not-approved");
  });
  it("returns null for reference plates", () => {
    expect(netflixStatusForCamera("Reference Plate")).toBeNull();
  });
});

// --- lensAnamorphicMismatch -------------------------------------------------
describe("lensAnamorphicMismatch", () => {
  const none = LENSES.find((l) => l.id === "none")!;
  const ana = LENSES.find((l) => l.id === "cooke-anamorphic-ffplus")!;
  const spherical = LENSES.find((l) => l.id === "zeiss-supreme-ff")!;
  const sphericalSrc = src({ squeeze: 1 });
  const anaSrc = src({ squeeze: 2 });

  it("never flags the no-lens sentinel", () => {
    expect(lensAnamorphicMismatch(none, anaSrc)).toBe(false);
  });
  it("flags anamorphic lens on a spherical capture mode", () => {
    expect(lensAnamorphicMismatch(ana, sphericalSrc)).toBe(true);
  });
  it("flags spherical lens on an anamorphic capture mode", () => {
    expect(lensAnamorphicMismatch(spherical, anaSrc)).toBe(true);
  });
  it("passes matching combinations", () => {
    expect(lensAnamorphicMismatch(ana, anaSrc)).toBe(false);
    expect(lensAnamorphicMismatch(spherical, sphericalSrc)).toBe(false);
  });
});

// --- usedSensorDiagonalMm ---------------------------------------------------
describe("usedSensorDiagonalMm", () => {
  it("computes the 3-4-5 diagonal of the full sensor", () => {
    expect(usedSensorDiagonalMm(src({ sensorWidthMm: 3, sensorHeightMm: 4 }))).toBeCloseTo(5, 6);
  });
  it("prefers the used-area dimensions when present", () => {
    const s = src({
      sensorWidthMm: 3,
      sensorHeightMm: 4,
      usedSensorWidthMm: 6,
      usedSensorHeightMm: 8,
    });
    expect(usedSensorDiagonalMm(s)).toBeCloseTo(10, 6);
  });
  it("returns null without sensor dimensions", () => {
    expect(usedSensorDiagonalMm(src({}))).toBeNull();
  });
});

// --- aspectDecimalLabel -----------------------------------------------------
describe("aspectDecimalLabel", () => {
  it("formats a ratio as N.NN:1", () => {
    expect(aspectDecimalLabel(16, 9)).toBe("1.78:1");
    expect(aspectDecimalLabel(2048, 858)).toBe("2.39:1");
  });
});

// --- data integrity ---------------------------------------------------------
describe("catalog data integrity", () => {
  it("ships a non-trivial camera catalog with unique ids", () => {
    expect(SOURCE_FORMATS.length).toBeGreaterThan(50);
    const ids = SOURCE_FORMATS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("includes IMF mastering targets", () => {
    expect(TARGETS.some((t) => t.id.startsWith("imf-"))).toBe(true);
  });
  it("includes modern card media (CFexpress 4.0, AXS, SxS, SD UHS-II)", () => {
    const ids = CARDS.map((c) => c.id);
    expect(ids).toContain("cfx4-1tb");
    expect(ids.some((i) => i.startsWith("axs-"))).toBe(true);
    expect(ids.some((i) => i.startsWith("sxs-"))).toBe(true);
    expect(ids.some((i) => i.startsWith("sd-uhsii-"))).toBe(true);
  });
});
