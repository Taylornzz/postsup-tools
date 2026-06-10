import { describe, it, expect, beforeEach } from "vitest";
import { newRecipient, type Recipient } from "@/lib/deliverables";
import { recipientSpecDiffs } from "@/lib/verifySpec";
import { driftCandidates, loadDrift, saveDrift, type DriftState } from "@/lib/driftCheck";

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

describe("spec-drift (#8)", () => {
  beforeEach(() => localStorage.clear());

  it("recipientSpecDiffs reports only fields the verifier actually changed", () => {
    const r: Recipient = { ...newRecipient("Netflix"), container: "IMF App 2E", loudness: "-27 LKFS (Netflix streaming)" };
    const diffs = recipientSpecDiffs(r, { container: "IMF App 2E", loudness: "-24 LKFS (streaming)", resolution: "" });
    expect(diffs.map((d) => d.key)).toEqual(["loudness"]);   // container same, resolution blank → ignored
    expect(diffs[0]).toMatchObject({ from: "-27 LKFS (Netflix streaming)", to: "-24 LKFS (streaming)" });
  });

  it("driftCandidates picks non-fresh named recipients (falls back to all named)", () => {
    const fresh: Recipient = { ...newRecipient("Fresh"), verified: { at: daysAgo(1) } };
    const stale: Recipient = { ...newRecipient("Stale"), verified: { at: daysAgo(300) } };
    expect(driftCandidates([fresh, stale]).map((r) => r.name)).toEqual(["Stale"]);
    // all fresh → nothing "worth" checking → fall back to all named so the button still works
    expect(driftCandidates([fresh]).map((r) => r.name)).toEqual(["Fresh"]);
    // unnamed recipients are never candidates
    expect(driftCandidates([{ ...newRecipient("") }]).length).toBe(0);
  });

  it("persists and clears drift state per project", () => {
    const state: DriftState = { checkedAt: daysAgo(0), checked: 2, drifted: [{ id: "r1", name: "Max", fields: ["Loudness"], checkedAt: daysAgo(0) }] };
    saveDrift("p1", state);
    expect(loadDrift("p1")?.drifted[0].name).toBe("Max");
    saveDrift("p1", null);
    expect(loadDrift("p1")).toBeNull();
  });
});
