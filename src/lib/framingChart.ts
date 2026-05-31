// Framing-chart export: ASC Framing Decision List (FDL) generation, a minimal
// baseline TIFF encoder, and small download helpers.
//
// FDL reference: ASC Framing Decision List v1.0/v2.0 (https://github.com/ascmitc/fdl).
// Geometry mirrors the canonical ASC sample FramingChart files:
//   • protection rectangle = largest target-aspect rect that fits in the canvas, centered
//   • framing rectangle      = protection rect reduced by the protection fraction, centered
// All dimensions/anchors are in the canvas's RECORDED pixel space; the
// anamorphic squeeze is recorded separately so tools can desqueeze.

import type { SourceFormat, TargetContainer } from "@/lib/formats";

export type FdlAspectRatio = { width: number; height: number };
export type FdlXY = { x: number; y: number };
export type FdlWH = { width: number; height: number };

export type FdlFramingIntent = {
  label: string;
  id: string;
  aspect_ratio: FdlAspectRatio;
  protection: number;
};

export type FdlFramingDecision = {
  label: string;
  id: string;
  framing_intent_id: string;
  dimensions: FdlWH;
  anchor_point: FdlXY;
  protection_dimensions: FdlWH;
  protection_anchor_point: FdlXY;
};

export type FdlCanvas = {
  label: string;
  id: string;
  source_canvas_id: string;
  dimensions: FdlWH;
  anamorphic_squeeze: number;
  framing_decisions: FdlFramingDecision[];
};

export type FdlContext = {
  label: string;
  context_creator: string;
  canvases: FdlCanvas[];
};

export type Fdl = {
  uuid: string;
  version: { major: number; minor: number };
  fdl_creator: string;
  default_framing_intent: string;
  framing_intents: FdlFramingIntent[];
  contexts: FdlContext[];
};

export type FramingChartParams = {
  source: SourceFormat;
  target: TargetContainer;
  /** Total protection fraction (0–1): the framing rect is (1 − protection) of the
   *  full target-aspect rectangle, inset symmetrically. e.g. 0.10 = 10% total. */
  protection?: number;
  creator?: string;
  /** Optional secondary delivery crop AR (e.g. 2.0 for 2:1) carried as a second
   *  framing intent/decision, fit inside the primary final frame. */
  secondaryCropAR?: number | null;
};

const GCD = (a: number, b: number): number => (b === 0 ? a : GCD(b, a % b));

/** Reduce a width:height pair to its smallest integer ratio (e.g. 3840×2160 → 16×9). */
export function reduceRatio(width: number, height: number): FdlAspectRatio {
  const w = Math.round(width);
  const h = Math.round(height);
  const g = GCD(w, h) || 1;
  return { width: w / g, height: h / g };
}

/** Stable-ish UUID (uses crypto when available, else a v4-shaped fallback). */
export function makeUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Largest rect of aspect `arRecorded` (W/H) fitting inside `W×H`. */
function fitRect(arRecorded: number, W: number, H: number): FdlWH {
  let width = W;
  let height = W / arRecorded;
  if (height > H) {
    height = H;
    width = H * arRecorded;
  }
  return { width, height };
}

/**
 * Build a spec-compliant ASC FDL describing the current framing on the source.
 * The deliverable aspect ratio (target) is the framing intent; the source
 * sensor mode is the canvas. Geometry is computed in recorded pixels.
 */
