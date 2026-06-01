import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  AcesVersion,
} from "@/lib/aces";
import {
  MasteringStrategy, STRATEGIES, LANES, EDGE_OP_META,
  buildMasterGraph, MNode, Lane, DeliverableRole, EdgeOp,
  MASTER_NITS, MasterNits,
} from "@/lib/mastering";
import { cn } from "@/lib/utils";
import { Crown, AlertTriangle, X, Plus, Minus, Maximize } from "lucide-react";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.2;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

interface Props {
  version: AcesVersion;
  onVersionChange: (v: AcesVersion) => void;
}

const COL_W = 184;
const NODE_H = 80;
const GAP_X = 124;
const GAP_Y = 26;
const PAD = 24;
const HEADER_H = 26;

// Compact token shown on each edge by default; the full label appears on hover
// (title) and in the side panel, so the graph stays legible.
const OP_TOKEN: Record<EdgeOp, string> = {
  "grade": "grade",
  "render-archive": "archive",
  "output-transform": "OT",
  "analyze": "L1",
  "trim": "trim",
  "cm-derive": "derive",
  "colour-convert": "convert",
  "regrade": "REGRADE",
  "downscale": "↓ res",
  "wrap": "wrap",
  "embed": "embed",
  "transcode": "proxy",
  "reference-match": "match",
};

const ROLE_ACCENT: Record<DeliverableRole, string> = {
  source: "#4ade80",        // green
  archive: "#a78bfa",       // violet
  "streaming-hdr": "#22d3ee", // cyan
  broadcast: "#94a3b8",     // slate
  theatrical: "#f59e0b",    // amber
  review: "#6b7280",        // gray
};

