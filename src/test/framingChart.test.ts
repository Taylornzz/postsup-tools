import { describe, it, expect } from "vitest";
import {
  buildFdl,
  encodeTiff,
  lzwCompress,
  reduceRatio,
  fdlToJson,
  slug,
  type Fdl,
} from "@/lib/framingChart";
import type { SourceFormat, TargetContainer } from "@/lib/formats";

const src = (over: Partial<SourceFormat>): SourceFormat => ({
  id: "s",
  camera: "Test Cam",
  mode: "Test Mode",
  width: 4448,
  height: 3096,
  squeeze: 1,
  ...over,
});

const tgt = (over: Partial<TargetContainer>): TargetContainer => ({
  id: "t",
  group: "Broadcast",
  name: "UHD 4K",
  width: 3840,
  height: 2160,
  ratioLabel: "16:9",
  ...over,
});

const decision = (f: Fdl) => f.contexts[0].canvases[0].framing_decisions[0];

describe("reduceRatio", () => {
  it("reduces pixel dimensions to a minimal integer ratio", () => {
    expect(reduceRatio(3840, 2160)).toEqual({ width: 16, height: 9 });
    expect(reduceRatio(2048, 858)).toEqual({ width: 1024, height: 429 });
  });
});

describe("buildFdl — matches the canonical ASC FramingChart sample", () => {
  // ASC sample B_4448x3096_1x_FramingChart.fdl:
  //   canvas 4448×3096, 16:9 intent, protection 0.09982014388…
  //   → framing 4004×2252 @ (222,422); protection 4448×2502 @ (0,297)
  const fdl = buildFdl({
    source: src({ camera: "ARRI ALEXA Mini LF", mode: "4.5K LF Open Gate" }),
    target: tgt({ name: "16:9", width: 16, height: 9 }),
    protection: 0.09982014388499999,
  });
  const d = decision(fdl);

  it("produces the protection rectangle", () => {
    expect(d.protection_dimensions).toEqual({ width: 4448, height: 2502 });
    expect(d.protection_anchor_point).toEqual({ x: 0, y: 297 });
  });
  it("produces the framing rectangle inset by the protection fraction", () => {
    expect(d.dimensions).toEqual({ width: 4004, height: 2252 });
    expect(d.anchor_point).toEqual({ x: 222, y: 422 });
  });
  it("records the framing intent and version", () => {
    expect(fdl.version).toEqual({ major: 2, minor: 0 });
    expect(fdl.framing_intents[0].aspect_ratio).toEqual({ width: 16, height: 9 });
    expect(fdl.framing_intents[0].protection).toBeCloseTo(0.09982, 4);
    expect(fdl.default_framing_intent).toBe(fdl.framing_intents[0].id);
  });
  it("records the canvas dimensions and squeeze", () => {
    const c = fdl.contexts[0].canvases[0];
    expect(c.dimensions).toEqual({ width: 4448, height: 3096 });
    expect(c.anamorphic_squeeze).toBe(1);
    expect(fdl.contexts[0].label).toBe("ARRI ALEXA Mini LF");
  });
});

describe("buildFdl — anamorphic squeeze", () => {
  it("computes the framing rect in recorded (squeezed) pixels", () => {
    // 2× anamorphic, 16:9 output → recorded aspect = 1.778/2 = 0.889 (tall).
    const fdl = buildFdl({
      source: src({ width: 4096, height: 3432, squeeze: 2 }),
      target: tgt({ width: 16, height: 9 }),
    });
    const d = decision(fdl);
    // recordedAR ≈ 0.8889 → fit in 4096×3432: height-limited.
    // width = 3432 * 0.8889 ≈ 3051, height = 3432
    expect(d.protection_dimensions.height).toBe(3432);
    expect(d.protection_dimensions.width).toBe(3051);
    expect(fdl.contexts[0].canvases[0].anamorphic_squeeze).toBe(2);
  });
  it("centers zero-protection framing on the full protection rect", () => {
    const fdl = buildFdl({ source: src({}), target: tgt({ width: 16, height: 9 }), protection: 0 });
    const d = decision(fdl);
    expect(d.dimensions).toEqual(d.protection_dimensions);
    expect(d.anchor_point).toEqual(d.protection_anchor_point);
  });
});

