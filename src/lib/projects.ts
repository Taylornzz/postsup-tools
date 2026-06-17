// Project model — a named container for one production's planning data.
// Backed by Supabase (per-user, RLS) when configured; local-storage otherwise.
// Same Project shape either way, so the UI doesn't care which store is live.

import { supabase } from "./supabase";
import { delFile } from "./fileStore";

export interface Project {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  updatedAt: number;
  /** Per-project planning state — populated as tools are migrated onto the project. */
  data?: Record<string, unknown>;
}

export const PROJECT_COLORS = [
  "#f59e0b", "#22d3ee", "#a78bfa", "#2dd4bf", "#fb7185", "#38bdf8", "#4ade80", "#818cf8",
];

const KEY = "kaos-projects";
const ACTIVE = "kaos-active-project";

const uid = () => {
  try { return crypto.randomUUID(); } catch { return `p${Date.now().toString(36)}${Math.floor(performance.now()).toString(36)}`; }
};

// ---- active project (always local — "which project is open in this browser") ----
export function getActiveProjectId(): string | null {
  try { return localStorage.getItem(ACTIVE); } catch { return null; }
}
export function setActiveProjectId(id: string | null): void {
  try { if (id) localStorage.setItem(ACTIVE, id); else localStorage.removeItem(ACTIVE); } catch { /* ignore */ }
}

// ---- local store ----
function localList(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const a = JSON.parse(raw); if (Array.isArray(a)) return a.sort((x, y) => y.updatedAt - x.updatedAt); }
  } catch { /* ignore */ }
  return [];
}
function localPersist(list: Project[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

// ---- Supabase row mapping ----
type Row = { id: string; name: string; color: string; data: Record<string, unknown> | null; created_at: string; updated_at: string };
const rowToProject = (r: Row): Project => ({
  id: r.id, name: r.name, color: r.color, data: r.data ?? {},
  createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
});

// ---- public API (async; works against either store) ----
export async function listProjects(): Promise<Project[]> {
  if (supabase) {
    const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
    if (error) { console.error("listProjects", error.message); return []; }
    return (data as Row[] | null ?? []).map(rowToProject);
  }
  return localList();
}

export async function getProject(id: string | null): Promise<Project | null> {
  if (!id) return null;
  if (supabase) {
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (error || !data) return null;
    return rowToProject(data as Row);
  }
  return localList().find((p) => p.id === id) ?? null;
}

export async function createProject(name: string, color: string): Promise<Project> {
  const clean = name.trim() || "Untitled project";
  if (supabase) {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("projects").insert({ user_id: u.user?.id, name: clean, color, data: {} }).select().single();
    if (error) throw new Error(error.message);
    return rowToProject(data as Row);
  }
  const now = Date.now();
  const p: Project = { id: uid(), name: clean, color, createdAt: now, updatedAt: now, data: {} };
  localPersist([p, ...localList()]);
  return p;
}

// Serialize all writes to a given project id so two read-modify-merge cycles can't interleave.
// On project close the snapshot push (data.snapshot) and the capture-state flush (data.url)
// fire ~simultaneously; both read-then-write the WHOLE data column, so without serialization a
// later write can clobber the other's just-merged field. Chaining per-id makes them sequential.
const writeChains = new Map<string, Promise<unknown>>();
export function updateProject(id: string, patch: Partial<Pick<Project, "name" | "color" | "data">>): Promise<boolean> {
  const prev = writeChains.get(id) ?? Promise.resolve();
  const run = prev.then(() => updateProjectInner(id, patch), () => updateProjectInner(id, patch));
  writeChains.set(id, run.catch(() => {}));
  return run;
}

async function updateProjectInner(id: string, patch: Partial<Pick<Project, "name" | "color" | "data">>): Promise<boolean> {
  if (supabase) {
    // Postgres replaces the whole `data` jsonb on update — so MERGE it with the current row
    // first. Two writers touch `data` (the debounced capture-state `url` writer and the
    // sync `snapshot` writer); without this read-modify-merge, the second write wipes the
    // first's field (e.g. a snapshot push clobbering a just-saved url, or vice versa).
    // A FAILED read must abort (not act as "no data") — merging onto {} and writing would
    // replace the whole column, the exact clobber this merge exists to prevent.
    let merged: typeof patch = patch;
    if (patch.data) {
      const { data: cur, error: readErr } = await supabase.from("projects").select("data").eq("id", id).maybeSingle();
      if (readErr) { console.error("updateProject read", readErr.message); return false; }
      merged = { ...patch, data: { ...((cur?.data as Record<string, unknown> | null) || {}), ...patch.data } };
    }
    const { error } = await supabase.from("projects").update(merged).eq("id", id);
    if (error) { console.error("updateProject", error.message); return false; }
    return true;
  }
  localPersist(localList().map((p) => (p.id === id
    ? { ...p, ...patch, data: patch.data ? { ...(p.data || {}), ...patch.data } : p.data, updatedAt: Date.now() }
    : p)));
  return true;
}

export async function deleteProject(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) console.error("deleteProject", error.message);
  } else {
    localPersist(localList().filter((p) => p.id !== id));
  }
  purgeLocalProject(id); // reclaim this project's per-project localStorage keys + attachment blobs
  if (getActiveProjectId() === id) setActiveProjectId(null);
}

