import { jsPDF } from "jspdf";

/** Export a Task Board (kanban) to JSON, CSV or PDF. Structural types so the
 *  component can pass its own Column/Card shapes straight in. */

export type BoardCheck = { text: string; done: boolean };
export type BoardCard = { title: string; notes: string; color: string; due?: string; checks: BoardCheck[] };
export type BoardColumn = { name: string; cards: BoardCard[] };
export type BoardExportFormat = "json" | "csv" | "pdf";

const slug = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function downloadText(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [100, 116, 139];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const fmtDue = (iso: string) => {
  try { return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
};
const doneCount = (c: BoardCard) => c.checks.filter((x) => x.done).length;

// ---- CSV (one row per card) ----
function buildCSV(cols: BoardColumn[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows: string[][] = [["Column", "Card", "Due", "Checklist", "Notes", "Items"]];
  for (const col of cols) {
    for (const k of col.cards) {
      const items = k.checks.map((x) => `[${x.done ? "x" : " "}] ${x.text}`).join("; ");
      rows.push([
        col.name,
        k.title,
        k.due ? fmtDue(k.due) : "",
        k.checks.length ? `${doneCount(k)}/${k.checks.length}` : "",
        k.notes || "",
        items,
      ]);
    }
  }
  return rows.map((r) => r.map((v) => esc(String(v))).join(",")).join("\r\n");
}

// ---- PDF (a clean printable board: columns → cards → checklists) ----
function buildPDF(cols: BoardColumn[], title: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 42;
  const CW = PW - M * 2;
  let y = M;
  const ensure = (h: number) => { if (y + h > PH - M) { pdf.addPage(); y = M; } };

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(20);
  pdf.text(`${title ? title + " — " : ""}Task Board`, M, y);
  y += 16;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(130);
  const total = cols.reduce((n, c) => n + c.cards.length, 0);
  pdf.text(`${total} card${total === 1 ? "" : "s"} · ${new Date().toLocaleString()}`, M, y);
  y += 18;

  for (const col of cols) {
    ensure(30);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(30);
    pdf.text(`${col.name.toUpperCase()}  (${col.cards.length})`, M, y);
    y += 5;
    pdf.setDrawColor(205); pdf.setLineWidth(0.6); pdf.line(M, y, PW - M, y);
    y += 15;

    if (!col.cards.length) {
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(9); pdf.setTextColor(160);
      pdf.text("(empty)", M + 12, y); y += 16; continue;
    }

    for (const k of col.cards) {
      // title + colour chip
      const titleLines = pdf.splitTextToSize(k.title, CW - 16) as string[];
      ensure(titleLines.length * 13 + 6);
      const [r, g, b] = hexToRgb(k.color);
      pdf.setFillColor(r, g, b); pdf.rect(M, y - 7.5, 6, 6, "F");
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(25);
      pdf.text(titleLines, M + 12, y);
      y += titleLines.length * 13;

      // meta: due + checklist progress
      const done = doneCount(k);
      const meta = [k.due ? `due ${fmtDue(k.due)}` : null, k.checks.length ? `${done}/${k.checks.length} done` : null].filter(Boolean).join("   ·   ");
      if (meta) {
        ensure(11);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(115);
        pdf.text(meta, M + 12, y); y += 11;
      }

      // notes
      if (k.notes) {
        const nl = pdf.splitTextToSize(k.notes, CW - 16) as string[];
        ensure(nl.length * 10 + 2);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(95);
        pdf.text(nl, M + 12, y); y += nl.length * 10 + 2;
      }

      // checklist items
      for (const ch of k.checks) {
        const cl = pdf.splitTextToSize(`${ch.done ? "[x]" : "[ ]"}  ${ch.text}`, CW - 28) as string[];
        ensure(cl.length * 10);
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
        pdf.setTextColor(ch.done ? 150 : 60);
        pdf.text(cl, M + 22, y); y += cl.length * 10;
      }
      y += 9;
    }
    y += 8;
  }

  pdf.save(`${slug(title) || "task-board"}.pdf`);
}

export function exportBoard(format: BoardExportFormat, cols: BoardColumn[], title: string) {
  const base = slug(title) || "task-board";
  if (format === "json") downloadText(`${base}.json`, "application/json", JSON.stringify({ product: "Kaos Theory — Task Board", title, columns: cols }, null, 2));
  else if (format === "csv") downloadText(`${base}.csv`, "text/csv", buildCSV(cols));
  else buildPDF(cols, title);
}
