import { useMemo, useState } from "react";
import {
  AcesVersion,
} from "@/lib/aces";
import {
  MasteringStrategy, STRATEGIES, LANES, EDGE_OP_META,
  buildMasterGraph, MNode, MEdge, Lane, DeliverableRole,
} from "@/lib/mastering";
import { cn } from "@/lib/utils";
import { Crown, AlertTriangle, X } from "lucide-react";

interface Props {
  version: AcesVersion;
  onVersionChange: (v: AcesVersion) => void;
}

const COL_W = 188;
const NODE_H = 80;
const GAP_X = 78;
const GAP_Y = 20;
const PAD = 24;
const HEADER_H = 26;

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
  const [selected, setSelected] = useState<string | null>(null);

  const graph = useMemo(() => buildMasterGraph(strategy, version), [strategy, version]);
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
          <p className="text-[11px] text-suite-text-dim font-mono leading-relaxed">
            <span className="text-suite-text">Hero: {strat.hero}.</span> {strat.when}
          </p>
        </div>

        {/* Graph */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          <div className="relative" style={{ width, height }}>
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
            {/* Edge label chips (midpoint) */}
            {graph.edges.map((e, i) => {
              const a = pos.get(e.from); const b = pos.get(e.to);
              if (!a || !b || !e.label) return null;
              const mx = (a.x + COL_W + b.x) / 2;
              const my = (a.y + b.y) / 2 + NODE_H / 2;
              const up = e.direction === "up-volume";
              const active = sel && (e.from === sel.id || e.to === sel.id);
              if (sel && !active) return null;
              return (
                <div key={i} title={e.warning ? `${e.label}\n\n${e.warning}` : e.label}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 max-w-[150px] px-1.5 py-0.5 rounded-[3px] border text-[8.5px] leading-tight font-mono text-center pointer-events-auto",
                    up ? "bg-red-950/80 border-red-500/50 text-red-200"
                      : e.acesManaged ? "bg-suite-bg border-guide-target/40 text-guide-target"
                      : "bg-suite-bg border-suite-border text-suite-text-dim",
                  )}
                  style={{ left: mx, top: my, zIndex: 5 }}>
                  {up && <AlertTriangle className="inline size-2.5 mr-0.5 -mt-0.5" strokeWidth={2} />}
                  {e.label}
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
                    isSidecar ? "rounded-full bg-suite-panel/90" : "rounded-sm bg-suite-panel",
                    "border hover:z-20",
                    isActive ? "border-guide-target shadow-[0_0_0_2px_rgba(34,211,238,0.4)] z-20" : "border-suite-border",
                  )}
                  style={{ left: p.x, top: p.y, width: COL_W, height: NODE_H, borderLeft: `3px solid ${accent}`, zIndex: isActive ? 20 : 10 }}>
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
          <p className="text-[10px] text-suite-text-dim font-mono mt-3 max-w-3xl leading-relaxed">
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
