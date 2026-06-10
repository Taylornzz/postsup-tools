import { jsPDF } from "jspdf";
import type { Recipient } from "./deliverables";
import type { ArtifactGroup } from "./deliverablesRollup";
import { CATEGORIES, STATUSES } from "./deliverablesList";

/** Export the Deliverables matrix — every recipient's spec + itemised punch-list,
 *  plus the make-once Production list — as CSV (one row per deliverable) or a
 *  formatted PDF for handoff to vendors/clients. */

export type DeliverablesExportFormat = "csv" | "pdf";

const slug = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const catLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label || id;
const statusLabel = (id?: string) => STATUSES.find((s) => s.id === id)?.label || "To do";

function downloadText(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const specLine = (r: Recipient) =>
  [r.dr, r.peakNits && /hdr|vision|hlg/i.test(r.dr || "") ? `${r.peakNits} nit` : "", r.resolution, r.fps ? `${r.fps} fps` : "", r.container, r.audio, r.loudness, r.truePeak, r.subtitles]
    .filter(Boolean).join(" · ");

// ---- CSV (one row per deliverable item; recipients without items get one spec row) ----
function buildCSV(recipients: Recipient[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows: string[][] = [[
    "Recipient", "Region", "Due", "Colour/Range", "Resolution", "FPS", "Container", "Audio",
    "Loudness", "True peak", "Subtitles", "Category", "Deliverable", "In scope", "Owner", "Status", "Version", "Item notes",
  ]];
  for (const r of recipients) {
    const spec = [r.name, r.region || "", r.due || "", r.dr || "", r.resolution || "", r.fps ? String(r.fps) : "", r.container || "", r.audio || "", r.loudness || "", r.truePeak || "", r.subtitles || ""];
    const items = r.deliverables || [];
    if (!items.length) rows.push([...spec, "", "", "", "", "", "", ""]);
    for (const it of items) {
      rows.push([...spec, catLabel(it.category), it.label, it.inScope ? "yes" : "no", it.owner || "", statusLabel(it.status), `v${it.version || 1}`, it.notes || ""]);
    }
  }
  return rows.map((row) => row.map(esc).join(",")).join("\n");
}

// ---- PDF ----
function buildPDF(recipients: Recipient[], rollup: ArtifactGroup[], title: string) {
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const PW = pdf.internal.pageSize.getWidth();
  const PH = pdf.internal.pageSize.getHeight();
  const M = 42;
  const CW = PW - M * 2;
  let y = M;
  const ensure = (h: number) => { if (y + h > PH - M) { pdf.addPage(); y = M; } };

  pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.setTextColor(20);
  pdf.text(`${title ? title + " — " : ""}Deliverables`, M, y);
  y += 16;
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(8); pdf.setTextColor(130);
  const itemCount = recipients.reduce((n, r) => n + (r.deliverables?.length || 0), 0);
  pdf.text(`${recipients.length} recipient${recipients.length === 1 ? "" : "s"} · ${itemCount} deliverables · ${new Date().toLocaleString()}`, M, y);
  y += 10;
  pdf.text("Every spec is a plan — confirm against each recipient's own delivery document.", M, y);
  y += 18;

  // jsPDF's built-in fonts are WinAnsi-only — draw the "main" star, never print "★".
  const drawStar = (cx: number, cy: number, rad: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? rad : rad * 0.45;
      pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
    }
    pdf.setFillColor(217, 119, 6);
    const segs = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]) as [number, number][];
    pdf.lines(segs, pts[0][0], pts[0][1], [1, 1], "F", true);
  };

  for (const r of recipients) {
    ensure(44);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(25);
    if (r.isMain) drawStar(M + 5, y - 4, 5);
    pdf.text(r.name || "Recipient", M + (r.isMain ? 14 : 0), y);
    if (r.due) {
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(120);
      pdf.text(`due ${r.due}`, PW - M, y, { align: "right" });
    }
    y += 6;
    pdf.setDrawColor(205); pdf.setLineWidth(0.6); pdf.line(M, y, PW - M, y);
    y += 12;

    const spec = specLine(r);
    if (spec) {
      const sl = pdf.splitTextToSize(spec, CW) as string[];
      ensure(sl.length * 10 + 4);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(70);
      pdf.text(sl, M, y); y += sl.length * 10 + 4;
    }
    if (r.notes) {
      const nl = pdf.splitTextToSize(r.notes, CW) as string[];
      ensure(nl.length * 9 + 2);
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(7.5); pdf.setTextColor(120);
      pdf.text(nl, M, y); y += nl.length * 9 + 4;
    }

    const items = r.deliverables || [];
    const byCat = CATEGORIES.map((c) => ({ cat: c, items: items.filter((i) => i.category === c.id) })).filter((g) => g.items.length);
    for (const g of byCat) {
      ensure(14);
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(8.5); pdf.setTextColor(90);
      pdf.text(g.cat.label.toUpperCase(), M + 4, y); y += 11;
      for (const it of g.items) {
        const line = `${it.inScope ? "[ ]" : "[–]"}  ${it.label}${it.version && it.version > 1 ? `  (v${it.version})` : ""}`;
        const meta = [it.owner, statusLabel(it.status), it.notes].filter(Boolean).join(" · ");
        const ll = pdf.splitTextToSize(line, CW - 22) as string[];
        ensure(ll.length * 10 + (meta ? 9 : 0));
        pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5);
        pdf.setTextColor(it.inScope ? 40 : 150);
        pdf.text(ll, M + 14, y); y += ll.length * 10;
        if (meta) {
          const ml = pdf.splitTextToSize(meta, CW - 30) as string[];
          pdf.setFontSize(7); pdf.setTextColor(130);
          pdf.text(ml, M + 26, y); y += ml.length * 8 + 1;
        }
      }
      y += 4;
    }
    if (!items.length) {
      ensure(12);
      pdf.setFont("helvetica", "italic"); pdf.setFontSize(8); pdf.setTextColor(160);
      pdf.text("(no deliverables itemised yet)", M + 4, y); y += 14;
    }
    y += 10;
  }

  // Production list — the make-once rollup
  const inScope = rollup.filter((g) => g.inScope);
  if (inScope.length) {
    ensure(40);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(12); pdf.setTextColor(25);
    pdf.text("Production list — make once", M, y); y += 6;
    pdf.setDrawColor(205); pdf.line(M, y, PW - M, y); y += 12;
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7.5); pdf.setTextColor(120);
    pdf.text("Identical artifacts collapsed (same content + spec); each shows who receives it.", M, y); y += 12;
    for (const g of inScope) {
      const line = `• ${g.label}${g.spec ? `   (${g.spec})` : ""}${g.consumers.length > 1 ? `   — shared x${g.consumers.length}` : ""}`;
      const ll = pdf.splitTextToSize(line, CW - 10) as string[];
      const consumers = `for:  ${g.consumers.map((c) => c.recipientName).join(" · ")}`;
      const cl = pdf.splitTextToSize(consumers, CW - 26) as string[];
      ensure(ll.length * 10 + cl.length * 8 + 3);
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setTextColor(40);
      pdf.text(ll, M + 4, y); y += ll.length * 10;
      pdf.setFontSize(7); pdf.setTextColor(130);
      pdf.text(cl, M + 16, y); y += cl.length * 8 + 3;
    }
  }

  pdf.save(`${slug(title) || "deliverables"}-deliverables.pdf`);
}

export function exportDeliverables(format: DeliverablesExportFormat, recipients: Recipient[], rollup: ArtifactGroup[], title: string) {
  const base = slug(title) || "deliverables";
  if (format === "csv") downloadText(`${base}-deliverables.csv`, "text/csv", buildCSV(recipients));
  else buildPDF(recipients, rollup, title);
}
