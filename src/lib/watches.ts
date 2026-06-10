// News watches — Phase 1 (local). Plain-English topics the app will track and
// summarise. Stored in localStorage for now; Phase 2 moves to Supabase (per-user,
// RLS) and wires a scheduled job + email. The data model here is deliberately the
// same shape we'll persist server-side, so the move is a drop-in.

export type Cadence = "daily" | "weekly";
export type Delivery = "email" | "feed" | "both";

export interface Watch {
  id: string;
  topic: string;          // plain-English subject, e.g. "Lord of the Rings — the new film"
  regions: string[];      // e.g. ["NZ", "LA"]
  keywords: string[];     // optional extra terms to sharpen the search
  cadence: Cadence;
  delivery: Delivery;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
}

export interface DigestItem {
  title: string;
  source: string;         // publication / outlet
  url: string;
  date: string;           // ISO or human
}

export interface Digest {
  id: string;
  watchId: string;
  watchTopic: string;
  createdAt: string;
  tldr: string;
  items: DigestItem[];
  sample: boolean;        // true while Phase 1 — clearly flagged as placeholder
}

const WATCHES_KEY = "kaos.news.watches.v1";
const DIGESTS_KEY = "kaos.news.digests.v1";

const uid = () =>
  (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

// ---- Region presets ----
export const REGION_PRESETS: { id: string; label: string }[] = [
  { id: "NZ", label: "New Zealand" },
  { id: "LA", label: "Los Angeles" },
  { id: "UK", label: "United Kingdom" },
  { id: "AU", label: "Australia" },
  { id: "Global", label: "Worldwide" },
];

export const regionLabel = (id: string) =>
  REGION_PRESETS.find((r) => r.id === id)?.label ?? id;

// ---- Plain-English → plan ----
// Lightweight, dependency-free intent read. Phase 2 swaps this for a real LLM
// clarification step; the *shape* it returns stays the same so the UI doesn't change.
const REGION_HINTS: { id: string; rx: RegExp }[] = [
  { id: "NZ", rx: /\b(nz|new zealand|aotearoa|auckland|wellington|wgtn|christchurch)\b/i },
  { id: "LA", rx: /\b(la|los angeles|hollywood|burbank|california|usa|u\.s\.|america)\b/i },
  { id: "UK", rx: /\b(uk|u\.k\.|britain|british|london|england|scotland|ireland)\b/i },
  { id: "AU", rx: /\b(au|australia|australian|sydney|melbourne|gold coast|queensland)\b/i },
];

export interface WatchPlan {
  topic: string;
  regions: string[];
  needsRegion: boolean;   // true when we couldn't infer any region → ask
}

export function planFromPrompt(prompt: string): WatchPlan {
  const topic = prompt.trim().replace(/\s+/g, " ");
  const regions = REGION_HINTS.filter((h) => h.rx.test(topic)).map((h) => h.id);
  return { topic, regions, needsRegion: regions.length === 0 };
}

// ---- Watches CRUD ----
export const listWatches = (): Watch[] => read<Watch[]>(WATCHES_KEY, []);

export function saveWatch(w: Omit<Watch, "id" | "createdAt"> & { id?: string; createdAt?: string }): Watch {
  const all = listWatches();
  if (w.id) {
    const idx = all.findIndex((x) => x.id === w.id);
    if (idx >= 0) {
      const merged: Watch = { ...all[idx], ...w, id: w.id } as Watch;
      all[idx] = merged;
      write(WATCHES_KEY, all);
      return merged;
    }
  }
  const created: Watch = {
    ...w,
    id: w.id ?? uid(),
    createdAt: w.createdAt ?? new Date().toISOString(),
  } as Watch;
  write(WATCHES_KEY, [created, ...all]);
  return created;
}

export function deleteWatch(id: string) {
  write(WATCHES_KEY, listWatches().filter((w) => w.id !== id));
}

export function toggleWatch(id: string, enabled: boolean) {
  const all = listWatches();
  const idx = all.findIndex((w) => w.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], enabled };
    write(WATCHES_KEY, all);
  }
}

export function markWatchRun(id: string, at = new Date().toISOString()) {
  const all = listWatches();
  const idx = all.findIndex((w) => w.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], lastRunAt: at };
    write(WATCHES_KEY, all);
  }
}

// ---- Digests (the in-app feed) ----
export const listDigests = (): Digest[] => read<Digest[]>(DIGESTS_KEY, []);

export function addDigest(d: Omit<Digest, "id" | "createdAt"> & { id?: string; createdAt?: string }): Digest {
  const created: Digest = {
    ...d,
    id: d.id ?? uid(),
    createdAt: d.createdAt ?? new Date().toISOString(),
  } as Digest;
  // keep newest first, cap the local feed so storage doesn't grow forever
  const all = [created, ...listDigests()].slice(0, 60);
  write(DIGESTS_KEY, all);
  return created;
}

export function clearDigests() {
  write(DIGESTS_KEY, []);
}

// ---- Real digest (from /api/news-digest) ----
export function digestFromResult(
  w: Watch,
  result: { tldr: string; items: DigestItem[]; noResults?: boolean },
): Digest {
  const where = w.regions.length === 0 ? "worldwide" : w.regions.map(regionLabel).join(" & ");
  const tldr =
    result.tldr ||
    (result.noResults
      ? `No fresh reporting on “${w.topic}” (${where}) turned up this time. Try widening the topic or check again later.`
      : `Latest on “${w.topic}” (${where}).`);
  return {
    id: uid(),
    watchId: w.id,
    watchTopic: w.topic,
    createdAt: new Date().toISOString(),
    tldr,
    items: result.items || [],
    sample: false,
  };
}

// ---- Phase-1 sample digest (offline fallback) ----
// Honest placeholder: clearly flagged, obviously-fake links, so nobody mistakes it
// for real reporting. Used only when the live news service is unreachable (e.g. local dev).
export function buildSampleDigest(w: Watch): Digest {
  const where =
    w.regions.length === 0
      ? "worldwide"
      : w.regions.map(regionLabel).join(" & ");
  const tldr =
    `Sample preview for “${w.topic}” (${where}). This is placeholder output that shows the ` +
    `shape of a digest — a short plain-English TLDR followed by source links. Once the watch ` +
    `goes live, this becomes a real ${w.cadence} summary pulled from current reporting.`;
  const items: DigestItem[] = (w.regions.length ? w.regions : ["Global"]).flatMap((r) => [
    {
      title: `Example headline about ${w.topic} — ${regionLabel(r)}`,
      source: "Sample source",
      url: "#",
      date: "preview",
    },
    {
      title: `Second example item for ${w.topic} in ${regionLabel(r)}`,
      source: "Sample source",
      url: "#",
      date: "preview",
    },
  ]);
  return {
    id: uid(),
    watchId: w.id,
    watchTopic: w.topic,
    createdAt: new Date().toISOString(),
    tldr,
    items,
    sample: true,
  };
}
