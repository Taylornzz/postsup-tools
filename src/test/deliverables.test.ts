import { describe, it, expect } from "vitest";
import {
  buildPlan, recipientsToMasteringConfig, newRecipient, recipientChecklist,
  DELIVERY_TEMPLATES, recipientFromTemplate, specStaleness, recipientSpecClass,
  deliverySchedule, sendDeliveriesToSchedule,
  type Recipient, type DRId,
} from "@/lib/deliverables";
import { makeOrder } from "@/lib/mastering";
import { rollupDeliverables, groupStatus, linkSuggestions, linkBySpecKey, unlinkArtifact } from "@/lib/deliverablesRollup";
import { templateDeliverables, languageItems, newItem, newLanguage, type DeliverableItem, type DeliveryLanguage } from "@/lib/deliverablesList";

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

describe("audit leftovers (#4)", () => {
  it("splits chain-of-title and E&O into two distinct legal items", () => {
    const items = templateDeliverables({ audio: "5.1", dr: "sdr", subtitles: "None" });
    const legal = items.filter((i) => i.category === "legal").map((i) => i.label.toLowerCase());
    expect(legal.some((l) => l.includes("chain-of-title"))).toBe(true);
    expect(legal.some((l) => l.includes("e&o"))).toBe(true);
    // they are separate items, not one combined line
    expect(legal.some((l) => l.includes("chain-of-title") && l.includes("e&o"))).toBe(false);
  });

  it("DCP template carries the full KDM lifecycle (DKDM + initial + re-issues)", () => {
    const dcp = templateDeliverables({ container: "DCP", dr: "theatrical" });
    const labels = dcp.map((i) => i.label.toLowerCase());
    expect(labels.some((l) => l.includes("dkdm"))).toBe(true);
    expect(labels.some((l) => l.includes("kdm") && l.includes("initial"))).toBe(true);
    expect(labels.some((l) => l.includes("re-issue"))).toBe(true);
  });

  it("staleness thresholds scale by spec class — streamers go stale fastest", () => {
    const at = new Date(Date.now() - 100 * 86400000).toISOString(); // 100 days ago
    expect(specStaleness(at, "streamer").level).toBe("aging");      // past 60d fresh window
    expect(specStaleness(at, "broadcaster").level).toBe("fresh");   // still inside 120d
    expect(specStaleness(at, "theatrical").level).toBe("fresh");    // 180d window
  });

  it("classifies recipients into the right drift class", () => {
    expect(recipientSpecClass(newRecipient("x"))).toBe("broadcaster");
    expect(recipientSpecClass({ ...newRecipient("n"), fpsNative: true })).toBe("streamer");
    expect(recipientSpecClass({ ...newRecipient("d"), dr: "theatrical" })).toBe("theatrical");
  });

  it("groupStatus aggregates per-(item×recipient) status on a shared artifact", () => {
    const mk = (status: DeliverableItem["status"]): DeliverableItem => ({ ...newItem("audio"), label: "M&E — 5.1", status });
    const a: Recipient = { ...newRecipient("A"), audio: "5.1", loudness: "-24 LKFS (streaming)", truePeak: "-2 dBTP", deliverables: [mk("accepted")] };
    const b: Recipient = { ...newRecipient("B"), audio: "5.1", loudness: "-24 LKFS (streaming)", truePeak: "-2 dBTP", deliverables: [mk("todo")] };
    const groups = rollupDeliverables([a, b]);
    const me = groups.find((g) => g.label.startsWith("M&E"))!;
    expect(me.consumers.length).toBe(2);             // same content+spec → one artifact, two consumers
    expect(groupStatus(me)).toMatchObject({ tone: "partial", done: 1, total: 2 });

    const c: Recipient = { ...b, deliverables: [mk("qc-fail")] };
    expect(groupStatus(rollupDeliverables([a, c]).find((g) => g.label.startsWith("M&E"))!).tone).toBe("fail");
  });
});

