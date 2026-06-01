import { AcesVersion, acesOdtFor, ACES_INTEROP_WARNING } from "./aces";

// ============================================================================
// Mastering Workflow — a deliverables DAG, modelled as a VIEW over the ACES
// layer. Output-transform edge labels are pulled from the existing AcesOdt
// fixtures (never free-typed) so this stays consistent with the ACES tab.
//
// Doctrine (verified vs Netflix Partner Help, Dolby, SMPTE): grade HDR high
// (PQ ≥1000 nit) and trim DOWN — SDR / HDR10 are derives. Going UP-volume
// (theatrical 48-nit → HDR PQ) is a FRESH regrade off the ACES archive, never
// a clean transform — flagged on the graph.
// ============================================================================

export type Lane = "grade" | "archive" | "hero" | "masters" | "deliverables" | "viewing";
export type MNodeType = "grade" | "archive" | "hero" | "master" | "sidecar" | "deliverable" | "viewing";
export type DeliverableRole = "source" | "archive" | "streaming-hdr" | "broadcast" | "theatrical" | "review";
export type EdgeOp =
  | "grade" | "render-archive" | "output-transform" | "analyze" | "trim"
  | "cm-derive" | "colour-convert" | "regrade" | "downscale"
  | "wrap" | "embed" | "transcode" | "reference-match";
export type EdgeDirection = "down-volume" | "lateral" | "up-volume";
export type MasteringStrategy = "hdr-first" | "theatrical-first" | "dual-hero";

export interface MNode {
  id: string;
  type: MNodeType;
  label: string;
  colourspace: string;
  eotf: string;
  peakNits: string | null;
  container?: string;
  role: DeliverableRole;
  lane: Lane;
  isHero?: boolean;
  /** True up to & including the Output Transform; false downstream (DV/encode). */
  acesManaged?: boolean;
}

export interface MEdge {
  from: string;
  to: string;
  op: EdgeOp;
  label: string;
  direction: EdgeDirection;
  acesManaged: boolean;
  /** Output-transform edge — label resolved from the AcesOdt fixtures. */
  ot?: { hdrVariant: string; targetName: string };
  warning?: string;
}

export interface MasterGraph {
  strategy: MasteringStrategy;
  version: AcesVersion;
  nodes: MNode[];
  edges: MEdge[];
}

export const LANES: { id: Lane; label: string }[] = [
  { id: "grade", label: "Grade" },
  { id: "archive", label: "Archive" },
  { id: "hero", label: "Hero" },
  { id: "masters", label: "Masters" },
  { id: "deliverables", label: "Deliverables" },
  { id: "viewing", label: "Viewing" },
];

export const STRATEGIES: {
  id: MasteringStrategy; name: string; hero: string; when: string; pros: string; cons: string;
}[] = [
  {
    id: "hdr-first",
    name: "HDR-First",
    hero: "Dolby Vision PQ (P3-D65, ≥1000 nit)",
    when: "Most streaming originals — HDR is the primary audience, SDR a guaranteed secondary. The Netflix/Dolby default.",
    pros: "One hero grade + metadata yields all home deliverables; SDR/HDR10 are clean down-volume derives; least re-grading.",
    cons: "A contractually-finessed SDR still needs per-shot review. Theatrical, if required, re-grades from the archive (not free).",
  },
  {
    id: "theatrical-first",
    name: "Theatrical-First",
    hero: "DCI-P3 48-nit DCDM (γ2.6, dark surround)",
    when: "Theatrical-first features, festival / awards timelines, director wants the cinema look locked as the reference.",
    pros: "Protects the cinema look in its native dark-surround condition; matches DCP delivery reality.",
    cons: "You grade twice — the HDR home master is a fresh regrade off the archive, not a derive; risk of the two looks drifting.",
  },
  {
    id: "dual-hero",
    name: "Dual-Hero",
    hero: "Two heroes: Dolby Vision PQ + DCI-P3 DCDM (reference-matched)",
    when: "Tentpole / studio features delivering theatrical AND streaming HDR both at hero quality.",
    pros: "Each domain graded in its own viewing condition; no lossy up-volume derive; cleanest creative result.",
    cons: "Most expensive — two real grades plus match passes; two master families to QC and archive.",
  },
];

