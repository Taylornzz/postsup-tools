import { describe, it, expect } from "vitest";
import {
  buildPlan, recipientsToMasteringConfig, newRecipient, recipientChecklist,
  DELIVERY_TEMPLATES, recipientFromTemplate,
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

describe("make-order conversions (#3)", () => {
  it("mixed frame rates → a standards conversion step", () => {
    const { conversions } = buildPlan([rcp("US", "sdr", { fps: 23.976 }), rcp("NZ", "sdr", { fps: 25 })]);
    const std = conversions.find((c) => c.kind === "standards");
    expect(std).toBeTruthy();
    expect(std!.detail).toMatch(/PAL|NTSC/i); // 24-family ↔ 25 is a cross-standard conversion
  });

  it("lower resolution at the same aspect → a clean down-scale", () => {
    const { conversions } = buildPlan([rcp("A", "sdr", { resolution: "UHD 3840×2160" }), rcp("B", "sdr", { resolution: "1080p 1920×1080" })]);
    const ds = conversions.find((c) => c.kind === "downscale");
    expect(ds?.covers).toContain("B");
  });

  it("different aspect (UHD vs DCI 4K) → a reframe", () => {
    const { conversions } = buildPlan([rcp("Cinema", "sdr", { resolution: "DCI 4K 4096×2160" }), rcp("Stream", "sdr", { resolution: "UHD 3840×2160" })]);
    expect(conversions.some((c) => c.kind === "reframe")).toBe(true);
  });

  it("identical formats → no conversions", () => {
    expect(buildPlan([rcp("A", "sdr"), rcp("B", "sdr")]).conversions).toHaveLength(0);
  });
});

describe("loudness QC fields (#4)", () => {
  it("new recipients carry a true-peak default", () => {
    expect(newRecipient().truePeak).toBe("-2 dBTP");
  });

  it("checklist surfaces true-peak, and dialnorm ONLY for AC-3 broadcast targets", () => {
    const usBroadcast = recipientChecklist(rcp("US", "sdr", { loudness: "-24 LKFS (ATSC A/85)" }));
    expect(usBroadcast.some((l) => /True-peak/.test(l))).toBe(true);
    expect(usBroadcast.some((l) => /Dialnorm \(AC-3 emission only\)/.test(l))).toBe(true);

    const ukStreaming = recipientChecklist(rcp("UK", "sdr", { loudness: "-23 LUFS (EBU R128)" }));
    expect(ukStreaming.some((l) => /True-peak/.test(l))).toBe(true);
    expect(ukStreaming.some((l) => /Dialnorm/.test(l))).toBe(false); // R128 master carries no dialnorm
  });
});

describe("delivery templates (#11)", () => {
  it("every template instantiates a complete recipient with a true-peak", () => {
    expect(DELIVERY_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const t of DELIVERY_TEMPLATES) {
      const r = recipientFromTemplate(t);
      expect(r.name).toBe(t.name);
      expect(r.id).toBeTruthy();
      expect(r.truePeak).toMatch(/dBTP|None/);
      expect(r.resolution).toBeTruthy();
      expect(r.container).toBeTruthy();
    }
  });

  it("Netflix template is Dolby Vision IMF at -27 LKFS / -2 dBTP", () => {
    const r = recipientFromTemplate(DELIVERY_TEMPLATES.find((t) => t.id === "netflix")!);
    expect(r.dr).toBe("dolby-vision");
    expect(r.container).toBe("IMF App 2E");
    expect(r.loudness).toMatch(/-27/);
    expect(r.truePeak).toBe("-2 dBTP");
  });

  it("Apple TV+ uses the tighter -1 dBTP ceiling", () => {
    expect(recipientFromTemplate(DELIVERY_TEMPLATES.find((t) => t.id === "apple")!).truePeak).toBe("-1 dBTP");
  });

  it("each instantiation gets a unique id", () => {
    expect(recipientFromTemplate(DELIVERY_TEMPLATES[0]).id).not.toBe(recipientFromTemplate(DELIVERY_TEMPLATES[0]).id);
  });
});
