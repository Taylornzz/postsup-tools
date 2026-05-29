import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  SourceFormat,
  TargetContainer,
  computeExtraction,
  formatNumber,
  FitMode,
} from "@/lib/formats";
import { cn } from "@/lib/utils";

interface FrameViewerProps {
  source: SourceFormat;
  target: TargetContainer;
  showGuides: boolean;
  showMask: boolean;
  showThirds: boolean;
  showSafeArea?: boolean;
  desqueeze: boolean;
  pixelTrue: boolean;
  fitMode: FitMode;
  reframeOffset: { x: number; y: number };
  onReframeChange: (o: { x: number; y: number }) => void;
  protectionPct?: number;
  onProtectionChange?: (pct: number) => void;
  extractionScale?: number;
  /** When provided, the frame's corner handles resize the extraction (scale). */
  onExtractionScaleChange?: (s: number) => void;
  /** Optional delivery-intent aspect ratio (W/H) drawn inside the extraction
   *  frame so DPs can pre-visualise a final crop (2.00, 2.39, 0.5625…) on
   *  top of the source view. null/undefined = no overlay. */
  deliveryCropAR?: number | null;
  deliveryCropLabel?: string;
  referenceImage?: string | null;
}

export function FrameViewer({
  source,
  target,
  showGuides,
  showMask,
  showThirds,
  showSafeArea = false,
  desqueeze,
  pixelTrue,
  fitMode,
  reframeOffset,
  onReframeChange,
  protectionPct = 0,
  onProtectionChange,
  extractionScale = 1,
  onExtractionScaleChange,
  deliveryCropAR = null,
  deliveryCropLabel,
  referenceImage,
}: FrameViewerProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setBox({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const ext = useMemo(
    () => computeExtraction(source, target, fitMode),
    [source, target, fitMode],
  );

  // Source frame on screen.
  // - If `desqueeze` is true, render at displayed (corrected) aspect.
  // - If false, render at recorded aspect (squeezed look).
  const screenSourceW = desqueeze ? source.width * source.squeeze : source.width;
  const screenSourceH = source.height;
  const screenSourceAsp = screenSourceW / screenSourceH;

  // Extraction in *displayed* source pixels (from compute).
  let extDisplayedW = ext.extractW;
  let extDisplayedH = ext.extractH;

  // PIXEL-TRUE: override the extraction size so the box represents the
  // TARGET's native pixel count inside the source's native pixel count.
  // This is what reveals the "8K → 4K = quarter-area headroom" relationship.
  if (pixelTrue) {
    extDisplayedW = target.width; // displayed-source px == target px at scale 1
    extDisplayedH = target.height;
  }

  // Same extraction in *recorded* (squeezed) pixels for the un-desqueezed view.
  const extRecordedW = extDisplayedW / source.squeeze;
  const extRecordedH = extDisplayedH;

  const screenExtW = desqueeze ? extDisplayedW : extRecordedW;
  const screenExtH = desqueeze ? extDisplayedH : extRecordedH;

  const padding = 64;
  const availW = Math.max(0, box.w - padding * 2);
  const availH = Math.max(0, box.h - padding * 2);

  // Determine on-screen pixel size of the source frame.
  let frameW: number;
  let frameH: number;

  if (pixelTrue) {
    // Pixel-true: scale so 1 source pixel = constant screen units. Fit the
    // LARGER of source and extraction into viewport so an upscale (target
    // bigger than source) is still fully visible — extraction will overflow
    // the source frame, which is the correct visual signal.
    const refW = Math.max(screenSourceW, screenExtW);
    const refH = Math.max(screenSourceH, screenExtH);
    const fitScale = Math.min(availW / refW, availH / refH);
    frameW = screenSourceW * fitScale;
    frameH = screenSourceH * fitScale;
  } else {
    // Standard fit-to-viewport mode.
    frameW = availW;
    frameH = frameW / screenSourceAsp;
    if (frameH > availH) {
      frameH = availH;
      frameW = frameH * screenSourceAsp;
    }
  }

  const esClamped = Math.max(0.25, Math.min(2, extractionScale));
  const extPxW = (screenExtW / screenSourceW) * frameW * esClamped;
  const extPxH = (screenExtH / screenSourceH) * frameH * esClamped;

  // Reframe range: how far from center the extraction window can travel
  // (in normalized [-1..1] units of the available room). Use absolute value
  // so a punch-in (>1, extraction overflows the source) can still be panned.
  const maxOffsetX = Math.abs(frameW - extPxW) / 2;
  const maxOffsetY = Math.abs(frameH - extPxH) / 2;
  const offX = reframeOffset.x * maxOffsetX;
  const offY = reframeOffset.y * maxOffsetY;

  const extLeft = (frameW - extPxW) / 2 + offX;
  const extTop = (frameH - extPxH) / 2 + offY;

  // Drag handling for reframing
  const dragging = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (maxOffsetX < 1 && maxOffsetY < 1) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = {
        startX: e.clientX,
        startY: e.clientY,
        baseX: reframeOffset.x,
        baseY: reframeOffset.y,
      };
    },
    [reframeOffset, maxOffsetX, maxOffsetY],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.startX;
      const dy = e.clientY - dragging.current.startY;
      const nx = dragging.current.baseX + (maxOffsetX > 0 ? dx / maxOffsetX : 0);
      const ny = dragging.current.baseY + (maxOffsetY > 0 ? dy / maxOffsetY : 0);
      onReframeChange({
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      });
    },
    [maxOffsetX, maxOffsetY, onReframeChange],
  );
  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  // Corner-handle resize → drives extractionScale (size, not just position).
  const resizing = useRef<{ cx: number; cy: number; startDist: number; startScale: number } | null>(null);
  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onExtractionScaleChange) return;
      e.stopPropagation();
      const host = (e.currentTarget as HTMLElement).parentElement;
      if (!host) return;
      const r = host.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const d = Math.hypot(e.clientX - cx, e.clientY - cy) || 1;
      resizing.current = { cx, cy, startDist: d, startScale: esClamped };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onExtractionScaleChange, esClamped],
  );
  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const s = resizing.current;
      if (!s || !onExtractionScaleChange) return;
      e.stopPropagation();
      const d = Math.hypot(e.clientX - s.cx, e.clientY - s.cy);
      const next = s.startScale * (d / s.startDist);
      onExtractionScaleChange(Math.max(0.25, Math.min(2, Math.round(next * 100) / 100)));
    },
    [onExtractionScaleChange],
  );
  const onResizeUp = useCallback((e: React.PointerEvent) => {
    if (!resizing.current) return;
    e.stopPropagation();
    resizing.current = null;
  }, []);

  // Frameline palette aligned with the export chart so the boxes are
  // distinguishable: sensor = slate, final frame = cyan, protection = orange
  // (drawn by ProtectionOverlay), secondary crop = violet.
  const sourceAccent = "#94a3b8"; // slate — sensor / source border
  const isSocial = target.group === "Social";
  const targetAccent = isSocial
    ? "hsl(var(--guide-social))" // violet for social formats
    : "#22d3ee"; // cyan — final frame

  // Pixel ratio readout (e.g. "8192 src px → 3840 tgt px")
  const sourcePxAcrossExtraction = Math.round(ext.extractW / source.squeeze);
  const reframeable = maxOffsetX > 1 || maxOffsetY > 1;

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full flex items-center justify-center bg-suite-canvas overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(var(--suite-text)) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      />

      {frameW > 0 && (
        <div
          className="relative shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-suite-border bg-suite-panel animate-fade-in"
          style={{ width: frameW, height: frameH }}
        >
          {/* Reference image or neutral fill — squeezed if !desqueeze and source is anamorphic */}
          {referenceImage ? (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--suite-panel-elevated)) 0%, hsl(var(--suite-canvas)) 100%)",
              }}
            >
              <img
                src={referenceImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-90"
                style={{
                  transform: !desqueeze && source.squeeze !== 1
                    ? `scaleX(${1 / source.squeeze})`
                    : undefined,
                  transformOrigin: "center",
                }}
              />
            </div>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--suite-panel-elevated)) 0%, hsl(var(--suite-canvas)) 100%)",
              }}
            />
          )}

          {/* Source frame border */}
          {showGuides && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ boxShadow: `inset 0 0 0 1px ${sourceAccent}99` }}
            >
              <div
                className="absolute -top-7 left-0 font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 bg-suite-bg/95 backdrop-blur border whitespace-nowrap"
                style={{ color: sourceAccent, borderColor: `${sourceAccent}55` }}
              >
                Source · {source.camera} · {formatNumber(source.width)}×
                {formatNumber(source.height)}
                {source.squeeze !== 1 && ` · ${source.squeeze}x ${desqueeze ? "DESQ" : "SQZ"}`}
              </div>
              <div
                className="absolute top-1/2 left-1/2 w-3 h-px -translate-x-1/2 -translate-y-1/2"
                style={{ background: `${sourceAccent}80` }}
              />
              <div
                className="absolute top-1/2 left-1/2 w-px h-3 -translate-x-1/2 -translate-y-1/2"
                style={{ background: `${sourceAccent}80` }}
              />
            </div>
          )}

          {/* Mask: 4 black overlays around the extraction window */}
          {showMask && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute left-0 right-0 top-0"
                style={{ height: extTop, background: "hsla(240,10%,2%,0.7)" }}
              />
              <div
                className="absolute left-0 right-0 bottom-0"
                style={{
                  height: frameH - (extTop + extPxH),
                  background: "hsla(240,10%,2%,0.7)",
                }}
              />
              <div
                className="absolute"
                style={{
                  top: extTop,
                  height: extPxH,
                  left: 0,
                  width: extLeft,
                  background: "hsla(240,10%,2%,0.7)",
                }}
              />
              <div
                className="absolute"
                style={{
                  top: extTop,
                  height: extPxH,
                  right: 0,
                  width: frameW - (extLeft + extPxW),
                  background: "hsla(240,10%,2%,0.7)",
                }}
              />
            </div>
          )}

          {/* Extraction frameline */}
          {showGuides && (
            <div
              className={cn(
                "absolute select-none touch-none",
                reframeable ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
              )}
              onPointerDown={reframeable ? onPointerDown : undefined}
              onPointerMove={reframeable ? onPointerMove : undefined}
              onPointerUp={reframeable ? onPointerUp : undefined}
              onPointerCancel={reframeable ? onPointerUp : undefined}
              style={{
                top: extTop,
                left: extLeft,
                width: extPxW,
                height: extPxH,
                boxShadow: `0 0 0 1.5px ${targetAccent}, 0 0 24px -4px ${targetAccent}66`,
              }}
            >
              {(["tl", "tr", "bl", "br"] as const).map((corner) => (
                <Corner key={corner} pos={corner} color={targetAccent} />
              ))}

              {/* Corner resize handles — drag to scale the extraction window. */}
              {onExtractionScaleChange &&
                (["tl", "tr", "bl", "br"] as const).map((corner) => {
                  const posMap: Record<string, string> = {
                    tl: "top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
                    tr: "top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
                    bl: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
                    br: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
                  };
                  return (
                    <div
                      key={`h-${corner}`}
                      className={cn("absolute size-3.5 rounded-[2px] touch-none pointer-events-auto", posMap[corner])}
                      style={{ background: targetAccent, boxShadow: "0 0 0 1.5px hsl(var(--suite-bg))" }}
                      onPointerDown={onResizeDown}
                      onPointerMove={onResizeMove}
                      onPointerUp={onResizeUp}
                      onPointerCancel={onResizeUp}
                      title="Drag to resize the extraction"
                    />
                  );
                })}

              {showThirds && (
                <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.5 }}>
                  <div className="absolute left-0 right-0 top-1/3 h-px" style={{ background: targetAccent }} />
                  <div className="absolute left-0 right-0 top-2/3 h-px" style={{ background: targetAccent }} />
                  <div className="absolute top-0 bottom-0 left-1/3 w-px" style={{ background: targetAccent }} />
                  <div className="absolute top-0 bottom-0 left-2/3 w-px" style={{ background: targetAccent }} />
                </div>
              )}

              {showSafeArea && (
                <SafeAreaOverlay color={targetAccent} />
              )}

              {protectionPct > 0 && (
                <ProtectionOverlay
                  pct={protectionPct}
                  color="#f59e0b"
                  onChange={onProtectionChange}
                />
              )}

              {/* Delivery-intent crop overlay (centered inside extraction) */}
              {deliveryCropAR != null && deliveryCropAR > 0 && (
                <DeliveryCropOverlay
                  extPxW={extPxW}
                  extPxH={extPxH}
                  cropAR={deliveryCropAR}
                  label={deliveryCropLabel}
                />
              )}

              {/* Target label */}
              <div
                className="absolute -bottom-7 right-0 font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 bg-suite-bg/95 backdrop-blur border whitespace-nowrap pointer-events-none"
                style={{ color: targetAccent, borderColor: `${targetAccent}55` }}
              >
                {target.name} · {formatNumber(target.activeWidth ?? target.width)}×
                {formatNumber(target.activeHeight ?? target.height)} · {target.ratioLabel}
              </div>

              {reframeable && (
                <div
                  className="absolute bottom-1 left-1 font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 bg-suite-bg/80 backdrop-blur border pointer-events-none"
                  style={{ color: targetAccent, borderColor: `${targetAccent}40` }}
                >
                  Drag to reframe · corners resize
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom data strip */}
      <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end font-mono text-[10px] text-suite-text-dim pointer-events-none">
        <div className="flex gap-4 flex-wrap">
          <span>
            <span className="text-suite-text-dim">SRC ASP </span>
            <span className="text-suite-text tabular">
              {(desqueeze ? ext.sourceAspect : source.width / source.height).toFixed(3)}
            </span>
          </span>
          <span>
            <span className="text-suite-text-dim">TGT ASP </span>
            <span className="text-suite-text tabular">
              {ext.targetAspect.toFixed(3)}
            </span>
          </span>
          <span>
            <span className="text-suite-text-dim">EXTRACT </span>
            <span className="text-suite-text tabular">
              {formatNumber(sourcePxAcrossExtraction)}×{formatNumber(Math.round(ext.extractH))} px
            </span>
          </span>
          {pixelTrue && (
            <span>
              <span className="text-suite-text-dim">VIEW </span>
              <span className="text-guide-source tabular">PIXEL-TRUE</span>
            </span>
          )}
          {esClamped !== 1 && (
            <span>
              <span className="text-suite-text-dim">EXT SCALE </span>
              <span
                className={cn(
                  "tabular",
                  esClamped > 1 ? "text-status-warn" : "text-guide-target",
                )}
              >
                {esClamped.toFixed(2)}× {esClamped < 1 ? "size-down" : "punch-in"}
              </span>
            </span>
          )}
          {deliveryCropAR != null && deliveryCropAR > 0 && (
            <span>
              <span className="text-suite-text-dim">CROP </span>
              <span className="tabular" style={{ color: "hsl(var(--guide-social))" }}>
                {deliveryCropLabel ?? `${deliveryCropAR.toFixed(2)}:1`}
              </span>
            </span>
          )}
        </div>
        <div className="flex gap-4">
          {reframeable && (
            <span>
              <span className="text-suite-text-dim">REFRAME </span>
              <span className="text-suite-text tabular">
                {(reframeOffset.x * 100).toFixed(0)}%, {(reframeOffset.y * 100).toFixed(0)}%
              </span>
            </span>
          )}
          <span>
            <span className="text-suite-text-dim">SCALE </span>
            <span className={cn("tabular", ext.scale > 1 ? "text-status-warn" : "text-status-ok")}>
              {ext.scale >= 1 ? "+" : ""}
              {((ext.scale - 1) * 100).toFixed(1)}%
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function Corner({
  pos,
  color,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  color: string;
}) {
  const base = "absolute size-2.5 pointer-events-none";
  const map = {
    tl: "top-0 left-0 border-t-2 border-l-2 -translate-x-px -translate-y-px",
    tr: "top-0 right-0 border-t-2 border-r-2 translate-x-px -translate-y-px",
    bl: "bottom-0 left-0 border-b-2 border-l-2 -translate-x-px translate-y-px",
    br: "bottom-0 right-0 border-b-2 border-r-2 translate-x-px translate-y-px",
  };
  return <div className={cn(base, map[pos])} style={{ borderColor: color }} />;
}

/** Broadcast-style safe-action (93%) and safe-title (90%) overlays.
 *  Rendered inside the extraction frame. Standard SMPTE/EBU values. */
export function SafeAreaOverlay({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* 93% safe action */}
      <div
        className="absolute"
        style={{
          left: "3.5%",
          right: "3.5%",
          top: "3.5%",
          bottom: "3.5%",
          border: `1px dashed ${color}`,
          opacity: 0.55,
        }}
      >
        <span
          className="absolute -top-4 left-0 font-mono text-[8px] tracking-[0.18em] uppercase px-1 bg-suite-bg/80"
          style={{ color, opacity: 0.85 }}
        >
          Safe Action 93%
        </span>
      </div>
      {/* 90% safe title */}
      <div
        className="absolute"
        style={{
          left: "5%",
          right: "5%",
          top: "5%",
          bottom: "5%",
          border: `1px dotted ${color}`,
          opacity: 0.7,
        }}
      >
        <span
          className="absolute -bottom-4 right-0 font-mono text-[8px] tracking-[0.18em] uppercase px-1 bg-suite-bg/80"
          style={{ color, opacity: 0.85 }}
        >
          Safe Title 90%
        </span>
      </div>
    </div>
  );
}

