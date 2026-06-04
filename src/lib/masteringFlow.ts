import { MarkerType, type Node, type Edge } from "@xyflow/react";
import {
  MasterGraph, MNode, LANES, EDGE_OP_META, ROLE_ACCENT, MASTERING_PALETTE_NODES,
} from "./mastering";
import type { StepData, PaletteGroup } from "@/components/WorkflowBuilder";

// Lane = column; nodes stack down each column. The builder pans/zooms freely,
// so exact spacing only needs to be readable, not pixel-matched to the derived view.
const LANE_X = 290;
const LANE_TOP = 60;
const NODE_GAP_Y = 130;

/** Map a mastering node to the builder's StepData (label + spec line + notes + colour). */
function nodeStep(n: MNode): StepData {
  const peak = n.peakNits ? ` · ${n.peakNits} nit` : "";
  const spec = [n.colourspace, `${n.eotf}${peak}`]
    .filter((s) => s && s !== "—" && s !== "metadata")
    .join("  ·  ");
  const detail = [
    n.container,
    n.acesManaged ? "ACES-managed (up to the Output Transform)" : null,
    n.note,
  ].filter(Boolean).join("\n\n");
  return {
    label: n.isHero ? `★ ${n.label}` : n.label,
    owner: spec || undefined,
    detail: detail || undefined,
    color: ROLE_ACCENT[n.role],
  };
}

/** Edge stroke carries the mastering semantics: red = up-volume regrade,
 *  cyan = ACES-managed, slate = downstream wrap/encode. */
function edgeStroke(e: MasterGraph["edges"][number]): string {
  return e.direction === "up-volume" ? "#ef4444" : e.acesManaged ? "#22d3ee" : "#64748b";
}

/** Convert a derived MasterGraph into editable builder nodes + edges. */
export function masterGraphToFlow(graph: MasterGraph): { nodes: Node[]; edges: Edge[] } {
  const laneIndex = new Map(LANES.map((l, i) => [l.id, i]));
  const slotPerLane = new Map<string, number>();
  const nodes: Node[] = graph.nodes.map((n) => {
    const li = laneIndex.get(n.lane) ?? 0;
    const slot = slotPerLane.get(n.lane) ?? 0;
    slotPerLane.set(n.lane, slot + 1);
    return {
      id: n.id,
      type: "step",
      position: { x: 40 + li * LANE_X, y: LANE_TOP + slot * NODE_GAP_Y },
      data: { ...nodeStep(n) },
    };
  });
  const edges: Edge[] = graph.edges.map((e, i) => {
    const stroke = edgeStroke(e);
    return {
      id: `me-${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      type: "deletable",
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: stroke },
      style: { stroke, strokeWidth: 1.5 },
      data: { label: EDGE_OP_META[e.op].label },
    };
  });
  return { nodes, edges };
}

/** Palette groups (by lane) of representative mastering nodes you can add. */
export function masteringPaletteGroups(): PaletteGroup[] {
  const byLane = new Map<string, StepData[]>();
  for (const n of MASTERING_PALETTE_NODES) {
    const laneLabel = LANES.find((l) => l.id === n.lane)?.label ?? n.lane;
    (byLane.get(laneLabel) ?? byLane.set(laneLabel, []).get(laneLabel)!).push(nodeStep(n));
  }
  return LANES
    .map((l) => ({ stage: l.label, steps: byLane.get(l.label) ?? [] }))
    .filter((g) => g.steps.length > 0);
}
