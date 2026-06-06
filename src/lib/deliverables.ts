// Deliverables matrix — plan a multi-recipient delivery deterministically.
//
// Phase 0 (this file): you set each recipient's spec; the engine works out the
// grade passes (grade the hero once, derive cleanly downward, flag the re-grades)
// and a per-recipient checklist of every variable to confirm/produce. It can push
// the whole plan to the Task Board.
//
// Phase 1 (later, needs a backend): an AI reads an uploaded contract / email /
// tech-spec and pre-fills the recipients — with the source quote beside each
// field so you verify, not trust. The data model below is what it fills in.
//
// Everything here is a planning aid — confirm every spec against the recipient's
// own delivery document. Per-project (localStorage).

export type Region = "US" | "UK" | "EU" | "AU" | "NZ" | "Other";
export type DRTier = "hdr" | "theatrical" | "sdr";
export type DRId = "dolby-vision" | "hdr10" | "hlg" | "sdr" | "theatrical";

export interface Recipient {
  id: string;
  name: string;
  region: Region;
  dr: DRId;
  peakNits: number; // used when dr is an HDR tier
  resolution: string;
  fps: number;
  container: string;
  audio: string;
  loudness: string;
  subtitles: string;
  textless: boolean;
  naming: string;
  qc: string;
  notes: string;
}

// ---- option sets (selects) ----
export const REGIONS: Region[] = ["US", "UK", "EU", "AU", "NZ", "Other"];
export const DR_OPTIONS: { id: DRId; label: string }[] = [
  { id: "dolby-vision", label: "Dolby Vision (HDR)" },
  { id: "hdr10", label: "HDR10" },
  { id: "hlg", label: "HLG (HDR)" },
  { id: "sdr", label: "SDR Rec.709" },
  { id: "theatrical", label: "Theatrical DCI-P3" },
];
export const NITS_OPTIONS = [600, 1000, 2000, 4000];
export const RESOLUTION_OPTIONS = ["UHD 3840×2160", "DCI 4K 4096×2160", "1080p 1920×1080", "1080i 1920×1080", "720p 1280×720", "DCI 2K 2048×1080"];
export const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];
export const CONTAINER_OPTIONS = ["IMF App 2E", "IMF App 5", "ProRes 422 HQ", "ProRes 4444 XQ", "ProRes 4444", "XDCAM HD 50", "AS-11 DPP", "DCP", "DNxHR HQX", "H.264 mezz", "Other"];
export const AUDIO_OPTIONS = ["2.0 Stereo", "5.1", "7.1", "5.1.4 Atmos", "7.1.4 Atmos", "Dual mono", "Other"];
export const SUBTITLE_OPTIONS = ["None", "Closed captions (CEA-608/708)", "Sidecar (IMSC/TTML)", "Burned-in (open)", "Open + sidecar", "SDH (deaf/HoH)"];
export const LOUDNESS_OPTIONS = [
  "-24 LKFS (ATSC A/85)",
  "-23 LUFS (EBU R128)",
  "-24 LKFS (Free TV OP-59)",
  "-27 LKFS (Netflix streaming)",
  "-16 LUFS (web)",
  "Theatrical reference (no normalisation)",
];
// Sensible starting loudness per region — a standard, but always confirm per recipient.
export const LOUDNESS_BY_REGION: Record<Region, string> = {
  US: "-24 LKFS (ATSC A/85)",
  UK: "-23 LUFS (EBU R128)",
  EU: "-23 LUFS (EBU R128)",
  AU: "-24 LKFS (Free TV OP-59)",
  NZ: "-24 LKFS",
  Other: "",
};

const DR_TIER: Record<DRId, DRTier> = { "dolby-vision": "hdr", hdr10: "hdr", hlg: "hdr", sdr: "sdr", theatrical: "theatrical" };
export const DR_LABEL: Record<DRId, string> = { "dolby-vision": "Dolby Vision", hdr10: "HDR10", hlg: "HLG", sdr: "SDR Rec.709", theatrical: "Theatrical DCI-P3" };
export const tierOf = (dr: DRId): DRTier => DR_TIER[dr];
export const isHdr = (dr: DRId) => DR_TIER[dr] === "hdr";

let _seq = 0;
const uid = (p = "r") => `${p}${Date.now().toString(36)}${(_seq++).toString(36)}`;

