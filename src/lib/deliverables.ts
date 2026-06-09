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

import {
  makeOrder, MASTER_NITS,
  type CustomConfig, type CustomHero, type CustomDeliverable, type MasterNits,
  type MakeStep, type MasterFamily,
} from "./mastering";
import type { DeliverableItem } from "./deliverablesList";

export type Region = "US" | "UK" | "EU" | "AU" | "NZ" | "Other";
export type DRTier = "hdr" | "theatrical" | "sdr";
export type DRId = "dolby-vision" | "hdr10" | "hlg" | "sdr" | "theatrical";

/** An uploaded document attached to a recipient. Bytes live in IndexedDB (keyed
 *  by id, see fileStore); only this metadata is persisted with the recipient. */
export interface DocMeta { id: string; name: string; type: string; size: number; addedAt: string; }

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
  truePeak: string;
  subtitles: string;
  textless: boolean;
  naming: string;
  qc: string;
  notes: string;
  documents?: DocMeta[];
  brief?: string;                   // the AI brief for this recipient's deliverables
  deliverables?: DeliverableItem[]; // this recipient's itemised punch-list
  isMain?: boolean;                 // the main/hero deliverable — the others derive from it
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
  "-24 LKFS (NZ / OP-59)",
  "-27 LKFS (Netflix streaming)",
  "-24 LKFS (streaming)",
  "-24 LUFS (Apple TV+)",
  "-16 LUFS (web)",
  "Theatrical reference (no normalisation)",
];
// Sensible starting loudness per region — a standard, but always confirm per recipient.
export const LOUDNESS_BY_REGION: Record<Region, string> = {
  US: "-24 LKFS (ATSC A/85)",
  UK: "-23 LUFS (EBU R128)",
  EU: "-23 LUFS (EBU R128)",
  AU: "-24 LKFS (Free TV OP-59)",
  NZ: "-24 LKFS (NZ / OP-59)",
  Other: "",
};

// True-peak ceiling — the QC-critical limit most checklists miss. Verified mid-2026
// against ATSC A/85, EBU R128, Free TV OP-59 and the major streamers (Netflix/Amazon
// -2 dBTP, Apple TV+ -1 dBTP). DPP recommends -3 dBTP (hard max -1).
export const TRUEPEAK_OPTIONS = ["-2 dBTP", "-1 dBTP", "-3 dBTP (DPP target)", "None (theatrical reference)"];
export const TRUEPEAK_BY_REGION: Record<Region, string> = {
  US: "-2 dBTP",   // ATSC A/85
  UK: "-1 dBTP",   // EBU R128 ceiling (DPP recommends -3)
  EU: "-1 dBTP",   // EBU R128
  AU: "-2 dBTP",   // Free TV OP-59
  NZ: "-2 dBTP",   // aligns OP-59
  Other: "",
};

// Dialnorm is a Dolby AC-3 / E-AC-3 EMISSION metadata value (integer 1–31), NOT a field
// on a PCM master — ProRes / IMF / WAV carry none. It only materialises where a broadcaster
// encodes to AC-3 (US ATSC, AU). Surface it as guidance, never as a "set this on your master"
// field — that instruction is the common mistake this tool should prevent.
export function dialnormNote(r: Recipient): string | null {
  if (!/ATSC|A\/85|OP-59/i.test(r.loudness || "")) return null;
  const target = (r.loudness.match(/-?\d+/) || ["-24"])[0];
  return `Dialnorm (AC-3 emission only) — match the target (${target}); your PCM master carries none.`;
}

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
    audio: "5.1", loudness: LOUDNESS_BY_REGION.US, truePeak: TRUEPEAK_BY_REGION.US, subtitles: "Closed captions (CEA-608/708)",
    textless: true, naming: "", qc: "", notes: "", documents: [], brief: "", deliverables: [], isMain: false,
  };
}

