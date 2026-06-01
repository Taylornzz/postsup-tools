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
  CODECS,
  computeFovDof,
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
  it("converts Mbps × seconds to decimal GB", () => {
    // 1000 Mbps for 8s = 8000 Mb = 1000 MB = 1 GB (decimal)
    expect(estimateFileSizeGB(1000, 8)).toBe(1);
    // 8000 Mbps for 1h = 3600 GB
    expect(estimateFileSizeGB(8000, 3600)).toBe(3600);
  });
  it("is zero for zero duration", () => {
    expect(estimateFileSizeGB(5000, 0)).toBe(0);
  });
});

// --- cardRuntimeMinutes -----------------------------------------------------
describe("cardRuntimeMinutes", () => {
  it("computes minutes of runtime for a card at a bitrate", () => {
    // 900 GB at 1000 Mbps = 900*8000/1000/60 = 120 min (decimal GB)
    expect(cardRuntimeMinutes(900, 1000)).toBeCloseTo(120, 6);
  });
  it("returns Infinity at non-positive bitrate", () => {
    expect(cardRuntimeMinutes(1000, 0)).toBe(Infinity);
    expect(cardRuntimeMinutes(1000, -5)).toBe(Infinity);
  });
});

// --- offloadHours -----------------------------------------------------------
describe("offloadHours", () => {
  it("scales with backup copies and bandwidth", () => {
    // 7200 GB/day × 2 copies @ 800 MB/s, 1 station = 14400*1000/800/3600 = 5.0 h
    expect(offloadHours(7200, 2, 800, 1)).toBeCloseTo(5.0, 6);
  });
  it("divides by parallel offload stations", () => {
    expect(offloadHours(7200, 2, 800, 2)).toBeCloseTo(2.5, 6);
  });
  it("defaults to a single station", () => {
    expect(offloadHours(7200, 2, 800)).toBeCloseTo(5.0, 6);
  });
  it("floors and clamps station count to at least 1", () => {
    expect(offloadHours(7200, 2, 800, 0)).toBeCloseTo(5.0, 6); // clamps to 1
    expect(offloadHours(7200, 2, 800, 2.9)).toBeCloseTo(2.5, 6); // floors to 2
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
  it("computes Sony X-OCN rates that match the published VENICE 2 figures", () => {
    // 8.6K 17:9 = 8640×4556 @ 24p → LT = 1.71 Gbps (Sony-verified), ST ≈ 2.90, XT ≈ 4.30.
    const at = (id: string) => {
      const c = CODECS.find((x) => x.id === id)!;
      return codecMbps(c, 8640, 4556, 24) / 1000; // Gbps
    };
    expect(at("sony-x-ocn-xt")).toBeCloseTo(4.3, 1);
    expect(at("sony-x-ocn-st")).toBeCloseTo(2.9, 1);
    expect(at("sony-x-ocn-lt")).toBeCloseTo(1.71, 1);
  });
  it("scales ProRes on real pixels — a taller frame is not understated", () => {
    const c = CODECS.find((x) => x.id === "arri-prores-422hq")!;
    const wide = codecMbps(c, 4096, 1716, 24); // 2.39:1
    const tall = codecMbps(c, 4096, 3416, 24); // ~6:5 — many more rows
    expect(tall).toBeGreaterThan(wide); // was equal under the old 16:9 assumption
  });
  it("reads a rate table and scales for off-table fps", () => {
    const c = codec({ rateTable: { "1920": { 24: 100, 30: 200 } } });
    expect(codecMbps(c, 1920, 1080, 24)).toBeCloseTo(100, 6); // exact row+col
    expect(codecMbps(c, 1920, 1080, 25)).toBeCloseTo(104.167, 2); // nearest fps 24, scaled ×25/24
  });
});

// --- computeExtraction ------------------------------------------------------
describe("computeExtraction", () => {
  it("FILL (cover): crops a 2.0 source into a 1:1 target", () => {
    const s = src({ width: 4000, height: 2000, squeeze: 1 }); // aspect 2.0
    const t = tgt({ width: 1000, height: 1000 }); // aspect 1.0
    const r = computeExtraction(s, t, "fill");
    expect(r.extractW).toBeCloseTo(2000, 6);
    expect(r.extractH).toBeCloseTo(2000, 6);
    expect(r.cropPctH).toBeCloseTo(0.5, 6); // half the width discarded
    expect(r.cropPctV).toBeCloseTo(0, 6);
    expect(r.usedArea).toBeCloseTo(0.5, 6);
    expect(r.scale).toBeCloseTo(0.5, 6); // 1000 deliverable ÷ 2000 extract
    expect(r.sourceAspect).toBeCloseTo(2.0, 6);
    expect(r.targetAspect).toBeCloseTo(1.0, 6);
  });
  it("FIT (contain): retains target aspect, encloses whole source with bars", () => {
    const s = src({ width: 4000, height: 2000, squeeze: 1 }); // aspect 2.0
    const t = tgt({ width: 1000, height: 1000 }); // aspect 1.0
    const r = computeExtraction(s, t, "fit");
    expect(r.extractW).toBeCloseTo(4000, 6); // full width
    expect(r.extractH).toBeCloseTo(4000, 6); // taller than source → letterbox T/B
    expect(r.extractW / r.extractH).toBeCloseTo(1.0, 6); // RETAINS the 1:1 target aspect
    expect(r.cropPctH).toBeCloseTo(0, 6); // nothing cropped
    expect(r.cropPctV).toBeCloseTo(0, 6);
    expect(r.usedArea).toBeCloseTo(1, 6); // 100% of sensor retained
    expect(r.scale).toBeCloseTo(0.25, 6); // 1000 ÷ 4000
  });
  it("FILL honours an active picture area for delivery scale", () => {
    const s = src({ width: 4000, height: 2000, squeeze: 1 });
    const t = tgt({ width: 1000, height: 1000, activeWidth: 500, activeHeight: 500 });
    const r = computeExtraction(s, t, "fill");
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
    expect(netflixStatusForCamera("Sony FX3")).toBe("approved"); // firmware 2.0, XAVC S-I 4K
    expect(netflixStatusForCamera("Sony PXW-FS7 II")).toBe("approved"); // 4K XAVC-I
  });
  it("flags limited-use cameras", () => {
    expect(netflixStatusForCamera("Canon EOS C70")).toBe("limited");
  });
  it("flags non-approved cameras", () => {
    expect(netflixStatusForCamera("Sony α7S III")).toBe("not-approved");
    expect(netflixStatusForCamera("iPhone 15 Pro")).toBe("not-approved");
    expect(netflixStatusForCamera("Nikon Z9")).toBe("not-approved"); // Nikon not a Netflix brand
    expect(netflixStatusForCamera("Fujifilm GFX100 II")).toBe("not-approved");
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

// --- computeFovDof ----------------------------------------------------------
describe("computeFovDof", () => {
  // ALEXA 35 4.6K OG sensor 27.99×19.22 mm, 35mm @ T2.8, 3 m.
  const r = computeFovDof({
    sensorWidthMm: 27.99, sensorHeightMm: 19.22, squeeze: 1,
    focalMm: 35, fNumber: 2.8, distanceM: 3,
  });
  it("computes angle of view", () => {
    expect(r.hAOV).toBeCloseTo(43.6, 0);
    expect(r.vAOV).toBeCloseTo(30.7, 0);
  });
  it("computes subject-plane coverage in metres", () => {
    expect(r.frameW).toBeCloseTo(2.4, 1);
    expect(r.frameH).toBeCloseTo(1.65, 1);
  });
  it("computes depth of field in metres", () => {
    expect(r.nearM).toBeCloseTo(2.6, 1);
    expect(r.farM).toBeCloseTo(3.54, 1);
    expect(r.dofM).toBeCloseTo(0.94, 1); // not 941 — metres, not mm
    expect(r.hyperfocalM).toBeCloseTo(19.4, 0);
  });
  it("returns infinite far focus at/over the hyperfocal", () => {
    const far = computeFovDof({ sensorWidthMm: 27.99, sensorHeightMm: 19.22, focalMm: 35, fNumber: 2.8, distanceM: 25 });
    expect(far.farM).toBe(Infinity);
    expect(far.dofM).toBe(Infinity);
  });
  it("widens horizontal AOV for anamorphic (focal ÷ squeeze)", () => {
    const sph = computeFovDof({ sensorWidthMm: 24, sensorHeightMm: 20, squeeze: 1, focalMm: 50, fNumber: 2, distanceM: 3 });
    const ana = computeFovDof({ sensorWidthMm: 24, sensorHeightMm: 20, squeeze: 2, focalMm: 50, fNumber: 2, distanceM: 3 });
    expect(ana.hAOV).toBeGreaterThan(sph.hAOV);
    expect(ana.vAOV).toBeCloseTo(sph.vAOV, 5); // vertical unchanged
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
  it("covers the core delivery groups (Broadcast / Cinema / Social)", () => {
    const groups = new Set(TARGETS.map((t) => t.group));
    expect(groups.has("Broadcast")).toBe(true);
    expect(groups.has("Cinema")).toBe(true);
    expect(groups.has("Social")).toBe(true);
  });
  it("includes modern card media (CFexpress 4.0, AXS, SxS, SD UHS-II)", () => {
    const ids = CARDS.map((c) => c.id);
    expect(ids).toContain("cfx4-1tb");
    expect(ids.some((i) => i.startsWith("axs-"))).toBe(true);
    expect(ids.some((i) => i.startsWith("sxs-"))).toBe(true);
    expect(ids.some((i) => i.startsWith("sd-uhsii-"))).toBe(true);
  });
});