export function newRecipient(name = "New recipient"): Recipient {
  return {
    id: uid(), name, region: "US", dr: "sdr", peakNits: 1000,
    resolution: "UHD 3840×2160", fps: 23.976, container: "ProRes 422 HQ",
    audio: "5.1", loudness: LOUDNESS_BY_REGION.US, subtitles: "Closed captions (CEA-608/708)",
    textless: true, naming: "", qc: "", notes: "",
  };
}

// ---- the plan ----
export interface Pass {
  kind: "hero" | "derive" | "regrade";
  label: string;
  note?: string;
  flag?: boolean;      // true = a fresh grade pass, not a clean transform
  covers: string[];    // recipient names this pass serves
}
export interface Plan {
  passes: Pass[];
  gradeCount: number;
  deliverableCount: number;
  common: string[];    // variables identical across every recipient
  watchOuts: string[]; // cross-recipient gotchas (fps, loudness, resolution spread)
}

export function buildPlan(recipients: Recipient[]): Plan {
  const namesOf = (t: DRTier) => recipients.filter((r) => DR_TIER[r.dr] === t).map((r) => r.name || "Untitled");
  const hdr = namesOf("hdr"), theat = namesOf("theatrical"), sdr = namesOf("sdr");
  const passes: Pass[] = [];

  if (hdr.length) {
    const maxNits = Math.max(...recipients.filter((r) => DR_TIER[r.dr] === "hdr").map((r) => r.peakNits || 1000));
    passes.push({ kind: "hero", label: `HDR hero grade @ ${maxNits} nit`, note: "Grade once at the highest dynamic range; everything below trims from here.", covers: hdr });
    if (sdr.length) passes.push({ kind: "derive", label: "SDR Rec.709 trim", note: "Clean down-volume derive off the HDR hero.", covers: sdr });
    if (theat.length) passes.push({ kind: "regrade", label: "Theatrical DCI-P3 pass", flag: true, note: "Separate DI — P3 theatrical isn't a clean transform from an HDR streaming hero.", covers: theat });
  } else if (theat.length) {
    passes.push({ kind: "hero", label: "Theatrical DCI-P3 grade", note: "Grade the theatrical hero first.", covers: theat });
    if (sdr.length) passes.push({ kind: "derive", label: "SDR Rec.709 trim", note: "Derive from the P3 grade.", covers: sdr });
  } else if (sdr.length) {
    passes.push({ kind: "hero", label: "SDR Rec.709 grade", note: "One SDR grade covers every recipient.", covers: sdr });
  }

  const common: string[] = [];
  if (recipients.length > 1) {
    const same = <T,>(f: (r: Recipient) => T, label: (v: T) => string) => {
      const v0 = f(recipients[0]);
      if (recipients.every((r) => f(r) === v0)) common.push(label(v0));
    };
    same((r) => r.fps, (v) => `${v} fps`);
    same((r) => r.resolution, (v) => `${v}`);
    same((r) => r.audio, (v) => `${v} audio`);
    same((r) => r.container, (v) => `${v}`);
  }

  const watchOuts: string[] = [];
  const uniq = <T,>(arr: T[]) => [...new Set(arr)];
  const fps = uniq(recipients.map((r) => r.fps));
  if (fps.length > 1) watchOuts.push(`Frame-rate / standards conversion: ${fps.join(" and ")} fps both required.`);
  const loud = uniq(recipients.map((r) => r.loudness).filter(Boolean));
  if (loud.length > 1) watchOuts.push("Loudness targets differ — a separate audio normalisation per target.");
  const res = uniq(recipients.map((r) => r.resolution));
  if (res.length > 1) watchOuts.push(`Multiple resolutions: ${res.join(", ")} — confirm the finishing res vs down-scales.`);

  return { passes, gradeCount: passes.length, deliverableCount: recipients.length, common, watchOuts };
}

// ---- per-recipient variable checklist ----
export function recipientChecklist(r: Recipient): string[] {
  return [
    `Resolution — ${r.resolution}`,
    `Container — ${r.container}`,
    `Frame rate — ${r.fps} fps`,
    `Colour — ${DR_LABEL[r.dr]}${DR_TIER[r.dr] === "hdr" ? ` @ ${r.peakNits} nit` : ""}`,
    `Audio — ${r.audio}`,
    `Loudness — ${r.loudness || "confirm"}`,
    `Subtitles — ${r.subtitles}`,
    ...(r.textless ? ["Textless / clean elements"] : []),
    `Naming — ${r.naming || "confirm convention"}`,
    `QC — ${r.qc || "platform QC pass"}`,
  ];
}