/** Remove a deleted project's on-device residue: its attachment blobs (global store, keyed by
 *  doc id — unreachable once the project is gone) and every "-{id}"-suffixed localStorage key. */
function purgeLocalProject(id: string) {
  try {
    const recips = JSON.parse(localStorage.getItem(`kaos.deliverables.v1-${id}`) || "[]");
    if (Array.isArray(recips)) for (const r of recips) for (const d of (r?.documents || [])) { if (d?.id) delFile(d.id).catch(() => {}); }
  } catch { /* ignore */ }
  try {
    const suffix = `-${id}`;
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.endsWith(suffix)) keys.push(k); }
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  } catch { /* ignore */ }
}

export async function duplicateProject(id: string): Promise<Project | null> {
  const src = await getProject(id);
  if (!src) return null;
  if (supabase) {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("projects").insert({ user_id: u.user?.id, name: `${src.name} copy`, color: src.color, data: src.data ?? {} }).select().single();
    if (error) { console.error("duplicateProject", error.message); return null; }
    return rowToProject(data as Row);
  }
  const now = Date.now();
  const copy: Project = { ...src, id: uid(), name: `${src.name} copy`, createdAt: now, updatedAt: now };
  localPersist([copy, ...localList()]);
  return copy;
}

// ---- display prefs (per-device): pinned project ids + sort method ----
export type ProjectSort = "edited" | "name" | "created";
const PINNED_KEY = "kaos.projects.pinned";
const SORT_KEY = "kaos.projects.sort";

export function loadPinned(): string[] {
  try { const a = JSON.parse(localStorage.getItem(PINNED_KEY) || "[]"); return Array.isArray(a) ? a.filter((x) => typeof x === "string") : []; }
  catch { return []; }
}
export function savePinned(ids: string[]) { try { localStorage.setItem(PINNED_KEY, JSON.stringify(ids)); } catch { /* ignore */ } }
export function loadSort(): ProjectSort {
  try { const s = localStorage.getItem(SORT_KEY); return s === "name" || s === "created" ? s : "edited"; } catch { return "edited"; }
}
export function saveSort(s: ProjectSort) { try { localStorage.setItem(SORT_KEY, s); } catch { /* ignore */ } }

/** Pinned projects first (top-left), then the rest — both groups in the chosen sort order. */
export function orderProjects(projects: Project[], pinned: string[], sort: ProjectSort): Project[] {
  const cmp =
    sort === "name" ? (a: Project, b: Project) => a.name.localeCompare(b.name)
    : sort === "created" ? (a: Project, b: Project) => b.createdAt - a.createdAt
    : (a: Project, b: Project) => b.updatedAt - a.updatedAt;
  const pinSet = new Set(pinned);
  const pins = projects.filter((p) => pinSet.has(p.id)).sort(cmp);
  const rest = projects.filter((p) => !pinSet.has(p.id)).sort(cmp);
  return [...pins, ...rest];
}
