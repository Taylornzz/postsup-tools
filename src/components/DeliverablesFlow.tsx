import { useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, Position,
  useNodesState, useEdgesState, type Node, type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

/** Read-only inline preview of the delivery workflow, rendered right beside the
 *  list. Live: rebuilds whenever the recipients/plan change. The full editable
 *  builder still lives in the Workflow tab ("Open in builder"). */

export type FlowGraph = {
  nodes: { id: string; position: { x: number; y: number }; data: { label: string; owner?: string; detail?: string; color: string } }[];
  edges: { id: string; source: string; target: string; data?: { label?: string } }[];
};

function toNodes(g: FlowGraph): Node[] {
  return g.nodes.map((n) => ({
    id: n.id,
    position: n.position,
    data: { label: n.data.label, color: n.data.color },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    draggable: false,
    connectable: false,
    selectable: false,
    style: {
      background: n.data.color + "22",
      border: `1px solid ${n.data.color}`,
      color: "#e2e8f0",
      fontSize: 9,
      fontFamily: "ui-monospace, Menlo, monospace",
      width: 154,
      borderRadius: 4,
      padding: "6px 8px",
      lineHeight: 1.2,
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
  useEffect(() => { setNodes(toNodes(graph)); setEdges(toEdges(graph)); }, [graph, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.15}
      maxZoom={1.5}
      proOptions={{ hideAttribution: true }}
      className="bg-suite-canvas"
    >
      <Background color="#1e293b" gap={18} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable maskColor="rgba(10,14,19,0.6)" nodeColor={(n) => ((n.data as { color?: string })?.color) || "#475569"} className="!bg-suite-panel" />
    </ReactFlow>
  );
}
