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
    if (!k || !k.endsWith(suffix) || isSensitiveLocalKey(k)) continue;
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

/** Validate a parsed backup file. Returns the backup or throws a friendly error. */
export function parseBackup(raw: unknown): ProjectBackup {
  const b = raw as Partial<ProjectBackup>;
  if (!b || b.kind !== "kaos-project-backup" || !b.snapshot || typeof b.snapshot !== "object" || typeof b.snapshot.entries !== "object") {
    throw new Error("That doesn’t look like a Kaos project backup file.");
  }
  return b as ProjectBackup;
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

/** Push this project's local state up to its cloud record (merging, so `data.url` survives). */
export async function syncProjectUp(pid: string, now: number): Promise<boolean> {
  if (!supabase) return false;
  const project = await getProject(pid);
  if (!project) return false;
  const snapshot = makeSnapshot(pid, now);
  await updateProject(pid, { data: { ...(project.data || {}), snapshot } });
  setLastApplied(pid, now);
  return true;
}

/** Pull the cloud snapshot into local storage IF it's newer than what we last applied here.
 *  Returns true if it hydrated local state (caller should mount/remount the project after). */
export async function syncProjectDown(pid: string): Promise<boolean> {
  if (!supabase) return false;
  const project = await getProject(pid);
  const snap = project?.data?.snapshot as ProjectSnapshot | undefined;
  if (!snap || typeof snap.entries !== "object") return false;
  if (snap.syncedAt && snap.syncedAt <= getLastApplied(pid)) return false; // local already has it (or newer)
  applyProjectState(snap.entries);
  setLastApplied(pid, snap.syncedAt || 0);
  return true;
}