export function buildFdl({
  source,
  target,
  protection = 0,
  creator = "LuminaFox Frame Matrix",
  secondaryCropAR = null,
}: FramingChartParams): Fdl {
  const W = source.width;
  const H = source.height;
  const sq = source.squeeze || 1;

  // The FINAL FRAME is the delivered (active) picture aspect; PROTECTION is the
  // full container aspect. For a letterbox deliverable like "2:1 in 16:9" the
  // active area is 2:1 but the container is 16:9, so protection is taller than
  // the final frame (different aspects). For a plain 16:9 target the two match.
  // All converted to recorded-pixel aspect via /squeeze.
  const activeW = target.activeWidth ?? target.width;
  const activeH = target.activeHeight ?? target.height;
  const activeAR = activeW / activeH / sq;
  const containerAR = target.width / target.height / sq;

  const activeFit = fitRect(activeAR, W, H);
  const containerFit = fitRect(containerAR, W, H);

  // Protection encloses the active extraction (container aspect, never smaller).
  const protW = Math.round(Math.max(containerFit.width, activeFit.width));
  const protH = Math.round(Math.max(containerFit.height, activeFit.height));
  const protX = Math.round((W - protW) / 2);
  const protY = Math.round((H - protH) / 2);

  // Final frame = active extraction, inset by the protection % for reframe headroom.
  const p = Math.max(0, Math.min(0.9, protection));
  const frmW = Math.round(activeFit.width * (1 - p));
  const frmH = Math.round(activeFit.height * (1 - p));
  const frmX = Math.round((W - frmW) / 2);
  const frmY = Math.round((H - frmH) / 2);

  const deliverW = activeW;
  const deliverH = activeH;

  const ratio = reduceRatio(deliverW, deliverH);
  const intentId = "1";
  const canvasId = "1";

  const framingIntents: FdlFramingIntent[] = [
    { label: target.name, id: intentId, aspect_ratio: ratio, protection: p },
  ];
  const framingDecisions: FdlFramingDecision[] = [
    {
      label: target.name,
      id: `${canvasId}-${intentId}`,
      framing_intent_id: intentId,
      dimensions: { width: frmW, height: frmH },
      anchor_point: { x: frmX, y: frmY },
      protection_dimensions: { width: protW, height: protH },
      protection_anchor_point: { x: protX, y: protY },
    },
  ];

  // Secondary delivery crop (e.g. 2:1) — a second intent fit inside the final frame.
  if (secondaryCropAR && secondaryCropAR > 0) {
    const recCropAR = secondaryCropAR / sq;
    const frameAR = frmW / frmH;
    let cw = frmW;
    let ch = frmW / recCropAR;
    if (recCropAR < frameAR) { ch = frmH; cw = frmH * recCropAR; }
    cw = Math.round(cw);
    ch = Math.round(ch);
    const cx = Math.round((W - cw) / 2);
    const cy = Math.round((H - ch) / 2);
    const cropLabel = `Secondary ${secondaryCropAR.toFixed(2)}:1`;
    framingIntents.push({
      label: cropLabel,
      id: "2",
      aspect_ratio: reduceRatio(Math.round(secondaryCropAR * 1000), 1000),
      protection: 0,
    });
    framingDecisions.push({
      label: cropLabel,
      id: `${canvasId}-2`,
      framing_intent_id: "2",
      dimensions: { width: cw, height: ch },
      anchor_point: { x: cx, y: cy },
      protection_dimensions: { width: cw, height: ch },
      protection_anchor_point: { x: cx, y: cy },
    });
  }

  return {
    uuid: makeUuid(),
    version: { major: 2, minor: 0 },
    fdl_creator: creator,
    default_framing_intent: intentId,
    framing_intents: framingIntents,
    contexts: [
      {
        label: source.camera,
        context_creator: creator,
        canvases: [
          {
            label: source.mode,
            id: canvasId,
            source_canvas_id: canvasId,
            dimensions: { width: W, height: H },
            anamorphic_squeeze: sq,
            framing_decisions: framingDecisions,
          },
        ],
      },
    ],
  };
}

export function fdlToJson(fdl: Fdl): string {
  return JSON.stringify(fdl, null, 2);
}

// --- TIFF LZW compression (TIFF 6.0, MSB-first, early code-width change) -----
// Integer-keyed dictionary for speed on multi-megapixel images.
export function lzwCompress(data: Uint8Array): Uint8Array {
  const CLEAR = 256;
  const EOI = 257;

  const out: number[] = [];
  let acc = 0;
  let accBits = 0;
  const emit = (code: number, width: number) => {
    acc = (acc << width) | code;
    accBits += width;
    while (accBits >= 8) {
      accBits -= 8;
      out.push((acc >>> accBits) & 0xff);
    }
  };
  const flush = () => {
    if (accBits > 0) {
      out.push((acc << (8 - accBits)) & 0xff);
      accBits = 0;
      acc = 0;
    }
  };

  let dict = new Map<number, number>();
  let codeWidth = 9;
  let nextCode = 258;
  const reset = () => {
    dict = new Map();
    codeWidth = 9;
    nextCode = 258;
  };

  reset();
  emit(CLEAR, codeWidth);

  if (data.length === 0) {
    emit(EOI, codeWidth);
    flush();
    return new Uint8Array(out);
  }

  let omega = data[0];
  for (let i = 1; i < data.length; i++) {
    const k = data[i];
    const key = omega * 256 + k; // unique per (prefix-code, byte)
    const found = dict.get(key);
    if (found !== undefined) {
      omega = found;
    } else {
      emit(omega, codeWidth);
      dict.set(key, nextCode++);
      omega = k;
      // Widen at the power-of-two boundary (the convention Apple ImageIO /
      // libtiff decoders expect); clear and restart once 12-bit codes fill.
      if (nextCode === 1 << codeWidth) {
        if (codeWidth < 12) {
          codeWidth++;
        } else {
          emit(CLEAR, 12);
          reset();
        }
      }
    }
  }
  emit(omega, codeWidth);
  emit(EOI, codeWidth);
  flush();
  return new Uint8Array(out);
}

