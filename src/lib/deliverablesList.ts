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
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("read failed"));
    fr.readAsDataURL(file);
  });
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  const mediaType = file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "text/plain");
  return { name: file.name, mediaType, dataBase64: base64 };
}

/** Send the brief + documents to the AI itemiser and return new deliverable items. */
export async function buildDeliverablesList(brief: string, files: File[]): Promise<DeliverableItem[]> {
  const documents = await Promise.all(files.map(fileToDoc));
  let resp: Response;
  try {
    resp = await fetch("/api/build-deliverables-list", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief, documents }),
    });
  } catch {
    throw new Error("Couldn’t reach the AI service — it only runs on the deployed site, not local dev.");
  }
  let data: { items?: unknown; message?: string } | null = null;
  try { data = await resp.json(); } catch { /* non-JSON */ }
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("AI endpoint not found — it runs on the deployed site, not local vite dev.");
    throw new Error(data?.message || `Build failed (${resp.status}).`);
  }
  const rawList = Array.isArray(data?.items) ? (data!.items as Record<string, unknown>[]) : [];
  if (rawList.length === 0) throw new Error("Nothing to itemise — add a brief or a document.");
  return rawList.map((x) => ({ ...coerceItem(x), id: uid() }));
}
