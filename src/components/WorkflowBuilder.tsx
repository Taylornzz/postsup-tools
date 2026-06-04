import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position, MarkerType,
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow,
  getNodesBounds, getViewportForBounds,
  type Node, type Edge, type Connection, type NodeProps, type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import {
  GitBranch, Plus, Trash2, X, ChevronRight, RotateCcw, Wand2, Check,
  Undo2, Redo2, Save, Download, FileText, Image as ImageIcon, FileDown, Braces,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES, NODES as PIPE_NODES, KIND_ACCENT } from "@/lib/pipeline";

/** Custom-workflow builder. A free-form node graph (like a Resolve node tree / mindmap):
 *  tick standard post steps to add them, drag to arrange, drag port→port to connect,
 *  rename and edit each node. Undo/redo, save named versions, export. Saves to the browser. */

type StepData = { label: string; owner?: string; detail?: string; color: string };
type Snapshot = { nodes: Node[]; edges: Edge[] };
type Version = { id: string; name: string; savedAt: number; nodes: Node[]; edges: Edge[] };

const KEY = "postsup-builder-v1";
const KEY_VERSIONS = "postsup-builder-versions";

let _seq = 0;
const uid = () => `n${Date.now().toString(36)}${(_seq++).toString(36)}`;

// ---- custom node ----
function StepNode({ data, selected }: NodeProps) {
  const d = data as StepData;
  return (
    <div
      className={cn(
        "rounded-md border bg-suite-panel px-3 py-2 min-w-[140px] max-w-[230px] shadow-sm transition-shadow",
        selected ? "ring-2 ring-guide-target" : "",
      )}
      style={{ borderColor: d.color }}
    >
      <Handle type="target" position={Position.Left} className="!size-2.5 !bg-suite-text-dim !border-suite-bg" />
      <div className="flex items-center gap-1.5">
        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
        <span className="font-mono text-[11px] text-suite-text font-semibold leading-snug">{d.label}</span>
      </div>
      {d.owner && <div className="font-mono text-[9px] text-suite-text-dim mt-0.5 truncate">{d.owner}</div>}
      <Handle type="source" position={Position.Right} className="!size-2.5 !bg-guide-target !border-suite-bg" />
    </div>
  );
}
const nodeTypes = { step: StepNode };

// ---- edge with a delete (×) button at its midpoint ----
function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style }: EdgeProps) {
  const { deleteElements } = useReactFlow();
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          className="nodrag nopan grid place-items-center size-4 rounded-full border border-suite-border bg-suite-panel text-suite-text-dim hover:text-destructive hover:border-destructive/60 transition-colors"
          style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all", fontSize: 10, lineHeight: 1 }}
          title="Remove connection"
          onClick={(e) => { e.stopPropagation(); void deleteElements({ edges: [{ id }] }); }}
        >×</button>
      </EdgeLabelRenderer>
    </>
  );
}
const edgeTypes = { deletable: DeletableEdge };

const defaultEdgeOptions = {
  type: "deletable" as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#64748b" },
  style: { stroke: "#64748b", strokeWidth: 1.5 },
};

// A very basic 6-step template covering the whole process; add detail from there.
const BASIC_TEMPLATE: StepData[] = [
  { label: "Camera Test & Show LUT", owner: "DOP + DIT", color: "#f59e0b" },
  { label: "Shoot & Offload", owner: "DIT", color: "#38bdf8" },
  { label: "Editorial — Offline → Lock", owner: "Editor", color: "#a78bfa" },
  { label: "VFX", owner: "VFX Producer", color: "#2dd4bf" },
  { label: "Grade & Online", owner: "Colourist + Online", color: "#22d3ee" },
  { label: "Delivery & Archive", owner: "Post Super", color: "#a78bfa" },
];

// ---- palette (grouped standard steps from the real pipeline) ----
const PALETTE = STAGES
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((s) => ({
    stage: s.label,
    steps: PIPE_NODES.filter((n) => n.stage === s.id).map((n) => ({
      label: n.label, owner: n.owner, detail: n.detail, color: KIND_ACCENT[n.kind],
    })),
  }))
  .filter((g) => g.steps.length > 0);

const CAMERA_TEST = PIPE_NODES.find((n) => /camera test|show lut|t-test/i.test(n.label) || n.id === "t-test");

function loadGraph(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (Array.isArray(g.nodes) && Array.isArray(g.edges)) return g;
  } catch { /* ignore */ }
  return null;
}

