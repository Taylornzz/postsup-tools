import { useMemo, useState, useRef, useEffect } from "react";
import {
  buildPipeline, PNode, PEdge, KIND_ACCENT, P_EDGE_META, PipelineConfig,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { X, Plus, Minus, Maximize, ArrowUpRight, AlertTriangle } from "lucide-react";

const NODE_W = 184;
const NODE_H = 60;
const GAP_X = 24;
const LABEL_H = 22;
const STAGE_GAP = 44;
const PAD = 28;
const BLOCK_GAP = 70;
const RAIL_GUTTER = 46;

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2.2;
const cz = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

interface Props { onOpenMastering: () => void; config?: PipelineConfig; }

export function WorkflowPipeline({ onOpenMastering, config }: Props) {
  const { stages, nodes, edges } = useMemo(() => buildPipeline(config), [config]);
  const [selected, setSelected] = useState<string | null>(null);

  // --- Layout: orders → Y-bands; picture/data left block, audio right block ---
  const { pos, width, height, railX, bandLabels } = useMemo(() => {
    const orders = [...new Set(stages.map((s) => s.order))].sort((a, b) => a - b);
    const byOrder = new Map<number, PNode[]>();
    orders.forEach((o) => byOrder.set(o, []));
    const stageOrder = new Map<string, number>(stages.map((s) => [s.id, s.order]));
    nodes.forEach((nd) => byOrder.get(stageOrder.get(nd.stage)!)!.push(nd));

    const maxPicCols = Math.max(1, ...orders.map((o) => byOrder.get(o)!.filter((x) => x.track !== "audio").length));
    const maxAudCols = Math.max(0, ...orders.map((o) => byOrder.get(o)!.filter((x) => x.track === "audio").length));
    const picBlockW = maxPicCols * (NODE_W + GAP_X) - GAP_X;
    const audioX = PAD + picBlockW + BLOCK_GAP;
    const audBlockW = maxAudCols > 0 ? maxAudCols * (NODE_W + GAP_X) - GAP_X : 0;
    const width = audioX + audBlockW + PAD + RAIL_GUTTER;

    const pos = new Map<string, { x: number; y: number }>();
    const bandLabels: { stageId: string; label: string; x: number; y: number; track: string }[] = [];
    let cursor = PAD;
    for (const o of orders) {
      const bandNodes = byOrder.get(o)!;
      const pic = bandNodes.filter((x) => x.track !== "audio");
      const aud = bandNodes.filter((x) => x.track === "audio");
      const y = cursor + LABEL_H;
      pic.forEach((nd, i) => pos.set(nd.id, { x: PAD + i * (NODE_W + GAP_X), y }));
      aud.forEach((nd, i) => pos.set(nd.id, { x: audioX + i * (NODE_W + GAP_X), y }));
      stages.filter((s) => s.order === o).forEach((s) => {
        const sNodes = bandNodes.filter((nd) => nd.stage === s.id);
        if (!sNodes.length) return;
        const minX = Math.min(...sNodes.map((nd) => pos.get(nd.id)!.x));
        bandLabels.push({ stageId: s.id, label: s.label, x: minX, y: cursor, track: s.track });
      });
      cursor = y + NODE_H + STAGE_GAP;
    }
    return { pos, width, height: cursor + PAD, railX: width - RAIL_GUTTER / 2, bandLabels };
  }, [stages, nodes]);

  const sel = nodes.find((n) => n.id === selected) ?? null;
  const inbound = sel ? edges.filter((e) => e.to === sel.id) : [];
  const outbound = sel ? edges.filter((e) => e.from === sel.id) : [];

  // --- zoom + pan (same pattern as the Mastering canvas) -------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.75);
  useEffect(() => {
    const el = scrollRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left + el.scrollLeft, py = e.clientY - rect.top + el.scrollTop;
      setZoom((z) => {
        const next = cz(z * Math.exp(-e.deltaY * 0.0015));
        const ratio = next / z;
        requestAnimationFrame(() => { el.scrollLeft = px * ratio - (e.clientX - rect.left); el.scrollTop = py * ratio - (e.clientY - rect.top); });
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const onDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = scrollRef.current; if (!el) return;
    pan.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!pan.current || !scrollRef.current) return;
    scrollRef.current.scrollLeft = pan.current.sl - (e.clientX - pan.current.x);
    scrollRef.current.scrollTop = pan.current.st - (e.clientY - pan.current.y);
  };
  const onUp = () => { pan.current = null; };
  const zoomBy = (f: number) => setZoom((z) => cz(z * f));
  const fit = () => { const el = scrollRef.current; if (!el) return; setZoom(cz((el.clientHeight - 40) / height)); requestAnimationFrame(() => { el.scrollLeft = 0; el.scrollTop = 0; }); };

  const path = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const sB = { x: a.x + NODE_W / 2, y: a.y + NODE_H }, tT = { x: b.x + NODE_W / 2, y: b.y };
    const sR = { x: a.x + NODE_W, y: a.y + NODE_H / 2 }, sL = { x: a.x, y: a.y + NODE_H / 2 };
    const tL = { x: b.x, y: b.y + NODE_H / 2 }, tR = { x: b.x + NODE_W, y: b.y + NODE_H / 2 };
    if (b.y > a.y + 4) { const dy = Math.max(28, (tT.y - sB.y) / 2); return `M ${sB.x} ${sB.y} C ${sB.x} ${sB.y + dy}, ${tT.x} ${tT.y - dy}, ${tT.x} ${tT.y}`; }
    if (Math.abs(b.y - a.y) <= 4) {
      if (b.x >= a.x) { const dx = Math.max(24, (tL.x - sR.x) / 2); return `M ${sR.x} ${sR.y} C ${sR.x + dx} ${sR.y}, ${tL.x - dx} ${tL.y}, ${tL.x} ${tL.y}`; }
      const dx = Math.max(24, (sL.x - tR.x) / 2); return `M ${sL.x} ${sL.y} C ${sL.x - dx} ${sL.y}, ${tR.x + dx} ${tR.y}, ${tR.x} ${tR.y}`;
    }
    return `M ${sR.x} ${sR.y} C ${railX} ${sR.y}, ${railX} ${tR.y}, ${tR.x} ${tR.y}`; // up → right rail
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 flex bg-suite-canvas">
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {/* Toolbar */}
        <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[11px] text-suite-text-dim font-mono leading-relaxed max-w-3xl">
            <span className="text-suite-text">End-to-end pipeline</span> — camera test &amp; show LUT → set → dailies → VFX → conform → grade/masters → QC → delivery → archive, with a parallel audio track. Click any node for detail. Drag to pan · scroll to zoom.
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out" className="size-6 grid place-items-center rounded-sm border border-suite-border text-suite-text-muted hover:text-suite-text"><Minus className="size-3" strokeWidth={2} /></button>
            <span className="w-10 text-center text-[10px] font-mono tabular text-suite-text-dim">{Math.round(zoom * 100)}%</span>
            <button onClick={() => zoomBy(1.2)} title="Zoom in" className="size-6 grid place-items-center rounded-sm border border-suite-border text-suite-text-muted hover:text-suite-text"><Plus className="size-3" strokeWidth={2} /></button>
            <button onClick={fit} title="Fit to height" className="size-6 grid place-items-center rounded-sm border border-suite-border text-suite-text-muted hover:text-suite-text"><Maximize className="size-3" strokeWidth={1.8} /></button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto p-4 cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-suite-border-strong" style={{ scrollbarWidth: "thin" }} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
          <div style={{ width: width * zoom, height: height * zoom }}>
            <div className="relative" style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "0 0" }}>
              {/* band labels */}
              {bandLabels.map((b) => (
                <div key={b.stageId} className={cn("absolute text-[9px] tracking-[0.18em] uppercase font-semibold whitespace-nowrap", b.track === "audio" ? "text-fuchsia-300/70" : b.track === "data" ? "text-violet-300/70" : "text-suite-text-dim")}
                  style={{ left: b.x, top: b.y }}>{b.label}</div>
              ))}
              {/* edges */}
              <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
                {edges.map((e, i) => {
                  const a = pos.get(e.from), b = pos.get(e.to); if (!a || !b) return null;
                  const meta = P_EDGE_META[e.op];
                  const active = sel && (e.from === sel.id || e.to === sel.id);
                  const back = meta.back;
                  const stroke = back ? "#ef4444" : meta.approve ? "#4ade80" : meta.data ? "#a78bfa" : e.dashed ? "#64748b" : "#22d3ee";
                  const dash = meta.style === "dashed" || e.dashed ? "6 4" : meta.style === "dotted" ? "2 5" : undefined;
                  return <path key={i} d={path(a, b)} fill="none" stroke={stroke} strokeWidth={active ? 2.4 : back ? 1.6 : 1.3} strokeDasharray={dash} opacity={active ? 1 : sel ? 0.18 : 0.6} />;
                })}
              </svg>
              {/* edge chips */}
              {edges.map((e, i) => {
                const a = pos.get(e.from), b = pos.get(e.to); if (!a || !b) return null;
                const active = !!(sel && (e.from === sel.id || e.to === sel.id));
                const meta = P_EDGE_META[e.op];
                const back = meta.back;
                // Same-band (lateral) edges sit in a tight inter-node gap — keep them
                // compact and raise them into the header gap above the node row so
                // they never cover the cards. Only vertical edges expand to the full label.
                const lateral = !back && Math.abs(a.y - b.y) <= 4;
                const full = active && !lateral;
                const mx = back ? railX
                  : lateral ? (Math.min(a.x, b.x) + NODE_W + Math.max(a.x, b.x)) / 2
                  : (a.x + b.x) / 2 + NODE_W / 2;
                const my = lateral ? a.y - 8 : (a.y + b.y) / 2 + NODE_H / 2;
                return (
                  <div key={i} title={e.label}
                    className={cn("absolute -translate-x-1/2 -translate-y-1/2 px-1 py-0.5 rounded-[3px] border font-mono text-center pointer-events-auto transition-opacity",
                      full ? "max-w-[150px] text-[8.5px] leading-tight z-30" : "text-[8px] leading-none whitespace-nowrap",
                      sel && !active ? "opacity-0" : "opacity-100",
                      back ? "bg-red-950/85 border-red-500/50 text-red-200" : meta.approve ? "bg-suite-bg border-green-400/40 text-green-300" : meta.data ? "bg-suite-bg border-violet-400/40 text-violet-200" : e.dashed ? "bg-suite-bg border-suite-border text-suite-text-dim" : "bg-suite-bg border-guide-target/40 text-guide-target")}
                    style={{ left: mx, top: my, zIndex: active ? 30 : 3 }}>
                    {back && <AlertTriangle className="inline size-2.5 mr-0.5 -mt-0.5" strokeWidth={2} />}
                    {full ? e.label : meta.token}
                  </div>
                );
              })}
              {/* nodes */}
              {nodes.map((nd) => {
                const p = pos.get(nd.id)!; const accent = KIND_ACCENT[nd.kind];
                const isActive = selected === nd.id;
                const isMaster = nd.kind === "master";
                return (
                  <button key={nd.id} onClick={() => setSelected(isActive ? null : nd.id)}
                    className={cn("absolute text-left flex flex-col justify-center gap-0.5 px-2.5 py-1.5 overflow-hidden rounded-sm bg-suite-panel border transition-shadow",
                      isActive ? "border-guide-target shadow-[0_0_0_2px_rgba(34,211,238,0.4)] z-20" : "border-suite-border hover:z-10")}
                    style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, borderLeft: `3px solid ${accent}`, zIndex: isActive ? 20 : 6 }}>
                    <span className="text-[10.5px] font-semibold text-suite-text leading-tight line-clamp-2 w-full flex items-center gap-1">
                      {nd.label}{isMaster && <ArrowUpRight className="size-3 shrink-0" style={{ color: accent }} strokeWidth={2} />}
                    </span>
                    <span className="text-[8px] tracking-wide uppercase truncate w-full" style={{ color: accent, opacity: 0.85 }}>
                      {nd.owner ?? nd.kind.replace("-", " ")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[10px] text-suite-text-dim font-mono mt-3 max-w-3xl leading-relaxed sticky left-4">
            <span className="text-suite-text-muted">Planning view, not an automated pipeline.</span> Cyan = colour/pixel transform · <span className="text-green-300">green = approval / sign-off</span> · violet = data-integrity · grey dashed = wrap / view / proxy · <span className="text-red-300">red = revisions / QC fail-loop (back upstream)</span>. Each node shows its OWNER. The audio column (fuchsia, right) branches at lock and re-marries picture at delivery. Verify loudness, IMF/DCDM specs, archive policy and CMVersion with your post house.
          </p>
        </div>
      </div>

      {/* Detail panel */}
      {sel && (
        <aside className="w-80 shrink-0 border-l border-suite-border bg-suite-panel overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-suite-border">
            <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">{stages.find((s) => s.id === sel.stage)?.label}</span>
            <button onClick={() => setSelected(null)} className="text-suite-text-muted hover:text-suite-text"><X className="size-3.5" /></button>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full" style={{ background: KIND_ACCENT[sel.kind] }} />
              <h3 className="text-[13px] font-semibold text-suite-text">{sel.label}</h3>
            </div>
            {sel.owner && (
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted">Owner</span>
                <span className="text-suite-text px-1.5 py-0.5 rounded-sm bg-suite-bg border border-suite-border">{sel.owner}</span>
              </div>
            )}
            <p className="text-[11px] text-suite-text-dim font-mono leading-relaxed">{sel.detail}</p>
            {sel.kind === "master" && (
              <button onClick={onOpenMastering} className="flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] tracking-[0.14em] uppercase border border-guide-target/50 text-guide-target hover:bg-guide-target/10 rounded-sm transition-colors">
                Open full Mastering tree <ArrowUpRight className="size-3" strokeWidth={2} />
              </button>
            )}
            {inbound.length > 0 && (
              <Section title="Produced by">
                {inbound.map((e, i) => <EdgeLine key={i} e={e} other={nodes.find((x) => x.id === e.from)?.label} dir="from" />)}
              </Section>
            )}
            {outbound.length > 0 && (
              <Section title="Feeds">
                {outbound.map((e, i) => <EdgeLine key={i} e={e} other={nodes.find((x) => x.id === e.to)?.label} dir="to" />)}
              </Section>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-suite-border pt-3">
      <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted">{title}</span>
      <ul className="mt-2 flex flex-col gap-2">{children}</ul>
    </div>
  );
}

function EdgeLine({ e, other, dir }: { e: PEdge; other?: string; dir: "from" | "to" }) {
  const meta = P_EDGE_META[e.op];
  return (
    <li className="text-[10.5px] font-mono leading-relaxed">
      <span className="text-suite-text-muted">{dir === "from" ? "←" : "→"} {other}</span>
      <div className={cn("mt-0.5", meta.back ? "text-red-300" : meta.data ? "text-violet-200" : e.dashed ? "text-suite-text-dim" : "text-guide-target")}>{e.label}</div>
    </li>
  );
}
