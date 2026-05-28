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
  /** Cap the longest canvas edge to bound memory (default 8192). */
  maxEdge?: number;
};

const SENSOR_LINE = "#6b7280";
const FRAME_LINE = "#22d3ee"; // final frame — cyan
const PROTECT_LINE = "#f59e0b"; // protection — orange (band + boundary + label)
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

  // --- Background -----------------------------------------------------------
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#1b1b1f");
  g.addColorStop(1, "#0d0d10");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (referenceImage && referenceImage.naturalWidth > 0) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    // Desqueezed: draw the reference at its TRUE aspect (cover), never stretched
    // to the squeezed sensor frame — so an anamorphic chart still reads upright.
    const ia = referenceImage.naturalWidth / referenceImage.naturalHeight;
    const ca = W / H;
    let dw: number, dh: number;
    if (ia > ca) { dh = H; dw = H * ia; } else { dw = W; dh = W / ia; }
    ctx.drawImage(referenceImage, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }

  // Fine grid
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  const step = Math.max(40, Math.round(W / 24));
  ctx.beginPath();
  for (let x = step; x < W; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = step; y < H; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // Diagonal alignment lines (corner to corner)
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, H);
  ctx.moveTo(W, 0);
  ctx.lineTo(0, H);
  ctx.stroke();

  // --- Sensor border + corner ticks ----------------------------------------
  ctx.strokeStyle = SENSOR_LINE;
  ctx.lineWidth = lw;
  ctx.strokeRect(lw / 2, lw / 2, W - lw, H - lw);
  drawCornerTicks(ctx, 0, 0, W, H, Math.min(W, H) * 0.04, SENSOR_LINE, lw);

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

    // Protection boundary — orange, dashed, clearly the OUTER limit.
    ctx.strokeStyle = PROTECT_LINE;
    ctx.lineWidth = lw * 1.2;
    ctx.setLineDash([font * 0.7, font * 0.45]);
    ctx.strokeRect(prot.x, prot.y, prot.w, prot.h);
    ctx.setLineDash([]);
  }

  // --- Framing rectangle = the FINAL FRAME (bright, solid, heaviest line) ----
  ctx.strokeStyle = FRAME_LINE;
  ctx.lineWidth = lw * 1.8;
  ctx.strokeRect(frame.x, frame.y, frame.w, frame.h);

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

  // --- Center crosshair (full canvas) ---------------------------------------
  ctx.strokeStyle = "rgba(245,245,247,0.6)";
  ctx.lineWidth = lw;
  const cx = W / 2;
  const cy = H / 2;
  const cross = Math.min(W, H) * 0.03;
  ctx.beginPath();
  ctx.moveTo(cx - cross, cy);
  ctx.lineTo(cx + cross, cy);
  ctx.moveTo(cx, cy - cross);
  ctx.lineTo(cx, cy + cross);
  ctx.stroke();

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
