// Project model — a named container for one production's planning data.
// Backed by Supabase (per-user, RLS) when configured; local-storage otherwise.
// Same Project shape either way, so the UI doesn't care which store is live.

import { supabase } from "./supabase";

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

export async function updateProject(id: string, patch: Partial<Pick<Project, "name" | "color" | "data">>): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("projects").update(patch).eq("id", id);
    if (error) console.error("updateProject", error.message);
    return;
  }
  localPersist(localList().map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)));
}

export async function deleteProject(id: string): Promise<void> {
  if (supabase) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) console.error("deleteProject", error.message);
  } else {
    localPersist(localList().filter((p) => p.id !== id));
  }
  if (getActiveProjectId() === id) setActiveProjectId(null);
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
