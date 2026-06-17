import { describe, it, expect, beforeEach } from "vitest";
import { fmtDuration } from "@/lib/postcalc";
import { parseBackup } from "@/lib/projectSync";
import { loadRecipients, sendDeliveriesToSchedule, newRecipient, type Recipient } from "@/lib/deliverables";
import { rollupDeliverables, shareCounts } from "@/lib/deliverablesRollup";

// Regression tests for the v2.15.0 audit-fix batch.

describe("fmtDuration carry (postcalc)", () => {
  it("never renders a 60.00s seconds field — carries to the next minute", () => {
    expect(fmtDuration(59.999)).toBe("01m 0.00s");   // was "0.00s" with a phantom 60 → now carries
    expect(fmtDuration(3599.999)).toBe("1h 00m 0.00s");
    expect(fmtDuration(0)).toBe("0.00s");
    expect(fmtDuration(125.5)).not.toContain("60.00"); // sanity: no seconds field ever hits 60
  });
});

describe("parseBackup pid guard (projectSync)", () => {
  it("rejects a canonical backup whose snapshot.pid is empty (would restore 0 items silently)", () => {
    expect(() => parseBackup({ kind: "kaos-project-backup", version: 1, name: "x", snapshot: { pid: "", syncedAt: 1, entries: { "k-": "1" } } })).toThrow();
  });
  it("accepts a canonical backup with a real pid", () => {
    const b = parseBackup({ kind: "kaos-project-backup", version: 1, name: "x", snapshot: { pid: "p1", syncedAt: 1, entries: {} } });
    expect(b.snapshot.pid).toBe("p1");
  });
});

describe("loadRecipients seed-reset guard (deliverables)", () => {
  beforeEach(() => localStorage.clear());
  it("survives a null/primitive deliverable element instead of wiping the whole project to seed", () => {
    const pid = "guard-test";
    localStorage.setItem(`kaos.deliverables.v1-${pid}`, JSON.stringify([
      { ...newRecipient("Real Recipient"), deliverables: [null, "oops", { id: "ok", label: "x", category: "picture", status: "todo" }] },
    ]));
    const rs = loadRecipients(pid);
    expect(rs.length).toBe(1);
    expect(rs[0].name).toBe("Real Recipient"); // NOT reset to the seed examples
    expect((rs[0].deliverables || []).length).toBe(1); // bad elements dropped, good one kept
  });
});

describe("Gantt delivery bars keyed by recipient id (deliverables)", () => {
  beforeEach(() => localStorage.clear());
  it("two blank-named recipients each get their own bar (no name-key collision)", () => {
    const pid = "gantt-test";
    const rs: Recipient[] = [
      { ...newRecipient(""), due: "2026-07-06" },
      { ...newRecipient(""), due: "2026-08-03" },
    ];
    const res = sendDeliveriesToSchedule(pid, rs);
    expect(res.added).toBe(2); // both create bars; the old name-key would have merged them
    const bars = JSON.parse(localStorage.getItem(`postsup-gantt-v1-${pid}`)!);
    expect(bars.length).toBe(2);
  });
});

describe("shareCounts distinct recipients (rollup)", () => {
  it("a single recipient's two same-spec items do NOT read as 'shared ×2'", () => {
    const r: Recipient = { ...newRecipient("Solo"), deliverables: [
      { id: "a", label: "M&E full", category: "audio", status: "todo" } as never,
      { id: "b", label: "M&E full", category: "audio", status: "todo" } as never,
    ] };
    const counts = shareCounts(rollupDeliverables([r]));
    // one recipient → not shared → no entry (only >1 distinct recipient is tagged)
    expect(counts.get("a")).toBeUndefined();
  });
});