// ---- platform delivery templates ------------------------------------------
// Starting-point specs for common platforms, web-verified mid-2026. NOT contracts —
// every platform issues per-title specs through its partner portal; each note carries
// the date + the must-confirm caveat. Drop one in and edit.
export interface DeliveryTemplate { id: string; name: string; spec: Partial<Recipient>; }
export const DELIVERY_TEMPLATES: DeliveryTemplate[] = [
  { id: "netflix", name: "Netflix", spec: { region: "US", dr: "dolby-vision", peakNits: 1000, resolution: "UHD 3840×2160", fps: 23.976, container: "IMF App 2E", audio: "5.1.4 Atmos", loudness: "-27 LKFS (Netflix streaming)", truePeak: "-2 dBTP", subtitles: "Sidecar (IMSC/TTML)", textless: true, qc: "Photon + platform", notes: "Netflix original — Dolby Vision IMF mandatory for HDR (no ProRes path); 25p in PAL territories. Starter spec (2026-06) — confirm the per-title Netflix spec." } },
  { id: "amazon", name: "Amazon Prime Video", spec: { region: "US", dr: "hdr10", peakNits: 1000, resolution: "UHD 3840×2160", fps: 23.976, container: "ProRes 422 HQ", audio: "5.1", loudness: "-24 LKFS (streaming)", truePeak: "-2 dBTP", subtitles: "Sidecar (IMSC/TTML)", textless: true, qc: "platform QC / Baton", notes: "Amazon — self-serve Video Central takes ProRes 422 HQ + a mandatory SDR companion with every HDR; Studios originals require IMF. Starter spec (2026-06) — confirm." } },
  { id: "apple", name: "Apple TV+", spec: { region: "US", dr: "dolby-vision", peakNits: 1000, resolution: "UHD 3840×2160", fps: 23.976, container: "ProRes 4444 XQ", audio: "5.1.4 Atmos", loudness: "-24 LUFS (Apple TV+)", truePeak: "-1 dBTP", subtitles: "Sidecar (IMSC/TTML)", textless: true, qc: "platform QC / Baton", notes: "Apple TV+ — documented path is ProRes 4444 XQ + Dolby Vision sidecar; Atmos effectively required. -1 dBTP true-peak is tighter than Netflix/Amazon (top QC reject). Starter spec (2026-06) — confirm." } },
  { id: "max", name: "Max (HBO / WBD)", spec: { region: "US", dr: "dolby-vision", peakNits: 1000, resolution: "UHD 3840×2160", fps: 23.976, container: "IMF App 2E", audio: "5.1.4 Atmos", loudness: "-24 LKFS (streaming)", truePeak: "-2 dBTP", subtitles: "Sidecar (IMSC/TTML)", textless: true, qc: "Photon + platform", notes: "Max/WBD original — HDR & SDR masters must be frame/shot-aligned (shared audio + subs); DV metadata must cover textless. Nits/loudness/true-peak portal-walled — confirm. Starter spec (2026-06)." } },
  { id: "bbc-dpp", name: "BBC · UK DPP (AS-11)", spec: { region: "UK", dr: "sdr", resolution: "1080i 1920×1080", fps: 25, container: "AS-11 DPP", audio: "5.1", loudness: "-23 LUFS (EBU R128)", truePeak: "-3 dBTP (DPP target)", subtitles: "Sidecar (IMSC/TTML)", textless: true, qc: "Baton (DPP)", notes: "BBC / UK DPP — AS-11 (MXF OP1a, AVC-Intra 100), interlaced 1080i/25, EBU R128 -23 LUFS, true-peak -3 (max -1). Not IMF/ProRes. Confirm the BBC DPP supplement. Starter spec (2026-06)." } },
  { id: "tvnz", name: "TVNZ", spec: { region: "NZ", dr: "sdr", resolution: "1080i 1920×1080", fps: 25, container: "XDCAM HD 50", audio: "5.1", loudness: "-24 LKFS (NZ / OP-59)", truePeak: "-2 dBTP", subtitles: "Sidecar (IMSC/TTML)", textless: true, qc: "Baton / platform", notes: "TVNZ — 1080i/50 PAL, XDCAM HD422 50 in MXF, -24 LKFS (OP-59). Public doc is the commercials spec; confirm long-form with TVNZ. Starter spec (2026-06)." } },
  { id: "abc-au", name: "ABC Australia", spec: { region: "AU", dr: "sdr", resolution: "1080i 1920×1080", fps: 25, container: "AS-11 DPP", audio: "5.1", loudness: "-24 LKFS (Free TV OP-59)", truePeak: "-2 dBTP", subtitles: "Sidecar (IMSC/TTML)", textless: true, qc: "Baton / platform", notes: "ABC Australia — Free TV OP-59 -24 LKFS; air-ready AS-11 (AU) or XDCAM HD422 50, 1080i/25 SDR. No ABC-specific public spec found — confirm. Starter spec (2026-06)." } },
];
export function recipientFromTemplate(t: DeliveryTemplate): Recipient {
  return { ...newRecipient(t.name), ...t.spec, name: t.name };
}

