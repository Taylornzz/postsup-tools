import { jsPDF } from "jspdf";
import { loadRecipients, type Recipient } from "./deliverables";
import { rollupDeliverables } from "./deliverablesRollup";
import { CATEGORIES, STATUSES } from "./deliverablesList";

/** Whole-project export — a designed PDF dossier (deliverables, production list,
 *  schedule, task board) or a JSON backup of every piece of project data.
 *
 *  PDF gotchas handled here: jsPDF's built-in fonts are WinAnsi-only, so NO
 *  unicode glyphs beyond latin-1 (★ → drawn star, → → "for:", etc.); schedule
 *  bars store fractional week offsets, so they're converted to real dates. */

const slug = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label || id;
const statusLabel = (id?: string) => STATUSES.find((s) => s.id === id)?.label || "To do";

function readJSON<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

type BoardCol = { name: string; cards: { title: string; notes: string; color?: string; due?: string; checks: { text: string; done: boolean }[] }[] };
type ScheduleBar = { name: string; color?: string; start: number; dur: number };

function downloadText(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** JSON backup: every localStorage key that belongs to this project (suffix -{id}),
 *  plus the project-agnostic keys the app uses. */
export function exportProjectJSON(projectId: string | undefined, projectName: string) {
  const data: Record<string, unknown> = {};
  const suffix = projectId ? `-${projectId}` : "";
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const isAppKey = key.startsWith("kaos.") || key.startsWith("postsup-");
    if (!isAppKey) continue;
    if (suffix ? key.endsWith(suffix) : true) {
      try { data[key] = JSON.parse(localStorage.getItem(key) || "null"); }
      catch { data[key] = localStorage.getItem(key); }
    }
  }
  downloadText(`${slug(projectName) || "project"}-backup.json`, "application/json", JSON.stringify({
    product: "Kaos Theory — project backup",
    project: projectName, projectId, exportedAt: new Date().toISOString(),
    data,
  }, null, 2));
}

// ---- palette (print-friendly) ----
const INK = 28;            // near-black body
const MUTED = 110;         // grey meta
const FAINT = 160;         // light grey
const AMBER: [number, number, number] = [217, 119, 6];
const GREEN: [number, number, number] = [5, 150, 105];
const RED: [number, number, number] = [220, 38, 38];
const RULE = 215;

