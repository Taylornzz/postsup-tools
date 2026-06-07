import { describe, it, expect } from "vitest";
import {
  buildPlan, recipientsToMasteringConfig, newRecipient,
  type Recipient, type DRId,
} from "@/lib/deliverables";
import { makeOrder } from "@/lib/mastering";

const rcp = (name: string, dr: DRId, extra: Partial<Recipient> = {}): Recipient => ({
  ...newRecipient(name), dr, ...extra,
});

describe("recipientsToMasteringConfig — requirements → mastering config", () => {
  it("grades HDR first when any HDR recipient exists", () => {
    const { config } = recipientsToMasteringConfig([rcp("Stream", "dolby-vision"), rcp("Bcast", "sdr")]);
    expect(config.hero).toBe("streaming-hdr");
    expect(config.deliverables).toEqual(expect.arrayContaining(["hdr", "sdr", "archive", "proxies"]));
  });

  it("grades theatrical first when theatrical present but no HDR", () => {
    expect(recipientsToMasteringConfig([rcp("Cinema", "theatrical"), rcp("Bcast", "sdr")]).config.hero).toBe("theatrical");
  });

  it("falls back to an SDR hero", () => {
    expect(recipientsToMasteringConfig([rcp("Bcast", "sdr")]).config.hero).toBe("broadcast");
  });

  it("masters to the highest HDR peak, snapped up to a supported tier", () => {
    expect(recipientsToMasteringConfig([rcp("A", "dolby-vision", { peakNits: 4000 })]).masterNits).toBe(4000);
    expect(recipientsToMasteringConfig([rcp("A", "hdr10", { peakNits: 600 })]).masterNits).toBe(1000); // 600 → 1000
    expect(recipientsToMasteringConfig([rcp("A", "sdr")]).masterNits).toBe(1000); // no HDR → default
  });
});

describe("buildPlan — make-order obeys the mastering doctrine", () => {
  it("HDR + SDR: SDR is a clean down-volume DERIVE off the hero (not flagged)", () => {
    const plan = buildPlan([rcp("Stream", "dolby-vision"), rcp("Bcast", "sdr")]);
    const hero = plan.passes.find((p) => p.kind === "hero");
    const sdr = plan.passes.find((p) => p.covers.includes("Bcast"));
    expect(hero?.label).toMatch(/HDR hero/i);
    expect(sdr?.kind).toBe("derive");
    expect(sdr?.flag).toBeFalsy();
  });

  it("Theatrical + SDR: SDR is a FRESH RE-GRADE off the archive, flagged (the bug fix)", () => {
    const plan = buildPlan([rcp("Cinema", "theatrical"), rcp("Bcast", "sdr")]);
    const hero = plan.passes.find((p) => p.kind === "hero");
    const sdr = plan.passes.find((p) => p.covers.includes("Bcast"));
    expect(hero?.label).toMatch(/Theatrical/i);
    expect(sdr?.kind).toBe("regrade"); // NOT "derive" — the old code wrongly called this a clean trim
    expect(sdr?.flag).toBe(true);
  });

  it("HDR + Theatrical: theatrical is a fresh re-grade off the archive, flagged", () => {
    const plan = buildPlan([rcp("Stream", "hdr10"), rcp("Cinema", "theatrical")]);
    const theat = plan.passes.find((p) => p.covers.includes("Cinema"));
    expect(theat?.kind).toBe("regrade");
    expect(theat?.flag).toBe(true);
  });

  it("SDR only: a single hero grade covers everyone", () => {
    const plan = buildPlan([rcp("A", "sdr"), rcp("B", "sdr")]);
    expect(plan.passes).toHaveLength(1);
    expect(plan.passes[0].kind).toBe("hero");
    expect(plan.passes[0].covers).toEqual(["A", "B"]);
  });

  it("hero pass always sorts before derives and regrades", () => {
    const plan = buildPlan([rcp("Bcast", "sdr"), rcp("Stream", "dolby-vision"), rcp("Cinema", "theatrical")]);
    expect(plan.passes[0].kind).toBe("hero");
    const kinds = plan.passes.map((p) => p.kind);
    expect(kinds.indexOf("derive")).toBeLessThan(kinds.lastIndexOf("regrade") + 1);
  });

  it("empty recipient list → no passes", () => {
    expect(buildPlan([]).passes).toHaveLength(0);
  });
});

describe("makeOrder — classification reads straight off the DAG", () => {
  it("theatrical hero + SDR → SDR classified as a regrade", () => {
    const steps = makeOrder({ hero: "theatrical", deliverables: ["theatrical", "sdr", "archive"] });
    expect(steps.find((s) => s.family === "broadcast")?.kind).toBe("regrade");
  });

  it("HDR hero + SDR → SDR classified as a derive", () => {
    const steps = makeOrder({ hero: "streaming-hdr", deliverables: ["hdr", "sdr"] });
    expect(steps.find((s) => s.family === "broadcast")?.kind).toBe("derive");
  });

  it("up-volume HDR off a theatrical hero is flagged as a regrade", () => {
    const steps = makeOrder({ hero: "theatrical", deliverables: ["theatrical", "hdr", "archive"] });
    expect(steps.find((s) => s.family === "streaming-hdr")?.kind).toBe("regrade");
  });
});