export const EDGE_OP_META: Record<EdgeOp, { label: string; style: "solid" | "dashed" | "dotted"; pixel: boolean }> = {
  "grade": { label: "Grade", style: "solid", pixel: true },
  "render-archive": { label: "Render archive (OT off)", style: "solid", pixel: true },
  "output-transform": { label: "ACES Output Transform", style: "solid", pixel: true },
  "analyze": { label: "Dolby Vision L1 analysis", style: "dotted", pixel: false },
  "trim": { label: "Dolby Vision trim", style: "dotted", pixel: false },
  "cm-derive": { label: "Content-map / tone-map down", style: "solid", pixel: true },
  "colour-convert": { label: "Colour convert", style: "solid", pixel: true },
  "regrade": { label: "Regrade (fresh grade)", style: "solid", pixel: true },
  "downscale": { label: "Downscale", style: "solid", pixel: true },
  "wrap": { label: "Wrap (no pixel change)", style: "dashed", pixel: false },
  "embed": { label: "Embed metadata", style: "dotted", pixel: false },
  "transcode": { label: "Transcode (proxy)", style: "dashed", pixel: false },
  "reference-match": { label: "Look match (not automated)", style: "dashed", pixel: false },
};

// --- Shared nodes -----------------------------------------------------------
const N = {
  grade: (): MNode => ({ id: "grade", type: "grade", label: "Grade / DSM", colourspace: "ACEScct", eotf: "Scene-linear (log)", peakNits: null, role: "source", lane: "grade", acesManaged: true }),
  nam: (): MNode => ({ id: "nam", type: "archive", label: "NAM archival", colourspace: "ACES2065-1 / AP0", eotf: "Linear", peakNits: null, container: "OpenEXR 16-bit", role: "archive", lane: "archive", acesManaged: true }),
  arch: (): MNode => ({ id: "arch", type: "archive", label: "Graded ACES archive", colourspace: "ACES2065-1 / AP0", eotf: "Linear", peakNits: null, container: "IMF App 5 · ST 2067-50", role: "archive", lane: "archive", acesManaged: true }),
  hdrHero: (hero: boolean): MNode => ({ id: "hdrHero", type: hero ? "hero" : "master", label: "HDR PQ master", colourspace: "P3-D65 (Rec.2020 container)", eotf: "PQ / ST.2084", peakNits: "1000–4000", role: "streaming-hdr", lane: "hero", isHero: hero, acesManaged: true }),
  dvxml: (): MNode => ({ id: "dvxml", type: "sidecar", label: "Dolby Vision XML", colourspace: "metadata", eotf: "—", peakNits: null, container: "XML · CMv4.0 [4 1]", role: "streaming-hdr", lane: "hero" }),
  hdr10: (): MNode => ({ id: "hdr10", type: "master", label: "HDR10 master", colourspace: "Rec.2020 (P3-D65 content)", eotf: "PQ / ST.2084", peakNits: "1000", container: "+L6 MaxCLL/MaxFALL", role: "streaming-hdr", lane: "masters" }),
  sdr: (): MNode => ({ id: "sdr", type: "master", label: "SDR Rec.709 master", colourspace: "Rec.709", eotf: "BT.1886", peakNits: "100", role: "broadcast", lane: "masters" }),
  dcdm4k: (lane: Lane, hero = false): MNode => ({ id: "dcdm4k", type: hero ? "hero" : "master", label: hero ? "DCDM hero (theatrical)" : "DCDM 4K", colourspace: "X′Y′Z′", eotf: "gamma 2.6", peakNits: "48", container: "12-bit TIFF · ST 428-1", role: "theatrical", lane, isHero: hero, acesManaged: hero }),
  dcdm2k: (): MNode => ({ id: "dcdm2k", type: "master", label: "DCDM 2K", colourspace: "X′Y′Z′", eotf: "gamma 2.6", peakNits: "48", container: "12-bit TIFF", role: "theatrical", lane: "masters" }),
  imf2e: (): MNode => ({ id: "imf2e", type: "deliverable", label: "IMF App 2E (DV) 4K", colourspace: "Rec.2020 PQ", eotf: "PQ / ST.2084", peakNits: "1000", container: "J2K/MXF · ST 2067-21", role: "streaming-hdr", lane: "deliverables" }),
  imfsdr: (): MNode => ({ id: "imfsdr", type: "deliverable", label: "IMF App 2 SDR / Broadcast HD", colourspace: "Rec.709", eotf: "BT.1886", peakNits: "100", container: "ST 2067-20", role: "broadcast", lane: "deliverables" }),
  dcp4k: (): MNode => ({ id: "dcp4k", type: "deliverable", label: "DCP 4K", colourspace: "XYZ", eotf: "gamma 2.6", peakNits: "48", container: "J2K/MXF · ST 429", role: "theatrical", lane: "deliverables" }),
  dcp2k: (): MNode => ({ id: "dcp2k", type: "deliverable", label: "DCP 2K", colourspace: "XYZ", eotf: "gamma 2.6", peakNits: "48", container: "J2K/MXF", role: "theatrical", lane: "deliverables" }),
  revhdr: (): MNode => ({ id: "revhdr", type: "viewing", label: "HDR review proxy", colourspace: "Rec.2020 PQ", eotf: "PQ", peakNits: null, container: "H.265", role: "review", lane: "viewing" }),
  revsdr: (): MNode => ({ id: "revsdr", type: "viewing", label: "SDR screener", colourspace: "Rec.709", eotf: "gamma 2.4", peakNits: null, container: "H.264", role: "review", lane: "viewing" }),
};