// ---- the plan ----
export interface Pass {
  kind: "hero" | "derive" | "regrade";
  label: string;
  note?: string;
  flag?: boolean;      // true = a fresh grade pass, not a clean transform
  covers: string[];    // recipient names this pass serves
}
export interface Conversion {
  kind: "standards" | "downscale" | "reframe";
  label: string;
  detail: string;
  covers: string[];
}
export interface Plan {
  passes: Pass[];
  gradeCount: number;
  deliverableCount: number;
  common: string[];          // variables identical across every recipient
  conversions: Conversion[]; // fps standards-conversions + resolution down-scales / reframes
  watchOuts: string[];       // remaining cross-recipient gotchas (loudness, true-peak)
}

// ---- bridge: recipients → the Mastering tab's custom config ----------------
// Deliverables is the requirements layer; the make-order is the Mastering
// engine's job. We translate the recipient list into a Custom mastering config
// (hero + deliverable families) and let buildCustomGraph / makeOrder decide the
// order. Doctrine: grade the highest dynamic range first and trim down.
const FAMILY_TIER: Record<MasterFamily, DRTier> = { "streaming-hdr": "hdr", theatrical: "theatrical", broadcast: "sdr" };
export const HERO_LABEL: Record<CustomHero, string> = { "streaming-hdr": "HDR PQ", theatrical: "DCI-P3 theatrical", broadcast: "SDR Rec.709" };

export function recipientsToMasteringConfig(recipients: Recipient[]): { config: CustomConfig; masterNits: MasterNits } {
  const tiers = new Set(recipients.map((r) => DR_TIER[r.dr]));
  const deliverables: CustomDeliverable[] = [];
  if (tiers.has("hdr")) deliverables.push("hdr");
  if (tiers.has("theatrical")) deliverables.push("theatrical");
  if (tiers.has("sdr")) deliverables.push("sdr");
  // House masters you always keep on a multi-deliverable show: the graded ACES
  // archive (what every up-volume / dedicated regrade derives from) + proxies.
  deliverables.push("archive", "proxies");
  const hero: CustomHero = tiers.has("hdr") ? "streaming-hdr" : tiers.has("theatrical") ? "theatrical" : "broadcast";
  // Master to the highest HDR peak any recipient asks for, snapped up to a
  // supported mastering-display tier (1000 / 2000 / 4000).
  const hdrPeaks = recipients.filter((r) => isHdr(r.dr)).map((r) => r.peakNits || 1000);
  const want = hdrPeaks.length ? Math.max(...hdrPeaks) : 1000;
  const masterNits = (MASTER_NITS.find((n) => n >= want) ?? MASTER_NITS[MASTER_NITS.length - 1]) as MasterNits;
  return { config: { hero, deliverables }, masterNits };
}

const FAMILY_FULL: Record<MasterFamily, string> = { "streaming-hdr": "HDR", theatrical: "Theatrical DCI-P3", broadcast: "SDR Rec.709" };

