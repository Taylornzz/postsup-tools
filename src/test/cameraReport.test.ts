import { describe, it, expect } from "vitest";
import { buildCameraReportPdf, CameraReportInput } from "@/lib/cameraReport";

const BASE: CameraReportInput = {
  version: "v1.9.21",
  dateLabel: "2026-05-29",
  url: "https://frame-matrix.lovable.app/?s=alexa35-46k-og",
  camera: "ARRI ALEXA 35",
  mode: "4.6K 3:2 Open Gate",
  recordedW: 4608,
  recordedH: 3164,
  squeeze: 1,
  displayedW: 4608,
  displayedH: 3164,
  imageAspectLabel: "1.46:1 (1.46:1)",
  sensorAspectLabel: "1.46:1 (1.46:1)",
  sensorWidthMm: 27.99,
  sensorHeightMm: 19.22,
  colorSpace: "ARRI Wide Gamut 4",
  oetf: "LogC4",
  megapixels: 14.58,
  lensName: "Cooke S7/i FF",
  lensDiameterMm: 46.3,
  lensCovers: true,
  lensIsNone: false,
  sensorDiagMm: 33.95,
  codecName: "ARRIRAW",
  fps: 24,
  mbps: 2600,
  perHourGB: 1170,
  targetName: "UHD 4K",
  targetW: 3840,
  targetH: 2160,
  targetAspectLabel: "1.78:1",
  hdr: "SDR",
  hdrNits: 100,
  extractPxW: 4096,
  extractPxH: 2160,
  cropPctH: 0.11,
  cropPctV: 0.32,
  usedArea: 0.61,
  scale: 0.94,
  recordHoursPerDay: 4,
  cameraCount: 2,
  perDayGB: 9360,
  cardName: "Codex Compact Drive 2TB",
  cardGB: 2048,
  cardKind: "drive",
  cardRuntimeMin: 105,
  bandwidthLabel: "Thunderbolt 3 (≈700 MB/s)",
  bandwidthMbps: 700,
  backupCopies: 2,
  offloadStations: 2,
  offloadHrs: 7.4,
  proxyName: "ProRes 422 Proxy",
  proxyPerDayGB: 280,
  proxyRatioPct: 3.0,
};

describe("buildCameraReportPdf", () => {
  it("produces a non-trivial PDF blob", () => {
    const blob = buildCameraReportPdf(BASE);
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
  });

  it("handles anamorphic + infinite offload + no proxy without throwing", () => {
    const ana = buildCameraReportPdf({
      ...BASE,
      squeeze: 2,
      offloadHrs: Infinity,
      cardRuntimeMin: Infinity,
      proxyName: null,
      proxyPerDayGB: null,
      proxyRatioPct: null,
      colorSpace: undefined,
      oetf: undefined,
      lensIsNone: true,
    });
    expect(ana.type).toBe("application/pdf");
  });
});