export function MasteringWorkflow({ version, onVersionChange }: Props) {
  const [strategy, setStrategy] = useState<MasteringStrategy>("hdr-first");
  const [masterNits, setMasterNits] = useState<MasterNits>(1000);
  const [selected, setSelected] = useState<string | null>(null);

  const graph = useMemo(() => buildMasterGraph(strategy, version, masterNits), [strategy, version, masterNits]);
  const strat = STRATEGIES.find((s) => s.id === strategy)!;

  // --- Deterministic layered layout (lanes = X columns) --------------------
  const { pos, width, height } = useMemo(() => {
    const byLane = new Map<Lane, MNode[]>();
    LANES.forEach((l) => byLane.set(l.id, []));
    graph.nodes.forEach((n) => byLane.get(n.lane)!.push(n));
    const maxSlots = Math.max(1, ...LANES.map((l) => byLane.get(l.id)!.length));
    const colH = maxSlots * (NODE_H + GAP_Y) - GAP_Y;
    const pos = new Map<string, { x: number; y: number }>();
    LANES.forEach((l, li) => {
      const ns = byLane.get(l.id)!;
      const offset = (colH - (ns.length * (NODE_H + GAP_Y) - GAP_Y)) / 2;
      ns.forEach((n, si) => {
        pos.set(n.id, {
          x: PAD + li * (COL_W + GAP_X),
          y: PAD + HEADER_H + offset + si * (NODE_H + GAP_Y),
        });
      });
    });
    return {
      pos,
      width: PAD * 2 + LANES.length * COL_W + (LANES.length - 1) * GAP_X,
      height: PAD * 2 + HEADER_H + colH,
    };
  }, [graph]);

  const sel = graph.nodes.find((n) => n.id === selected) ?? null;
  const inbound = sel ? graph.edges.filter((e) => e.to === sel.id) : [];

  // --- Zoom + pan ----------------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  // Wheel-zoom toward the cursor (native non-passive listener so preventDefault works).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) return; // shift+wheel = native horizontal scroll
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left + el.scrollLeft;
      const py = e.clientY - rect.top + el.scrollTop;
      setZoom((z) => {
        const next = clampZoom(z * Math.exp(-e.deltaY * 0.0015));
        const ratio = next / z;
        requestAnimationFrame(() => {
          el.scrollLeft = px * ratio - (e.clientX - rect.left);
          el.scrollTop = py * ratio - (e.clientY - rect.top);
        });
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Drag-to-pan on empty canvas (ignore drags that start on a node).
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const onPanDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = scrollRef.current; if (!el) return;
    pan.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
  };
  const onPanMove = (e: React.MouseEvent) => {
    if (!pan.current) return;
    const el = scrollRef.current; if (!el) return;
    el.scrollLeft = pan.current.sl - (e.clientX - pan.current.x);
    el.scrollTop = pan.current.st - (e.clientY - pan.current.y);
  };
  const onPanUp = () => { pan.current = null; };

  const zoomBy = (f: number) => setZoom((z) => clampZoom(z * f));
  const fit = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    const avail = el.clientWidth - 32;
    setZoom(clampZoom(avail / width));
    requestAnimationFrame(() => { el.scrollLeft = 0; el.scrollTop = 0; });
  }, [width]);

  return (
    <div className="flex-1 min-h-0 flex bg-suite-canvas">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Controls */}
        <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 p-0.5 bg-suite-bg border border-suite-border rounded-sm">
              {STRATEGIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setStrategy(s.id); setSelected(null); }}
                  className={cn(
                    "px-3 py-1.5 text-[10px] tracking-[0.14em] uppercase rounded-[3px] transition-colors",
                    strategy === s.id ? "bg-guide-target/15 text-guide-target" : "text-suite-text-muted hover:text-suite-text",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {/* Zoom controls */}
              <div className="flex items-center gap-1">
                <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out"
                  className="size-6 grid place-items-center rounded-sm border border-suite-border text-suite-text-muted hover:text-suite-text hover:border-suite-border-strong transition-colors">
                  <Minus className="size-3" strokeWidth={2} />
                </button>
                <span className="w-10 text-center text-[10px] font-mono tabular text-suite-text-dim">{Math.round(zoom * 100)}%</span>
                <button onClick={() => zoomBy(1.2)} title="Zoom in"
                  className="size-6 grid place-items-center rounded-sm border border-suite-border text-suite-text-muted hover:text-suite-text hover:border-suite-border-strong transition-colors">
                  <Plus className="size-3" strokeWidth={2} />
                </button>
                <button onClick={fit} title="Fit to width"
                  className="size-6 grid place-items-center rounded-sm border border-suite-border text-suite-text-muted hover:text-suite-text hover:border-suite-border-strong transition-colors">
                  <Maximize className="size-3" strokeWidth={1.8} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted" title="Mastering-display peak luminance the HDR hero is graded to">Peak</span>
                <div className="flex gap-1">
                  {MASTER_NITS.map((n) => (
                    <button key={n} onClick={() => setMasterNits(n)}
                      className={cn("px-2 py-0.5 text-[10px] font-mono tabular rounded-sm border transition-colors",
                        masterNits === n ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text" : "border-suite-border text-suite-text-muted hover:text-suite-text")}>
                      {n >= 1000 ? `${n / 1000}k` : n}
                    </button>
                  ))}
                  <span className="text-[9px] text-suite-text-dim self-center ml-0.5">nit</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted">ACES</span>
                <div className="flex gap-1">
                  {(["2.0", "1.3"] as AcesVersion[]).map((v) => (
                    <button key={v} onClick={() => onVersionChange(v)}
                      className={cn("px-2 py-0.5 text-[10px] font-mono rounded-sm border transition-colors",
                        version === v ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text" : "border-suite-border text-suite-text-muted hover:text-suite-text")}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-suite-text-dim font-mono leading-relaxed">
            <span className="text-suite-text">Hero: {strat.hero}.</span> {strat.when}
          </p>
        </div>

        {/* Graph */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-auto p-4 cursor-grab active:cursor-grabbing"
          onMouseDown={onPanDown}
          onMouseMove={onPanMove}
          onMouseUp={onPanUp}
          onMouseLeave={onPanUp}
        >
          {/* Scaled sizer — keeps the scrollable area in sync with the zoom. */}
          <div style={{ width: width * zoom, height: height * zoom }}>
          <div className="relative" style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
            {/* Lane headers */}
            {LANES.map((l, li) => (
              <div key={l.id} className="absolute text-[9px] tracking-[0.22em] uppercase text-suite-text-dim font-semibold"
                style={{ left: PAD + li * (COL_W + GAP_X), top: PAD, width: COL_W }}>
                {l.label}
              </div>
            ))}
            {/* Edges */}
            <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
              {graph.edges.map((e, i) => {
                const a = pos.get(e.from); const b = pos.get(e.to);
                if (!a || !b) return null;
                const x1 = a.x + COL_W, y1 = a.y + NODE_H / 2;
                const x2 = b.x, y2 = b.y + NODE_H / 2;
                const dx = Math.max(40, (x2 - x1) / 2);
                const meta = EDGE_OP_META[e.op];
                const up = e.direction === "up-volume";
                const stroke = up ? "#ef4444" : e.acesManaged ? "#22d3ee" : "#64748b";
                const dash = meta.style === "dashed" ? "6 4" : meta.style === "dotted" ? "2 5" : undefined;
                const active = sel && (e.from === sel.id || e.to === sel.id);
                return (
                  <path key={i} d={`M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`}
                    fill="none" stroke={stroke} strokeWidth={active ? 2.4 : 1.4}
                    strokeDasharray={dash} opacity={active ? 1 : sel ? 0.25 : 0.7} />
                );
              })}
            </svg>
            {/* Edge chips (midpoint). Compact op token by default; the selected
                node's edges expand to the full transform label. */}
            {graph.edges.map((e, i) => {
              const a = pos.get(e.from); const b = pos.get(e.to);
              if (!a || !b) return null;
              const mx = (a.x + COL_W + b.x) / 2;
              const my = (a.y + b.y) / 2 + NODE_H / 2;
              const up = e.direction === "up-volume";
              const active = !!(sel && (e.from === sel.id || e.to === sel.id));
              const full = active && !!e.label;
              return (
                <div key={i} title={e.warning ? `${e.label}\n\n${e.warning}` : e.label}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-[3px] border font-mono text-center pointer-events-auto transition-opacity",
                    full ? "max-w-[150px] text-[8.5px] leading-tight z-30" : "text-[8px] leading-none whitespace-nowrap",
                    sel && !active ? "opacity-25" : "opacity-100",
                    up ? "bg-red-950/85 border-red-500/50 text-red-200"
                      : e.acesManaged ? "bg-suite-bg border-guide-target/40 text-guide-target"
                      : "bg-suite-bg border-suite-border text-suite-text-dim",
                  )}
                  style={{ left: mx, top: my, zIndex: full ? 30 : 4 }}>
                  {up && <AlertTriangle className="inline size-2.5 mr-0.5 -mt-0.5" strokeWidth={2} />}
                  {full ? e.label : OP_TOKEN[e.op]}
                </div>
              );
            })}
            {/* Nodes */}
            {graph.nodes.map((n) => {
              const p = pos.get(n.id)!;
              const accent = ROLE_ACCENT[n.role];
              const isSidecar = n.type === "sidecar";
              const isActive = selected === n.id;
              return (
                <button key={n.id} onClick={() => setSelected(isActive ? null : n.id)}
                  className={cn(
                    "absolute text-left transition-shadow flex flex-col gap-0.5 px-2.5 py-1.5 overflow-hidden",
                    isSidecar ? "rounded-xl border-dashed bg-suite-panel/80" : "rounded-sm bg-suite-panel",
                    "border hover:z-20",
                    isActive ? "border-guide-target shadow-[0_0_0_2px_rgba(34,211,238,0.4)] z-20" : "border-suite-border",
                  )}
                  style={{ left: p.x, top: p.y, width: COL_W, height: isSidecar ? NODE_H - 14 : NODE_H, marginTop: isSidecar ? 7 : 0, borderLeft: `3px solid ${accent}`, zIndex: isActive ? 20 : 10 }}>
                  <span className="flex items-center gap-1 text-[10.5px] font-semibold text-suite-text leading-tight truncate w-full">
                    {n.isHero && <Crown className="size-3 shrink-0" style={{ color: accent }} strokeWidth={2} />}
                    {n.label}
                  </span>
                  <span className="text-[8.5px] font-mono text-suite-text-dim leading-tight truncate w-full">
                    {n.colourspace}
                  </span>
                  <span className="text-[8.5px] font-mono text-suite-text-muted leading-tight truncate w-full">
                    {n.eotf}{n.peakNits ? ` · ${n.peakNits} nit` : ""}
                  </span>
                  {n.container && (
                    <span className="text-[8px] font-mono text-suite-text-dim/70 leading-tight truncate w-full">{n.container}</span>
                  )}
                  {n.isHero && (
                    <span className="absolute top-1 right-1.5 text-[7px] tracking-widest uppercase font-bold" style={{ color: accent }}>HERO</span>
                  )}
                  {n.acesManaged && !isSidecar && n.type !== "grade" && (
                    <span className="absolute bottom-1 right-1.5 text-[7px] tracking-wider uppercase text-guide-target/60">ACES</span>
                  )}
                </button>
              );
            })}
          </div>
          </div>
          <p className="text-[10px] text-suite-text-dim font-mono mt-3 max-w-3xl leading-relaxed sticky left-4">
            Reference planning view, not an automated pipeline. Cyan edges are ACES-managed (up to the Output Transform); grey are downstream (Dolby Vision trims, wraps, encodes); <span className="text-red-300">red = up-volume — a fresh re-grade off the archive, never a clean transform</span>. Verify trim ladders, IMF/DCDM specs and CMVersion with your post house.
          </p>
        </div>
      </div>

      {/* Detail side panel */}
      {sel && (
        <aside className="w-80 shrink-0 border-l border-suite-border bg-suite-panel overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-suite-border">
            <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">Master Node</span>
            <button onClick={() => setSelected(null)} className="text-suite-text-muted hover:text-suite-text"><X className="size-3.5" /></button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: ROLE_ACCENT[sel.role] }} />
              <h3 className="text-[13px] font-semibold text-suite-text">{sel.label}</h3>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[11px] font-mono">
              <Row k="Type" v={sel.type} />
              <Row k="Colour" v={sel.colourspace} />
              <Row k="EOTF" v={sel.eotf} />
              {sel.peakNits && <Row k="Peak" v={`${sel.peakNits} nit`} />}
              {sel.container && <Row k="Container" v={sel.container} />}
              <Row k="Role" v={sel.role} />
              <Row k="ACES" v={sel.acesManaged ? "managed (≤ OT)" : "downstream"} />
            </dl>
            {sel.note && (
              <div className="border-t border-suite-border pt-3 flex gap-2">
                <AlertTriangle className="size-3.5 shrink-0 text-status-warn mt-0.5" strokeWidth={1.8} />
                <p className="text-[10.5px] text-suite-text-dim font-mono leading-relaxed">{sel.note}</p>
              </div>
            )}
            <div className="border-t border-suite-border pt-3">
              <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted">How it's produced</span>
              {inbound.length === 0 ? (
                <p className="text-[11px] text-suite-text-dim font-mono mt-2">Root node — the graded source.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {inbound.map((e, i) => (
                    <li key={i} className="text-[10.5px] font-mono leading-relaxed">
                      <span className="text-suite-text-muted">{EDGE_OP_META[e.op].label}</span>
                      <span className="text-suite-text-dim"> from {graph.nodes.find((n) => n.id === e.from)?.label}</span>
                      <div className={cn("mt-0.5", e.direction === "up-volume" ? "text-red-300" : e.acesManaged ? "text-guide-target" : "text-suite-text")}>{e.label}</div>
                      {e.warning && <div className="text-[9px] text-status-warn mt-0.5">{e.warning}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-suite-text-dim">{k}</dt>
      <dd className="text-suite-text">{v}</dd>
    </>
  );
}