/** Human label + note for one make-order step. Same doctrine as the Mastering tab. */
function passText(step: MakeStep, masterNits: number): { label: string; note: string } {
  const { family, kind } = step;
  if (kind === "hero") {
    if (family === "streaming-hdr") return { label: `HDR hero grade @ ${masterNits} nit`, note: "Grade once at the highest dynamic range — every lower tier trims from here." };
    if (family === "theatrical") return { label: "Theatrical DCI-P3 grade", note: "Grade the hero in the cinema's dark-surround condition (48 nit, γ2.6)." };
    return { label: "SDR Rec.709 grade", note: "One SDR grade covers every recipient." };
  }
  if (kind === "derive") {
    if (family === "broadcast") return { label: "SDR Rec.709 trim", note: "Down-volume off the HDR hero — Dolby Vision TID1 map + manual per-shot trims. Budget a colourist QC pass." };
    return { label: `${FAMILY_FULL[family]} derive`, note: "Clean down-volume derive off the hero." };
  }
  // regrade — a fresh colourist pass, not a clean transform
  if (family === "theatrical") return { label: "Theatrical DCI-P3 pass", note: "Separate DI off the ACES archive — a 48-nit dark-surround grade, not a transform from the streaming hero." };
  if (family === "streaming-hdr") return { label: `HDR PQ pass @ ${masterNits} nit`, note: "Up-volume regrade off the archive — a fresh grade, not a clean transform from a lower-range hero." };
  return { label: "SDR Rec.709 pass", note: "Fresh dim-surround pass off the ACES archive — P3 theatrical doesn't trim cleanly to Rec.709 SDR." };
}

function parseRes(s: string): { w: number; h: number } {
  const m = s.match(/(\d{3,4})\s*[×x]\s*(\d{3,4})/);
  return m ? { w: parseInt(m[1], 10), h: parseInt(m[2], 10) } : { w: 1920, h: 1080 };
}
function fpsConversionDetail(from: number, to: number): string {
  const r = (x: number) => Math.round(x);
  if (new Set([r(from), r(to)]).size === 1) return "Frame-rate pull only (0.1%) — no motion change, just a re-stamp.";
  const fam = (x: number) => (r(x) === 25 || r(x) === 50 ? "PAL" : "NTSC/film");
  if (fam(from) !== fam(to)) return "Cross-standard (PAL ↔ NTSC) motion conversion — frame-rate convert (interpolate) or 4% speed change; pick per the brief.";
  return "Cadence conversion (e.g. 2:3 pulldown) — confirm the motion handling.";
}

