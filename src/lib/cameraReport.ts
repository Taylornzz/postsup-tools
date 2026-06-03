import { jsPDF } from "jspdf";
import { formatSize, formatNumber } from "./formats";

/** Everything the report renders — all numbers are pre-computed by the caller
 *  (Index) so the PDF exactly matches what's on screen / in the permalink. */
export interface CameraReportInput {
  version: string;
  dateLabel: string; // human date for the header
  url: string;
  projectName?: string;
  authorName?: string;
  // SOURCE
  camera: string;
  mode: string;
  recordedW: number;
  recordedH: number;
  squeeze: number;
  displayedW: number;
  displayedH: number;
  imageAspectLabel: string;
  sensorAspectLabel: string;
  sensorWidthMm?: number;
  sensorHeightMm?: number;
  usedSensorWidthMm?: number;
  usedSensorHeightMm?: number;
  colorSpace?: string;
  oetf?: string;
  megapixels: number;
  lensName: string;
  lensDiameterMm: number;
  lensCovers: boolean;
  lensIsNone: boolean;
  sensorDiagMm: number | null;
  // RECORDING
  codecName: string;
  fps: number;
  mbps: number;
  perHourGB: number;
  // DELIVERY
  targetName: string;
  targetW: number;
  targetH: number;
  targetAspectLabel: string;
  hdr: string;
  hdrNits: number;
  // EXTRACTION
  extractPxW: number;
  extractPxH: number;
  cropPctH: number;
  cropPctV: number;
  usedArea: number;
  scale: number;
  // STORAGE & MEDIA
  recordHoursPerDay: number;
  cameraCount: number;
  perDayGB: number;
  cardName: string;
  cardGB: number;
  cardKind: string; // "mag" | "drive" | "card"
  cardRuntimeMin: number;
  bandwidthLabel: string;
  bandwidthMbps: number;
  backupCopies: number;
  offloadStations: number;
  offloadHrs: number;
  proxyName: string | null;
  proxyPerDayGB: number | null;
  proxyRatioPct: number | null;
  // COLOUR · ACES (optional)
  acesVersion?: string;
  acesIdt?: string;
  acesIdtOfficial?: boolean;
  acesGrade?: string;
  acesInterchange?: string;
  acesOdt?: string;
  acesOdtDisplay?: string; // "<display> · <eotf> · <nits> nits"
}

const INK = [26, 26, 26] as const;
const MUTED = [120, 120, 120] as const;
const ACCENT = [8, 145, 178] as const; // guide-target cyan
const WARN = [180, 83, 9] as const;

/** jsPDF's standard Courier uses WinAnsi encoding — map the few non-WinAnsi
 *  characters our data can contain to safe equivalents (≈, smart quotes). */