describe("buildFdl — letterbox deliverable (deliver 2:1, protect 16:9)", () => {
  // Final frame = 2:1 active picture; protection = the full 16:9 container,
  // which is TALLER than the 2:1 frame (different aspect ratios).
  const fdl = buildFdl({
    source: src({ width: 4448, height: 3096, squeeze: 1 }),
    target: tgt({ name: "2:1 in 16:9", width: 16, height: 9, activeWidth: 2, activeHeight: 1 }),
    protection: 0,
  });
  const d = decision(fdl);

  it("frames the 2:1 active area as the final frame", () => {
    expect(d.dimensions).toEqual({ width: 4448, height: 2224 }); // 4448/2224 = 2.0
  });
  it("protects the taller 16:9 container", () => {
    expect(d.protection_dimensions).toEqual({ width: 4448, height: 2502 }); // 4448/2502 = 1.778
  });
  it("makes protection enclose the final frame on the tall axis", () => {
    expect(d.protection_dimensions.height).toBeGreaterThan(d.dimensions.height);
    expect(d.protection_dimensions.width).toBe(d.dimensions.width);
  });
  it("records the 2:1 framing intent", () => {
    expect(fdl.framing_intents[0].aspect_ratio).toEqual({ width: 2, height: 1 });
  });
});

describe("buildFdl — secondary delivery crop", () => {
  // Primary 16:9 with a 2:1 secondary crop → a second framing intent/decision,
  // the 2:1 fit inside the 16:9 final frame.
  const fdl = buildFdl({
    source: src({ width: 4608, height: 3164, squeeze: 1 }),
    target: tgt({ name: "UHD 4K", width: 3840, height: 2160 }),
    protection: 0,
    secondaryCropAR: 2.0,
  });

  it("adds a second framing intent for the crop", () => {
    expect(fdl.framing_intents).toHaveLength(2);
    expect(fdl.framing_intents[1].aspect_ratio).toEqual({ width: 2, height: 1 });
    expect(fdl.default_framing_intent).toBe("1"); // primary stays default
  });
  it("fits the 2:1 crop inside the 16:9 final frame", () => {
    const decs = fdl.contexts[0].canvases[0].framing_decisions;
    expect(decs).toHaveLength(2);
    const crop = decs[1];
    const primary = decs[0];
    // 2:1 is wider than 16:9 → same width, shorter height, centered
    expect(crop.dimensions.width).toBe(primary.dimensions.width);
    expect(crop.dimensions.height).toBeLessThan(primary.dimensions.height);
    expect(crop.dimensions.width / crop.dimensions.height).toBeCloseTo(2.0, 1);
  });
  it("omits the second intent when no crop is set", () => {
    const plain = buildFdl({ source: src({}), target: tgt({}) });
    expect(plain.framing_intents).toHaveLength(1);
  });
});

describe("fdlToJson", () => {
  it("serializes to valid, parseable JSON", () => {
    const fdl = buildFdl({ source: src({}), target: tgt({}) });
    const parsed = JSON.parse(fdlToJson(fdl));
    expect(parsed.uuid).toMatch(/[0-9a-f-]{36}/);
    expect(parsed.contexts[0].canvases[0].framing_decisions).toHaveLength(1);
  });
});

