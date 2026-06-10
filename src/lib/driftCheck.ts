/** Spec-drift alerts (v2). The per-recipient "Verify spec" already web-checks one platform;
 *  this batches that across recipients and remembers the result so the Deliverables tab can
 *  show, per recipient, "the platform's published spec changed since you set this up."
 *
 *  IMPORTANT — drift is INFORMATIONAL, not a push to change. A show already in production
 *  delivers to the spec it was set up with; you don't re-cut mid-shoot because a platform
 *  revised its doc. So this only ever surfaces what changed + when; applying anything still
 *  goes through the per-recipient Verify diff, by hand (never auto-merged).
 *
 *  The fully-automatic weekly version (a Supabase reference-spec table + cron that refreshes
 *  it server-side, and which only nudges projects not yet locked / in production) is the next
 *  step and lands with accounts — see docs/spec-drift.md. */

import type { Recipient } from "./deliverables";
import { specStaleness, recipientSpecClass } from "./deliverables";
import { recipientSpecDiffs } from "./verifySpec";

export interface DriftDiff { label: string; from: string; to: string; }
export interface DriftRecord {
  id: string;
  name: string;
  diffs: DriftDiff[];      // field-level: what current reporting says vs your spec
  summary?: string;        // the verifier's one-line note
  checkedAt: string;
}
export interface DriftState {
  checkedAt: string;
  drifted: DriftRecord[];  // only the recipients that actually changed
  checked: number;         // how many were checked this run
}

const driftKey = (pid?: string) => `kaos.deliverables.drift${pid ? `-${pid}` : ""}`;

export function loadDrift(pid?: string): DriftState | null {
  try {
    const raw = localStorage.getItem(driftKey(pid));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && Array.isArray(v.drifted) ? (v as DriftState) : null;
  } catch { return null; }
}
export function saveDrift(pid: string | undefined, state: DriftState | null) {
  try {
    if (state) localStorage.setItem(driftKey(pid), JSON.stringify(state));
    else localStorage.removeItem(driftKey(pid));
  } catch { /* ignore */ }
}

// ---- monthly auto-check throttle ----
// Drift runs automatically in the background (no button). We stamp the last *successful*
// run per project and skip until a month has passed, so opening the app re-checks at most
// ~once a month — cheap, hands-off, and impossible to trigger a costly run by accident.
// A separate *attempt* stamp gives a short retry floor so a failed/offline run (which never
// stamps success) can't re-fire on every tab revisit within the same day.
export const AUTO_DRIFT_INTERVAL_MS = 30 * 86400000; // ~1 month between successful runs
export const AUTO_DRIFT_RETRY_MS = 6 * 3600 * 1000;  // don't re-attempt within 6h of any attempt
const autoKey = (pid?: string) => `kaos.deliverables.driftAutoAt${pid ? `-${pid}` : ""}`;
const attemptKey = (pid?: string) => `kaos.deliverables.driftAttemptAt${pid ? `-${pid}` : ""}`;

export function lastAutoDriftAt(pid?: string): number {
  try { return Number(localStorage.getItem(autoKey(pid))) || 0; } catch { return 0; }
}
export function markAutoDriftAt(pid: string | undefined, at: number) {
  try { localStorage.setItem(autoKey(pid), String(at)); } catch { /* ignore */ }
}
export function lastAutoDriftAttemptAt(pid?: string): number {
  try { return Number(localStorage.getItem(attemptKey(pid))) || 0; } catch { return 0; }
}
export function markAutoDriftAttempt(pid: string | undefined, at: number) {
  try { localStorage.setItem(attemptKey(pid), String(at)); } catch { /* ignore */ }
}
/** True if a project is due for its background drift check: a month since the last successful
 *  run AND not attempted within the short retry window (so failures don't re-fire repeatedly). */
export function autoDriftDue(pid: string | undefined, now: number): boolean {
  return now - lastAutoDriftAt(pid) >= AUTO_DRIFT_INTERVAL_MS
    && now - lastAutoDriftAttemptAt(pid) >= AUTO_DRIFT_RETRY_MS;
}

/** Which recipients are worth a drift check — named, and either never verified or past their
 *  class's "fresh" window (a fresh, just-verified spec doesn't need re-checking). Keeps the
 *  web-search count (and cost) down. Falls back to all named recipients if none look stale. */
export function driftCandidates(recipients: Recipient[]): Recipient[] {
  const named = recipients.filter((r) => (r.name || "").trim());
  const worth = named.filter((r) => {
    const s = specStaleness(r.verified?.at, recipientSpecClass(r));
    return s.level !== "fresh"; // none / aging / stale
  });
  return worth.length ? worth : named;
}

// ---- the scan: parallel, with a per-check timeout so one slow call can't hang it ----
export interface VerifyResult { spec: Partial<Recipient>; summary?: string }
export type VerifyFn = (r: Recipient) => Promise<VerifyResult>;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

/** Run the drift check over `candidates` with bounded concurrency and a per-check timeout, so a
 *  batch finishes in roughly one slow call's time instead of the sum of all of them — and a single
 *  hung request can never stall the whole run. `verify` is injected (the component passes the real
 *  /api/verify-spec call); `onProgress` fires as each settles so the UI can show "3/6". Returns the
 *  drift state plus how many were checked / failed. `now` keeps it deterministic for tests. */
export async function runDriftScan(
  candidates: Recipient[],
  verify: VerifyFn,
  opts: { concurrency?: number; timeoutMs?: number; now?: string; onProgress?: (done: number, total: number) => void } = {},
): Promise<{ state: DriftState; checked: number; failed: number }> {
  const concurrency = Math.max(1, opts.concurrency ?? 4);
  const timeoutMs = opts.timeoutMs ?? 60000;
  const at = opts.now ?? new Date().toISOString();
  const total = candidates.length;
  const drifted: DriftRecord[] = [];
  let checked = 0, failed = 0, done = 0, idx = 0;

  const worker = async () => {
    while (idx < candidates.length) {
      const r = candidates[idx++];
      try {
        const res = await withTimeout(verify(r), timeoutMs);
        checked++;
        const diffs = recipientSpecDiffs(r, res.spec || {});
        if (diffs.length) drifted.push({ id: r.id, name: r.name, summary: res.summary, checkedAt: at, diffs: diffs.map((d) => ({ label: d.label, from: d.from, to: d.to })) });
      } catch { failed++; }
      finally { done++; opts.onProgress?.(done, total); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, total || 1) }, worker));
  return { state: { checkedAt: at, drifted, checked }, checked, failed };
}

/** Drop a single recipient's drift record (when the user has reviewed / dismissed it). */
export function clearDriftFor(state: DriftState | null, recipientId: string): DriftState | null {
  if (!state) return null;
  const drifted = state.drifted.filter((d) => d.id !== recipientId);
  return drifted.length ? { ...state, drifted } : null;
}
