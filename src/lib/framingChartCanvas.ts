// Renders a framing chart to a canvas at the source's native recorded resolution.
// Shares geometry with buildFdl() so the rasterized chart (PNG/TIFF) and the
// exported FDL describe exactly the same rectangles.

import type { SourceFormat, TargetContainer } from "@/lib/formats";
import { buildFdl } from "@/lib/framingChart";

export type ChartOptions = {
  source: SourceFormat;
  target: TargetContainer;
  /** Total protection fraction (0–1). */
  protection?: number;
  showThirds?: boolean;
  showSafeArea?: boolean;
  creator?: string;
  /** Pre-loaded reference image drawn behind the guides (optional). */
  referenceImage?: HTMLImageElement | null;
  /** Optional secondary delivery crop (e.g. 2.0 for 2:1) drawn as an extra
   *  frameline INSIDE the final frame — a guide the operator also composes to. */
  secondaryCropAR?: number | null;
  secondaryCropLabel?: string;
  /** Cap the longest canvas edge to bound memory (default 8192). */
  maxEdge?: number;
};

const SENSOR_LINE = "#6b7280";
const FRAME_LINE = "#22d3ee"; // final frame — cyan
const PROTECT_LINE = "#f59e0b"; // protection — orange (band + boundary + label)
const CROP_LINE = "#c084fc"; // secondary delivery crop — violet
const SAFE_LINE = "#94a3b8"; // safe action/title — neutral slate (distinct from protection)
const TEXT = "#f5f5f7";
const TEXT_DIM = "#cbd5e1";

