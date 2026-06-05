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
  /** Slate metadata stamped into the title block. */
  projectName?: string;
  authorName?: string;
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
const CROP_LINE = "#c084fc"; // secondary delivery crop — violet (line)
const CROP_TEXT = "#e2cffd"; // lighter lavender for the crop label (legible on dark)
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
    creator = "Kaos Theory",
    projectName,
    authorName,
    referenceImage = null,
    secondaryCropAR = null,
    secondaryCropLabel,
    maxEdge = 8192,
  } = opts;

  // Render in DESQUEEZED display space (canvas width = sensor width × squeeze),
  // so anamorphic charts read upright and the plate, framelines and crop all
  // match the live viewer. Capped for memory safety. scaleX folds in the
  // squeeze, so the recorded-pixel FDL geometry maps to display positions.
  const sq = source.squeeze || 1;
  let W = source.width * sq;
  let H = source.height;
  const longest = Math.max(W, H);
  if (longest > maxEdge) {
    const k = maxEdge / longest;
    W = Math.round(W * k);
    H = Math.round(H * k);
  }
  const scaleX = W / source.width; // includes the anamorphic desqueeze
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

  // --- Background -----------------------------------------------------------
  ctx.fillStyle = "#0b0c0e"; // dark base / border zone
  ctx.fillRect(0, 0, W, H);

  const useImage = !!(referenceImage && referenceImage.naturalWidth > 0);
  if (useImage) {
    // Image mode: composite over the studio plate (desqueezed, cover), then a
    // dark scrim so the framelines/labels stay legible.
    const ia = referenceImage!.naturalWidth / referenceImage!.naturalHeight;
    const ca = W / H;
    let dw: number, dh: number;
    if (ia > ca) { dh = H; dw = H * ia; } else { dw = W; dh = W / ia; }
    ctx.drawImage(referenceImage!, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.fillStyle = "rgba(8,9,11,0.34)";
    ctx.fillRect(0, 0, W, H);
  } else {
    // Clean mode: neutral working-area panel + fine grid (our ASC grey field).
    const panel = ctx.createLinearGradient(0, prot.y, 0, prot.y + prot.h);
    panel.addColorStop(0, "#2b2f36");
    panel.addColorStop(1, "#21242a");
    ctx.fillStyle = panel;
    ctx.fillRect(prot.x, prot.y, prot.w, prot.h);

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
  }

  // Sensor border + corner ticks (slate).
  ctx.strokeStyle = SENSOR_LINE;
  ctx.lineWidth = lw;
  ctx.strokeRect(lw / 2, lw / 2, W - lw, H - lw);
  drawCornerTicks(ctx, 0, 0, W, H, Math.min(W, H) * 0.045, SENSOR_LINE, lw);

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
  // Registration arrows: tips land exactly on the final-frame edges (per the
  // Netflix reference) — one at each edge centre, pointing inward.
  drawEdgeArrows(ctx, frame, Math.min(W, H) * 0.022, "#e5e7eb");

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
    // Bottom-left of the crop rect — keeps it clear of the FINAL FRAME label
    // (which sits top-left) so the two never collide.
    label(
      ctx,
      `CROP · ${secondaryCropLabel ?? `${secondaryCropAR.toFixed(2)}:1`}`,
      cxp + font * 0.4,
      cyp + ch - font * 1.45,
      font * 0.85,
      CROP_TEXT,
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
  ctx.fillText("KAOS THEORY", cx, brandY);
  ctx.fillStyle = FRAME_LINE;
  ctx.font = `${font * 1.05}px ui-monospace, Menlo, Consolas, monospace`;
  ctx.fillText("F R A M I N G   C H A R T", cx, brandY + font * 2.1);
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
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    projectName ? projectName.toUpperCase() : `${source.camera} — ${source.mode}`,
    ...(projectName ? [`${source.camera} — ${source.mode}`] : []),
    `SENSOR ${source.width}×${source.height}  ·  ${sqLabel}`,
    `FINAL FRAME ${fd.dimensions.width}×${fd.dimensions.height} @ ${target.name}`,
    protection > 0
      ? `PROTECTION ${fd.protection_dimensions.width}×${fd.protection_dimensions.height}  ·  ${(protection * 100).toFixed(1)}%`
      : `PROTECTION none`,
    `${authorName ? authorName + "  ·  " : ""}${date}  ·  ${creator}`,
  ];
  // Centred info box, sitting just below the centre crosshair.
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const lineGap = font * 1.45;
  let maxW = 0;
  lines.forEach((ln, i) => {
    ctx.font = `${i === 0 ? font * 1.05 : font * 0.85}px ui-monospace, Menlo, Consolas, monospace`;
    maxW = Math.max(maxW, ctx.measureText(ln).width);
  });
  const blockH = (lines.length - 1) * lineGap + font * 1.2;
  const top = cy + cross + font * 1.4; // clear of the crosshair
  ctx.fillStyle = "rgba(8,8,10,0.7)";
  ctx.fillRect(cx - maxW / 2 - font * 0.6, top - font * 0.4, maxW + font * 1.2, blockH + font * 0.7);
  lines.forEach((ln, i) => {
    const y = top + i * lineGap;
    ctx.font = `${i === 0 ? font * 1.05 : font * 0.85}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillStyle = i === 0 ? TEXT : TEXT_DIM;
    ctx.fillText(ln, cx, y);
  });
  ctx.textAlign = "left";

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

/** Inward-pointing registration arrows whose TIPS land exactly on the centre of
 *  each edge of a rect (the base sits just outside the edge). */
function drawEdgeArrows(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  const mx = r.x + r.w / 2;
  const my = r.y + r.h / 2;
  const d = size * 1.5; // depth of the arrow, outward from the edge
  // top — tip on the top edge, base above
  ctx.beginPath();
  ctx.moveTo(mx, r.y); ctx.lineTo(mx - size, r.y - d); ctx.lineTo(mx + size, r.y - d); ctx.closePath(); ctx.fill();
  // bottom
  ctx.beginPath();
  ctx.moveTo(mx, r.y + r.h); ctx.lineTo(mx - size, r.y + r.h + d); ctx.lineTo(mx + size, r.y + r.h + d); ctx.closePath(); ctx.fill();
  // left
  ctx.beginPath();
  ctx.moveTo(r.x, my); ctx.lineTo(r.x - d, my - size); ctx.lineTo(r.x - d, my + size); ctx.closePath(); ctx.fill();
  // right
  ctx.beginPath();
  ctx.moveTo(r.x + r.w, my); ctx.lineTo(r.x + r.w + d, my - size); ctx.lineTo(r.x + r.w + d, my + size); ctx.closePath(); ctx.fill();
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