// --- Minimal baseline TIFF encoder -----------------------------------------
// 8-bit RGB, single strip, little-endian (Baseline TIFF 6.0). Defaults to LZW
// (Compression=5); pass { compress: false } for uncompressed (Compression=1).
// `rgba` is the canvas's RGBA byte array (length = w*h*4); alpha is dropped.
export function encodeTiff(
  width: number,
  height: number,
  rgba: Uint8ClampedArray | Uint8Array,
  opts: { compress?: boolean } = {},
): Uint8Array {
  const compress = opts.compress !== false;
  const samplesPerPixel = 3;

  // Pack RGB (drop alpha).
  const rgb = new Uint8Array(width * height * samplesPerPixel);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }

  const strip = compress ? lzwCompress(rgb) : rgb;
  const stripBytes = strip.length;

  const numEntries = 10;
  const headerSize = 8;
  const ifdSize = 2 + numEntries * 12 + 4; // count + entries + nextIFD offset
  const bitsArrayOffset = headerSize + ifdSize; // 3 SHORTs (6 bytes) live here
  const bitsArraySize = 6;
  const stripOffset = bitsArrayOffset + bitsArraySize;
  const total = stripOffset + stripBytes;

  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const LE = true;

  // Header
  dv.setUint16(0, 0x4949, LE); // "II" little-endian
  dv.setUint16(2, 42, LE); // magic
  dv.setUint32(4, headerSize, LE); // offset to IFD

  let o = headerSize;
  dv.setUint16(o, numEntries, LE);
  o += 2;

  const SHORT = 3;
  const LONG = 4;
  const entry = (tag: number, type: number, count: number, value: number) => {
    dv.setUint16(o, tag, LE);
    dv.setUint16(o + 2, type, LE);
    dv.setUint32(o + 4, count, LE);
    if (type === SHORT && count === 1) {
      dv.setUint16(o + 8, value, LE); // SHORTs left-justified in the 4-byte field
      dv.setUint16(o + 10, 0, LE);
    } else {
      dv.setUint32(o + 8, value, LE);
    }
    o += 12;
  };

  entry(256, LONG, 1, width); // ImageWidth
  entry(257, LONG, 1, height); // ImageLength
  entry(258, SHORT, 3, bitsArrayOffset); // BitsPerSample → [8,8,8]
  entry(259, SHORT, 1, compress ? 5 : 1); // Compression: 5=LZW, 1=none
  entry(262, SHORT, 1, 2); // PhotometricInterpretation = RGB
  entry(273, LONG, 1, stripOffset); // StripOffsets
  entry(277, SHORT, 1, samplesPerPixel); // SamplesPerPixel
  entry(278, LONG, 1, height); // RowsPerStrip
  entry(279, LONG, 1, stripBytes); // StripByteCounts
  entry(284, SHORT, 1, 1); // PlanarConfiguration = chunky

  dv.setUint32(o, 0, LE); // next IFD = none
  o += 4;

  // BitsPerSample array [8,8,8]
  dv.setUint16(bitsArrayOffset, 8, LE);
  dv.setUint16(bitsArrayOffset + 2, 8, LE);
  dv.setUint16(bitsArrayOffset + 4, 8, LE);

  // Strip data
  new Uint8Array(buf, stripOffset, stripBytes).set(strip);

  return new Uint8Array(buf);
}

/** Trigger a browser download for an arbitrary blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Filesystem-safe slug for filenames. */
export function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