describe("encodeTiff", () => {
  it("writes a little-endian baseline TIFF header", () => {
    const w = 2, h = 2;
    const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
    const bytes = encodeTiff(w, h, rgba);
    const dv = new DataView(bytes.buffer);
    expect(dv.getUint16(0, true)).toBe(0x4949); // "II"
    expect(dv.getUint16(2, true)).toBe(42); // magic
  });
  it("encodes width, height and RGB pixel data of the right size (uncompressed)", () => {
    const w = 3, h = 2;
    const rgba = new Uint8ClampedArray(w * h * 4);
    // first pixel red
    rgba[0] = 200; rgba[1] = 10; rgba[2] = 20; rgba[3] = 255;
    const bytes = encodeTiff(w, h, rgba, { compress: false });
    const dv = new DataView(bytes.buffer);

    // walk the IFD for ImageWidth (256) and StripOffsets (273)
    const ifd = dv.getUint32(4, true);
    const n = dv.getUint16(ifd, true);
    const tags: Record<number, number> = {};
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      tags[dv.getUint16(e, true)] = dv.getUint32(e + 8, true);
    }
    expect(tags[256]).toBe(w); // ImageWidth
    expect(tags[257]).toBe(h); // ImageLength
    expect(tags[259]).toBe(0x0001); // Compression none (SHORT left-justified)
    expect(tags[262]).toBe(0x0002); // RGB

    const stripOffset = tags[273];
    // first pixel RGB written without alpha
    expect(bytes[stripOffset]).toBe(200);
    expect(bytes[stripOffset + 1]).toBe(10);
    expect(bytes[stripOffset + 2]).toBe(20);
    // total length = strip offset + w*h*3
    expect(bytes.length).toBe(stripOffset + w * h * 3);
  });

  it("marks LZW compression and shrinks flat image data", () => {
    const w = 64, h = 64;
    const rgba = new Uint8ClampedArray(w * h * 4).fill(128); // flat gray
    const bytes = encodeTiff(w, h, rgba); // default = compressed
    const dv = new DataView(bytes.buffer);
    const ifd = dv.getUint32(4, true);
    const n = dv.getUint16(ifd, true);
    const tags: Record<number, number> = {};
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      tags[dv.getUint16(e, true)] = dv.getUint32(e + 8, true);
    }
    expect(tags[259]).toBe(5); // Compression = LZW
    // strip byte count must be far smaller than the raw RGB for flat data
    expect(tags[279]).toBeLessThan(w * h * 3);
  });
});

// Spec-correct TIFF-LZW decoder (early code-width change, MSB-first) used to
// prove the encoder round-trips.
function lzwDecode(data: Uint8Array): Uint8Array {
  const CLEAR = 256;
  const EOI = 257;
  let bitPos = 0;
  const read = (width: number): number => {
    let v = 0;
    for (let i = 0; i < width; i++) {
      const byte = data[bitPos >> 3];
      const bit = (byte >> (7 - (bitPos & 7))) & 1;
      v = (v << 1) | bit;
      bitPos++;
    }
    return v;
  };

  const out: number[] = [];
  let table: number[][] = [];
  let codeWidth = 9;
  const reset = () => {
    table = [];
    for (let i = 0; i < 256; i++) table[i] = [i];
    table[CLEAR] = [];
    table[EOI] = [];
    codeWidth = 9;
  };
  reset();

  let prev: number[] | null = null;
  const totalBits = data.length * 8;
  while (bitPos + codeWidth <= totalBits) {
    // Decoder lags the encoder by one table entry, so the width increase is
    // evaluated BEFORE reading the next code (mirrors TIFF early change).
    if (table.length === (1 << codeWidth) - 1 && codeWidth < 12) codeWidth++;
    const code = read(codeWidth);
    if (code === EOI) break;
    if (code === CLEAR) {
      reset();
      prev = null;
      continue;
    }
    let entry: number[];
    if (table[code]) {
      entry = table[code];
    } else if (prev) {
      entry = [...prev, prev[0]];
    } else {
      break;
    }
    for (const b of entry) out.push(b);
    if (prev) table.push([...prev, entry[0]]);
    prev = entry;
  }
  return new Uint8Array(out);
}

describe("lzwCompress", () => {
  const roundtrip = (arr: number[]) => {
    const input = new Uint8Array(arr);
    const decoded = lzwDecode(lzwCompress(input));
    expect(Array.from(decoded)).toEqual(arr);
  };

  it("round-trips an empty buffer", () => roundtrip([]));
  it("round-trips a short sequence", () => roundtrip([1, 2, 3, 1, 2, 3, 1, 2, 3]));
  it("round-trips a flat run", () => roundtrip(new Array(5000).fill(42)));
  it("round-trips data that overflows the 12-bit table", () => {
    const a: number[] = [];
    for (let i = 0; i < 20000; i++) a.push((i * 31 + (i >> 3)) & 0xff);
    roundtrip(a);
  });
  it("round-trips pseudo-random bytes", () => {
    let seed = 12345;
    const a: number[] = [];
    for (let i = 0; i < 8000; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      a.push(seed & 0xff);
    }
    roundtrip(a);
  });
});

describe("slug", () => {
  it("makes filesystem-safe names", () => {
    expect(slug("ARRI ALEXA 35 — 4.6K")).toBe("ARRI-ALEXA-35-4.6K");
    expect(slug("Sony α7S III")).toBe("Sony-7S-III");
  });
});