const OT_PQ = { hdrVariant: "Dolby Vision P8.1", targetName: "UHD 4K" };
const OT_DCI = { hdrVariant: "SDR", targetName: "DCI 4K Scope" };

// The HDR derive-down chain (shared by every strategy once a PQ hero exists).
function hdrDeriveEdges(heroId: string): MEdge[] {
  return [
    { from: heroId, to: "dvxml", op: "analyze", label: "Dolby Vision L1 analysis (min/avg/max)", direction: "lateral", acesManaged: false },
    { from: heroId, to: "dvxml", op: "trim", label: "TID1 trim → SDR Rec.709 100 nit (first), +600 nit", direction: "down-volume", acesManaged: false },
    { from: heroId, to: "hdr10", op: "cm-derive", label: "Content-map → HDR10 (L1 + L6 static)", direction: "lateral", acesManaged: false },
    { from: "dvxml", to: "hdr10", op: "embed", label: "L6 MaxCLL/MaxFALL drives HDR10", direction: "lateral", acesManaged: false },
    { from: heroId, to: "sdr", op: "cm-derive", label: "DV TID1 metadata map → SDR Rec.709 100 nit", direction: "down-volume", acesManaged: false },
    { from: "dvxml", to: "sdr", op: "trim", label: "L8/L2 TID1 trim drives the SDR derive", direction: "down-volume", acesManaged: false },
    { from: heroId, to: "imf2e", op: "wrap", label: "Wrap PQ essence → IMF App 2E CPL (J2K/MXF)", direction: "lateral", acesManaged: false },
    { from: "dvxml", to: "imf2e", op: "embed", label: "Embed DV metadata, CMVersion [4 1]", direction: "lateral", acesManaged: false },
    { from: "sdr", to: "imfsdr", op: "wrap", label: "Wrap → IMF App 2 SDR / Broadcast HD CPL", direction: "lateral", acesManaged: false },
    { from: heroId, to: "revhdr", op: "transcode", label: "H.265 HDR review proxy (no new OT)", direction: "lateral", acesManaged: false },
    { from: "sdr", to: "revsdr", op: "transcode", label: "H.264 SDR screener (no new OT)", direction: "lateral", acesManaged: false },
  ];
}

function buildHdrFirst(): { nodes: MNode[]; edges: MEdge[] } {
  const nodes = [
    N.grade(), N.nam(), N.arch(), N.hdrHero(true), N.dvxml(), N.hdr10(), N.sdr(),
    N.dcdm4k("masters"), N.dcdm2k(), N.imf2e(), N.imfsdr(), N.dcp4k(), N.dcp2k(), N.revhdr(), N.revsdr(),
  ];
  const edges: MEdge[] = [
    { from: "grade", to: "nam", op: "render-archive", label: "Flat pass, OT off → ACES2065-1 AP0 EXR", direction: "lateral", acesManaged: true },
    { from: "grade", to: "arch", op: "render-archive", label: "Bake graded ACEScct → AP0 EXR (App 5)", direction: "lateral", acesManaged: true },
    { from: "grade", to: "hdrHero", op: "output-transform", label: "", direction: "lateral", acesManaged: true, ot: OT_PQ },
    ...hdrDeriveEdges("hdrHero"),
    { from: "arch", to: "dcdm4k", op: "regrade", label: "Theatrical REGRADE off archive → P3-D65 48 nit γ2.6 (fresh grade, not math)", direction: "down-volume", acesManaged: false },
    { from: "dcdm4k", to: "dcdm2k", op: "downscale", label: "4K → 2K DCI", direction: "lateral", acesManaged: false },
    { from: "dcdm4k", to: "dcp4k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 4K (ST 429)", direction: "lateral", acesManaged: false },
    { from: "dcdm2k", to: "dcp2k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 2K", direction: "lateral", acesManaged: false },
  ];
  return { nodes, edges };
}

