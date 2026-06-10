import { describe, it, expect, beforeEach } from "vitest";
import { newRecipient, type Recipient } from "@/lib/deliverables";
import { recipientSpecDiffs } from "@/lib/verifySpec";
import { driftCandidates, loadDrift, saveDrift, runDriftScan, clearDriftFor, autoDriftDue, markAutoDriftAt, AUTO_DRIFT_INTERVAL_MS, type DriftState } from "@/lib/driftCheck";

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
    const state: DriftState = { checkedAt: daysAgo(0), checked: 2, drifted: [{ id: "r1", name: "Max", diffs: [{ label: "Loudness", from: "-27", to: "-24" }], checkedAt: daysAgo(0) }] };
    saveDrift("p1", state);
    expect(loadDrift("p1")?.drifted[0].name).toBe("Max");
    saveDrift("p1", null);
    expect(loadDrift("p1")).toBeNull();
  });

  it("runDriftScan runs in parallel, records field-level diffs, and survives a hung check", async () => {
    const a: Recipient = { ...newRecipient("A"), id: "a", loudness: "-27 LKFS (Netflix streaming)" };
    const b: Recipient = { ...newRecipient("B"), id: "b", loudness: "-24 LKFS (streaming)" };
    const c: Recipient = { ...newRecipient("C"), id: "c" };
    let active = 0, maxActive = 0;
    const verify = async (r: Recipient) => {
      active++; maxActive = Math.max(maxActive, active);
      await new Promise((res) => setTimeout(res, 5));
      active--;
      if (r.id === "a") return { spec: { loudness: "-24 LKFS (streaming)" }, summary: "changed" }; // drifted
      if (r.id === "c") return await new Promise<{ spec: Record<string, never> }>(() => {});         // hangs forever
      return { spec: { loudness: r.loudness } };                                                     // no change
    };
    const progress: number[] = [];
    const { state, checked, failed } = await runDriftScan([a, b, c], verify, { concurrency: 3, timeoutMs: 40, now: "2026-06-11T00:00:00Z", onProgress: (d) => progress.push(d) });
    expect(maxActive).toBeGreaterThan(1);                 // genuinely parallel
    expect(checked).toBe(2);                              // a + b returned
    expect(failed).toBe(1);                               // c timed out, didn't hang the run
    expect(state.drifted.map((d) => d.id)).toEqual(["a"]);
    expect(state.drifted[0].diffs[0]).toMatchObject({ label: "Loudness", to: "-24 LKFS (streaming)" });
    expect(progress[progress.length - 1]).toBe(3);        // progress reached total
  });

  it("auto-check is due when never run or older than a month, throttled otherwise", () => {
    const now = 1_000 * AUTO_DRIFT_INTERVAL_MS; // arbitrary large 'now'
    expect(autoDriftDue("p", now)).toBe(true);                 // never run → due
    markAutoDriftAt("p", now);
    expect(autoDriftDue("p", now)).toBe(false);                // just ran → not due
    expect(autoDriftDue("p", now + AUTO_DRIFT_INTERVAL_MS - 1)).toBe(false); // <1mo → still throttled
    expect(autoDriftDue("p", now + AUTO_DRIFT_INTERVAL_MS)).toBe(true);      // ≥1mo → due again
    expect(autoDriftDue("other", now)).toBe(true);             // per-project, independent
  });

  it("clearDriftFor removes one recipient, nulling the state when empty", () => {
    const state: DriftState = { checkedAt: "x", checked: 2, drifted: [
      { id: "a", name: "A", diffs: [], checkedAt: "x" }, { id: "b", name: "B", diffs: [], checkedAt: "x" },
    ] };
    expect(clearDriftFor(state, "a")?.drifted.map((d) => d.id)).toEqual(["b"]);
    expect(clearDriftFor({ ...state, drifted: [state.drifted[0]] }, "a")).toBeNull(); // last one → null
  });
});
