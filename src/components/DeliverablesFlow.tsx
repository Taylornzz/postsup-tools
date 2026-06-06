import { useEffect, useRef } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, Position,
  useNodesState, useEdgesState, type Node, type Edge, type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/** Read-only inline preview of the delivery workflow, beside the list. Live:
 *  rebuilds whenever the recipients/plan change, and re-fits the view on open
 *  and on every pane resize so it always fills the panel (no empty gap). */

export type FlowGraph = {
  nodes: { id: string; position: { x: number; y: number }; data: { label: string; owner?: string; detail?: string; color: string } }[];
  edges: { id: string; source: string; target: string; data?: { label?: string } }[];
};

function toNodes(g: FlowGraph): Node[] {
  return g.nodes.map((n) => ({
    id: n.id,
    position: n.position,
    data: { label: n.data.label, color: n.data.color },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    draggable: false,
    connectable: false,
    selectable: false,
    style: {
      background: n.data.color + "22",
      border: `1px solid ${n.data.color}`,
      color: "#e2e8f0",
      fontSize: 9,
      fontFamily: "ui-monospace, Menlo, monospace",
      width: 150,
      borderRadius: 4,
      padding: "6px 8px",
      lineHeight: 1.2,
      textAlign: "center" as const,
    },
  }));
}
function toEdges(g: FlowGraph): Edge[] {
  return g.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.data?.label,
    style: { stroke: "#475569", strokeWidth: 1.2 },
    labelStyle: { fontSize: 8, fill: "#94a3b8", fontFamily: "ui-monospace, monospace" },
    labelBgStyle: { fill: "#0a0e13", fillOpacity: 0.85 },
  }));
}

export default function DeliverablesFlow({ graph }: { graph: FlowGraph }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toNodes(graph));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toEdges(graph));
  const inst = useRef<ReactFlowInstance | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const fit = () => inst.current?.fitView({ padding: 0.12, duration: 150 });

  // keep the graph in sync, then re-fit after the nodes update
  useEffect(() => {
    setNodes(toNodes(graph));
    setEdges(toEdges(graph));
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [graph, setNodes, setEdges]);

  // re-fit whenever the pane resizes — on first open, lazy reveal, divider drag
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(fit); });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div ref={wrap} className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={(i) => { inst.current = i; requestAnimationFrame(fit); }}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        className="bg-suite-canvas"
      >
        <Background color="#1e293b" gap={18} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable maskColor="rgba(10,14,19,0.6)" nodeColor={(n) => ((n.data as { color?: string })?.color) || "#475569"} className="!bg-suite-panel" />
      </ReactFlow>
    </div>
  );
}
