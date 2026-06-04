import { jsPDF } from "jspdf";
import { parseEDL, edlToCSV, type EdlEvent } from "./edl";
import { framesToTC } from "./postcalc";

/** Multi-format sequence converter. Reads CMX3600 EDL, FCP7/Premiere/Resolve XML (xmeml),
 *  FCPXML (best-effort) and CSV into a common event model, and writes EDL/CSV/PDF/XLSX/JSON.
 *  Like editingtools.io's converter: this targets cut lists, not full round-trip editing —
 *  transitions become cuts and audio-only tracks are skipped. */

export type SeqFormat = "edl" | "fcp7xml" | "fcpxml" | "csv";
export type OutFormat = "edl" | "csv" | "pdf" | "xlsx" | "json";
export type ParseResult = { title?: string; events: EdlEvent[]; fps?: number; df?: boolean; format: SeqFormat };

export const FORMAT_LABEL: Record<SeqFormat, string> = {
  edl: "CMX3600 EDL", fcp7xml: "FCP7 / Premiere / Resolve XML", fcpxml: "FCPXML (experimental)", csv: "CSV",
};

const slug = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "sequence";
function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
const reelTag = (s: string) => (s || "AX").replace(/\.[^.]+$/, "").toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 8) || "AX";

// ---------- detection ----------
export function detectFormat(text: string, filename = ""): SeqFormat {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const t = text.slice(0, 4000);
  if (ext === "fcpxml" || /<fcpxml/i.test(t)) return "fcpxml";
  if (ext === "xml" || /<xmeml/i.test(t)) return /<fcpxml/i.test(t) ? "fcpxml" : "fcp7xml";
  if (ext === "csv") return "csv";
  if (/<\?xml/i.test(t)) return "fcp7xml";
  if (ext === "edl" || /^TITLE:/im.test(t) || /^\s*\d{1,6}\s+\S+\s+\S+\s+\S+\s+\d{2}:\d{2}:\d{2}/m.test(t)) return "edl";
  // CSV: a header keyword, OR a consistent multi-column comma structure (so differently-
  // named cut-list headers aren't silently misread as EDL → "0 events").
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  const head = lines[0] || "";
  if (head.includes(",")) {
    if (/reel|clip|src|rec|track|event|name/i.test(head)) return "csv";
    const cols = head.split(",").length;
    if (cols >= 3 && lines.slice(1, 5).some((l) => l.split(",").length === cols)) return "csv";
  }
  return "edl";
}

// ---------- XML helpers ----------
const txt = (el: Element | null, sel: string) => el?.querySelector(sel)?.textContent?.trim() ?? "";
const num = (el: Element | null, sel: string, d = 0) => { const v = parseFloat(txt(el, sel)); return Number.isFinite(v) ? v : d; };
/** "1/25s", "100/25s", "3600s", "3600/1s" → seconds. */
function rationalSec(s: string | null): number {
  if (!s) return 0;
  const m = s.match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+))?s?$/);
  if (!m) return 0;
  return m[2] ? +m[1] / +m[2] : +m[1];
}

// ---------- FCP7 / Premiere / Resolve XML (xmeml) ----------
function parseFCP7XML(text: string): ParseResult {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not parse XML.");
  const seq = doc.querySelector("sequence");
  const title = txt(seq, ":scope > name") || undefined;
  const nominal = num(seq, ":scope > rate > timebase", 25) || 25;
  const df = (txt(seq, ":scope > timecode > displayformat") || "NDF").toUpperCase() === "DF";
  const seqTc = num(seq, ":scope > timecode > frame", 0);

  const events: EdlEvent[] = [];
  let n = 1;
  const clips = Array.from(doc.querySelectorAll("media > video clipitem, video > track > clipitem"));
  const seen = new Set<Element>();
  for (const ci of clips) {
    if (seen.has(ci)) continue; seen.add(ci);
    const startF = num(ci, ":scope > start", -1);
    const endF = num(ci, ":scope > end", -1);
    if (startF < 0 || endF < 0) continue; // -1 marks a transition placeholder
    const inF = num(ci, ":scope > in", 0);
    const outF = num(ci, ":scope > out", 0);
    const fileTc = num(ci, ":scope > file > timecode > frame", 0);
    const fileName = txt(ci, ":scope > file > name") || txt(ci, ":scope > name") || "clip";
    events.push({
      num: String(n++).padStart(3, "0"),
      reel: reelTag(fileName),
      track: "V",
      transition: "C",
      srcIn: framesToTC(fileTc + inF, nominal, df),
      srcOut: framesToTC(fileTc + outF, nominal, df),
      recIn: framesToTC(seqTc + startF, nominal, df),
      recOut: framesToTC(seqTc + endF, nominal, df),
      clip: fileName,
      comments: [],
    });
  }
  return { title, events, fps: nominal, df, format: "fcp7xml" };
}

