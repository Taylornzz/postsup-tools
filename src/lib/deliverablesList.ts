/** The post-supervisor's master deliverables list (the "punch list"): every artifact
 *  you owe, grouped by category, each flagged in/out of post's scope, with an owner and
 *  notes. Built from a natural-language brief + uploaded documents via the AI itemiser,
 *  then freely edited. Persisted per-project (localStorage). v1 — expect iteration. */

export type DelivCategory = "picture" | "audio" | "subtitles" | "metadata" | "archive" | "editorial" | "legal" | "marketing" | "other";
export type DelivOwner = "" | "post" | "sound" | "editorial" | "vfx" | "marketing" | "production" | "other";
export type DelivStatus = "todo" | "wip" | "delivered" | "accepted" | "qc-fail" | "redeliver";

export interface DeliverableItem {
  id: string;
  label: string;
  category: DelivCategory;
  inScope: boolean;   // is this post-production's responsibility?
  owner: DelivOwner;
  notes: string;
  status: DelivStatus; // QC / delivery lifecycle
  version: number;     // redelivery version (v1, v2 after a QC fix)
}

export const STATUSES: { id: DelivStatus; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "wip", label: "In progress" },
  { id: "delivered", label: "Delivered (in QC)" },
  { id: "accepted", label: "Accepted" },
  { id: "qc-fail", label: "QC fail" },
  { id: "redeliver", label: "Redeliver" },
];

