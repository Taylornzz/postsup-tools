// Project sync — make a project portable across devices without rewriting every tool.
//
// Each tool persists its own per-project localStorage keys (kaos.deliverables.v1-{pid},
// kaos.board.v1-{pid}, postsup-gantt-v1-{pid}, …). Rather than migrate them all, we SNAPSHOT
// every key scoped to a project into one object, which can be:
//   • downloaded as a .json backup and restored on another device (works for everyone), or
//   • stored in the project's `data.snapshot` (Supabase, when signed in) and pulled on open —
//     the project id is the stable Supabase row id, so the keys match across devices.
//
// Last-write-wins by `syncedAt` for a solo user (the common case here). Never destructive on
// the cloud side beyond the snapshot field; `data.url` (capture state) is preserved on merge.

import { supabase } from "./supabase";
import { getProject, updateProject } from "./projects";

export interface ProjectSnapshot {
  pid: string;
  syncedAt: number;
  entries: Record<string, string>; // raw localStorage key → value, all scoped to this project
}

/** Keys that hold credentials/secrets (e.g. the Trello key+token at `kaos.trello.auth`) — never
 *  put these in a synced snapshot or a downloadable backup, even if they ever became project-scoped.
 *  Defence-in-depth so neither the cloud sync nor the JSON backup can exfiltrate a token. */
export function isSensitiveLocalKey(key: string): boolean {
  return /trello|oauth|token|secret|credential|\.auth$/i.test(key);
}

/** Every localStorage key scoped to this project (suffix `-{pid}`), minus any credential keys. */
export function collectProjectState(pid: string): Record<string, string> {
  const out: Record<string, string> = {};
  const suffix = `-${pid}`;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    // Skip credentials and the sync bookkeeping stamp — a snapshot shouldn't carry its own ledger.
    if (!k || !k.endsWith(suffix) || isSensitiveLocalKey(k) || k.startsWith("kaos.sync.lastApplied-")) continue;
    const v = localStorage.getItem(k);
    if (v != null) out[k] = v;
  }
  return out;
}

/** Write a snapshot's entries back into localStorage (used when restoring / pulling). */
export function applyProjectState(entries: Record<string, string>): number {
  let n = 0;
  for (const [k, v] of Object.entries(entries || {})) {
    try { localStorage.setItem(k, v); n++; } catch { /* quota / private mode */ }
  }
  return n;
}

export function makeSnapshot(pid: string, now: number): ProjectSnapshot {
  return { pid, syncedAt: now, entries: collectProjectState(pid) };
}

// ---- file backup (works signed-in or local) -------------------------------
export interface ProjectBackup { kind: "kaos-project-backup"; version: 1; name: string; snapshot: ProjectSnapshot; }

export function buildBackup(pid: string, name: string, now: number): ProjectBackup {
  return { kind: "kaos-project-backup", version: 1, name, snapshot: makeSnapshot(pid, now) };
}

/** Validate a parsed backup file. Returns the backup or throws a friendly error.
 *  Accepts both the canonical format and the legacy in-app "Export project — JSON backup"
 *  shape ({product, project, projectId, data} with JSON-parsed values). */
export function parseBackup(raw: unknown): ProjectBackup {
  const b = raw as Partial<ProjectBackup>;
  // `entries: null` passes a bare typeof check and then explodes in rekeyEntries — reject it here.
  if (b && b.kind === "kaos-project-backup" && b.snapshot && typeof b.snapshot === "object" && b.snapshot.entries && typeof b.snapshot.entries === "object"
      && typeof b.snapshot.pid === "string" && b.snapshot.pid) {
    // pid must be present and non-empty: rekeyEntries keys off "-{pid}", so an empty pid makes
    // every entry get dropped by the restore filter and the user gets a silent "0 items" success.
    return b as ProjectBackup;
  }
  const legacy = raw as { product?: unknown; project?: unknown; projectId?: unknown; data?: unknown };
  if (typeof legacy?.product === "string" && /kaos/i.test(legacy.product) && legacy.data && typeof legacy.data === "object" && typeof legacy.projectId === "string" && legacy.projectId) {
    const entries: Record<string, string> = {};
    for (const [k, v] of Object.entries(legacy.data as Record<string, unknown>)) {
      if (v == null || isSensitiveLocalKey(k)) continue;
      // Values were JSON.parse'd at export (raw string kept on parse failure) — re-encode
      // non-strings; strings were raw scalars in storage, keep them as-is.
      entries[k] = typeof v === "string" ? v : JSON.stringify(v);
    }
    return { kind: "kaos-project-backup", version: 1, name: String(legacy.project || "Restored project"), snapshot: { pid: legacy.projectId, syncedAt: 0, entries } };
  }
  throw new Error("That doesn’t look like a Kaos project backup file.");
}