function buildTheatricalFirst(): { nodes: MNode[]; edges: MEdge[] } {
  const nodes = [
    N.grade(), N.nam(), N.arch(), N.dcdm4k("hero", true), N.dcp4k(), N.dcp2k(),
    N.hdrHero(true), N.dvxml(), N.hdr10(), N.sdr(), N.imf2e(), N.imfsdr(), N.revhdr(), N.revsdr(),
  ];
  const edges: MEdge[] = [
    { from: "grade", to: "nam", op: "render-archive", label: "Flat pass, OT off → ACES2065-1 AP0 EXR", direction: "lateral", acesManaged: true },
    { from: "grade", to: "arch", op: "render-archive", label: "Bake graded ACEScct → AP0 EXR (App 5)", direction: "lateral", acesManaged: true },
    { from: "grade", to: "dcdm4k", op: "output-transform", label: "", direction: "lateral", acesManaged: true, ot: OT_DCI },
    { from: "dcdm4k", to: "dcp4k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 4K (ST 429)", direction: "lateral", acesManaged: false },
    { from: "dcdm4k", to: "dcp2k", op: "downscale", label: "4K → 2K DCI, then J2K/MXF wrap", direction: "lateral", acesManaged: false },
    { from: "arch", to: "hdrHero", op: "regrade", label: "UP-VOLUME regrade off archive → P3-D65 PQ 1000 nit (fresh grade, not math)", direction: "up-volume", acesManaged: false },
    ...hdrDeriveEdges("hdrHero"),
  ];
  return { nodes, edges };
}

function buildDualHero(): { nodes: MNode[]; edges: MEdge[] } {
  const dcdmHero = N.dcdm4k("hero", true);
  const nodes = [
    N.grade(), N.nam(), N.arch(), N.hdrHero(true), dcdmHero, N.dvxml(), N.hdr10(), N.sdr(),
    N.dcdm2k(), N.imf2e(), N.imfsdr(), N.dcp4k(), N.dcp2k(), N.revhdr(), N.revsdr(),
  ];
  const edges: MEdge[] = [
    { from: "grade", to: "nam", op: "render-archive", label: "Flat pass, OT off → ACES2065-1 AP0 EXR", direction: "lateral", acesManaged: true },
    { from: "grade", to: "arch", op: "render-archive", label: "Bake graded ACEScct → AP0 EXR (App 5)", direction: "lateral", acesManaged: true },
    { from: "grade", to: "hdrHero", op: "output-transform", label: "", direction: "lateral", acesManaged: true, ot: OT_PQ },
    { from: "grade", to: "dcdm4k", op: "output-transform", label: "", direction: "lateral", acesManaged: true, ot: OT_DCI },
    { from: "hdrHero", to: "dcdm4k", op: "reference-match", label: "Look match — dark-cinema ↔ dim-room (not automated)", direction: "lateral", acesManaged: false },
    ...hdrDeriveEdges("hdrHero"),
    { from: "dcdm4k", to: "dcdm2k", op: "downscale", label: "4K → 2K DCI", direction: "lateral", acesManaged: false },
    { from: "dcdm4k", to: "dcp4k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 4K (ST 429)", direction: "lateral", acesManaged: false },
    { from: "dcdm2k", to: "dcp2k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 2K", direction: "lateral", acesManaged: false },
  ];
  return { nodes, edges };
}

/** Build the mastering DAG for a strategy, resolving OT edge labels from the
 *  ACES fixtures for the chosen ACES version. */
export function buildMasterGraph(strategy: MasteringStrategy, version: AcesVersion): MasterGraph {
  const base =
    strategy === "hdr-first" ? buildHdrFirst()
    : strategy === "theatrical-first" ? buildTheatricalFirst()
    : buildDualHero();
  const edges = base.edges.map((e) => {
    if (!e.ot) return e;
    const odt = acesOdtFor(e.ot.hdrVariant, e.ot.targetName);
    return {
      ...e,
      label: `ACES OT → ${version === "2.0" ? odt.label2 : odt.label13}`,
      warning: ACES_INTEROP_WARNING,
    };
  });
  return { strategy, version, nodes: base.nodes, edges };
}
