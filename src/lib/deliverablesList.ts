/** The post-supervisor's master deliverables list (the "punch list"): every artifact
 *  you owe, grouped by category, each flagged in/out of post's scope, with an owner and
 *  notes. Built from a natural-language brief + uploaded documents via the AI itemiser,
 *  then freely edited. Persisted per-project (localStorage). v1 — expect iteration. */

export type DelivCategory = "picture" | "audio" | "subtitles" | "metadata" | "marketing" | "other";
export type DelivOwner = "" | "post" | "sound" | "editorial" | "vfx" | "marketing" | "production" | "other";

export interface DeliverableItem {
  id: string;
  label: string;
  category: DelivCategory;
  inScope: boolean;   // is this post-production's responsibility?
  owner: DelivOwner;
  notes: string;
}

export const CATEGORIES: { id: DelivCategory; label: string }[] = [
  { id: "picture", label: "Picture" },
  { id: "audio", label: "Audio" },
  { id: "subtitles", label: "Subtitles & captions" },
  { id: "metadata", label: "Metadata & paperwork" },
  { id: "marketing", label: "Publicity & marketing" },
  { id: "other", label: "Other" },
];

export const OWNERS: { id: DelivOwner; label: string }[] = [
  { id: "", label: "—" },
  { id: "post", label: "Post" },
  { id: "sound", label: "Sound / mix" },
  { id: "editorial", label: "Editorial" },
  { id: "vfx", label: "VFX" },
  { id: "marketing", label: "Marketing" },
  { id: "production", label: "Production" },
  { id: "other", label: "Other" },
];

let _seq = 0;
const uid = () => `d${Date.now().toString(36)}${(_seq++).toString(36)}`;

export function newItem(category: DelivCategory = "picture"): DeliverableItem {
  return { id: uid(), label: "", category, inScope: true, owner: "", notes: "" };
}

/** A sensible generic starter punch-list for a Build-from-template recipient — the common
 *  artifacts most deliveries need. Edit, or Grow with AI, to tailor it to the platform. */
export function templateDeliverables(): DeliverableItem[] {
  const std: [string, DelivCategory][] = [
    ["Feature master — textless / clean", "picture"],
    ["Feature master — texted", "picture"],
    ["Textless elements (titles / graphics)", "picture"],
    ["Audio mix — 5.1", "audio"],
    ["Audio mix — Stereo", "audio"],
    ["M&E — 5.1", "audio"],
    ["M&E — Stereo", "audio"],
    ["Stems (D/M/E) — 5.1", "audio"],
    ["Subtitles / captions (per language)", "subtitles"],
    ["QC report", "metadata"],
    ["Delivery paperwork (as-run / spec sheet)", "metadata"],
    ["Proxy / viewing copy", "picture"],
  ];
  return std.map(([label, category]) => ({ ...newItem(category), label }));
}

function coerceItem(x: Record<string, unknown>): DeliverableItem {
  return {
    id: typeof x.id === "string" ? x.id : uid(),
    label: typeof x.label === "string" ? x.label : "",
    category: CATEGORIES.some((c) => c.id === x.category) ? (x.category as DelivCategory) : "other",
    inScope: x.inScope !== false,
    owner: OWNERS.some((o) => o.id === x.owner) ? (x.owner as DelivOwner) : "",
    notes: typeof x.notes === "string" ? x.notes : "",
  };
}

const listKey = (pid?: string) => `kaos.deliverables.list${pid ? `-${pid}` : ""}`;
const briefKey = (pid?: string) => `kaos.deliverables.brief${pid ? `-${pid}` : ""}`;

export function loadList(pid?: string): DeliverableItem[] {
  try {
    const raw = localStorage.getItem(listKey(pid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x === "object").map(coerceItem) : [];
  } catch { return []; }
}
export function saveList(pid: string | undefined, items: DeliverableItem[]) {
  try { localStorage.setItem(listKey(pid), JSON.stringify(items)); } catch { /* ignore */ }
}
export function loadBrief(pid?: string): string {
  try { return localStorage.getItem(briefKey(pid)) || ""; } catch { return ""; }
}
export function saveBrief(pid: string | undefined, brief: string) {
  try { localStorage.setItem(briefKey(pid), brief); } catch { /* ignore */ }
}

async function fileToDoc(file: File): Promise<{ name: string; mediaType: string; dataBase64: string }> {
  // Send the raw bytes + a media type; the serverless function reads PDFs/images natively
  // and extracts text from Word/Excel (Node-side) so nothing heavy ships in the browser bundle.
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("read failed"));
    fr.readAsDataURL(file);
  });
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const lower = file.name.toLowerCase();
  let mediaType = file.type;
  if (!mediaType) {
    if (lower.endsWith(".pdf")) mediaType = "application/pdf";
    else if (lower.endsWith(".docx")) mediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    else if (lower.endsWith(".xlsx")) mediaType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else if (lower.endsWith(".xls")) mediaType = "application/vnd.ms-excel";
    else mediaType = "text/plain";
  }
  return { name: file.name, mediaType, dataBase64: base64 };
}

const normKey = (label: string, category: string) => `${category}|${label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;

/** Send the brief + documents (+ what's already on the list) to the AI itemiser and return
 *  the NEW deliverable items only — deduped against `existing` and within the batch, so a
 *  Grow doesn't re-add what's already there. Returns [] if there's nothing new. */
export async function buildDeliverablesList(
  brief: string, files: File[], existing: DeliverableItem[] = [], opts: Record<string, (string | number)[]> = {},
): Promise<{ items: DeliverableItem[]; recipientRaw: unknown }> {
  const documents = await Promise.all(files.map(fileToDoc));
  const existingPayload = existing.filter((i) => i.label?.trim()).map((i) => ({ label: i.label, category: i.category }));
  const wantSpec = existingPayload.length === 0; // fill the recipient spec only on the first build
  let resp: Response;
  try {
    resp = await fetch("/api/build-deliverables-list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief, documents, existing: existingPayload, specOptions: opts, wantSpec }),
    });
  } catch {
    throw new Error("Couldn’t reach the AI service — it only runs on the deployed site, not local dev.");
  }
  let data: { items?: unknown; recipient?: unknown; message?: string } | null = null;
  try { data = await resp.json(); } catch { /* non-JSON */ }
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("AI endpoint not found — it runs on the deployed site, not local vite dev.");
    throw new Error(data?.message || `Build failed (${resp.status}).`);
  }
  const rawList = Array.isArray(data?.items) ? (data!.items as Record<string, unknown>[]) : [];
  // Safety net: drop anything matching an existing item or repeated within this batch.
  const seen = new Set(existing.filter((i) => i.label?.trim()).map((i) => normKey(i.label, i.category)));
  const out: DeliverableItem[] = [];
  for (const x of rawList) {
    const item = { ...coerceItem(x), id: uid() };
    if (!item.label.trim()) continue;
    const k = normKey(item.label, item.category);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return { items: out, recipientRaw: data?.recipient ?? null };
}
