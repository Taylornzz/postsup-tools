import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState, Handle, Position, MarkerType,
  BaseEdge, EdgeLabelRenderer, getSmoothStepPath, useReactFlow,
  type Node, type Edge, type Connection, type NodeProps, type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch, Plus, Trash2, X, ChevronRight, RotateCcw, Wand2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGES, NODES as PIPE_NODES, KIND_ACCENT } from "@/lib/pipeline";

/** Custom-workflow builder. A free-form node graph (like a Resolve node tree / mindmap):
 *  tick standard post steps to add them, drag to arrange, drag port→port to connect,
 *  rename and edit each node. Saves to the browser. */

type StepData = { label: string; owner?: string; detail?: string; color: string };
const KEY = "postsup-builder-v1";

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
  const { setEdges } = useReactFlow();
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          className="nodrag nopan grid place-items-center size-4 rounded-full border border-suite-border bg-suite-panel text-suite-text-dim hover:text-destructive hover:border-destructive/60 transition-colors"
          style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all", fontSize: 10, lineHeight: 1 }}
          title="Remove connection"
          onClick={(e) => { e.stopPropagation(); setEdges((es) => es.filter((x) => x.id !== id)); }}
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

function loadGraph(): { nodes: Node[]; edges: Edge[] } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (Array.isArray(g.nodes) && Array.isArray(g.edges)) return g;
  } catch { /* ignore */ }
  return null;
}

function seedNodes(): Node[] {
  const c = CAMERA_TEST;
  return [{
    id: uid(), type: "step", position: { x: 80, y: 160 },
    data: { label: c?.label ?? "Camera Test", owner: c?.owner ?? "DOP + DIT", detail: c?.detail ?? "", color: KIND_ACCENT[c?.kind ?? "look"] } as StepData,
  }];
}

function Builder() {
  const saved = useMemo(loadGraph, []);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(saved?.nodes ?? seedNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(saved?.edges ?? []);
  const [selId, setSelId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [openStages, setOpenStages] = useState<Set<string>>(() => new Set(PALETTE.map((g) => g.stage)));

  // persist
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ nodes, edges })); } catch { /* ignore */ }
  }, [nodes, edges]);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge(c, eds)), [setEdges]);

  const addStep = useCallback((tpl: StepData) => {
    const n = nodes.length;
    const id = uid();
    setNodes((ns) => [...ns, {
      id, type: "step",
      position: { x: 120 + (n % 6) * 60, y: 120 + (n % 9) * 50 },
      data: { ...tpl },
    }]);
    setSelId(id);
  }, [nodes.length, setNodes]);

  const selected = nodes.find((x) => x.id === selId) || null;
  const selData = selected?.data as StepData | undefined;
  const usedLabels = useMemo(() => new Set(nodes.map((n) => (n.data as StepData).label)), [nodes]);

  const patchSel = useCallback((p: Partial<StepData>) => {
    setNodes((ns) => ns.map((x) => (x.id === selId ? { ...x, data: { ...(x.data as StepData), ...p } } : x)));
  }, [selId, setNodes]);

  const deleteSel = useCallback(() => {
    if (!selId) return;
    setNodes((ns) => ns.filter((x) => x.id !== selId));
    setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId));
    setSelId(null);
  }, [selId, setNodes, setEdges]);

  function clearAll() {
    if (nodes.length && !window.confirm("Clear the whole workflow?")) return;
    setNodes([]); setEdges([]); setSelId(null);
  }
  function reseed() {
    if (nodes.length && !window.confirm("Replace with a fresh Camera Test start?")) return;
    setNodes(seedNodes()); setEdges([]); setSelId(null);
  }
  function loadTemplate() {
    if (nodes.length && !window.confirm("Replace with the basic 6-step template?")) return;
    const ids = BASIC_TEMPLATE.map(() => uid());
    setNodes(BASIC_TEMPLATE.map((t, i) => ({ id: ids[i], type: "step", position: { x: 60 + i * 230, y: 180 }, data: { ...t } })));
    setEdges(ids.slice(0, -1).map((id, i) => ({ id: `e-${id}`, source: id, target: ids[i + 1] })));
    setSelId(null);
  }

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
          <span className="font-mono text-[10px] text-suite-text-dim hidden lg:inline">— drag to arrange · drag a node's right dot → another's left dot to connect (a node can branch to many) · click the × on a line to remove it · click a node to edit</span>
          <span className="flex-1" />
          <button onClick={loadTemplate} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20"><Wand2 className="size-3" strokeWidth={1.6} /> Template</button>
          <button onClick={reseed} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg"><RotateCcw className="size-3" strokeWidth={1.6} /> Reset</button>
          <button onClick={clearAll} className="px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg">Clear</button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
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