export const CATEGORIES: { id: DelivCategory; label: string }[] = [
  { id: "picture", label: "Picture" },
  { id: "audio", label: "Audio" },
  { id: "subtitles", label: "Subtitles & captions" },
  { id: "metadata", label: "Metadata & paperwork" },
  { id: "archive", label: "Archive & masters" },
  { id: "editorial", label: "Editorial & conform" },
  { id: "legal", label: "Legal & music" },
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
export const newItemId = () => `d${Date.now().toString(36)}${(_seq++).toString(36)}`;
const uid = newItemId;

export function newItem(category: DelivCategory = "picture"): DeliverableItem {
  return { id: uid(), label: "", category, inScope: true, owner: "", notes: "", status: "todo", version: 1 };
}

/** Audio configurations a delivery implies, richest first. Atmos deliveries carry a 5.1 +
 *  stereo fold-down; 5.1 carries a stereo; etc. */
function audioConfigs(audio: string): string[] {
  const a = (audio || "").toLowerCase();
  if (a.includes("atmos")) return ["Atmos", "5.1", "Stereo"];
  if (a.includes("7.1")) return ["7.1", "5.1", "Stereo"];
  if (a.includes("5.1")) return ["5.1", "Stereo"];
  return ["Stereo"];
}

function subtitleItem(subs: string): string {
  const s = (subs || "").toLowerCase();
  if (!s || s.includes("none")) return "";
  if (s.includes("sidecar") || s.includes("imsc") || s.includes("ttml")) return "Subtitle files (IMSC/TTML, per language)";
  if (s.includes("caption") || s.includes("608") || s.includes("708")) return "Closed captions (CEA-608/708)";
  if (s.includes("burn")) return "Burned-in subtitles (open)";
  if (s.includes("sdh")) return "SDH subtitles (per language)";
  return "Subtitles / captions (per language)";
}

// ---- language / version matrix (OV + per-language VF supplementals) ----
export type LangKind = "OV" | "VF";
export interface DeliveryLanguage { code: string; kind: LangKind; dub: boolean; sdh: boolean; forced: boolean; ad: boolean; }
export function newLanguage(code = ""): DeliveryLanguage { return { code, kind: "VF", dub: false, sdh: false, forced: false, ad: false }; }

/** Fan a language matrix into the localization deliverables it implies. A versioned (VF) dub
 *  needs a dub PRINTMASTER (dubbed dialogue + M&E), localized titles/credits and a dub card; the
 *  source-language M&E and textless fill are shared (added once when any dub exists). The OV owes
 *  forced narratives + SDH (not full same-language subs); VF languages owe full subs. Audio
 *  description (AD) + AD script fan out per language flagged. Each is a distinct, typed artifact. */
export function languageItems(langs: DeliveryLanguage[]): DeliverableItem[] {
  const rows: { label: string; category: DelivCategory; owner: DelivOwner }[] = [];
  const anyDub = langs.some((l) => l.kind === "VF" && l.dub);
  if (anyDub) {
    rows.push({ label: "M&E — fully-filled (for foreign dubs)", category: "audio", owner: "sound" });
    rows.push({ label: "Textless / clean fill (for localized graphics)", category: "picture", owner: "vfx" });
  }
  for (const l of langs) {
    const tag = (l.code || "").trim().toUpperCase() || "??";
    if (l.kind === "VF" && l.dub) {
      rows.push({ label: `Dub printmaster — ${tag} (dubbed D + M&E)`, category: "audio", owner: "sound" });
      rows.push({ label: `Localized titles & credits — ${tag}`, category: "picture", owner: "vfx" });
      rows.push({ label: `Dub card — ${tag}`, category: "picture", owner: "editorial" });
    }
    if (l.kind === "VF") rows.push({ label: `Subtitles (full) — ${tag}`, category: "subtitles", owner: "post" });
    if (l.forced) rows.push({ label: `Forced narratives — ${tag}`, category: "subtitles", owner: "post" });
    if (l.sdh) rows.push({ label: `SDH — ${tag}`, category: "subtitles", owner: "post" });
    if (l.ad) {
      rows.push({ label: `Audio description (AD) — ${tag}`, category: "audio", owner: "sound" });
      rows.push({ label: `AD script — ${tag}`, category: "metadata", owner: "editorial" });
    }
  }
  return rows.map((r) => ({ ...newItem(r.category), label: r.label, owner: r.owner }));
}

/** A sensible default owner per category so template items arrive pre-assigned. */
const defaultOwner = (c: DelivCategory): DelivOwner =>
  c === "audio" ? "sound" : c === "picture" || c === "subtitles" || c === "metadata" ? "post" : "";

/** The non-rendition obligations that hold up final payment — cue sheet, conform handoff,
 *  archive/LTO, archival master, chain-of-title. Mostly coordinated by post, owned elsewhere. */
function editorialArchiveItems(): DeliverableItem[] {
  return [
    { ...newItem("legal"), label: "Music cue sheet", owner: "production", inScope: false },
    { ...newItem("editorial"), label: "Conform AAF / XML + EDL", owner: "editorial" },
    { ...newItem("editorial"), label: "As-broadcast script / CCSL (dialogue + spotting list)", owner: "editorial" },
    { ...newItem("archive"), label: "Project archive → LTO + MHL / checksum manifest", owner: "post" },
    { ...newItem("archive"), label: "Archival master (graded ACES / OCN handover)", owner: "post" },
    { ...newItem("legal"), label: "Chain-of-title / E&O paperwork", owner: "production", inScope: false },
  ];
}

/** A spec-aware starter punch-list for a Build-from-template recipient — tailored to the
 *  platform's audio config (Atmos vs 5.1 vs stereo), HDR/SDR, and subtitle type. A sensible
 *  starting point; edit or Grow with AI to finish. */
export function templateDeliverables(spec?: { audio?: string; dr?: string; subtitles?: string; container?: string }): DeliverableItem[] {
  // Theatrical / DCP is a different beast — DCP package, KDM keys, printmasters, accessibility.
  const theatrical = spec?.dr === "theatrical" || (spec?.container || "").toUpperCase().includes("DCP");
  if (theatrical) {
    const dcp: [string, DelivCategory][] = [
      ["DCDM — Digital Cinema Distribution Master", "picture"],
      ["DCP — feature, SMPTE (OV) — 2K + 4K", "picture"],
      ["CPL / PKL / ASSETMAP (composition + packing list)", "picture"],
      ["VF / version DCPs (per language / edit)", "picture"],
      ["Textless / clean master (for foreign VF)", "picture"],
      ["Trailer / teaser DCP", "picture"],
      ["KDM keys — per-server, time-windowed", "metadata"],
      ["Printmaster — 5.1", "audio"],
      ["Printmaster — 7.1", "audio"],
      ["Printmaster — Dolby Atmos (if immersive)", "audio"],
      ["M&E — 5.1 (for foreign dubs)", "audio"],
      ["Accessibility — HI + VI-N audio tracks", "audio"],
      ["Subtitle DCP / SMPTE-TT (per language)", "subtitles"],
      ["Closed captions (CCAP) + open-caption version", "subtitles"],
      ["DCP QC report (Clipster / Dolby / lab)", "metadata"],
      ["Delivery paperwork (CPL list / version map)", "metadata"],
    ];
    return [...dcp.map(([label, category]) => ({ ...newItem(category), label, owner: defaultOwner(category) })), ...editorialArchiveItems()];
  }

  const hdr = spec?.dr === "dolby-vision" || spec?.dr === "hdr10" || spec?.dr === "hlg";
  const configs = audioConfigs(spec?.audio || "5.1");
  const out: [string, DelivCategory][] = [];

  // Picture
  if (hdr) {
    out.push(["Picture master — HDR (clean / textless)", "picture"]);
    out.push(["Picture master — SDR (clean / textless)", "picture"]);
    if (spec?.dr === "dolby-vision") out.push(["Dolby Vision metadata (XML)", "picture"]);
  } else {
    out.push(["Picture master — clean / textless", "picture"]);
  }
  out.push(["Picture master — texted", "picture"]);
  out.push(["Textless elements (titles / graphics)", "picture"]);
  out.push(["Proxy / viewing copy", "picture"]);

  // Audio — one mix + M&E per configuration the spec implies; stems in the richest config
  for (const c of configs) out.push([`Audio mix — ${c}`, "audio"]);
  for (const c of configs) out.push([`M&E — ${c}`, "audio"]);
  out.push([`Stems (D/M/E) — ${configs[0]}`, "audio"]);

  // Subtitles
  const sub = subtitleItem(spec?.subtitles ?? "");
  if (sub) out.push([sub, "subtitles"]);

  // Paperwork
  out.push(["QC report", "metadata"]);
  out.push(["Delivery paperwork (as-run / spec sheet)", "metadata"]);

  return [...out.map(([label, category]) => ({ ...newItem(category), label, owner: defaultOwner(category) })), ...editorialArchiveItems()];
}

export function coerceItem(x: Record<string, unknown>): DeliverableItem {
  return {
    id: typeof x.id === "string" ? x.id : uid(),
    label: typeof x.label === "string" ? x.label : "",
    category: CATEGORIES.some((c) => c.id === x.category) ? (x.category as DelivCategory) : "other",
    inScope: x.inScope !== false,
    owner: OWNERS.some((o) => o.id === x.owner) ? (x.owner as DelivOwner) : "",
    notes: typeof x.notes === "string" ? x.notes : "",
    status: STATUSES.some((s) => s.id === x.status) ? (x.status as DelivStatus) : "todo",
    version: typeof x.version === "number" && x.version > 0 ? x.version : 1,
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

// PDFs up to ~3 MB go to the AI natively (best quality — layout/tables). Larger ones would
// exceed the serverless request limit (4.5 MB) once base64-encoded, so we extract their text in
// the browser instead — the binary stays on-device; only the (small) text is sent.
const PDF_NATIVE_MAX = 3 * 1024 * 1024;

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    parts.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return parts.join("\n\n").trim();
}

async function fileToDoc(file: File): Promise<{ name: string; mediaType: string; dataBase64: string }> {
  const lower = file.name.toLowerCase();
  // Large PDF → extract text client-side so the request fits the serverless limit.
  if ((file.type === "application/pdf" || lower.endsWith(".pdf")) && file.size >= PDF_NATIVE_MAX) {
    const text = await extractPdfText(file);
    if (!text) throw new Error(`“${file.name}” is large and has no selectable text (it may be scanned) — paste the key spec text, or attach a smaller PDF.`);
    return { name: file.name, mediaType: "text/plain", dataBase64: btoa(unescape(encodeURIComponent(`[${file.name}]\n\n${text}`))) };
  }
  // Otherwise send the raw bytes + a media type; the serverless function reads PDFs/images
  // natively and extracts text from Word/Excel (Node-side) so nothing heavy ships in the bundle.
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("read failed"));
    fr.readAsDataURL(file);
  });
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
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
    if (resp.status === 413) throw new Error("The attached document is too large to send (over ~4.5 MB once encoded). Try a smaller file, or paste the key text into the brief.");
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