describe("artifact links — Phase 2 (#5)", () => {
  const me = (): DeliverableItem => ({ ...newItem("audio"), label: "M&E — 5.1" });
  const a = (): Recipient => ({ ...newRecipient("A"), audio: "5.1", loudness: "-24 LKFS (streaming)", truePeak: "-2 dBTP", deliverables: [me()] });
  const b = (): Recipient => ({ ...newRecipient("B"), audio: "5.1", loudness: "-24 LKFS (streaming)", truePeak: "-2 dBTP", deliverables: [me()] });

  it("suggests linking identical items across recipients, then stops once linked", () => {
    let rs = [a(), b()];
    const sugg = linkSuggestions(rs);
    expect(sugg.length).toBe(1);
    expect(sugg[0].recipientNames.sort()).toEqual(["A", "B"]);

    rs = linkBySpecKey(rs, sugg[0].specKey);
    // both items now carry the same artifactId
    const ids = rs.flatMap((r) => r.deliverables!.map((d) => d.artifactId));
    expect(ids[0]).toBeTruthy();
    expect(new Set(ids).size).toBe(1);
    // no more suggestions — already unified
    expect(linkSuggestions(rs).length).toBe(0);
    // rollup marks the group linked
    expect(rollupDeliverables(rs).find((g) => g.label.startsWith("M&E"))!.linked).toBe(true);
  });

  it("a link survives a label edit on one recipient (durable, not inferred)", () => {
    let rs = linkBySpecKey([a(), b()], linkSuggestions([a(), b()])[0].specKey);
    // rename one recipient's item — spec key would now differ, but the link holds
    rs = rs.map((r, i) => (i === 0 ? { ...r, deliverables: r.deliverables!.map((d) => ({ ...d, label: "M&E full-fill 5.1" })) } : r));
    const g = rollupDeliverables(rs).filter((x) => x.linked);
    expect(g.length).toBe(1);
    expect(g[0].consumers.length).toBe(2); // still one make, two consumers
  });

  it("unlink returns to inferred grouping", () => {
    let rs = linkBySpecKey([a(), b()], linkSuggestions([a(), b()])[0].specKey);
    const artifactId = rs[0].deliverables![0].artifactId!;
    rs = unlinkArtifact(rs, artifactId);
    expect(rs.flatMap((r) => r.deliverables!.map((d) => d.artifactId)).every((x) => x === undefined)).toBe(true);
    expect(linkSuggestions(rs).length).toBe(1); // suggestion is back
  });

  it("does not suggest linking genuinely different specs", () => {
    const x: Recipient = { ...newRecipient("X"), audio: "5.1", loudness: "-24 LKFS (streaming)", truePeak: "-2 dBTP", deliverables: [me()] };
    const y: Recipient = { ...newRecipient("Y"), audio: "5.1", loudness: "-27 LKFS (Netflix streaming)", truePeak: "-2 dBTP", deliverables: [me()] };
    expect(linkSuggestions([x, y]).length).toBe(0); // different loudness = different render
  });
});

describe("IMF OV + supplementals (#7)", () => {
  const langs: DeliveryLanguage[] = [
    { ...newLanguage("EN"), kind: "OV" },
    { ...newLanguage("FR"), kind: "VF", dub: true, forced: true },
  ];

  it("non-IMF keeps the flat dub-printmaster framing", () => {
    const items = languageItems(langs);
    const labels = items.map((i) => i.label.toLowerCase());
    expect(labels.some((l) => l.includes("dub printmaster"))).toBe(true);
    expect(labels.some((l) => l.includes("supplemental"))).toBe(false);
    expect(labels.some((l) => l.includes("imf ov"))).toBe(false);
  });

  it("IMF framing produces an explicit OV + per-language supplemental packages", () => {
    const items = languageItems(langs, { imf: true });
    const labels = items.map((i) => i.label.toLowerCase());
    expect(labels.some((l) => l.includes("imf ov"))).toBe(true);                      // OV base, once
    expect(labels.some((l) => l.includes("imf supplemental — fr") || l.includes("imf supplemental — fr (cpl referencing ov"))).toBe(true);
    expect(labels.some((l) => l.includes("references ov m&e"))).toBe(true);            // dub audio references OV
    expect(labels.some((l) => l.includes("dub printmaster"))).toBe(false);            // not the flat framing
    // OV is the source language — no EN supplemental
    expect(labels.some((l) => l.includes("supplemental — en"))).toBe(false);
  });
});

describe("per-delivery dates → Planner (#6)", () => {
  it("deliverySchedule lists only dated recipients, earliest first", () => {
    const rs: Recipient[] = [
      { ...newRecipient("Late"), due: "2026-09-01" },
      { ...newRecipient("NoDate") },
      { ...newRecipient("Early"), due: "2026-07-01" },
    ];
    const s = deliverySchedule(rs);
    expect(s.map((x) => x.name)).toEqual(["Early", "Late"]);
  });

  it("sendDeliveriesToSchedule upserts delivery bars into the Planner store", () => {
    const pid = "test-sched";
    localStorage.removeItem(`postsup-gantt-v1-${pid}`);
    localStorage.removeItem(`postsup-gantt-start-${pid}`);
    const rs: Recipient[] = [
      { ...newRecipient("Netflix"), due: "2026-07-06" },   // anchor (Monday)
      { ...newRecipient("ABC"), due: "2026-07-20" },       // +2 weeks
      { ...newRecipient("NoDate") },
    ];
    const res = sendDeliveriesToSchedule(pid, rs);
    expect(res.added).toBe(2);
    expect(res.skipped).toBe(1);
    const bars = JSON.parse(localStorage.getItem(`postsup-gantt-v1-${pid}`)!);
    const abc = bars.find((b: { name: string }) => b.name === "Deliver: ABC");
    expect(abc.start).toBe(2); // two weeks after the anchor
    // re-running is idempotent (no duplicates), and moving a date updates in place
    const res2 = sendDeliveriesToSchedule(pid, rs.map((r) => (r.name === "ABC" ? { ...r, due: "2026-07-27" } : r)));
    expect(res2.added).toBe(0);
    expect(res2.updated).toBe(1);
    const bars2 = JSON.parse(localStorage.getItem(`postsup-gantt-v1-${pid}`)!);
    expect(bars2.filter((b: { name: string }) => b.name === "Deliver: ABC").length).toBe(1);
    expect(bars2.find((b: { name: string }) => b.name === "Deliver: ABC").start).toBe(3);
  });
});