/** Re-key a snapshot's entries onto a new project id (when restoring INTO a fresh project). */
export function rekeyEntries(entries: Record<string, string>, fromPid: string, toPid: string): Record<string, string> {
  const out: Record<string, string> = {};
  const fromSuffix = `-${fromPid}`;
  for (const [k, v] of Object.entries(entries)) {
    out[k.endsWith(fromSuffix) ? k.slice(0, -fromSuffix.length) + `-${toPid}` : k] = v;
  }
  return out;
}

// ---- cloud snapshot (Supabase, when signed in) ----------------------------
const lastPullKey = (pid: string) => `kaos.sync.lastApplied-${pid}`;
const getLastApplied = (pid: string) => { try { return Number(localStorage.getItem(lastPullKey(pid))) || 0; } catch { return 0; } };
const setLastApplied = (pid: string, t: number) => { try { localStorage.setItem(lastPullKey(pid), String(t)); } catch { /* ignore */ } };

export type SyncUpResult = "ok" | "no-auth" | "no-project" | "empty" | "error";

/** Push this project's local state up to its cloud record. The patch carries ONLY the
 *  snapshot field — updateProject's read-modify-merge keeps `data.url` (and anything else)
 *  intact, and sending the full mount-time `data` here would revert fields written by other
 *  devices since this one last read the row. */
export async function syncProjectUp(pid: string, now: number): Promise<SyncUpResult> {
  if (!supabase) return "no-auth";
  const project = await getProject(pid);
  if (!project) return "no-project";
  const snapshot = makeSnapshot(pid, now);
  // Never replace a non-empty cloud snapshot with an empty one — that's the signature of a
  // device that failed to hydrate (open-time pull lost) closing the project: pushing {}
  // would destroy the only cross-device copy.
  const prev = project.data?.snapshot as ProjectSnapshot | undefined;
  if (!Object.keys(snapshot.entries).length && prev && Object.keys(prev.entries || {}).length) return "empty";
  const ok = await updateProject(pid, { data: { snapshot } });
  if (!ok) return "error"; // write (or pre-merge read) failed — do NOT stamp or report success
  setLastApplied(pid, now);
  return "ok";
}

/** Pull the cloud snapshot into local storage IF it's newer than what we last applied here.
 *  Returns true if it hydrated local state (caller should mount/remount the project after). */
export async function syncProjectDown(pid: string): Promise<boolean> {
  if (!supabase) return false;
  const project = await getProject(pid);
  const snap = project?.data?.snapshot as ProjectSnapshot | undefined;
  if (!snap || typeof snap.entries !== "object" || snap.entries === null) return false;
  if (snap.syncedAt && snap.syncedAt <= getLastApplied(pid)) return false; // local already has it (or newer)
  // A duplicated project's row carries the SOURCE's snapshot verbatim — applying those keys
  // as-is would overwrite the source project's live local state and leave the duplicate
  // empty. Re-key onto this project's id before applying.
  const entries = snap.pid && snap.pid !== pid ? rekeyEntries(snap.entries, snap.pid, pid) : snap.entries;
  const expected = Object.keys(entries).length;
  const n = applyProjectState(entries);
  // Only stamp lastApplied when EVERY key landed. A partial apply (some keys hit quota
  // mid-batch) must stay unstamped so the next open retries the rest — otherwise the
  // syncedAt<=lastApplied guard would permanently skip the missing keys and leave tools blank.
  if (n < expected) return n > 0; // some landed → remount; none → report no hydration
  setLastApplied(pid, snap.syncedAt || 0);
  return true;
}