function loadVersions(): Version[] {
  try {
    const raw = localStorage.getItem(KEY_VERSIONS);
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) return a; }
  } catch { /* ignore */ }
  return [];
}

function seedNodes(): Node[] {
  const c = CAMERA_TEST;
  return [{
    id: uid(), type: "step", position: { x: 80, y: 160 },
    data: { label: c?.label ?? "Camera Test", owner: c?.owner ?? "DOP + DIT", detail: c?.detail ?? "", color: KIND_ACCENT[c?.kind ?? "look"] } as StepData,
  }];
}

// strip transient flags so restored / saved nodes don't carry stale selection
const clean = (ns: Node[]) => ns.map((n) => ({ ...n, selected: false, dragging: false }));

// ---- export helpers ----
function downloadURL(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
function downloadText(text: string, name: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  downloadURL(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const csvCell = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
function buildCSV(nodes: Node[], edges: Edge[]): string {
  const labelOf = (id: string) => (nodes.find((n) => n.id === id)?.data as StepData | undefined)?.label ?? id;
  const header = ["#", "Step", "Owner", "Detail", "Connects To"];
  const rows = nodes.map((n, i) => {
    const d = n.data as StepData;
    const outs = edges.filter((e) => e.source === n.id).map((e) => labelOf(e.target));
    return [i + 1, d.label, d.owner ?? "", d.detail ?? "", outs.join(" ; ")].map(csvCell).join(",");
  });
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}
async function exportImage(kind: "png" | "pdf", base: string, nodes: Node[]) {
  const vp = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!vp) throw new Error("no canvas");
  const bounds = getNodesBounds(nodes);
  const w = Math.min(Math.max(Math.round(bounds.width + 160), 640), 4096);
  const h = Math.min(Math.max(Math.round(bounds.height + 160), 460), 4096);
  const tr = getViewportForBounds(bounds, w, h, 0.4, 2, 0.12);
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(vp, {
    backgroundColor: "#0a0e13",
    width: w, height: h, pixelRatio: 2,
    style: { width: `${w}px`, height: `${h}px`, transform: `translate(${tr.x}px, ${tr.y}px) scale(${tr.zoom})` },
  });
  if (kind === "png") { downloadURL(dataUrl, `${base}.png`); return; }
  const { jsPDF } = await import("jspdf");
  const landscape = w >= h;
  const pdf = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "pt", format: "a4" });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), margin = 28;
  const scale = Math.min((pw - margin * 2) / w, (ph - margin * 2) / h);
  const iw = w * scale, ih = h * scale;
  pdf.setFontSize(9); pdf.setTextColor(120);
  pdf.text("PostSup Tools — Custom Workflow", margin, margin - 8);
  pdf.addImage(dataUrl, "PNG", (pw - iw) / 2, (ph - ih) / 2, iw, ih);
  pdf.save(`${base}.pdf`);
}