export function renderFramingChart(opts: ChartOptions): HTMLCanvasElement {
  const {
    source,
    target,
    protection = 0,
    showThirds = false,
    showSafeArea = false,
    creator = "Lumina Frame Matrix",
    referenceImage = null,
    secondaryCropAR = null,
    secondaryCropLabel,
    maxEdge = 8192,
  } = opts;

  // Recorded sensor resolution, capped for memory safety (preserves aspect).
  let W = source.width;
  let H = source.height;
  const longest = Math.max(W, H);
  if (longest > maxEdge) {
    const k = maxEdge / longest;
    W = Math.round(W * k);
    H = Math.round(H * k);
  }
  const scaleX = W / source.width;
  const scaleY = H / source.height;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Geometry (in source recorded px) — identical to the FDL.
  const fd = buildFdl({ source, target, protection, creator }).contexts[0].canvases[0]
    .framing_decisions[0];
  const prot = {
    x: fd.protection_anchor_point.x * scaleX,
    y: fd.protection_anchor_point.y * scaleY,
    w: fd.protection_dimensions.width * scaleX,
    h: fd.protection_dimensions.height * scaleY,
  };
  const frame = {
    x: fd.anchor_point.x * scaleX,
    y: fd.anchor_point.y * scaleY,
    w: fd.dimensions.width * scaleX,
    h: fd.dimensions.height * scaleY,
  };

  const font = Math.max(13, Math.round(H * 0.016));
  const lw = Math.max(1.5, H * 0.0016);

  // --- Clean framing-chart background (our palette, no guide image) ----------
  void referenceImage; // the export chart is intentionally clean — image stays in the live viewer
  ctx.fillStyle = "#0b0c0e"; // dark border zone
  ctx.fillRect(0, 0, W, H);
  // Neutral working-area panel inside the protection rect, so framelines, focus
  // stars and the subject's framing read clearly (our take on the ASC grey field).
  const panel = ctx.createLinearGradient(0, prot.y, 0, prot.y + prot.h);
  panel.addColorStop(0, "#2b2f36");
  panel.addColorStop(1, "#21242a");
  ctx.fillStyle = panel;
  ctx.fillRect(prot.x, prot.y, prot.w, prot.h);

  // Fine grid, confined to the working area.
  ctx.save();
  ctx.beginPath();
  ctx.rect(prot.x, prot.y, prot.w, prot.h);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  const step = Math.max(40, Math.round(W / 28));
  ctx.beginPath();
  for (let x = prot.x; x < prot.x + prot.w; x += step) { ctx.moveTo(x, prot.y); ctx.lineTo(x, prot.y + prot.h); }
  for (let y = prot.y; y < prot.y + prot.h; y += step) { ctx.moveTo(prot.x, y); ctx.lineTo(prot.x + prot.w, y); }
  ctx.stroke();
  ctx.restore();

  // Sensor border + corner ticks (slate).
  ctx.strokeStyle = SENSOR_LINE;
  ctx.lineWidth = lw;
  ctx.strokeRect(lw / 2, lw / 2, W - lw, H - lw);
  drawCornerTicks(ctx, 0, 0, W, H, Math.min(W, H) * 0.045, SENSOR_LINE, lw);

  // Inward registration triangles just inside each sensor edge.
  drawEdgeTriangles(ctx, W, H, Math.min(W, H) * 0.024, "#e5e7eb");

  // Four Siemens-star focus targets, inset from the corners so they clear the
  // FINAL FRAME label (top-left) and the title block (bottom-left).
  const starR = Math.min(prot.w, prot.h) * 0.07;
  const si = starR * 2.4;
  ([
    [prot.x + si, prot.y + si],
    [prot.x + prot.w - si, prot.y + si],
    [prot.x + si, prot.y + prot.h - si],
    [prot.x + prot.w - si, prot.y + prot.h - si],
  ] as const).forEach(([sx, sy]) => drawSiemensStar(ctx, sx, sy, starR));

  // --- Protection band = the area BETWEEN the final frame and the protection
  //     boundary. Tinted amber so it reads as reserved headroom, not picture. --
  if (protection > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(prot.x, prot.y, prot.w, prot.h);
    ctx.rect(frame.x, frame.y, frame.w, frame.h);
    ctx.fillStyle = "rgba(245,158,11,0.16)";
    ctx.fill("evenodd");
    ctx.restore();

    // Protection boundary — orange, dashed, rounded, clearly the OUTER limit.
    ctx.strokeStyle = PROTECT_LINE;
    ctx.lineWidth = lw * 1.2;
    ctx.setLineDash([font * 0.7, font * 0.45]);
    roundRectPath(ctx, prot.x, prot.y, prot.w, prot.h, Math.min(prot.w, prot.h) * 0.02);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // --- Framing rectangle = the FINAL FRAME (bright cyan, rounded, with ASC-style
  //     corner brackets + edge-center registration ticks). ---------------------
  const frameR = Math.min(frame.w, frame.h) * 0.025;
  ctx.strokeStyle = FRAME_LINE;
  ctx.lineWidth = lw * 1.6;
  roundRectPath(ctx, frame.x, frame.y, frame.w, frame.h, frameR);
  ctx.stroke();
  const brk = Math.min(frame.w, frame.h) * 0.05;
  drawCornerTicks(ctx, frame.x, frame.y, frame.w, frame.h, brk, FRAME_LINE, lw * 1.8);
  edgeCenterTicks(ctx, frame, Math.min(frame.w, frame.h) * 0.025, FRAME_LINE, lw * 1.8);

  // --- Secondary delivery crop (e.g. 2:1) — an extra guide the operator also
  //     composes to, fit inside the final frame (violet). --------------------
  if (secondaryCropAR && secondaryCropAR > 0) {
    const frameAR = frame.w / frame.h;
    let cw = frame.w;
    let ch = frame.w / secondaryCropAR;
    if (secondaryCropAR < frameAR) { ch = frame.h; cw = frame.h * secondaryCropAR; }
    const cxp = frame.x + (frame.w - cw) / 2;
    const cyp = frame.y + (frame.h - ch) / 2;
    ctx.strokeStyle = CROP_LINE;
    ctx.lineWidth = lw * 1.3;
    ctx.setLineDash([font * 0.55, font * 0.4]);
    roundRectPath(ctx, cxp, cyp, cw, ch, Math.min(cw, ch) * 0.02);
    ctx.stroke();
    ctx.setLineDash([]);
    label(
      ctx,
      `CROP · ${secondaryCropLabel ?? `${secondaryCropAR.toFixed(2)}:1`}`,
      cxp + font * 0.4,
      cyp + font * 0.4,
      font * 0.85,
      CROP_LINE,
    );
  }

  // Thirds inside the framing rect
  if (showThirds) {
    ctx.strokeStyle = "rgba(34,211,238,0.45)";
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    for (let i = 1; i <= 2; i++) {
      const x = frame.x + (frame.w * i) / 3;
      const y = frame.y + (frame.h * i) / 3;
      ctx.moveTo(x, frame.y);
      ctx.lineTo(x, frame.y + frame.h);
      ctx.moveTo(frame.x, y);
      ctx.lineTo(frame.x + frame.w, y);
    }
    ctx.stroke();
  }

  // Safe action 93% / safe title 90% inside the framing rect
  if (showSafeArea) {
    ctx.strokeStyle = SAFE_LINE;
    ctx.lineWidth = lw * 0.8;
    insetRect(ctx, frame, 0.035, [font * 0.6, font * 0.4]);
    insetRect(ctx, frame, 0.05, [font * 0.3, font * 0.3]);
    ctx.setLineDash([]);
  }

  // --- Center crosshair + focus ring (camera-chart feel) --------------------
  ctx.strokeStyle = "rgba(245,245,247,0.7)";
  ctx.lineWidth = lw;
  const cx = W / 2;
  const cy = H / 2;
  const cross = Math.min(W, H) * 0.042;
  const ring = cross * 0.62;
  ctx.beginPath();
  // crosshair with a gap through the ring
  ctx.moveTo(cx - cross, cy); ctx.lineTo(cx - ring, cy);
  ctx.moveTo(cx + ring, cy); ctx.lineTo(cx + cross, cy);
  ctx.moveTo(cx, cy - cross); ctx.lineTo(cx, cy - ring);
  ctx.moveTo(cx, cy + ring); ctx.lineTo(cx, cy + cross);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, ring, 0, Math.PI * 2);
  ctx.stroke();

  // --- Brand mark (centre — our identity in place of resolution text) -------
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const brandY = frame.y + frame.h * 0.28;
  ctx.fillStyle = TEXT;
  ctx.font = `700 ${font * 2.6}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText("LUMINA", cx, brandY);
  ctx.fillStyle = FRAME_LINE;
  ctx.font = `${font * 1.05}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText("F R A M E   M A T R I X", cx, brandY + font * 2.1);
  ctx.restore();
  ctx.textAlign = "left";

  // --- Labels ---------------------------------------------------------------
  ctx.textBaseline = "top";
  ctx.font = `${font}px ui-monospace, Menlo, Consolas, monospace`;

  const deliverW = target.activeWidth ?? target.width;
  const deliverH = target.activeHeight ?? target.height;
  const targetAR = (deliverW / deliverH).toFixed(2);

  // Final-frame label (top-left, inside the framing rect)
  label(
    ctx,
    `FINAL FRAME · ${target.name} · ${targetAR}:1`,
    frame.x + font * 0.4,
    frame.y + font * 0.4,
    font,
    FRAME_LINE,
  );
  // Protection label (on the protection boundary)
  if (protection > 0) {
    label(
      ctx,
      `PROTECTION ${(protection * 100).toFixed(1)}% — reserved headroom`,
      prot.x + font * 0.4,
      prot.y - font * 1.6,
      font * 0.85,
      PROTECT_LINE,
    );
  }

  // Title block (bottom-left)
  const sqLabel = source.squeeze !== 1 ? `${source.squeeze}× ANAMORPHIC` : "SPHERICAL";
  const lines = [
    `${source.camera} — ${source.mode}`,
    `SENSOR ${source.width}×${source.height}  ·  ${sqLabel}`,
    `FINAL FRAME ${fd.dimensions.width}×${fd.dimensions.height} @ ${target.name}`,
    protection > 0
      ? `PROTECTION ${fd.protection_dimensions.width}×${fd.protection_dimensions.height}  ·  ${(protection * 100).toFixed(1)}%`
      : `PROTECTION none`,
    `${creator}  ·  ${new Date().toISOString().slice(0, 10)}`,
  ];
  ctx.textBaseline = "bottom";
  const pad = font;
  const lineGap = font * 1.45;
  // Backing panel so the title block stays legible over any footage.
  let maxW = 0;
  lines.forEach((ln, i) => {
    ctx.font = `${i === 0 ? font * 1.05 : font * 0.85}px ui-monospace, Menlo, Consolas, monospace`;
    maxW = Math.max(maxW, ctx.measureText(ln).width);
  });
  const blockH = (lines.length - 1) * lineGap + font * 1.2;
  ctx.fillStyle = "rgba(8,8,10,0.68)";
  ctx.fillRect(pad * 0.4, H - pad - blockH - font * 0.4, maxW + pad * 1.2, blockH + font * 0.7);
  lines.forEach((ln, i) => {
    const y = H - pad - (lines.length - 1 - i) * lineGap;
    ctx.font = `${i === 0 ? font * 1.05 : font * 0.85}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillStyle = i === 0 ? TEXT : TEXT_DIM;
    ctx.fillText(ln, pad, y);
  });

  return canvas;
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  ctx.font = `${size}px ui-monospace, Menlo, Consolas, monospace`;
  const w = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(8,8,10,0.7)";
  ctx.fillRect(x - size * 0.2, y - size * 0.15, w + size * 0.4, size * 1.35);
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.fillText(text, x, y);
}

function insetRect(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  pct: number,
  dash: number[],
) {
  const ix = r.w * pct;
  const iy = r.h * pct;
  ctx.setLineDash(dash);
  ctx.strokeRect(r.x + ix, r.y + iy, r.w - ix * 2, r.h - iy * 2);
}

function drawCornerTicks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  len: number,
  color: string,
  lw: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw * 1.5;
  ctx.beginPath();
  // TL
  ctx.moveTo(x, y + len); ctx.lineTo(x, y); ctx.lineTo(x + len, y);
  // TR
  ctx.moveTo(x + w - len, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + len);
  // BL
  ctx.moveTo(x, y + h - len); ctx.lineTo(x, y + h); ctx.lineTo(x + len, y + h);
  // BR
  ctx.moveTo(x + w - len, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - len);
  ctx.stroke();
}

/** Small registration ticks at the centre of each edge of a rect. */
function edgeCenterTicks(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  len: number,
  color: string,
  lw: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  const mx = r.x + r.w / 2;
  const my = r.y + r.h / 2;
  ctx.beginPath();
  ctx.moveTo(mx, r.y); ctx.lineTo(mx, r.y + len); // top
  ctx.moveTo(mx, r.y + r.h); ctx.lineTo(mx, r.y + r.h - len); // bottom
  ctx.moveTo(r.x, my); ctx.lineTo(r.x + len, my); // left
  ctx.moveTo(r.x + r.w, my); ctx.lineTo(r.x + r.w - len, my); // right
  ctx.stroke();
}

/** Inward-pointing registration triangles just inside each sensor edge. */
function drawEdgeTriangles(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  const m = size * 1.6;
  const tri = (x: number, y: number, dir: "u" | "d" | "l" | "r") => {
    ctx.beginPath();
    if (dir === "d") { ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.lineTo(x, y + size * 1.4); }
    if (dir === "u") { ctx.moveTo(x - size, y); ctx.lineTo(x + size, y); ctx.lineTo(x, y - size * 1.4); }
    if (dir === "r") { ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.lineTo(x + size * 1.4, y); }
    if (dir === "l") { ctx.moveTo(x, y - size); ctx.lineTo(x, y + size); ctx.lineTo(x - size * 1.4, y); }
    ctx.closePath();
    ctx.fill();
  };
  for (const f of [0.25, 0.5, 0.75]) {
    tri(W * f, m, "d");
    tri(W * f, H - m, "u");
    tri(m, H * f, "r");
    tri(W - m, H * f, "l");
  }
}

/** Siemens-star focus target (alternating wedges) with a slate ring. */
function drawSiemensStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  segments = 24,
) {
  const stepA = (Math.PI * 2) / segments;
  for (let i = 0; i < segments; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, i * stepA, (i + 1) * stepA);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#e5e7eb" : "#0b0c0e";
    ctx.fill();
  }
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** Build a rounded-rectangle path (caller then strokes/fills). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}