const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
const fmtDateY = (d: Date) => d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
const addDays = (iso: string, days: number) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + Math.round(days)); return d; };
const fmtWeeks = (w: number) => {
  const r = Math.round(w * 10) / 10;
  if (r <= 0) return "<1 wk";
  return `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)} wk${r === 1 ? "" : "s"}`;
};
const hexToRgb = (hex?: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [100, 116, 139];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export function exportProjectPDF(projectId: string | undefined, projectName: string) {
  const recipients: Recipient[] = loadRecipients(projectId);
  const rollup = rollupDeliverables(recipients);
  const board = readJSON<BoardCol[]>(`kaos.board.v1${projectId ? `-${projectId}` : ""}`) || [];
  const bars = readJSON<ScheduleBar[]>(`postsup-gantt-v1${projectId ? `-${projectId}` : ""}`) || [];
  const startDate = (() => { try { return localStorage.getItem(`postsup-gantt-start${projectId ? `-${projectId}` : ""}`) || ""; } catch { return ""; } })();

  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 46, CW = PW - M * 2;
  let y = M;
  const ensure = (h: number) => { if (y + h > PH - M - 16) { pdf.addPage(); y = M; } };

  const drawStar = (cx: number, cy: number, r: number, rgb: [number, number, number]) => {
    // five-point star path (WinAnsi-safe replacement for "★")
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    pdf.setFillColor(...rgb);
    // jsPDF lines() uses relative segments from the start point
    const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]) as [number, number][];
    pdf.lines(segs, pts[0][0], pts[0][1], [1, 1], "F", true);
  };

  const sectionHeader = (title: string, sub?: string) => {
    ensure(44);
    y += 6;
    pdf.setFillColor(...AMBER);
    pdf.rect(M, y - 9, 3.5, 12, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12.5); pdf.setTextColor(INK);
    pdf.text(title.toUpperCase(), M + 10, y, { charSpace: 0.8 });
    if (sub) {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(MUTED);
      pdf.text(sub, PW - M, y, { align: "right" });
    }
    y += 7;
    pdf.setDrawColor(RULE); pdf.setLineWidth(0.7); pdf.line(M, y, PW - M, y);
    y += 14;
  };

  // ================= Cover block =================
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(24); pdf.setTextColor(15);
  const titleLines = pdf.splitTextToSize(projectName || "Untitled project", CW) as string[];
  pdf.text(titleLines, M, y + 6); y += titleLines.length * 26;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(MUTED);
  pdf.text(`Project dossier  ·  exported ${fmtDateY(new Date())}  ·  Kaos Theory`, M, y); y += 18;

  // summary strip
  const itemCount = recipients.reduce((n, r) => n + (r.deliverables?.length || 0), 0);
  const cardCount = board.reduce((n, c) => n + c.cards.length, 0);
  const doneCount = board.filter((c) => /done|complete/i.test(c.name)).reduce((n, c) => n + c.cards.length, 0);
  const schedEnd = bars.length ? Math.max(...bars.map((b) => b.start + b.dur)) : 0;
  const stats: [string, string][] = [
    ["Recipients", String(recipients.length)],
    ["Deliverables", String(itemCount)],
    ["To make (unique)", String(rollup.filter((g) => g.inScope).length)],
    ["Schedule", bars.length && startDate ? `${fmtWeeks(schedEnd)} from ${fmtDate(new Date(startDate + "T00:00:00"))}` : bars.length ? fmtWeeks(schedEnd) : "—"],
    ["Board", cardCount ? `${doneCount}/${cardCount} done` : "—"],
  ];
  const cellW = CW / stats.length;
  pdf.setDrawColor(RULE); pdf.setLineWidth(0.7);
  pdf.line(M, y, PW - M, y);
  y += 13;
  stats.forEach(([k, v], i) => {
    const x = M + i * cellW;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.8); pdf.setTextColor(FAINT);
    pdf.text(k.toUpperCase(), x, y, { charSpace: 0.5 });
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(INK);
    pdf.text(v, x, y + 13);
  });
  y += 22;
  pdf.line(M, y, PW - M, y);
  y += 8;
  pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(FAINT);
  pdf.text("Plans, not gospel — confirm every spec against the recipient's own delivery document.", M, y);
  y += 18;

  // ================= Deliverables =================
  sectionHeader("Deliverables", `${recipients.length} recipient${recipients.length === 1 ? "" : "s"} · ${itemCount} items`);
  if (!recipients.length) {
    pdf.setFont("helvetica", "italic"); pdf.setFontSize(8.5); pdf.setTextColor(FAINT);
    pdf.text("No recipients yet.", M, y); y += 14;
  }
  for (const r of recipients) {
    ensure(40);
    // recipient header row
    let x = M;
    if (r.isMain) { drawStar(M + 4, y - 3.5, 4.5, AMBER); x = M + 12; }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.setTextColor(INK);
    pdf.text(r.name || "Recipient", x, y);
    const nameW = pdf.getTextWidth(r.name || "Recipient");
    if (r.region) {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(FAINT);
      pdf.text(r.region, x + nameW + 6, y);
    }
    if (r.due) {
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(...AMBER);
      pdf.text(`due ${fmtDate(new Date(r.due + "T00:00:00"))}`, PW - M, y, { align: "right" });
    }
    y += 11;
    const spec = [r.dr, r.resolution, r.fps ? `${r.fps} fps` : "", r.container, r.audio, r.loudness, r.truePeak, r.subtitles].filter(Boolean).join("  ·  ");
    if (spec) {
      const sl = pdf.splitTextToSize(spec, CW - (r.isMain ? 12 : 0)) as string[];
      ensure(sl.length * 9 + 2);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(MUTED);
      pdf.text(sl, x, y); y += sl.length * 9 + 5;
    }

    const items = r.deliverables || [];
    const byCat = CATEGORIES.map((c) => ({ cat: c, items: items.filter((i) => i.category === c.id) })).filter((g) => g.items.length);
    for (const g of byCat) {
      ensure(13);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(FAINT);
      pdf.text(g.cat.label.toUpperCase(), x + 2, y, { charSpace: 0.5 }); y += 10;
      for (const it of g.items) {
        const st = statusLabel(it.status);
        const stDone = it.status === "accepted" || it.status === "delivered";
        const stBad = it.status === "qc-fail" || it.status === "redeliver";
        const label = `${it.label}${(it.version || 1) > 1 ? `  (v${it.version})` : ""}`;
        const ll = pdf.splitTextToSize(label, CW - 96) as string[];
        ensure(ll.length * 10 + 1);
        // checkbox
        pdf.setDrawColor(it.inScope ? 120 : 200); pdf.setLineWidth(0.7);
        pdf.rect(x + 4, y - 6.5, 6, 6, "S");
        if (stDone) {
          pdf.setDrawColor(...GREEN); pdf.setLineWidth(1);
          pdf.line(x + 5.2, y - 3.6, x + 6.8, y - 1.8); pdf.line(x + 6.8, y - 1.8, x + 9.4, y - 5.8);
        }
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
        pdf.setTextColor(it.inScope ? INK : FAINT);
        pdf.text(ll, x + 15, y);
        // status, right-aligned
        pdf.setFontSize(7);
        if (stBad) pdf.setTextColor(...RED); else if (stDone) pdf.setTextColor(...GREEN); else pdf.setTextColor(FAINT);
        pdf.text(it.inScope ? st : "not ours", PW - M, y, { align: "right" });
        y += ll.length * 10;
        const meta = [it.owner, it.notes].filter(Boolean).join("  ·  ");
        if (meta) {
          const ml = pdf.splitTextToSize(meta, CW - 110) as string[];
          ensure(ml.length * 8);
          pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.8); pdf.setTextColor(FAINT);
          pdf.text(ml, x + 15, y); y += ml.length * 8;
        }
        y += 1.5;
      }
      y += 3;
    }
    if (!items.length) {
      ensure(12);
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(8); pdf.setTextColor(FAINT);
      pdf.text("No deliverables itemised yet.", x + 2, y); y += 12;
    }
    y += 6;
    ensure(8);
    pdf.setDrawColor(235); pdf.setLineWidth(0.5); pdf.line(M, y, PW - M, y);
    y += 14;
  }

  // ================= Production list =================
  const inScope = rollup.filter((g) => g.inScope);
  if (inScope.length) {
    sectionHeader("Production list — make once", `${inScope.length} unique artifacts`);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(FAINT);
    pdf.text("Identical artifacts collapsed (same content + spec). Naming and timing stay per-recipient.", M, y); y += 13;
    let lastCat = "";
    for (const g of inScope) {
      if (g.category !== lastCat) {
        lastCat = g.category;
        ensure(14);
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(FAINT);
        pdf.text(catLabel(g.category).toUpperCase(), M + 2, y, { charSpace: 0.5 }); y += 10;
      }
      const head = g.label + (g.spec ? `   —  ${g.spec}` : "");
      const hl = pdf.splitTextToSize(head, CW - 70) as string[];
      ensure(hl.length * 10 + 9);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.setTextColor(INK);
      pdf.text(hl, M + 14, y);
      if (g.consumers.length > 1) {
        pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.setTextColor(...AMBER);
        pdf.text(`shared x${g.consumers.length}`, PW - M, y, { align: "right" });
      }
      y += hl.length * 10;
      const cl = pdf.splitTextToSize(`for:  ${g.consumers.map((c) => c.recipientName).join("  ·  ")}`, CW - 80) as string[];
      ensure(cl.length * 8 + 2);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(6.8); pdf.setTextColor(MUTED);
      pdf.text(cl, M + 14, y); y += cl.length * 8 + 4;
    }
    y += 4;
  }

  // ================= Schedule =================
  if (bars.length && startDate) {
    const sorted = [...bars].sort((a, b) => a.start - b.start || a.dur - b.dur);
    const endDate = addDays(startDate, schedEnd * 7);
    sectionHeader("Post schedule", `${fmtDate(new Date(startDate + "T00:00:00"))} – ${fmtDateY(endDate)} · ${fmtWeeks(schedEnd)}`);
    const colDate = M + CW * 0.42;
    const colDur = PW - M;
    for (const b of sorted) {
      const from = addDays(startDate, b.start * 7);
      const to = addDays(startDate, (b.start + Math.max(b.dur, 0.15)) * 7);
      ensure(13);
      const [cr, cg, cb] = hexToRgb(b.color);
      pdf.setFillColor(cr, cg, cb);
      pdf.rect(M + 2, y - 6, 5, 5, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.setTextColor(INK);
      pdf.text(pdf.splitTextToSize(b.name, CW * 0.38)[0] as string, M + 13, y);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(MUTED);
      pdf.text(`${fmtDate(from)}  –  ${fmtDate(to)}`, colDate, y);
      pdf.setTextColor(FAINT);
      pdf.text(fmtWeeks(b.dur), colDur, y, { align: "right" });
      y += 13;
    }
    y += 8;
  }

  // ================= Task board =================
  if (board.length) {
    sectionHeader("Task board", `${doneCount}/${cardCount} done`);
    for (const col of board) {
      if (!col.cards.length) continue;
      ensure(15);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.setTextColor(MUTED);
      pdf.text(`${col.name.toUpperCase()}  (${col.cards.length})`, M + 2, y, { charSpace: 0.5 }); y += 11;
      for (const k of col.cards) {
        const done = k.checks.filter((c) => c.done).length;
        const meta = [k.due ? `due ${fmtDate(new Date(k.due + "T00:00:00"))}` : "", k.checks.length ? `${done}/${k.checks.length}` : ""].filter(Boolean).join("  ·  ");
        const tl = pdf.splitTextToSize(k.title, CW - 100) as string[];
        ensure(tl.length * 10 + 1);
        const [cr, cg, cb] = hexToRgb(k.color);
        pdf.setFillColor(cr, cg, cb);
        pdf.rect(M + 6, y - 5.5, 4.5, 4.5, "F");
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(INK);
        pdf.text(tl, M + 16, y);
        if (meta) {
          pdf.setFontSize(7); pdf.setTextColor(FAINT);
          pdf.text(meta, PW - M, y, { align: "right" });
        }
        y += tl.length * 10 + 1.5;
      }
      y += 5;
    }
  }

  // ================= footer on every page =================
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(230); pdf.setLineWidth(0.5);
    pdf.line(M, PH - 30, PW - M, PH - 30);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.setTextColor(FAINT);
    pdf.text(`${projectName || "Untitled project"}  ·  Kaos Theory dossier`, M, PH - 19);
    pdf.text(`${i} / ${pages}`, PW - M, PH - 19, { align: "right" });
  }

  pdf.save(`${slug(projectName) || "project"}-dossier.pdf`);
}
