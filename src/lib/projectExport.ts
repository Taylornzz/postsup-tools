import { jsPDF } from "jspdf";
import { loadRecipients, type Recipient } from "./deliverables";
import { rollupDeliverables } from "./deliverablesRollup";
import { CATEGORIES, STATUSES } from "./deliverablesList";

/** Whole-project export — one PDF dossier (deliverables, production list, schedule,
 *  task board) or a JSON backup of every piece of project data in this browser. */

const slug = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label || id;
const statusLabel = (id?: string) => STATUSES.find((s) => s.id === id)?.label || "To do";

function readJSON<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}

type BoardCol = { name: string; cards: { title: string; notes: string; due?: string; checks: { text: string; done: boolean }[] }[] };
type ScheduleBar = { name: string; start: number; dur: number };

function downloadText(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** JSON backup: every localStorage key that belongs to this project (suffix -{id}),
 *  plus the project-agnostic keys the app uses. Re-importable by hand if ever needed. */
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

export function exportProjectPDF(projectId: string | undefined, projectName: string) {
  const recipients: Recipient[] = loadRecipients(projectId);
  const rollup = rollupDeliverables(recipients);
  const board = readJSON<BoardCol[]>(`kaos.board.v1${projectId ? `-${projectId}` : ""}`) || [];
  const bars = readJSON<ScheduleBar[]>(`postsup-gantt-v1${projectId ? `-${projectId}` : ""}`) || [];
  const startDate = (() => { try { return localStorage.getItem(`postsup-gantt-start${projectId ? `-${projectId}` : ""}`) || ""; } catch { return ""; } })();

  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 42, CW = PW - M * 2;
  let y = M;
  const ensure = (h: number) => { if (y + h > PH - M) { pdf.addPage(); y = M; } };
  const h1 = (t: string) => {
    ensure(34);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(25);
    pdf.text(t, M, y); y += 6;
    pdf.setDrawColor(190); pdf.setLineWidth(0.7); pdf.line(M, y, PW - M, y); y += 14;
  };
  const small = (t: string, color = 120) => {
    const lines = pdf.splitTextToSize(t, CW) as string[];
    ensure(lines.length * 9 + 2);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(color);
    pdf.text(lines, M, y); y += lines.length * 9 + 2;
  };

  // Cover
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(20); pdf.setTextColor(15);
  pdf.text(projectName || "Untitled project", M, y); y += 20;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(110);
  pdf.text(`Kaos Theory project dossier · exported ${new Date().toLocaleString()}`, M, y); y += 12;
  pdf.text("Plans, not gospel — confirm specs against each recipient's own delivery document.", M, y); y += 24;

  // ---- Deliverables ----
  h1(`Deliverables — ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`);
  if (!recipients.length) small("(none yet)");
  for (const r of recipients) {
    ensure(26);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.setTextColor(30);
    pdf.text(`${r.isMain ? "★ " : ""}${r.name || "Recipient"}${r.due ? `   ·   due ${r.due}` : ""}`, M, y); y += 12;
    const spec = [r.dr, r.resolution, r.fps ? `${r.fps} fps` : "", r.container, r.audio, r.loudness, r.truePeak, r.subtitles].filter(Boolean).join(" · ");
    if (spec) small(spec, 80);
    const items = r.deliverables || [];
    for (const it of items) {
      const line = `${it.inScope ? "[ ]" : "[–]"} ${it.label}   (${catLabel(it.category)}${it.owner ? ` · ${it.owner}` : ""} · ${statusLabel(it.status)}${(it.version || 1) > 1 ? ` · v${it.version}` : ""})`;
      const ll = pdf.splitTextToSize(line, CW - 14) as string[];
      ensure(ll.length * 9.5);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(it.inScope ? 50 : 150);
      pdf.text(ll, M + 10, y); y += ll.length * 9.5;
    }
    y += 8;
  }

  // ---- Production list ----
  const inScope = rollup.filter((g) => g.inScope);
  if (inScope.length) {
    h1("Production list — make once");
    for (const g of inScope) {
      const line = `• ${g.label}${g.spec ? ` (${g.spec})` : ""}${g.consumers.length > 1 ? ` — shared ×${g.consumers.length}` : ""}  →  ${g.consumers.map((c) => c.recipientName).join(", ")}`;
      const ll = pdf.splitTextToSize(line, CW - 6) as string[];
      ensure(ll.length * 9.5);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(50);
      pdf.text(ll, M + 4, y); y += ll.length * 9.5 + 1;
    }
    y += 8;
  }

  // ---- Schedule ----
  if (bars.length) {
    h1(`Post schedule${startDate ? ` — from ${startDate}` : ""}`);
    for (const b of bars) {
      const line = `• ${b.name} — week ${b.start + 1} to ${b.start + b.dur}  (${b.dur} wk${b.dur === 1 ? "" : "s"})`;
      const ll = pdf.splitTextToSize(line, CW - 6) as string[];
      ensure(ll.length * 9.5);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(50);
      pdf.text(ll, M + 4, y); y += ll.length * 9.5 + 1;
    }
    y += 8;
  }

  // ---- Task board ----
  if (board.length) {
    h1("Task board");
    for (const col of board) {
      ensure(16);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.setTextColor(70);
      pdf.text(`${col.name.toUpperCase()} (${col.cards.length})`, M, y); y += 11;
      for (const k of col.cards) {
        const done = k.checks.filter((c) => c.done).length;
        const line = `• ${k.title}${k.due ? ` · due ${k.due}` : ""}${k.checks.length ? ` · ${done}/${k.checks.length}` : ""}`;
        const ll = pdf.splitTextToSize(line, CW - 14) as string[];
        ensure(ll.length * 9.5);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(50);
        pdf.text(ll, M + 10, y); y += ll.length * 9.5;
      }
      y += 5;
    }
  }

  pdf.save(`${slug(projectName) || "project"}-dossier.pdf`);
}
