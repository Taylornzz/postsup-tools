/** Spec-drift alerts (v2). The per-recipient "Verify spec" already web-checks one platform;
 *  this batches that across recipients and remembers the result so the Deliverables tab can
 *  warn "these platforms may have changed their spec since you planned." Detection only —
 *  applying a change still goes through the per-recipient Verify diff (never auto-merged).
 *
 *  The fully-automatic weekly version (a Supabase reference-spec table + cron that refreshes
 *  it server-side, so the client compares against it for free) is the next step and lands with
 *  accounts — see docs/spec-drift.md. This on-demand check needs no backend beyond verify-spec. */

import type { Recipient } from "./deliverables";
import { specStaleness, recipientSpecClass } from "./deliverables";

export interface DriftRecord {
  id: string;
  name: string;
  fields: string[];        // which spec fields differ from current reporting
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