// ---------- FCPXML (best-effort) ----------
function parseFCPXML(text: string): ParseResult {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Could not parse FCPXML.");
  const formats: Record<string, number> = {};
  doc.querySelectorAll("resources > format").forEach((f) => {
    formats[f.getAttribute("id") || ""] = rationalSec(f.getAttribute("frameDuration")) || 1 / 25;
  });
  const assets: Record<string, { name: string; start: number }> = {};
  doc.querySelectorAll("resources > asset, resources > media").forEach((a) => {
    assets[a.getAttribute("id") || ""] = { name: a.getAttribute("name") || "clip", start: rationalSec(a.getAttribute("start")) };
  });
  const seq = doc.querySelector("sequence");
  const df = (seq?.getAttribute("tcFormat") || "NDF").toUpperCase() === "DF";
  const frameDur = formats[seq?.getAttribute("format") || ""] || 1 / 25;
  const nominal = Math.round(1 / frameDur);
  const tcStart = rationalSec(seq?.getAttribute("tcStart") || "0s");
  const title = doc.querySelector("project")?.getAttribute("name") || doc.querySelector("event")?.getAttribute("name") || undefined;
  const toF = (s: number) => Math.round(s / frameDur);

  const events: EdlEvent[] = [];
  let n = 1;
  const spine = seq?.querySelector("spine");
  const items = Array.from(spine?.children || []);
  for (const el of items) {
    const tag = el.tagName.toLowerCase();
    if (!/^(asset-clip|clip|ref-clip|sync-clip|video|title)$/.test(tag)) continue;
    const offset = rationalSec(el.getAttribute("offset"));
    const duration = rationalSec(el.getAttribute("duration"));
    const start = rationalSec(el.getAttribute("start"));
    if (duration <= 0) continue;
    const ref = el.getAttribute("ref") || "";
    const asset = assets[ref];
    const name = el.getAttribute("name") || asset?.name || "clip";
    // FCPXML asset-clip `start` is already in the asset's own timeline (its origin is the
    // asset's start), so it IS the source in-point. Only fall back to asset.start when the
    // clip has no start attribute. (Adding both double-counts the source TC — often ~1h.)
    const srcBase = el.getAttribute("start") != null ? start : (asset?.start || 0);
    events.push({
      num: String(n++).padStart(3, "0"),
      reel: reelTag(name),
      track: "V",
      transition: "C",
      srcIn: framesToTC(toF(srcBase), nominal, df),
      srcOut: framesToTC(toF(srcBase + duration), nominal, df),
      recIn: framesToTC(toF(tcStart + offset), nominal, df),
      recOut: framesToTC(toF(tcStart + offset + duration), nominal, df),
      clip: name,
      comments: [],
    });
  }
  return { title, events, fps: nominal, df, format: "fcpxml" };
}

// ---------- CSV ----------
function parseCSVRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (ch !== "\r") cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
function parseCSVtoEvents(text: string): ParseResult {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return { events: [], format: "csv" };
  const head = rows[0].map((h) => h.toLowerCase().trim());
  const find = (...keys: string[]) => head.findIndex((h) => keys.some((k) => h.includes(k)));
  const ci = { num: find("event", "#", "no"), reel: find("reel", "tape"), clip: find("clip", "name"), track: find("track", "trk"), trans: find("trans"), si: find("src in", "source in", "srcin"), so: find("src out", "source out", "srcout"), ri: find("rec in", "record in", "recin"), ro: find("rec out", "record out", "recout") };
  const events: EdlEvent[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const g = (idx: number) => (idx >= 0 ? (r[idx] || "").trim() : "");
    events.push({
      num: g(ci.num) || String(i).padStart(3, "0"),
      reel: g(ci.reel) || "AX",
      track: g(ci.track) || "V",
      transition: (g(ci.trans) || "C").split(" ")[0] || "C",
      clip: g(ci.clip),
      srcIn: g(ci.si), srcOut: g(ci.so), recIn: g(ci.ri), recOut: g(ci.ro),
      comments: [],
    });
  }
  return { events, format: "csv" };
}

// ---------- dispatch ----------
export function parseSequence(text: string, filename = ""): ParseResult {
  const fmt = detectFormat(text, filename);
  if (fmt === "fcpxml") return parseFCPXML(text);
  if (fmt === "fcp7xml") return parseFCP7XML(text);
  if (fmt === "csv") return parseCSVtoEvents(text);
  const p = parseEDL(text);
  return { title: p.title, events: p.events, df: /DROP/i.test(p.fcm || "") && !/NON/i.test(p.fcm || ""), format: "edl" };
}

