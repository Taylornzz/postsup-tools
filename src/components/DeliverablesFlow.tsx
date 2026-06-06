import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap, Position,
  useNodesState, useEdgesState, useReactFlow, useNodesInitialized,
  type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/** Inline workflow preview beside the deliverables list. Nodes are draggable and
 *  their positions persist per-project. It frames itself once on open — both via
 *  React Flow's `fitView` and a guaranteed re-fit the moment the nodes are
 *  measured — then stays put. The Controls "fit view" button re-frames on demand. */

export type FlowGraph = {
  nodes: { id: string; position: { x: number; y: number }; data: { label: string; owner?: string; detail?: string; color: string } }[];
  edges: { id: string; source: string; target: string; data?: { label?: string } }[];
};

const posKey = (pid?: string) => `kaos.deliverables.flowpos${pid ? `-${pid}` : ""}`;
function loadPos(pid?: string): Record<string, { x: number; y: number }> {
  try { return JSON.parse(localStorage.getItem(posKey(pid)) || "{}") || {}; } catch { return {}; }
}

function toNodes(g: FlowGraph, saved: Record<string, { x: number; y: number }>): Node[] {
  return g.nodes.map((n) => ({
    id: n.id,
    position: saved[n.id] ?? n.position,
    data: { label: n.data.label, color: n.data.color },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
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

function Flow({ graph, projectId }: { graph: FlowGraph; projectId?: string }) {
  const saved = useRef<Record<string, { x: number; y: number }>>(loadPos(projectId));
  const [nodes, setNodes, onNodesChange] = useNodesState(toNodes(graph, saved.current));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toEdges(graph));
  const rf = useReactFlow();
  const initialized = useNodesInitialized();
  const didFit = useRef(false);

  // content stays live (labels/structure update) but keeps any dragged positions
  useEffect(() => {
    setNodes(toNodes(graph, saved.current));
    setEdges(toEdges(graph));
  }, [graph, setNodes, setEdges]);

  useEffect(() => { saved.current = loadPos(projectId); }, [projectId]);

  // guaranteed one-time fit once the nodes have real measured dimensions
  useEffect(() => {
    if (initialized && !didFit.current) {
      didFit.current = true;
      requestAnimationFrame(() => rf.fitView({ padding: 0.15 }));
    }
  }, [initialized, rf]);

  const onDragStop = useCallback((_e: unknown, node: Node) => {
    saved.current = { ...saved.current, [node.id]: { x: Math.round(node.position.x), y: Math.round(node.position.y) } };
    try { localStorage.setItem(posKey(projectId), JSON.stringify(saved.current)); } catch { /* ignore */ }
  }, [projectId]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={onDragStop}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      minZoom={0.1}
      maxZoom={1.6}
      proOptions={{ hideAttribution: true }}
      className="bg-suite-canvas"
    >
      <Background color="#1e293b" gap={18} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable maskColor="rgba(10,14,19,0.6)" nodeColor={(n) => ((n.data as { color?: string })?.color) || "#475569"} className="!bg-suite-panel" />
    </ReactFlow>
  );
}

export default function DeliverablesFlow(props: { graph: FlowGraph; projectId?: string }) {
  return (
    <ReactFlowProvider>
      <Flow {...props} />
    </ReactFlowProvider>
  );
}
