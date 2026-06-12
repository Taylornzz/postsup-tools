import { describe, it, expect } from "vitest";
import { buildMasterGraph, buildCustomGraph } from "./mastering";
import { masterGraphToFlow, masteringPaletteGroups } from "./masteringFlow";

describe("masteringFlow — derive→edit converter", () => {
  it("converts a derived graph to valid builder nodes + edges", () => {
    const g = buildMasterGraph("hdr-first", "2.0", 1000);
    const { nodes, edges } = masterGraphToFlow(g);
    expect(nodes.length).toBe(g.nodes.length);
    const ids = new Set(nodes.map((n) => n.id));
    for (const n of nodes) {
      expect(n.type).toBe("step");
      const d = n.data as { label: string; color: string };
      expect(d.label).toBeTruthy();
      expect(d.color).toMatch(/^#/);
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
    // every edge connects two real nodes and renders via the deletable type
    expect(edges.length).toBe(g.edges.length);
    for (const e of edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
      expect(e.type).toBe("deletable");
      expect((e.style as { stroke: string }).stroke).toMatch(/^#/);
    }
  });

  it("keeps the mastering semantics in edge colour (up-volume regrade = red)", () => {
    const g = buildMasterGraph("theatrical-first", "2.0", 1000); // has an arch→hdrHero up-volume edge
    const { edges } = masterGraphToFlow(g);
    expect(edges.some((e) => (e.style as { stroke: string }).stroke === "#ef4444")).toBe(true);
  });

  it("converts a custom graph with every edge wired to an existing node", () => {
    const g = buildCustomGraph(
      { hero: "streaming-hdr", deliverables: ["hdr", "sdr", "theatrical", "archive", "proxies"] },
      "2.0",
      1000,
    );
    const { nodes, edges } = masterGraphToFlow(g);
    const ids = new Set(nodes.map((n) => n.id));
    expect(nodes.length).toBeGreaterThan(0);
    for (const e of edges) expect(ids.has(e.source) && ids.has(e.target)).toBe(true);
  });

  it("an SDR-hero show still gets its IMF SDR wrap", () => {
    const g = buildCustomGraph({ hero: "broadcast", deliverables: ["sdr"] }, "2.0", 1000);
    expect(g.nodes.some((n) => n.id === "imfsdr")).toBe(true);
    expect(g.edges.some((e) => e.from === "sdr" && e.to === "imfsdr")).toBe(true);
  });

  it("SDR derived from a PQ hero without the hdr deliverable keeps every edge on a real node", () => {
    const g = buildCustomGraph({ hero: "streaming-hdr", deliverables: ["sdr"] }, "2.0", 1000);
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.from)).toBe(true);
      expect(ids.has(e.to)).toBe(true);
    }
  });

  it("builds a non-empty palette of named, coloured steps", () => {
    const groups = masteringPaletteGroups();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.steps.length > 0)).toBe(true);
    expect(groups.flatMap((g) => g.steps).every((s) => s.label && s.color)).toBe(true);
  });
});
