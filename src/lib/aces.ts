import { SourceFormat } from "./formats";

// ACES reference layer — a READ-ONLY lookup that tells a DIT / colorist / post
// supervisor which Input Transform (IDT), working space and Output Transform to
// set in their actual app (Resolve / Baselight / Nuke). PostSup Tools does NOT
// apply any of these transforms; it only reports the correct ones to configure.
//
// Data verified (web + adversarial fact-check) against ACES docs, the AMPAS
// ACES GitHub, Netflix Partner Help and manufacturer color science, mid-2025.
// ACES 2.0 is the default; ACES 1.3 is the optional fallback.

export type AcesVersion = "2.0" | "1.3";

export interface AcesIdt {
  /** Human-readable transform name (follows ACES naming; exact app spelling varies). */
  label: string;
  /** True only when an official AMPAS / manufacturer-reviewed core ACES IDT exists. */
  official: boolean;
  /** ACES encoding the camera log maps into. */
  mapsInto: string;
  note?: string;
}

export interface AcesOdt {
  /** ACES 2.0 unified Output Transform. */
  label2: string;
  /** ACES 1.3 RRT + ODT equivalent. */
  label13: string;
  display: string;
  eotf: string;
  peakNits: string;
  note?: string;
}

export interface AcesWorkingSpace {
  name: string;
  use: string;
}

export interface AcesPipeline {
  version: AcesVersion;
  idt: AcesIdt;
  /** Recommended grade working space (ACEScct). */
  grade: AcesWorkingSpace;
  /** VFX / CG working space (ACEScg). */
  vfx: AcesWorkingSpace;
  /** Interchange / archival encoding (ACES2065-1). */
  interchange: AcesWorkingSpace;
  odt: AcesOdt;
}

// ---- Input Transforms (IDTs) ----------------------------------------------
const ARRI_LOGC4: AcesIdt = {
  label: "ARRI LogC4 (AWG4)",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "Single fixed encoding — not EI-dependent. Distinct curve/gamut from LogC3; don't mix.",
};
const ARRI_LOGC3: AcesIdt = {
  label: "ARRI LogC3 (AWG3) · EI-dependent",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "LogC3 curve changes with Exposure Index — match the IDT EI to the shooting EI (EI800 is the common default). ACES 2.0 collapses the per-EI entries into one parameterized transform.",
};
const SONY_SLOG3: AcesIdt = {
  label: "Sony S-Log3 / S-Gamut3.Cine",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "Pick S-Gamut3.Cine — NOT plain S-Gamut3 (different gamut IDTs). VENICE-specific CTLs also exist; the unified transform is preferred.",
};
const RED_LOG3G10: AcesIdt = {
  label: "RED Log3G10 / REDWideGamutRGB (IPP2)",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "IPP2-aligned. Legacy REDcolor / REDlogFilm clips use a different IDT. For .R3D, Resolve can decode RAW straight to ACES with no separate IDT.",
};
const CANON_CLOG2: AcesIdt = {
  label: "Canon Log 2 / Cinema Gamut",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "Canon Log 2 ≠ Canon Log 3 — match BOTH the log and the gamut to what the camera recorded (a common mismatch).",
};
const CANON_CLOG3: AcesIdt = {
  label: "Canon Log 3 / Cinema Gamut",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "Canon Log 3 ≠ Canon Log 2 — use the Log 3 IDT for footage shot in CLog3 (e.g. EOS R5 C).",
};
const BMD_FILM_GEN5: AcesIdt = {
  label: "Blackmagic Film Gen 5 / BMD Wide Gamut",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "Official Blackmagic Design Film Gen 5 IDT (URSA Cine / Pocket). For BRAW, Resolve can also decode straight to ACES.",
};
const NIKON_NLOG: AcesIdt = {
  label: "Nikon N-Log (third-party IDT)",
  official: false,
  mapsInto: "ACES2065-1 / AP0 (via third-party)",
  note: "No official core ACES IDT for Nikon. Any transform is community / vendor (DCTL / CLF) — validate against a known reference chart before trusting it.",
};
const FUJI_FLOG2: AcesIdt = {
  label: "Fujifilm F-Log2 (third-party IDT)",
  official: false,
  mapsInto: "ACES2065-1 / AP0 (via third-party)",
  note: "No official core ACES IDT for Fujifilm. GFX100 II records F-Log2 (F-Log2C on newer firmware) — match the third-party transform to the exact variant.",
};
const APPLE_LOG: AcesIdt = {
  label: "Apple Log",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "Official core ACES IDT (Apple Log / Apple Log 2). Only applies to true Apple Log capture — plain ProRes has no log to invert.",
};
const FILM_SCAN: AcesIdt = {
  label: "Film scan — ADX / printing density",
  official: true,
  mapsInto: "ACES2065-1 / AP0",
  note: "Scanned film uses an ADX (printing-density) transform, not a camera-log IDT.",
};
const UNKNOWN_IDT: AcesIdt = {
  label: "Set per your capture format",
  official: false,
  mapsInto: "ACES2065-1 / AP0",
  note: "No log encoding identified for this source — choose the IDT that matches how it was recorded.",
};