/** Protection / framing-reservation overlay.
 *  Renders a dashed rectangle OUTSIDE the final frame (the larger reserved area
 *  you keep clean) and lets the user drag any edge to live-adjust the percentage.
 *  Matches the export chart + FDL: protection = final ÷ (1 − pct/100). */
export function ProtectionOverlay({
  pct,
  color,
  onChange,
}: {
  pct: number;
  color: string;
  onChange?: (pct: number) => void;
}) {
  // Protection is LARGER than the final frame: protection = final / (1 − p),
  // so it sits OUTSIDE, expanding past each edge by this fraction of the frame.
  const p = Math.max(0, Math.min(0.9, pct / 100));
  const outsetPct = ((1 / (1 - p) - 1) / 2) * 100; // % of the frame, per side
  const interactive = !!onChange;

  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"t" | "b" | "l" | "r" | null>(null);

  const begin = (edge: "t" | "b" | "l" | "r") => (e: React.PointerEvent) => {
    if (!onChange) return;
    e.stopPropagation();
    dragRef.current = edge;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!dragRef.current || !onChange || !rootRef.current) return;
    e.stopPropagation();
    const r = rootRef.current.getBoundingClientRect(); // = final frame
    let o = 0; // how far OUTSIDE the frame the cursor is, as a fraction of the frame
    if (dragRef.current === "t") o = (r.top - e.clientY) / r.height;
    else if (dragRef.current === "b") o = (e.clientY - r.bottom) / r.height;
    else if (dragRef.current === "l") o = (r.left - e.clientX) / r.width;
    else o = (e.clientX - r.right) / r.width;
    o = Math.max(0, o);
    const pp = (2 * o) / (1 + 2 * o); // invert the outset back to a fraction
    onChange(Math.max(0, Math.min(40, Math.round(pp * 1000) / 10)));
  };
  const end = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    e.stopPropagation();
    dragRef.current = null;
  };

  const edgeBase =
    "absolute touch-none" +
    (interactive ? " cursor-grab active:cursor-grabbing pointer-events-auto" : " pointer-events-none");

  return (
    <div ref={rootRef} className="absolute inset-0 pointer-events-none">
      <div
        className="absolute"
        style={{
          left: `-${outsetPct}%`,
          right: `-${outsetPct}%`,
          top: `-${outsetPct}%`,
          bottom: `-${outsetPct}%`,
          border: `1.5px dashed ${color}`,
          opacity: 0.9,
        }}
      >
        <span
          className="absolute -top-5 left-0 font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 bg-suite-bg/90 backdrop-blur border pointer-events-none whitespace-nowrap"
          style={{ color, borderColor: `${color}55` }}
        >
          Protection {pct.toFixed(pct % 1 === 0 ? 0 : 1)}% · outside frame
        </span>

        {interactive && (
          <>
            <div className={edgeBase} style={{ top: -4, left: 0, right: 0, height: 8 }}
              onPointerDown={begin("t")} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
              title="Drag to adjust protection" />
            <div className={edgeBase} style={{ bottom: -4, left: 0, right: 0, height: 8 }}
              onPointerDown={begin("b")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
            <div className={edgeBase} style={{ left: -4, top: 0, bottom: 0, width: 8 }}
              onPointerDown={begin("l")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
            <div className={edgeBase} style={{ right: -4, top: 0, bottom: 0, width: 8 }}
              onPointerDown={begin("r")} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
          </>
        )}
      </div>
    </div>
  );
}

/** Delivery-intent crop overlay. Drawn INSIDE the extraction frame so a DP
 *  can see what part of the delivery they actually intend to put on screen
 *  (e.g. 2.00:1 or 9:16 social out of a 16:9 master). Fits the given aspect
 *  ratio centered, letterboxed or pillarboxed as needed, with dimmed bars
 *  on the unused area. */
function DeliveryCropOverlay({
  extPxW,
  extPxH,
  cropAR,
  label,
}: {
  extPxW: number;
  extPxH: number;
  cropAR: number;
  label?: string;
}) {
  const extAR = extPxW / extPxH;
  let cropW = extPxW;
  let cropH = extPxH;
  if (cropAR >= extAR) {
    // Wider than extraction → fit width, letterbox top/bottom
    cropW = extPxW;
    cropH = extPxW / cropAR;
  } else {
    // Taller / narrower → fit height, pillarbox left/right
    cropH = extPxH;
    cropW = extPxH * cropAR;
  }
  const left = (extPxW - cropW) / 2;
  const top = (extPxH - cropH) / 2;
  const color = "hsl(var(--guide-social))";
  const barBg = "hsla(240,10%,2%,0.45)";
  const horizBar = top > 0.5;
  const vertBar = left > 0.5;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Dimmed bars on the area outside the delivery crop */}
      {horizBar && (
        <>
          <div className="absolute left-0 right-0 top-0" style={{ height: top, background: barBg }} />
          <div className="absolute left-0 right-0 bottom-0" style={{ height: top, background: barBg }} />
        </>
      )}
      {vertBar && (
        <>
          <div className="absolute top-0 bottom-0 left-0" style={{ width: left, background: barBg }} />
          <div className="absolute top-0 bottom-0 right-0" style={{ width: left, background: barBg }} />
        </>
      )}
      {/* Crop frameline */}
      <div
        className="absolute"
        style={{
          left,
          top,
          width: cropW,
          height: cropH,
          boxShadow: `0 0 0 1.5px ${color}, 0 0 18px -4px ${color}66`,
        }}
      >
        <span
          className="absolute -top-5 right-0 font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 bg-suite-bg/90 backdrop-blur border"
          style={{ color, borderColor: `${color}55` }}
        >
          Crop · {label ?? `${cropAR.toFixed(2)}:1`}
        </span>
      </div>
    </div>
  );
}