// ---- push to the Task Board (writes the board's per-project localStorage) ----
type BoardCheck = { id: string; text: string; done: boolean };
type BoardCard = { id: string; title: string; notes: string; color: string; checks: BoardCheck[]; due?: string };
type BoardColumn = { id: string; name: string; cards: BoardCard[] };

export function sendToBoard(projectId: string | undefined, recipients: Recipient[], plan: Plan): { added: number } {
  const key = "kaos.board.v1" + (projectId ? `-${projectId}` : "");
  let cols: BoardColumn[] | null = null;
  try { cols = JSON.parse(localStorage.getItem(key) || "null"); } catch { cols = null; }
  if (!Array.isArray(cols) || !cols.length) {
    cols = ["To do", "Doing", "Blocked", "Done"].map((name) => ({ id: uid("co"), name, cards: [] }));
  }
  const have = new Set(cols.flatMap((c) => c.cards.map((k) => (k.title || "").toLowerCase().trim())));

  const draft: { title: string; notes: string; color: string; checks: string[] }[] = [];
  plan.passes.forEach((p, i) => draft.push({
    title: `Grade ${i + 1}: ${p.label}`,
    notes: [p.note, p.covers.length ? `Covers: ${p.covers.join(", ")}` : ""].filter(Boolean).join(" · "),
    color: p.flag ? "#f87171" : p.kind === "hero" ? "#f59e0b" : "#34d399",
    checks: [],
  }));
  recipients.forEach((r) => draft.push({
    title: `Deliver: ${r.name || "Untitled"}`,
    notes: r.notes || `${r.region} · ${r.container}`,
    color: "#38bdf8",
    checks: recipientChecklist(r),
  }));

  const fresh: BoardCard[] = draft
    .filter((c) => !have.has(c.title.toLowerCase().trim()))
    .map((c) => ({ id: uid("cd"), title: c.title, notes: c.notes, color: c.color, checks: c.checks.map((t) => ({ id: uid("ch"), text: t, done: false })) }));

  cols[0] = { ...cols[0], cards: [...cols[0].cards, ...fresh] };
  try { localStorage.setItem(key, JSON.stringify(cols)); } catch { /* ignore */ }
  return { added: fresh.length };
}

// ---- per-project persistence ----
const KEY = "kaos.deliverables.v1";

function seed(): Recipient[] {
  // Starter examples using the three recipients from the brief — all editable,
  // all to be confirmed against each platform's real delivery spec.
  return [
    { id: uid(), name: "Paramount+ USA", region: "US", dr: "dolby-vision", peakNits: 1000, resolution: "UHD 3840×2160", fps: 23.976, container: "IMF App 2E", audio: "5.1.4 Atmos", loudness: "-24 LKFS (ATSC A/85)", subtitles: "Sidecar (IMSC/TTML)", textless: true, naming: "", qc: "Photon + platform", notes: "Example — confirm against the real Paramount+ delivery spec." },
    { id: uid(), name: "TVNZ", region: "NZ", dr: "sdr", peakNits: 1000, resolution: "1080p 1920×1080", fps: 25, container: "ProRes 422 HQ", audio: "5.1", loudness: "-24 LKFS", subtitles: "Closed captions (CEA-608/708)", textless: true, naming: "", qc: "", notes: "Example — confirm against the real TVNZ delivery spec." },
    { id: uid(), name: "ABC Sydney", region: "AU", dr: "sdr", peakNits: 1000, resolution: "1080p 1920×1080", fps: 25, container: "AS-11 DPP", audio: "5.1", loudness: "-24 LKFS (Free TV OP-59)", subtitles: "Closed captions (CEA-608/708)", textless: true, naming: "", qc: "", notes: "Example — confirm against the real ABC delivery spec." },
  ];
}

export function loadRecipients(projectId?: string): Recipient[] {
  const key = KEY + (projectId ? `-${projectId}` : "");
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return seed();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return seed();
    return arr.filter((r) => r && typeof r.name === "string").map((r) => ({ ...newRecipient(), ...r, id: typeof r.id === "string" ? r.id : uid() }));
  } catch { return seed(); }
}
export function saveRecipients(projectId: string | undefined, recipients: Recipient[]) {
  const key = KEY + (projectId ? `-${projectId}` : "");
  try { localStorage.setItem(key, JSON.stringify(recipients)); } catch { /* ignore */ }
}
