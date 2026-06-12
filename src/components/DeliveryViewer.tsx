import { useCallback, useEffect, useRef, useState } from "react";
import { SourceFormat, TargetContainer, formatNumber, sourceDisplayed } from "@/lib/formats";
import { SafeAreaOverlay, ProtectionOverlay } from "@/components/FrameViewer";
import { cn } from "@/lib/utils";

export type SourceTransform = { scale: number; x: number; y: number };

interface DeliveryViewerProps {
  source: SourceFormat;
  target: TargetContainer;
  desqueeze: boolean;
  showGuides: boolean;
  showThirds: boolean;
  showSafeArea?: boolean;
  /** scale = 1 means source COVERS the target (fill). <1 → letterbox/pillar visible. */
  transform: SourceTransform;
  onTransformChange: (t: SourceTransform) => void;
  referenceImage?: string | null;
  protectionPct?: number;
  onProtectionChange?: (pct: number) => void;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

export function DeliveryViewer({
  source,
  target,
  desqueeze,
  showGuides,
  showThirds,
  showSafeArea = false,
  transform,
  onTransformChange,
  referenceImage,
  protectionPct = 0,
  onProtectionChange,
}: DeliveryViewerProps) {
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

  // Source displayed dimensions (after desqueeze if active)
  const srcW = desqueeze ? source.width * source.squeeze : source.width;
  const srcH = source.height;
  const srcAsp = srcW / srcH;

  // Storage frame aspect (the on-disk container shape we draw)
  const storageAsp = target.width / target.height;
  // Active picture area aspect (what the source actually covers).
  // Falls back to storage aspect when no inset is defined.
  const hasInset = !!(target.activeWidth && target.activeHeight);
  const activeAsp = hasInset
    ? (target.activeWidth as number) / (target.activeHeight as number)
    : storageAsp;
  const tgtAsp = activeAsp;

  // Fit the STORAGE frame into the viewport.
  const padding = 64;
  const availW = Math.max(0, box.w - padding * 2);
  const availH = Math.max(0, box.h - padding * 2);
  let frameW = availW;
  let frameH = frameW / storageAsp;
  if (frameH > availH) {
    frameH = availH;
    frameW = frameH * storageAsp;
  }

  // Active region inset within the storage frame
  let activeW = frameW;
  let activeH = frameW / activeAsp;
  if (activeH > frameH) {
    activeH = frameH;
    activeW = frameH * activeAsp;
  }
  const activeLeft = (frameW - activeW) / 2;
  const activeTop = (frameH - activeH) / 2;

  // At scale = 1, source COVERS the ACTIVE area (matches default extraction).
  const baseCoverW = Math.max(activeW, activeH * srcAsp);
  const baseCoverH = baseCoverW / srcAsp;

  const srcOnScreenW = baseCoverW * transform.scale;
  const srcOnScreenH = baseCoverH * transform.scale;

  // Pan range: relative to the ACTIVE area
  const panMaxX = Math.max(0, (srcOnScreenW - activeW) / 2);
  const panMaxY = Math.max(0, (srcOnScreenH - activeH) / 2);
  const slackX = Math.max(0, (activeW - srcOnScreenW) / 2);
  const slackY = Math.max(0, (activeH - srcOnScreenH) / 2);
  const limitX = panMaxX + slackX;
  const limitY = panMaxY + slackY;
  const tx = Math.max(-limitX, Math.min(limitX, transform.x));
  const ty = Math.max(-limitY, Math.min(limitY, transform.y));

  // Position source within the active region (which is itself inset in storage frame)
  const srcLeft = activeLeft + (activeW - srcOnScreenW) / 2 + tx;
  const srcTop = activeTop + (activeH - srcOnScreenH) / 2 + ty;

  // ---- Interactions ------------------------------------------------------
  const dragging = useRef<{ sx: number; sy: number; bx: number; by: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = { sx: e.clientX, sy: e.clientY, bx: tx, by: ty };
    },
    [tx, ty],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - dragging.current.sx;
      const dy = e.clientY - dragging.current.sy;
      onTransformChange({
        scale: transform.scale,
        x: dragging.current.bx + dx,
        y: dragging.current.by + dy,
      });
    },
    [transform.scale, onTransformChange],
  );
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0015);
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, transform.scale * factor));
      onTransformChange({ ...transform, scale: next });
    },
    [transform, onTransformChange],
  );

  // Pinch (two-finger) on touch — basic two-pointer scaling
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchBase = useRef<{ dist: number; scale: number } | null>(null);
  const onPointerDownPinch = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchBase.current = {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        scale: transform.scale,
      };
    }
  };
  const onPointerMovePinch = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchBase.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(b.x - a.x, b.y - a.y);
      const next = Math.max(
        MIN_SCALE,
        Math.min(MAX_SCALE, (pinchBase.current.scale * dist) / pinchBase.current.dist),
      );
      onTransformChange({ ...transform, scale: next });
    }
  };
  const onPointerUpPinch = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchBase.current = null;
  };

  const sourceAccent = "hsl(var(--guide-source))";
  const isSocial = target.group === "Social";
  const targetAccent = isSocial ? "hsl(var(--guide-social))" : "hsl(var(--guide-target))";

  // Coverage: how much of the ACTIVE area the source actually fills
  const coverPctW = Math.min(1, srcOnScreenW / activeW);
  const coverPctH = Math.min(1, srcOnScreenH / activeH);
  const letterbox = coverPctH < 1;
  const pillarbox = coverPctW < 1;

  const sd = sourceDisplayed(source);

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-full flex items-center justify-center bg-suite-canvas overflow-hidden"
    >
      {/* dot grid */}
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
          className="relative shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] ring-1 ring-suite-border bg-black animate-fade-in overflow-hidden select-none touch-none"
          style={{ width: frameW, height: frameH }}
          onWheel={onWheel}
          onPointerDown={(e) => {
            onPointerDownPinch(e);
            if (pointers.current.size < 2) onPointerDown(e);
          }}
          onPointerMove={(e) => {
            onPointerMovePinch(e);
            if (pointers.current.size < 2) onPointerMove(e);
          }}
          onPointerUp={(e) => {
            onPointerUpPinch(e);
            onPointerUp(e);
          }}
          onPointerCancel={(e) => {
            onPointerUpPinch(e);
            onPointerUp(e);
          }}
        >
          {/* ACTIVE picture area — source is clipped to this region */}
          <div
            className="absolute overflow-hidden"
            style={{
              left: activeLeft,
              top: activeTop,
              width: activeW,
              height: activeH,
            }}
          >
            {/* SOURCE rendered inside the active region */}
            <div
              className="absolute"
              style={{
                left: srcLeft - activeLeft,
                top: srcTop - activeTop,
                width: srcOnScreenW,
                height: srcOnScreenH,
                cursor: dragging.current ? "grabbing" : "grab",
              }}
            >
              {referenceImage ? (
                <div
                  className="w-full h-full pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--suite-panel-elevated)) 0%, hsl(var(--suite-canvas)) 100%)",
                  }}
                >
                  <img
                    src={referenceImage}
                    alt=""
                    draggable={false}
                    className="w-full h-full object-cover pointer-events-none"
                    style={{
                      transform:
                        !desqueeze && source.squeeze !== 1
                          ? `scaleX(${1 / source.squeeze})`
                          : undefined,
                      transformOrigin: "center",
                    }}
                  />
                </div>
              ) : (
                <div
                  className="w-full h-full pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, hsl(var(--suite-panel-elevated)) 0%, hsl(var(--suite-canvas)) 100%)",
                  }}
                />
              )}
            </div>
          </div>

          {/* Source label (positioned above the active region) */}
          {showGuides && (
            <div
              className="absolute font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 bg-suite-bg/95 backdrop-blur border whitespace-nowrap pointer-events-none"
              style={{
                color: sourceAccent,
                borderColor: `${sourceAccent}55`,
                left: activeLeft,
                top: activeTop - 28,
              }}
            >
              Source · {formatNumber(source.width)}×{formatNumber(source.height)}
              {source.squeeze !== 1 && ` · ${source.squeeze}x ${desqueeze ? "DESQ" : "SQZ"}`}
            </div>
          )}

          {/* Inset bars (letterbox/pillarbox of the storage frame around the active area) */}
          {hasInset && (
            <>
              {activeTop > 0 && (
                <>
                  <div className="absolute left-0 right-0 top-0 bg-black pointer-events-none" style={{ height: activeTop }} />
                  <div className="absolute left-0 right-0 bottom-0 bg-black pointer-events-none" style={{ height: frameH - (activeTop + activeH) }} />
                </>
              )}
              {activeLeft > 0 && (
                <>
                  <div className="absolute top-0 bottom-0 left-0 bg-black pointer-events-none" style={{ width: activeLeft }} />
                  <div className="absolute top-0 bottom-0 right-0 bg-black pointer-events-none" style={{ width: frameW - (activeLeft + activeW) }} />
                </>
              )}
            </>
          )}

          {/* Storage frame outline (always) */}
          <div
            className="absolute inset-0 pointer-events-none ring-1 ring-suite-border"
            style={{ boxShadow: hasInset ? "inset 0 0 0 1px hsl(var(--suite-border-strong))" : undefined }}
          />

          {/* Active area outline + label + thirds */}
          {showGuides && (
            <>
              <div
                className="absolute pointer-events-none"
                style={{
                  left: activeLeft,
                  top: activeTop,
                  width: activeW,
                  height: activeH,
                  boxShadow: `inset 0 0 0 1.5px ${targetAccent}, 0 0 24px -4px ${targetAccent}66`,
                }}
              >
                {(["tl", "tr", "bl", "br"] as const).map((c) => (
                  <Corner key={c} pos={c} color={targetAccent} />
                ))}
                {showThirds && (
                  <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.5 }}>
                    <div className="absolute left-0 right-0 top-1/3 h-px" style={{ background: targetAccent }} />
                    <div className="absolute left-0 right-0 top-2/3 h-px" style={{ background: targetAccent }} />
                    <div className="absolute top-0 bottom-0 left-1/3 w-px" style={{ background: targetAccent }} />
                    <div className="absolute top-0 bottom-0 left-2/3 w-px" style={{ background: targetAccent }} />
                  </div>
                )}
                {showSafeArea && <SafeAreaOverlay color={targetAccent} />}
                {protectionPct > 0 && (
                  <ProtectionOverlay
                    pct={protectionPct}
                    color={targetAccent}
                    onChange={onProtectionChange}
                  />
                )}
              </div>
              <div
                className="absolute font-mono text-[10px] tracking-[0.18em] uppercase px-2 py-1 bg-suite-bg/95 backdrop-blur border whitespace-nowrap pointer-events-none"
                style={{
                  color: targetAccent,
                  borderColor: `${targetAccent}55`,
                  right: hasInset ? frameW - (activeLeft + activeW) : 0,
                  top: activeTop + activeH + 6,
                }}
              >
                Delivery · {target.name} · {formatNumber((target.activeWidth ?? target.width))}×
                {formatNumber((target.activeHeight ?? target.height))} · {target.ratioLabel}
              </div>
            </>
          )}

          {/* Letterbox / pillarbox indicator strips (only when bars visible inside active area) */}
          {(letterbox || pillarbox) && (
            <div className="absolute top-2 left-2 font-mono text-[9px] tracking-[0.18em] uppercase px-1.5 py-0.5 bg-suite-bg/80 backdrop-blur border border-suite-border pointer-events-none text-suite-text-muted z-10">
              {letterbox && pillarbox
                ? "Letterboxed"
                : letterbox
                  ? "Letterbox"
                  : "Pillarbox"}
            </div>
          )}
        </div>
      )}

      {/* Bottom data strip */}
      <div className="absolute bottom-3 left-4 right-4 flex justify-between items-end font-mono text-[10px] text-suite-text-dim pointer-events-none">
        <div className="flex gap-4 flex-wrap">
          <span>
            <span className="text-suite-text-dim">SRC ASP </span>
            <span className="text-suite-text tabular">{sd.aspect.toFixed(3)}</span>
          </span>
          <span>
            <span className="text-suite-text-dim">TGT ASP </span>
            <span className="text-suite-text tabular">{tgtAsp.toFixed(3)}</span>
          </span>
          <span>
            <span className="text-suite-text-dim">SCALE </span>
            <span className="text-suite-text tabular">
              {(transform.scale * 100).toFixed(0)}%
            </span>
          </span>
          <span>
            <span className="text-suite-text-dim">FILL </span>
            <span className="text-suite-text tabular">
              {(coverPctW * 100).toFixed(0)}% × {(coverPctH * 100).toFixed(0)}%
            </span>
          </span>
        </div>
        <div className="flex gap-4">
          <span className="text-suite-text-dim">DRAG · WHEEL · PINCH</span>
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

/** Helper: scale value that exactly fits source WIDTH inside target's active area. */
export function fitWidthScale(src: SourceFormat, tgt: TargetContainer, desqueeze: boolean) {
  const srcAsp =
    (desqueeze ? src.width * src.squeeze : src.width) / src.height;
  const tgtAsp =
    tgt.activeWidth && tgt.activeHeight
      ? tgt.activeWidth / tgt.activeHeight
      : tgt.width / tgt.height;
  if (srcAsp >= tgtAsp) {
    return tgtAsp / srcAsp;
  }
  return 1;
}

/** Helper: scale value that exactly fits source HEIGHT inside target's active area. */
export function fitHeightScale(src: SourceFormat, tgt: TargetContainer, desqueeze: boolean) {
  const srcAsp =
    (desqueeze ? src.width * src.squeeze : src.width) / src.height;
  const tgtAsp =
    tgt.activeWidth && tgt.activeHeight
      ? tgt.activeWidth / tgt.activeHeight
      : tgt.width / tgt.height;
  if (srcAsp <= tgtAsp) {
    return srcAsp / tgtAsp;
  }
  return 1;
}
