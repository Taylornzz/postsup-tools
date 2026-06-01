import { describe, it, expect } from "vitest";
import { buildPipeline, STAGES, NODES, EDGES } from "@/lib/pipeline";

describe("buildPipeline", () => {
  const g = buildPipeline();

  it("has no dangling edges (every from/to is a real node)", () => {
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.from), `from ${e.from}`).toBe(true);
      expect(ids.has(e.to), `to ${e.to}`).toBe(true);
    }
  });

  it("every node belongs to a declared stage", () => {
    const stageIds = new Set(STAGES.map((s) => s.id));
    for (const n of NODES) expect(stageIds.has(n.stage), n.stage).toBe(true);
  });

  it("covers the full spine end to end (test → archive) plus the audio track", () => {
    const tracks = new Set(STAGES.map((s) => s.track));
    expect(tracks.has("picture")).toBe(true);
    expect(tracks.has("audio")).toBe(true);
    expect(tracks.has("data")).toBe(true);
    expect(STAGES.find((s) => s.id === "test")).toBeTruthy();   // front
    expect(STAGES.find((s) => s.id === "archive")).toBeTruthy(); // tail
    // the camera original is the single hero source feeding offload
    expect(EDGES.some((e) => e.from === "p-orig" && e.op === "checksum-verify")).toBe(true);
  });

  it("the Mastering stage folds in as one master node with the right boundary edges", () => {
    const master = g.nodes.find((n) => n.kind === "master");
    expect(master?.id).toBe("m-master");
    expect(g.edges.some((e) => e.to === "m-master" && e.op === "output-transform")).toBe(true);
    expect(g.edges.some((e) => e.from === "m-master" && e.to === "del-imf")).toBe(true);
  });

  it("audio re-marries picture at delivery (rejoin), and QC has fail-loops", () => {
    expect(g.edges.some((e) => e.op === "rejoin" && e.to === "del-imf")).toBe(true);
    expect(g.edges.filter((e) => e.op === "qc-fail-loop").length).toBeGreaterThanOrEqual(2);
  });
});
