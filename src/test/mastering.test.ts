import { describe, it, expect } from "vitest";
import { buildMasterGraph, STRATEGIES, MasteringStrategy } from "@/lib/mastering";

const STRATS = STRATEGIES.map((s) => s.id) as MasteringStrategy[];

describe("buildMasterGraph", () => {
  it("builds all three strategies with no dangling edges", () => {
    for (const s of STRATS) {
      const g = buildMasterGraph(s, "2.0");
      const ids = new Set(g.nodes.map((n) => n.id));
      expect(g.nodes.length).toBeGreaterThan(8);
      for (const e of g.edges) {
        expect(ids.has(e.from)).toBe(true);
        expect(ids.has(e.to)).toBe(true);
      }
    }
  });

  it("has at least one hero per strategy (two for dual-hero)", () => {
    expect(buildMasterGraph("hdr-first", "2.0").nodes.filter((n) => n.isHero).length).toBe(1);
    expect(buildMasterGraph("theatrical-first", "2.0").nodes.filter((n) => n.isHero).length).toBe(2);
    expect(buildMasterGraph("dual-hero", "2.0").nodes.filter((n) => n.isHero).length).toBe(2);
  });

  it("pulls OT edge labels from the ACES fixtures and respects the version", () => {
    const v2 = buildMasterGraph("hdr-first", "2.0");
    const v13 = buildMasterGraph("hdr-first", "1.3");
    const ot2 = v2.edges.find((e) => e.op === "output-transform")!;
    const ot13 = v13.edges.find((e) => e.op === "output-transform")!;
    expect(ot2.label).toMatch(/ACES OT →/);
    expect(ot2.label).toMatch(/PQ/); // DV_PQ fixture (2.0)
    expect(ot13.label).not.toBe(ot2.label); // 1.3 label differs
    expect(ot2.warning).toBeTruthy(); // interop warning attached
  });

  it("propagates the chosen mastering-display peak to the HDR nodes + PQ OT edge", () => {
    const g = buildMasterGraph("hdr-first", "2.0", 4000);
    const hero = g.nodes.find((n) => n.id === "hdrHero")!;
    expect(hero.peakNits).toBe("4000");
    const ot = g.edges.find((e) => e.op === "output-transform")!;
    expect(ot.label).toMatch(/@ 4000 nit/);
    // SDR stays at 100 nit; DCDM theatrical stays at 48 nit regardless.
    expect(g.nodes.find((n) => n.id === "sdr")!.peakNits).toBe("100");
    expect(g.nodes.find((n) => n.id === "dcdm4k")!.peakNits).toBe("48");
  });

  it("attaches colourist notes to the HDR / SDR / DCDM masters", () => {
    const g = buildMasterGraph("hdr-first", "2.0");
    expect(g.nodes.find((n) => n.id === "sdr")!.note).toMatch(/manual/i);
    expect(g.nodes.find((n) => n.id === "dcdm4k")!.note).toMatch(/dedicated/i);
  });

  it("flags theatrical-first HDR derivation as an up-volume regrade", () => {
    const g = buildMasterGraph("theatrical-first", "2.0");
    const up = g.edges.find((e) => e.direction === "up-volume");
    expect(up).toBeTruthy();
    expect(up!.op).toBe("regrade");
  });

  it("keeps the ACES boundary at the Output Transform (downstream edges not aces-managed)", () => {
    const g = buildMasterGraph("hdr-first", "2.0");
    const trim = g.edges.find((e) => e.op === "trim")!;
    const ot = g.edges.find((e) => e.op === "output-transform")!;
    expect(ot.acesManaged).toBe(true);
    expect(trim.acesManaged).toBe(false);
  });
});