function clean(s: string): string {
  return s
    .replace(/≈/g, "~") // ≈
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

function fmtMinutes(min: number): string {
  if (!Number.isFinite(min)) return "—";
  if (min < 60) return `${min.toFixed(0)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h} h ${m} min`;
}

/** Build the Camera & Storage report PDF and return it as a Blob. */
export function buildCameraReportPdf(d: CameraReportInput): Blob {
  return buildCameraReportDoc(d).output("blob");
}

/** Build the report and return the underlying jsPDF document (for tests / other outputs). */
export function buildCameraReportDoc(d: CameraReportInput): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const M = 40; // margin
  const COL_VAL = M + 132; // value column x
  let y = M;

  const ensure = (need: number) => {
    if (y + need > PAGE_H - M) {
      doc.addPage();
      y = M;
    }
  };

  const sectionHeader = (label: string) => {
    ensure(34);
    y += 8;
    doc.setDrawColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.setLineWidth(1.5);
    doc.line(M, y, M + 18, y);
    doc.setFont("courier", "bold");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(label.toUpperCase(), M + 24, y + 3);
    y += 16;
  };

  const kv = (key: string, value: string, tone?: "warn" | "accent") => {
    if (!value) return;
    ensure(15);
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(clean(key), M, y);
    const c = tone === "warn" ? WARN : tone === "accent" ? ACCENT : INK;
    doc.setTextColor(c[0], c[1], c[2]);
    const lines = doc.splitTextToSize(clean(value), PAGE_W - COL_VAL - M);
    doc.text(lines, COL_VAL, y);
    y += 13 * lines.length;
  };

  // ---- Header -------------------------------------------------------------
  doc.setFont("courier", "bold");
  doc.setFontSize(15);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text("NORTHLIGHT GUIDE", M, y + 6);
  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text("Camera & Storage Report", M, y + 22);
  doc.text(`${d.dateLabel}  ·  ${d.version}`, PAGE_W - M, y + 22, { align: "right" });
  y += 30;
  // Slate line — project + DP, only when supplied.
  const proj = (d.projectName || "").trim();
  const author = (d.authorName || "").trim();
  if (proj || author) {
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const slate = [proj ? clean(proj) : null, author ? clean(author) : null]
      .filter(Boolean)
      .join("    ·    ");
    doc.text(slate, M, y + 6);
    y += 14;
  }
  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.75);
  doc.line(M, y, PAGE_W - M, y);
  y += 4;

  // ---- Source -------------------------------------------------------------
  sectionHeader("Source");
  kv("Camera", d.camera);
  kv("Mode", d.mode);
  kv("Resolution", `${formatNumber(d.recordedW)} × ${formatNumber(d.recordedH)} (recorded)`);
  kv("Squeeze", d.squeeze === 1 ? "1.0× spherical" : `${d.squeeze}× anamorphic`);
  if (d.squeeze !== 1) {
    kv("Displayed", `${formatNumber(d.displayedW)} × ${formatNumber(d.displayedH)} (desqueezed)`);
    kv("Aspect", `Sensor ${d.sensorAspectLabel} · Image ${d.imageAspectLabel}`);
  } else {
    kv("Aspect", d.imageAspectLabel);
  }
  if (d.sensorWidthMm) {
    const used =
      d.usedSensorWidthMm && d.usedSensorWidthMm !== d.sensorWidthMm
        ? ` · ${d.usedSensorWidthMm} × ${d.usedSensorHeightMm} mm (used)`
        : "";
    kv("Sensor", `${d.sensorWidthMm} × ${d.sensorHeightMm} mm${used}`);
  }
  if (d.colorSpace) kv("Color", `${d.colorSpace} / ${d.oetf}`);
  if (!d.lensIsNone) {
    kv(
      "Lens",
      `${d.lensName} · Ø ${d.lensDiameterMm} mm — ${d.lensCovers ? "covers sensor" : "DOES NOT cover (vignette)"}${
        d.sensorDiagMm ? ` · sensor Ø ${d.sensorDiagMm.toFixed(1)} mm` : ""
      }`,
      d.lensCovers ? undefined : "warn",
    );
  }
  kv("Megapixels", `${d.megapixels.toFixed(2)} MP`);

  // ---- Recording ----------------------------------------------------------
  sectionHeader("Recording");
  kv("Codec", d.codecName);
  kv("Frame rate", `${d.fps} fps`);
  kv(
    "Bitrate",
    `${d.mbps >= 1000 ? `${(d.mbps / 1000).toFixed(2)} Gbps` : `${d.mbps.toFixed(0)} Mbps`} (${(d.mbps / 8).toFixed(1)} MB/s)`,
  );
  kv("Per hour", formatSize(d.perHourGB), "accent");

  // ---- Delivery -----------------------------------------------------------
  sectionHeader("Delivery");
  kv("Container", d.targetName);
  kv("Resolution", `${formatNumber(d.targetW)} × ${formatNumber(d.targetH)}`);
  kv("Aspect", d.targetAspectLabel);
  kv("HDR", `${d.hdr} · ${d.hdrNits} nits peak`);

  // ---- Extraction ---------------------------------------------------------
  sectionHeader("Extraction (delivery-aspect cover crop)");
  kv("Extract px", `${formatNumber(d.extractPxW)} × ${formatNumber(d.extractPxH)}`);
  kv("Crop", `H ${(d.cropPctH * 100).toFixed(1)}%  ·  V ${(d.cropPctV * 100).toFixed(1)}%`);
  kv("Sensor used", `${(d.usedArea * 100).toFixed(1)}% of source area`);
  kv(
    "Pixel scale",
    `${d.scale.toFixed(3)}× — ${d.scale > 1.001 ? "UPSCALE (target larger than extraction)" : "downscale / supersampled (safe)"}`,
    d.scale > 1.001 ? "warn" : undefined,
  );

  // ---- Storage & Media ----------------------------------------------------
  const perCamGB = d.perDayGB / Math.max(1, d.cameraCount);
  const cardsPerCamDay = Math.max(1, Math.ceil(perCamGB / d.cardGB));
  const cardsPerDay = cardsPerCamDay * d.cameraCount;
  const inventory = cardsPerDay * 3;
  const word = d.cardKind === "mag" ? "mag" : d.cardKind === "drive" ? "drive" : "card";

  sectionHeader("Storage & Media");
  kv("Recording plan", `${d.recordHoursPerDay} h/day rolling · ${d.cameraCount} camera${d.cameraCount !== 1 ? "s" : ""}`);
  kv("Footage / day", formatSize(d.perDayGB), "warn");
  kv(`${word[0].toUpperCase()}${word.slice(1)}`, `${d.cardName} · ${(d.cardGB / 1000).toFixed(d.cardGB % 1000 === 0 ? 0 : 2)} TB`);
  kv(`${word} runtime`, fmtMinutes(d.cardRuntimeMin));
  kv(`${word}s / cam / day`, `${cardsPerCamDay}  (${(((perCamGB / d.cardGB) % 1) * 100).toFixed(0)}% into the last ${word})`);
  kv(`${word}s / day`, `${cardsPerDay}  (${cardsPerCamDay} × ${d.cameraCount} cam${d.cameraCount !== 1 ? "s" : ""})`, "warn");
  kv("On-set inventory", `${inventory}  ${word}s — 3× rotation (in cam + offload + spare)`, "warn");

  sectionHeader("Offload & Proxies");
  kv("Bandwidth", `${d.bandwidthLabel} (${d.bandwidthMbps} MB/s)`);
  kv("Backups", `${d.backupCopies}×  ·  ${d.offloadStations} parallel station${d.offloadStations !== 1 ? "s" : ""}`);
  kv(
    "Offload / day",
    Number.isFinite(d.offloadHrs) ? `${d.offloadHrs.toFixed(1)} h  (${formatSize(d.perDayGB)} × ${d.backupCopies})` : "—",
    d.offloadHrs > 8 ? "warn" : "accent",
  );
  if (d.proxyName && d.proxyPerDayGB != null) {
    kv("Proxy codec", d.proxyName);
    kv(
      "Proxy / day",
      `${formatSize(d.proxyPerDayGB)}${d.proxyRatioPct != null ? `  (${d.proxyRatioPct.toFixed(1)}% of camera footage)` : ""}`,
    );
    kv("Camera + proxy / day", formatSize(d.perDayGB + d.proxyPerDayGB), "warn");
  }

  // ---- Colour · ACES ------------------------------------------------------
  if (d.acesIdt && d.acesOdt) {
    sectionHeader(`Colour · ACES ${d.acesVersion ?? "2.0"}`);
    kv("Input · IDT", `${d.acesIdt}${d.acesIdtOfficial === false ? "  (third-party — no official ACES IDT)" : ""}`,
      d.acesIdtOfficial === false ? "warn" : undefined);
    if (d.acesGrade) kv("Working space", d.acesGrade);
    if (d.acesInterchange) kv("Interchange", d.acesInterchange);
    kv("Output · Transform", d.acesOdt, "accent");
    if (d.acesOdtDisplay) kv("Display", d.acesOdtDisplay);
    kv("Note", "Reference only — set in your grading app; menu names vary by app & version. 1.3 and 2.0 renders are not interchangeable.");
  }

  // ---- Footer -------------------------------------------------------------
  y += 6;
  ensure(40);
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.5);
  doc.line(M, y, PAGE_W - M, y);
  y += 12;
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const disclaimer = doc.splitTextToSize(
    "Estimates from published vendor bitrates & bits-per-pixel ratios. Real sizes vary with scene complexity and audio/metadata. Planning baseline, not a billing figure.",
    PAGE_W - 2 * M,
  );
  doc.text(disclaimer, M, y);
  y += 11 * disclaimer.length + 4;
  if (d.url) {
    const link = doc.splitTextToSize(d.url, PAGE_W - 2 * M);
    doc.setTextColor(ACCENT[0], ACCENT[1], ACCENT[2]);
    doc.text(link, M, y);
  }

  return doc;
}