// ---------- generators ----------
function toEDL(events: EdlEvent[], opts: { title?: string; df?: boolean; reelLong?: boolean }): string {
  const L = [`TITLE: ${(opts.title || "SEQUENCE").toUpperCase()}`, `FCM: ${opts.df ? "DROP FRAME" : "NON-DROP FRAME"}`];
  events.forEach((e, i) => {
    let reel = (e.reel || "AX").toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!opts.reelLong) reel = reel.slice(0, 8) || "AX";
    // Cut-list contract: every event is a clean cut. We don't emit two-line CMX3600
    // dissolves, so collapse any transition to "C" rather than write a lone (invalid) "D nnn".
    L.push(`${String(i + 1).padStart(3, "0")}  ${reel.padEnd(8)} ${(e.track || "V").padEnd(4)} C        ${e.srcIn} ${e.srcOut} ${e.recIn} ${e.recOut}`);
    if (e.clip) L.push(`* FROM CLIP NAME: ${e.clip}`);
  });
  return L.join("\r\n");
}

function eventsToCSV(events: EdlEvent[]): string {
  return edlToCSV({ events });
}

function toPDF(events: EdlEvent[], title: string, base: string) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 26;
  const ph = pdf.internal.pageSize.getHeight();
  const cols = [
    { h: "#", w: 26 }, { h: "Reel", w: 64 }, { h: "Trk", w: 26 }, { h: "Trans", w: 36 },
    { h: "Clip", w: 210 }, { h: "Src In", w: 78 }, { h: "Src Out", w: 78 }, { h: "Rec In", w: 78 }, { h: "Rec Out", w: 78 },
  ];
  const totalW = cols.reduce((a, c) => a + c.w, 0);
  let y = margin;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(12);
  pdf.text(`${title || "Sequence"} — Cut List (${events.length} events)`, margin, y); y += 16;
  const writeRow = (vals: string[], bold: boolean) => {
    pdf.setFont("courier", bold ? "bold" : "normal"); pdf.setFontSize(8);
    let x = margin;
    cols.forEach((c, i) => {
      const max = Math.floor(c.w / 4.8); // Courier 8pt advance = 0.6em = 4.8pt/char
      let t = String(vals[i] ?? "");
      if (t.length > max) t = t.slice(0, max - 1) + "…";
      pdf.text(t, x, y); x += c.w;
    });
  };
  writeRow(cols.map((c) => c.h), true); y += 3;
  pdf.setDrawColor(180); pdf.line(margin, y, margin + totalW, y); y += 11;
  for (const e of events) {
    if (y > ph - margin) { pdf.addPage(); y = margin; writeRow(cols.map((c) => c.h), true); y += 14; }
    writeRow([e.num, e.reel, e.track, (e.transition || "C") + (e.transDur ? ` ${e.transDur}` : ""), e.clip || "", e.srcIn, e.srcOut, e.recIn, e.recOut], false);
    y += 11;
  }
  pdf.save(`${base}.pdf`);
}

async function toXLSX(events: EdlEvent[], base: string) {
  const XLSX = await import("xlsx");
  const data = events.map((e) => ({
    Event: e.num, Reel: e.reel, Track: e.track, Transition: (e.transition || "C") + (e.transDur ? ` ${e.transDur}` : ""),
    Clip: e.clip || "", "Src In": e.srcIn, "Src Out": e.srcOut, "Rec In": e.recIn, "Rec Out": e.recOut,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 5 }, { wch: 9 }, { wch: 30 }, { wch: 13 }, { wch: 13 }, { wch: 13 }, { wch: 13 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sequence");
  XLSX.writeFile(wb, `${base}.xlsx`);
}

export async function exportConverted(format: OutFormat, events: EdlEvent[], opts: { title?: string; df?: boolean; reelLong?: boolean }) {
  const base = slug(opts.title || "");
  switch (format) {
    case "edl": download(`${base}.edl`, "text/plain", toEDL(events, opts)); break;
    case "csv": download(`${base}.csv`, "text/csv", eventsToCSV(events)); break;
    case "json": download(`${base}.json`, "application/json", JSON.stringify({ title: opts.title, events }, null, 2)); break;
    case "pdf": toPDF(events, opts.title || "", base); break;
    case "xlsx": await toXLSX(events, base); break;
  }
}

export { toEDL, eventsToCSV };