/** Resolve the IDT from a source's colour science (OETF first, then camera name). */
export function acesIdtForSource(source: SourceFormat): AcesIdt {
  const oetf = (source.oetf ?? "").toLowerCase();
  const cam = source.camera.toLowerCase();
  if (oetf.includes("logc4")) return ARRI_LOGC4;
  if (oetf.includes("logc3")) return ARRI_LOGC3;
  if (oetf.includes("s-log3")) return SONY_SLOG3;
  if (oetf.includes("log3g10")) return RED_LOG3G10;
  if (oetf.includes("canon log 3")) return CANON_CLOG3;
  if (oetf.includes("canon log 2")) return CANON_CLOG2;
  if (oetf.includes("film gen 5")) return BMD_FILM_GEN5;
  if (/nikon|z9|z8/.test(cam)) return NIKON_NLOG;
  if (/fuji|gfx/.test(cam)) return FUJI_FLOG2;
  if (/iphone|apple/.test(cam)) return APPLE_LOG;
  if (/film|35mm|65mm/.test(cam)) return FILM_SCAN;
  return UNKNOWN_IDT;
}

// ---- Output Transforms (ODTs) ---------------------------------------------
const SDR_REC709: AcesOdt = {
  label2: "Rec.709 (SDR, 100 nit, BT.1886)",
  label13: "Rec.709 (BT.1886)",
  display: "Rec.709",
  eotf: "BT.1886",
  peakNits: "100",
};
const HDR10_PQ: AcesOdt = {
  label2: "Rec.2100 PQ (1000 nit)",
  label13: "Rec.2020 ST2084 (1000 nit)",
  display: "Rec.2100 (often P3-D65-limited in practice)",
  eotf: "PQ / ST.2084",
  peakNits: "1000",
  note: "HDR10 and HDR10+ use the SAME Output Transform — dynamic metadata is added downstream. PQ also ships at 500 / 2000 / 4000 nit.",
};
const HLG_ODT: AcesOdt = {
  label2: "HLG (1000 nit, P3-D65-limited)",
  label13: "Rec.2020 HLG",
  display: "Rec.2100 container · P3-D65-limited",
  eotf: "HLG (BT.2100)",
  peakNits: "1000",
  note: "ACES 2.0 ships HLG only at 1000 nit, P3-limited (D65 and ACES/D60 creative-white variants) — there is no full Rec.2020-primaries HLG output.",
};
const DV_PQ: AcesOdt = {
  label2: "Rec.2100 PQ (1000–4000 nit · match mastering display)",
  label13: "Rec.2020 ST2084 (match master)",
  display: "Rec.2100",
  eotf: "PQ / ST.2084",
  peakNits: "1000–4000",
  note: "ACES renders only the PQ mastering pass at your mastering-display peak. Dolby Vision L1 analysis + L2/L8 trims (toward targets like SDR Rec.709 100nit, P3 48nit, PQ 108nit) happen downstream in DV tooling.",
};
const DCI_THEATRICAL: AcesOdt = {
  label2: "P3-D65 48 nit (γ2.6) → DCDM (XYZ-E)",
  label13: "P3-D65 / DCDM",
  display: "P3-D65 → XYZ-E (DCDM)",
  eotf: "gamma 2.6",
  peakNits: "48",
  note: "Theatrical DCP: grade to P3-D65 at 48 nit / γ2.6, then encode to DCDM (XYZ-E). A high-luminance DCDM is 300 nit PQ, not γ2.6.",
};

/** Resolve the Output Transform from the chosen HDR variant + delivery target. */
export function acesOdtFor(hdrVariant: string, targetName: string): AcesOdt {
  const h = hdrVariant.toLowerCase();
  if (h.includes("dolby")) return DV_PQ;
  if (h.includes("hdr10")) return HDR10_PQ; // HDR10 and HDR10+
  if (h.includes("hlg")) return HLG_ODT;
  if (/dci/i.test(targetName)) return DCI_THEATRICAL; // SDR theatrical
  return SDR_REC709;
}

// ---- Working spaces (constant) --------------------------------------------
const GRADE: AcesWorkingSpace = {
  name: "ACEScct",
  use: "Grade — log curve with a linear toe in the shadows (ACEScc has no toe → harsher lift); the usual colourist pick.",
};
const VFX: AcesWorkingSpace = {
  name: "ACEScg",
  use: "VFX / CG — linear on AP1 for compositing & rendering.",
};
const INTERCHANGE: AcesWorkingSpace = {
  name: "ACES2065-1 (AP0)",
  use: "Interchange & archival — the designated ACES handoff/archival encoding (linear AP0). Carried as OpenEXR / SMPTE ST 2065-4 ACES container; tag it AP0, since EXR alone doesn't pin the encoding.",
};

/** Full reference pipeline for a source + delivery + ACES version. */
export function acesPipeline(
  source: SourceFormat,
  hdrVariant: string,
  targetName: string,
  version: AcesVersion,
): AcesPipeline {
  return {
    version,
    idt: acesIdtForSource(source),
    grade: GRADE,
    vfx: VFX,
    interchange: INTERCHANGE,
    odt: acesOdtFor(hdrVariant, targetName),
  };
}

export const ACES_VERSION_NOTE: Record<AcesVersion, string> = {
  "2.0": "Single hue-preserving CAM-based Output Transform (Hellwig 2022 / JMh). Renders extreme & saturated colour gracefully and keeps SDR and HDR matched. The default for new work.",
  "1.3": "Proven two-stage RRT + per-display ODT, plus the Reference Gamut Compression (RGC). Still the most widely deployed baseline across facilities and archived projects.",
};

/** Cross-version warning every colourist will want surfaced. */
export const ACES_INTEROP_WARNING =
  "Reference only — PostSup Tools doesn't apply these; set them in your grading app. Exact menu names vary by app & version. A shot graded under 1.3 looks different under 2.0 — don't switch versions mid-project.";
