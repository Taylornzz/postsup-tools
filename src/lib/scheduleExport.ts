import { jsPDF } from "jspdf";

/** Export a Post Schedule (Gantt) to PDF, PNG, iCalendar, CSV or JSON. */

export type SchedBar = { id: string; name: string; color: string; start: number; dur: number };
export type ExportFormat = "pdf" | "png" | "ics" | "csv" | "json";
export type ExportCtx = {
  startDate: string;   // anchor source (raw)
  anchor: string;      // Monday ISO of the timeline origin
  bars: SchedBar[];
  weeksToShow: number;
  title: string;       // project name (may be empty)
  todayWeeks: number;
};

// ---- canvas layout (export only) ----
const SCALE = 2;
const LBL = 150, RH = 26, WW = 34, MH = 20, WH = 16, TITLE = 34;
const HEAD = MH + WH;

const pad = (n: number) => String(n).padStart(2, "0");
function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const dateAtISO = (anchor: string, weeks: number) => addDaysISO(anchor, Math.round(weeks * 7));
const dObj = (iso: string) => new Date(iso + "T00:00:00");
const fmtShort = (iso: string) => dObj(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
const fmtLong = (iso: string) => dObj(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
function isoWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
const slug = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// ---- downloads ----
function downloadText(filename: string, mime: string, content: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a");
  a.href = dataUrl; a.download = filename; a.click();
}

// ---- text builders ----
function buildJSON(ctx: ExportCtx): string {
  return JSON.stringify({ product: "PostSup Tools — Post Schedule", startDate: ctx.startDate, bars: ctx.bars }, null, 2);
}
function buildCSV(ctx: ExportCtx): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows: string[][] = [["Phase", "Type", "Start", "End", "Duration (weeks)"]];
  for (const b of ctx.bars) {
    const s = dateAtISO(ctx.anchor, b.start);
    if (b.dur === 0) rows.push([b.name, "Milestone", fmtLong(s), "", "0"]);
    else rows.push([b.name, "Phase", fmtLong(s), fmtLong(addDaysISO(dateAtISO(ctx.anchor, b.start + b.dur), -1)), String(b.dur)]); // inclusive last day
  }
  return rows.map((r) => r.map(esc).join(",")).join("\r\n");
}
function icsStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function buildICS(ctx: ExportCtx): string {
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const stamp = icsStamp(new Date());
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PostSup Tools//Post Schedule//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const b of ctx.bars) {
    const startISO = dateAtISO(ctx.anchor, b.start);
    const endISO = b.dur === 0 ? addDaysISO(startISO, 1) : dateAtISO(ctx.anchor, b.start + b.dur);
    L.push("BEGIN:VEVENT");
    L.push(`UID:${b.id}@postsup-tools`);
    L.push(`DTSTAMP:${stamp}`);
    L.push(`SUMMARY:${esc(b.name)}${ctx.title ? " — " + esc(ctx.title) : ""}`);
    L.push(`DTSTART;VALUE=DATE:${startISO.replace(/-/g, "")}`);
    L.push(`DTEND;VALUE=DATE:${endISO.replace(/-/g, "")}`);
    L.push(`DESCRIPTION:${esc(b.dur === 0 ? "Milestone / keyframe" : b.dur + " week phase")}`);
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.join("\r\n");
}

// ---- gantt canvas (shared by PDF + PNG) ----
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function renderGanttCanvas(ctx0: ExportCtx): HTMLCanvasElement {
  const { anchor, bars, weeksToShow, title, todayWeeks } = ctx0;
  const W = LBL + weeksToShow * WW;
  const H = TITLE + HEAD + bars.length * RH + 8;
  const c = document.createElement("canvas");
  c.width = Math.round(W * SCALE);
  c.height = Math.round(H * SCALE);
  const ctx = c.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = "#0a0e13"; ctx.fillRect(0, 0, W, H);

  // title
  ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 13px ui-monospace, Menlo, monospace";
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  ctx.fillText(`${title ? title + " — " : ""}Post Schedule`, 10, 22);
  ctx.textBaseline = "middle";

  const top = TITLE;
  const bottom = top + HEAD + bars.length * RH;

  // week columns + grid
  ctx.font = "9px ui-monospace, monospace";
  for (let i = 0; i < weeksToShow; i++) {
    const x = LBL + i * WW;
    ctx.fillStyle = "#0f172a"; ctx.fillRect(x, top + MH, WW, WH);
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, top + MH + 0.5, WW, WH);
    ctx.fillStyle = "#64748b"; ctx.textAlign = "center";
    ctx.fillText("W" + isoWeek(dObj(dateAtISO(anchor, i))), x + WW / 2, top + MH + WH / 2);
    ctx.strokeStyle = "rgba(148,163,184,0.10)";
    ctx.beginPath(); ctx.moveTo(x + 0.5, top + HEAD); ctx.lineTo(x + 0.5, bottom); ctx.stroke();
  }

  // month spans
  const months: { label: string; span: number; startIdx: number }[] = [];
  for (let i = 0; i < weeksToShow; i++) {
    const label = dObj(dateAtISO(anchor, i)).toLocaleDateString(undefined, { month: "short", year: "numeric" });
    const last = months[months.length - 1];
    if (last && last.label === label) last.span += 1;
    else months.push({ label, span: 1, startIdx: i });
  }
  ctx.textAlign = "left";
  for (const m of months) {
    const x = LBL + m.startIdx * WW;
    ctx.fillStyle = "#0f172a"; ctx.fillRect(x, top, m.span * WW, MH);
    ctx.strokeStyle = "#1e293b"; ctx.strokeRect(x + 0.5, top + 0.5, m.span * WW, MH);
    ctx.fillStyle = "#94a3b8"; ctx.fillText(m.label.toUpperCase(), x + 4, top + MH / 2);
  }

  // header corner
  ctx.fillStyle = "#0f172a"; ctx.fillRect(0, top, LBL, HEAD);
  ctx.strokeStyle = "#1e293b"; ctx.strokeRect(0.5, top + 0.5, LBL, HEAD);
  ctx.fillStyle = "#64748b"; ctx.fillText("PHASE", 8, top + HEAD - WH / 2);

  // today line
  if (todayWeeks >= 0 && todayWeeks <= weeksToShow) {
    const x = LBL + todayWeeks * WW;
    ctx.strokeStyle = "#f87171"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
  }

  // rows
  bars.forEach((b, r) => {
    const y = top + HEAD + r * RH;
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.beginPath(); ctx.moveTo(0, y + RH + 0.5); ctx.lineTo(W, y + RH + 0.5); ctx.stroke();

    // name cell
    ctx.fillStyle = "#0a0e13"; ctx.fillRect(0, y, LBL, RH);
    ctx.fillStyle = b.color; ctx.beginPath(); ctx.arc(11, y + RH / 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#cbd5e1"; ctx.textAlign = "left"; ctx.font = "10px ui-monospace, monospace";
    ctx.fillText(b.name, 20, y + RH / 2);
    ctx.strokeStyle = "#1e293b"; ctx.beginPath(); ctx.moveTo(LBL + 0.5, y); ctx.lineTo(LBL + 0.5, y + RH); ctx.stroke();

    if (b.dur === 0) {
      const x = LBL + b.start * WW;
      ctx.save(); ctx.translate(x, y + RH / 2); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = b.color; ctx.fillRect(-5, -5, 10, 10); ctx.restore();
      ctx.fillStyle = "#94a3b8"; ctx.textAlign = "left";
      ctx.fillText(`${b.name} · ${fmtShort(dateAtISO(anchor, b.start))}`, x + 9, y + RH / 2);
    } else {
      const x = LBL + b.start * WW, w = b.dur * WW;
      ctx.fillStyle = b.color; roundRect(ctx, x, y + RH / 2 - 7, w, 14, 3); ctx.fill();
      if (w > 22) {
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.textAlign = "center"; ctx.font = "bold 9px ui-monospace, monospace";
        ctx.fillText(`${b.dur}w`, x + w / 2, y + RH / 2);
      }
      ctx.fillStyle = "#94a3b8"; ctx.textAlign = "left"; ctx.font = "10px ui-monospace, monospace";
      ctx.fillText(`${b.name} · ${fmtShort(dateAtISO(anchor, b.start))}–${fmtShort(addDaysISO(dateAtISO(anchor, b.start + b.dur), -1))}`, x + w + 6, y + RH / 2);
    }
  });

  return c;
}

// ---- entry point ----
export function exportSchedule(format: ExportFormat, ctx: ExportCtx) {
  const base = slug(ctx.title) || "post-schedule";
  switch (format) {
    case "json":
      downloadText(`${base}.json`, "application/json", buildJSON(ctx));
      break;
    case "csv":
      downloadText(`${base}.csv`, "text/csv", buildCSV(ctx));
      break;
    case "ics":
      downloadText(`${base}.ics`, "text/calendar", buildICS(ctx));
      break;
    case "png": {
      const c = renderGanttCanvas(ctx);
      downloadDataUrl(`${base}-gantt.png`, c.toDataURL("image/png"));
      break;
    }
    case "pdf": {
      const c = renderGanttCanvas(ctx);
      const W = c.width / SCALE, H = c.height / SCALE;
      const pdf = new jsPDF({ orientation: W >= H ? "landscape" : "portrait", unit: "px", format: [W, H], compress: true });
      pdf.addImage(c.toDataURL("image/png"), "PNG", 0, 0, W, H);
      pdf.save(`${base}-gantt.pdf`);
      break;
    }
  }
}