function Builder() {
  const saved = useMemo(loadGraph, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(saved?.nodes ?? seedNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(saved?.edges ?? []);
  const [selId, setSelId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [openStages, setOpenStages] = useState<Set<string>>(() => new Set(PALETTE.map((g) => g.stage)));

  // always-current refs (for history snapshots + export from event handlers)
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const edgesRef = useRef(edges); edgesRef.current = edges;

  // persist working graph
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ nodes, edges })); } catch { /* ignore */ }
  }, [nodes, edges]);

  // ---- undo / redo ----
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const dragSnap = useRef<Snapshot | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncHist = useCallback(() => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  }, []);
  const commit = useCallback(() => {
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    if (past.current.length > 80) past.current.shift();
    future.current = [];
    syncHist();
  }, [syncHist]);
  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    const prev = past.current.pop()!;
    setNodes(clean(prev.nodes)); setEdges(prev.edges); setSelId(null);
    syncHist();
  }, [setNodes, setEdges, syncHist]);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push({ nodes: nodesRef.current, edges: edgesRef.current });
    const next = future.current.pop()!;
    setNodes(clean(next.nodes)); setEdges(next.edges); setSelId(null);
    syncHist();
  }, [setNodes, setEdges, syncHist]);

  // keyboard: ⌘/Ctrl+Z undo, ⌘/Ctrl+Shift+Z or Ctrl+Y redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // deletions (× button, Delete key) snapshot before they apply
  const onBeforeDelete = useCallback(async () => { commit(); return true; }, [commit]);
  // drags snapshot at start, but only land in history if something actually moved
  const onNodeDragStart = useCallback(() => { dragSnap.current = { nodes: nodesRef.current, edges: edgesRef.current }; }, []);
  const onNodeDragStop = useCallback(() => {
    const snap = dragSnap.current; dragSnap.current = null;
    if (!snap) return;
    const moved = snap.nodes.some((o) => {
      const c = nodesRef.current.find((x) => x.id === o.id);
      return c && (c.position.x !== o.position.x || c.position.y !== o.position.y);
    });
    if (moved) { past.current.push(snap); if (past.current.length > 80) past.current.shift(); future.current = []; syncHist(); }
  }, [syncHist]);

  const onConnect = useCallback((c: Connection) => { commit(); setEdges((eds) => addEdge(c, eds)); }, [commit, setEdges]);

  const addStep = useCallback((tpl: StepData) => {
    commit();
    const n = nodesRef.current.length;
    const id = uid();
    setNodes((ns) => [...ns, {
      id, type: "step",
      position: { x: 120 + (n % 6) * 60, y: 120 + (n % 9) * 50 },
      data: { ...tpl },
    }]);
    setSelId(id);
  }, [commit, setNodes]);

  const selected = nodes.find((x) => x.id === selId) || null;
  const selData = selected?.data as StepData | undefined;
  const usedLabels = useMemo(() => new Set(nodes.map((n) => (n.data as StepData).label)), [nodes]);

  const patchSel = useCallback((p: Partial<StepData>) => {
    setNodes((ns) => ns.map((x) => (x.id === selId ? { ...x, data: { ...(x.data as StepData), ...p } } : x)));
  }, [selId, setNodes]);

  const deleteSel = useCallback(() => {
    if (!selId) return;
    commit();
    setNodes((ns) => ns.filter((x) => x.id !== selId));
    setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId));
    setSelId(null);
  }, [selId, commit, setNodes, setEdges]);

  function clearAll() {
    if (nodesRef.current.length && !window.confirm("Clear the whole workflow?")) return;
    commit();
    setNodes([]); setEdges([]); setSelId(null);
  }
  function reseed() {
    if (nodesRef.current.length && !window.confirm("Replace with a fresh Camera Test start?")) return;
    commit();
    setNodes(seedNodes()); setEdges([]); setSelId(null);
  }
  function loadTemplate() {
    if (nodesRef.current.length && !window.confirm("Replace with the basic 6-step template?")) return;
    commit();
    const ids = BASIC_TEMPLATE.map(() => uid());
    setNodes(BASIC_TEMPLATE.map((t, i) => ({ id: ids[i], type: "step", position: { x: 60 + i * 230, y: 180 }, data: { ...t } })));
    setEdges(ids.slice(0, -1).map((id, i) => ({ id: `e-${id}`, source: id, target: ids[i + 1] })));
    setSelId(null);
  }

  // ---- saved workflows ----
  const [versions, setVersions] = useState<Version[]>(loadVersions);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [showExport, setShowExport] = useState(false);
  useEffect(() => {
    try { localStorage.setItem(KEY_VERSIONS, JSON.stringify(versions)); } catch { /* ignore */ }
  }, [versions]);

  const saveVersion = useCallback(() => {
    if (!nodesRef.current.length) { toast.error("Nothing to save yet."); return; }
    const name = saveName.trim() || `Workflow ${versions.length + 1}`;
    const v: Version = { id: uid(), name, savedAt: Date.now(), nodes: clean(nodesRef.current), edges: edgesRef.current };
    setVersions((vs) => [v, ...vs.filter((x) => x.name !== name)]);
    setSaveName("");
    toast.success(`Saved “${name}”`);
  }, [saveName, versions.length]);

  const loadVersion = useCallback((v: Version) => {
    commit();
    setNodes(clean(v.nodes)); setEdges(v.edges); setSelId(null); setShowSave(false);
    toast.success(`Loaded “${v.name}”`);
  }, [commit, setNodes, setEdges]);

  const deleteVersion = useCallback((id: string) => setVersions((vs) => vs.filter((x) => x.id !== id)), []);

  const doExport = useCallback(async (fmt: "png" | "pdf" | "csv" | "json") => {
    setShowExport(false);
    if (!nodesRef.current.length) { toast.error("Nothing to export."); return; }
    const base = `postsup-workflow-${new Date().toISOString().slice(0, 10)}`;
    try {
      if (fmt === "csv") downloadText(buildCSV(nodesRef.current, edgesRef.current), `${base}.csv`, "text/csv;charset=utf-8");
      else if (fmt === "json") downloadText(JSON.stringify({ nodes: clean(nodesRef.current), edges: edgesRef.current }, null, 2), `${base}.json`, "application/json");
      else await exportImage(fmt, base, nodesRef.current);
      toast.success(`Exported ${fmt.toUpperCase()}`);
    } catch {
      toast.error("Export failed — try again.");
    }
  }, []);

  return (
    <div className="flex-1 min-h-0 min-w-0 flex bg-suite-canvas select-none">
      {/* Palette */}
      {showPalette && (
        <aside className="w-60 shrink-0 border-r border-suite-border bg-suite-panel flex flex-col">
          <div className="shrink-0 px-3 py-2.5 border-b border-suite-border flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-suite-text-muted">Add steps</span>
            <button onClick={() => setShowPalette(false)} className="text-suite-text-dim hover:text-suite-text"><X className="size-3.5" strokeWidth={2} /></button>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            <button onClick={() => addStep({ label: "New step", color: "#94a3b8" })}
              className="w-full text-left px-3 py-1.5 flex items-center gap-1.5 font-mono text-[11px] text-guide-target hover:bg-suite-panel-elevated">
              <Plus className="size-3" strokeWidth={2} /> Blank node
            </button>
            {PALETTE.map((g) => {
              const open = openStages.has(g.stage);
              return (
                <div key={g.stage} className="border-t border-suite-border/50">
                  <button onClick={() => setOpenStages((s) => { const n = new Set(s); n.has(g.stage) ? n.delete(g.stage) : n.add(g.stage); return n; })}
                    className="w-full flex items-center gap-1 px-2 py-1.5 font-mono text-[9px] tracking-[0.12em] uppercase text-suite-text-dim hover:text-suite-text">
                    <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} strokeWidth={2} /> {g.stage}
                  </button>
                  {open && g.steps.map((s, i) => {
                    const used = usedLabels.has(s.label);
                    return (
                      <button key={i} onClick={() => addStep(s)} title={used ? `${s.label} (already on the canvas — click to add another)` : s.detail}
                        className={cn("w-full text-left pl-7 pr-2 py-1 flex items-center gap-1.5 font-mono text-[10px] hover:bg-suite-panel-elevated",
                          used ? "text-suite-text-dim/60" : "text-suite-text-muted hover:text-suite-text")}>
                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                        <span className="truncate flex-1">{s.label}</span>
                        {used && <Check className="size-3 shrink-0 text-status-ok" strokeWidth={2.5} />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Canvas */}
      <div className="flex-1 min-w-0 relative">
        {/* toolbar */}
        <div className="absolute top-0 left-0 right-0 z-10 border-b border-suite-border bg-suite-panel/90 backdrop-blur px-4 py-2 flex items-center gap-2 flex-wrap">
          {!showPalette && (
            <button onClick={() => setShowPalette(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20">
              <Plus className="size-3" strokeWidth={2} /> Add steps
            </button>
          )}
          <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold flex items-center gap-1.5">
            <GitBranch className="size-3.5 text-guide-target" strokeWidth={1.6} /> Custom Workflow
          </span>
          <span className="font-mono text-[10px] text-suite-text-dim hidden xl:inline">— drag to arrange · port → port to connect · × on a line removes it · ⌘Z undo</span>
          <span className="flex-1" />

          {/* undo / redo */}
          <div className="flex items-center">
            <button onClick={undo} disabled={!canUndo} title="Undo (⌘Z)"
              className={cn("grid place-items-center size-7 border rounded-l-sm font-mono", canUndo ? "text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg" : "text-suite-text-dim/40 border-suite-border/50 bg-suite-bg/50 cursor-default")}>
              <Undo2 className="size-3.5" strokeWidth={1.6} />
            </button>
            <button onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)"
              className={cn("grid place-items-center size-7 border border-l-0 rounded-r-sm font-mono", canRedo ? "text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg" : "text-suite-text-dim/40 border-suite-border/50 bg-suite-bg/50 cursor-default")}>
              <Redo2 className="size-3.5" strokeWidth={1.6} />
            </button>
          </div>

          <button onClick={loadTemplate} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20"><Wand2 className="size-3" strokeWidth={1.6} /> Template</button>

          {/* save / versions */}
          <div className="relative">
            <button onClick={() => { setShowExport(false); setShowSave((s) => !s); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg"><Save className="size-3" strokeWidth={1.6} /> Save <ChevronRight className={cn("size-3 transition-transform", showSave && "rotate-90")} strokeWidth={2} /></button>
            {showSave && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowSave(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-30 w-72 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-2.5 flex flex-col gap-2">
                  <div className="flex gap-1.5">
                    <input value={saveName} onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveVersion(); }}
                      placeholder="Name this workflow…" autoFocus
                      className="flex-1 min-w-0 bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target" />
                    <button onClick={saveVersion} className="shrink-0 px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] font-mono border rounded-sm text-status-ok border-status-ok/50 bg-status-ok/10 hover:bg-status-ok/20">Save</button>
                  </div>
                  <div className="border-t border-suite-border/60 pt-1.5 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                    {versions.length === 0 ? (
                      <span className="font-mono text-[10px] text-suite-text-dim px-1 py-2">No saved workflows yet. Name one above and hit Save.</span>
                    ) : versions.map((v) => (
                      <div key={v.id} className="group flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-suite-panel-elevated">
                        <button onClick={() => loadVersion(v)} className="flex-1 min-w-0 text-left">
                          <div className="font-mono text-[11px] text-suite-text truncate">{v.name}</div>
                          <div className="font-mono text-[9px] text-suite-text-dim">{v.nodes.length} node{v.nodes.length === 1 ? "" : "s"} · {new Date(v.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                        </button>
                        <button onClick={() => deleteVersion(v.id)} title="Delete this saved workflow" className="shrink-0 text-suite-text-dim hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="size-3.5" strokeWidth={1.6} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* export */}
          <div className="relative">
            <button onClick={() => { setShowSave(false); setShowExport((s) => !s); }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg"><Download className="size-3" strokeWidth={1.6} /> Export <ChevronRight className={cn("size-3 transition-transform", showExport && "rotate-90")} strokeWidth={2} /></button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-30 w-52 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-1 flex flex-col">
                  {([
                    ["png", ImageIcon, "PNG image"],
                    ["pdf", FileDown, "PDF document"],
                    ["csv", FileText, "CSV (spreadsheet)"],
                    ["json", Braces, "JSON (backup)"],
                  ] as [Parameters<typeof doExport>[0], typeof FileText, string][]).map(([fmt, Icon, label]) => (
                    <button key={fmt} onClick={() => doExport(fmt)} className="flex items-center gap-2 px-2 py-1.5 rounded font-mono text-[11px] text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated text-left">
                      <Icon className="size-3.5 shrink-0 text-suite-text-dim" strokeWidth={1.6} /> {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button onClick={reseed} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg"><RotateCcw className="size-3" strokeWidth={1.6} /> Reset</button>
          <button onClick={clearAll} className="px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg">Clear</button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onBeforeDelete={onBeforeDelete}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          colorMode="dark"
          fitView
          deleteKeyCode={["Backspace", "Delete"]}
          onNodeClick={(_, n) => setSelId(n.id)}
          onPaneClick={() => setSelId(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} color="#1e293b" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={(n) => (n.data as StepData).color} maskColor="rgba(10,14,19,0.7)" />
        </ReactFlow>

        {/* Edit panel */}
        {selData && (
          <div className="absolute top-14 right-3 z-20 w-64 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.14em] uppercase text-suite-text-muted">Edit node</span>
              <button onClick={() => setSelId(null)} className="text-suite-text-dim hover:text-suite-text"><X className="size-3.5" strokeWidth={2} /></button>
            </div>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">Label</span>
              <input value={selData.label} onChange={(e) => patchSel({ label: e.target.value })}
                className="bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[12px] font-mono text-suite-text focus:outline-none focus:border-guide-target" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">Owner</span>
              <input value={selData.owner ?? ""} onChange={(e) => patchSel({ owner: e.target.value })}
                className="bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">Detail / notes</span>
              <textarea value={selData.detail ?? ""} onChange={(e) => patchSel({ detail: e.target.value })} rows={4}
                className="bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target resize-y" />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">Colour</span>
              <input type="color" value={selData.color} onChange={(e) => patchSel({ color: e.target.value })}
                className="w-10 h-6 bg-suite-bg border border-suite-border rounded-sm" />
            </label>
            <button onClick={deleteSel} className="flex items-center justify-center gap-1.5 mt-1 px-2 py-1.5 text-[10px] uppercase tracking-[0.1em] font-mono border rounded-sm text-destructive border-destructive/40 hover:bg-destructive/10">
              <Trash2 className="size-3" strokeWidth={1.6} /> Delete node
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WorkflowBuilder() {
  return (
    <ReactFlowProvider>
      <Builder />
    </ReactFlowProvider>
  );
}