export function buildPlan(recipients: Recipient[]): Plan {
  const namesOf = (t: DRTier) => recipients.filter((r) => DR_TIER[r.dr] === t).map((r) => r.name || "Untitled");

  // The make-order is computed by the Mastering engine, not by ad-hoc rules here,
  // so a theatrical→SDR or up-volume step is correctly flagged as a fresh pass.
  const { config, masterNits } = recipientsToMasteringConfig(recipients);
  const steps = recipients.length ? makeOrder(config, "2.0", masterNits) : [];
  const passes: Pass[] = [];
  for (const step of steps) {
    const covers = namesOf(FAMILY_TIER[step.family]);
    if (covers.length === 0) continue; // a family the engine added that no recipient actually needs
    const { label, note } = passText(step, masterNits);
    passes.push({ kind: step.kind, label, note, flag: step.flag || undefined, covers });
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

  // ---- conversions: fps standards-conversion + resolution down-scale / reframe ----
  const conversions: Conversion[] = [];
  if (recipients.length) {
    // Master cadence = the most common fps (the format you actually finish in).
    const byFps = new Map<number, Recipient[]>();
    recipients.forEach((r) => { (byFps.get(r.fps) ?? byFps.set(r.fps, []).get(r.fps)!).push(r); });
    const masterFps = [...byFps.entries()].sort((a, b) => b[1].length - a[1].length || b[0] - a[0])[0][0];
    [...byFps.entries()].forEach(([fps, rs]) => {
      if (fps === masterFps) return;
      conversions.push({ kind: "standards", label: `Standards conversion ${masterFps} → ${fps} fps`, detail: fpsConversionDetail(masterFps, fps), covers: rs.map((r) => r.name || "Untitled") });
    });
    // Finishing resolution = the largest pixel area; lower area → downscale, different aspect → reframe.
    const dims = recipients.map((r) => ({ r, ...parseRes(r.resolution) }));
    const finish = dims.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
    dims.forEach(({ r, w, h }) => {
      if (w === finish.w && h === finish.h) return;
      const name = r.name || "Untitled";
      if (Math.abs(w / h - finish.w / finish.h) < 0.02) {
        conversions.push({ kind: "downscale", label: `Down-scale → ${r.resolution}`, detail: `Clean down-scale from the ${finish.w}×${finish.h} finish.`, covers: [name] });
      } else {
        conversions.push({ kind: "reframe", label: `Reframe → ${r.resolution}`, detail: `Aspect differs from the ${finish.w}×${finish.h} finish (${(finish.w / finish.h).toFixed(2)}:1 → ${(w / h).toFixed(2)}:1) — pad or centre-crop; confirm framing.`, covers: [name] });
      }
    });
  }

  const watchOuts: string[] = [];
  const uniq = <T,>(arr: T[]) => [...new Set(arr)];
  const loud = uniq(recipients.map((r) => r.loudness).filter(Boolean));
  if (loud.length > 1) watchOuts.push("Loudness targets differ — a separate audio normalisation per target.");
  const tp = uniq(recipients.map((r) => r.truePeak).filter(Boolean));
  if (tp.length > 1) watchOuts.push(`True-peak ceilings differ (${tp.join(", ")}) — limit per target; the tightest wins if you cut one master for several.`);

  return { passes, gradeCount: passes.length, deliverableCount: recipients.length, common, conversions, watchOuts };
}

// ---- per-recipient variable checklist ----
export function recipientChecklist(r: Recipient): string[] {
  const dn = dialnormNote(r);
  return [
    `Resolution — ${r.resolution}`,
    `Container — ${r.container}`,
    `Frame rate — ${r.fps} fps`,
    `Colour — ${DR_LABEL[r.dr]}${DR_TIER[r.dr] === "hdr" ? ` @ ${r.peakNits} nit` : ""}`,
    `Audio — ${r.audio}`,
    `Loudness — ${r.loudness || "confirm"}`,
    `True-peak — ${r.truePeak || "confirm ceiling"}`,
    ...(dn ? [dn] : []),
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
    { id: uid(), name: "Paramount+ USA", region: "US", dr: "dolby-vision", peakNits: 1000, resolution: "UHD 3840×2160", fps: 23.976, container: "IMF App 2E", audio: "5.1.4 Atmos", loudness: "-24 LKFS (ATSC A/85)", truePeak: "-2 dBTP", subtitles: "Sidecar (IMSC/TTML)", textless: true, naming: "", qc: "Photon + platform", notes: "Example — confirm against the real Paramount+ delivery spec." },
    { id: uid(), name: "TVNZ", region: "NZ", dr: "sdr", peakNits: 1000, resolution: "1080p 1920×1080", fps: 25, container: "ProRes 422 HQ", audio: "5.1", loudness: "-24 LKFS", truePeak: "-2 dBTP", subtitles: "Closed captions (CEA-608/708)", textless: true, naming: "", qc: "", notes: "Example — confirm against the real TVNZ delivery spec." },
    { id: uid(), name: "ABC Sydney", region: "AU", dr: "sdr", peakNits: 1000, resolution: "1080p 1920×1080", fps: 25, container: "AS-11 DPP", audio: "5.1", loudness: "-24 LKFS (Free TV OP-59)", truePeak: "-2 dBTP", subtitles: "Closed captions (CEA-608/708)", textless: true, naming: "", qc: "", notes: "Example — confirm against the real ABC delivery spec." },
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

// ---- Commit → workflow graph (feeds the Custom Workflow builder) ----
// Fans the make-plan out into a node-graph the existing WorkflowBuilder loads:
// Conform → grade passes → per-recipient Package → QC → Deliver.
type WFNode = { id: string; type: "step"; position: { x: number; y: number }; data: { label: string; owner?: string; detail?: string; color: string } };
type WFEdge = { id: string; source: string; target: string; data?: { label?: string } };

export function buildWorkflowGraph(recipients: Recipient[], plan: Plan): { nodes: WFNode[]; edges: WFEdge[] } {
  // Laid out TOP-DOWN (Conform → grades → per-recipient Package → QC → Deliver),
  // so it fills the tall side-pane rather than stretching wide.
  const nodes: WFNode[] = [];
  const edges: WFEdge[] = [];
  const COLW = 200, ROWH = 150, GW = 210;
  const link = (s: string, t: string, label?: string) => edges.push({ id: `e-${s}-${t}`, source: s, target: t, data: label ? { label } : undefined });

  const n = Math.max(recipients.length, 1);
  const totalW = (n - 1) * COLW;
  const cx = totalW / 2;
  const yConform = 0, yGrade = ROWH, yPkg = ROWH * 2, yQc = ROWH * 3, yDel = ROWH * 4;

  const srcId = "dlv-src";
  nodes.push({ id: srcId, type: "step", position: { x: cx, y: yConform }, data: { label: "Conformed master", owner: "Online / Conform", detail: "Graded-ready timeline → the grade", color: "#94a3b8" } });

  const gradeForName: Record<string, string> = {};
  let heroId: string | null = null;
  const ng = Math.max(plan.passes.length, 1);
  plan.passes.forEach((p, i) => {
    const gid = `dlv-grade-${i}`;
    const color = p.flag ? "#f87171" : p.kind === "hero" ? "#f59e0b" : "#34d399";
    const gx = cx + (i - (ng - 1) / 2) * GW;
    nodes.push({ id: gid, type: "step", position: { x: gx, y: yGrade }, data: { label: p.label, owner: "Colourist", detail: p.note || "", color } });
    if (p.kind === "derive") link(heroId ?? srcId, gid, "trim");
    else link(srcId, gid, p.flag ? "fresh re-grade" : undefined);
    if (p.kind === "hero") heroId = gid;
    p.covers.forEach((name) => { gradeForName[name] = gid; });
  });

  recipients.forEach((r, i) => {
    const x = i * COLW;
    const name = r.name || "Untitled";
    const master = gradeForName[name] ?? heroId ?? srcId;
    const rid = r.id || `i${i}`;
    const pkg = `dlv-pkg-${rid}`, qc = `dlv-qc-${rid}`, del = `dlv-del-${rid}`;
    nodes.push({ id: pkg, type: "step", position: { x, y: yPkg }, data: { label: `Package: ${name}`, owner: "Online / Mastering", detail: `${r.container} · ${r.resolution} · ${r.fps} fps · ${r.audio} · ${r.loudness}`, color: "#38bdf8" } });
    nodes.push({ id: qc, type: "step", position: { x, y: yQc }, data: { label: `QC: ${name}`, owner: "QC", detail: r.qc || "Platform QC pass", color: "#a78bfa" } });
    nodes.push({ id: del, type: "step", position: { x, y: yDel }, data: { label: `Deliver: ${name}`, owner: "Post Producer", detail: [r.subtitles, r.textless ? "textless" : "", r.naming].filter(Boolean).join(" · "), color: "#2dd4bf" } });
    link(master, pkg, "master");
    link(pkg, qc);
    link(qc, del);
  });

  return { nodes, edges };
}

const BUILDER_KEY = (projectId?: string) => `postsup-builder-${projectId ?? "default"}`;

export function hasCustomWorkflow(projectId?: string): boolean {
  try {
    const raw = localStorage.getItem(BUILDER_KEY(projectId));
    if (!raw) return false;
    const g = JSON.parse(raw);
    return Array.isArray(g.nodes) && g.nodes.length > 1;
  } catch { return false; }
}

export function commitToWorkflow(projectId: string | undefined, recipients: Recipient[], plan: Plan): { nodes: WFNode[]; edges: WFEdge[] } {
  const graph = buildWorkflowGraph(recipients, plan);
  try { localStorage.setItem(BUILDER_KEY(projectId), JSON.stringify(graph)); } catch { /* ignore */ }
  return graph;
}
