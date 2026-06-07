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
export type MasteringStrategy = "hdr-first" | "theatrical-first" | "dual-hero" | "custom";

/** Which master is graded first in a custom build. */
export type CustomHero = "streaming-hdr" | "theatrical" | "broadcast";
/** Deliverable families a custom build can include. */
export type CustomDeliverable = "hdr" | "theatrical" | "sdr" | "archive" | "proxies";
export interface CustomConfig {
  hero: CustomHero;
  deliverables: CustomDeliverable[];
}
export const CUSTOM_DELIVERABLES: { id: CustomDeliverable; label: string }[] = [
  { id: "hdr", label: "Streaming HDR (Dolby Vision + HDR10)" },
  { id: "theatrical", label: "Theatrical DCP (4K + 2K)" },
  { id: "sdr", label: "SDR Rec.709 / Broadcast HD" },
  { id: "archive", label: "ACES archive (App 5 + NAM)" },
  { id: "proxies", label: "Viewing proxies" },
];
export const CUSTOM_HEROES: { id: CustomHero; label: string }[] = [
  { id: "streaming-hdr", label: "HDR PQ (Dolby Vision)" },
  { id: "theatrical", label: "DCI-P3 theatrical" },
  { id: "broadcast", label: "SDR Rec.709" },
];

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
  /** Colourist-facing caveat, shown in the node side panel. */
  note?: string;
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

/** Node accent by deliverable role (shared with the editable builder). */
export const ROLE_ACCENT: Record<DeliverableRole, string> = {
  source: "#4ade80",          // green
  archive: "#a78bfa",         // violet
  "streaming-hdr": "#22d3ee", // cyan
  broadcast: "#94a3b8",       // slate
  theatrical: "#f59e0b",      // amber
  review: "#6b7280",          // gray
};

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
  {
    id: "custom",
    name: "Custom",
    hero: "You choose — pick the master you grade first and which deliverables to include.",
    when: "Your specific delivery list. The tree derives the order for you and flags any up-volume re-grade.",
    pros: "Models your exact project. Down-volume targets derive cleanly; the tool shows where a fresh grade is unavoidable.",
    cons: "Can't beat physics — a master above the hero's dynamic range is still a fresh re-grade off the archive (flagged red).",
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
  hdr10: (): MNode => ({ id: "hdr10", type: "master", label: "HDR10 master", colourspace: "Rec.2020 (P3-D65 content)", eotf: "PQ / ST.2084", peakNits: "1000", container: "+L6 MaxCLL/MaxFALL (content-measured)", role: "streaming-hdr", lane: "masters" , note: "Audio −27 LKFS dialog-gated. MaxCLL/MaxFALL are measured from content — many specs cap the MaxCLL target near 1000 nit, so don't read the scaled peak as a hard delivery spec." }),
  sdr: (): MNode => ({ id: "sdr", type: "master", label: "SDR Rec.709 master", colourspace: "Rec.709", eotf: "BT.1886", peakNits: "100", role: "broadcast", lane: "masters" , note: "Audio −23 LUFS (EBU R128) / −24 LKFS (ATSC A/85)." }),
  dcdm4k: (lane: Lane, hero = false): MNode => ({ id: "dcdm4k", type: hero ? "hero" : "master", label: hero ? "DCDM hero (theatrical)" : "DCDM 4K", colourspace: "X′Y′Z′", eotf: "gamma 2.6", peakNits: "48", container: "12-bit TIFF · ST 428-1", role: "theatrical", lane, isHero: hero, acesManaged: hero }),
  dcdm2k: (): MNode => ({ id: "dcdm2k", type: "master", label: "DCDM 2K", colourspace: "X′Y′Z′", eotf: "gamma 2.6", peakNits: "48", container: "12-bit TIFF", role: "theatrical", lane: "masters" }),
  imf2e: (): MNode => ({ id: "imf2e", type: "deliverable", label: "IMF App 2E (DV) 4K", colourspace: "Rec.2020 PQ", eotf: "PQ / ST.2084", peakNits: "1000", container: "J2K/MXF · ST 2067-21", role: "streaming-hdr", lane: "deliverables" , note: "Audio loudness: −27 LKFS dialog-gated, ≤ −2 dBTP (Netflix) — confirm per platform." }),
  imfsdr: (): MNode => ({ id: "imfsdr", type: "deliverable", label: "IMF App 2E — SDR (Rec.709)", colourspace: "Rec.709", eotf: "BT.1886", peakNits: "100", container: "J2K/MXF · ST 2067-21", role: "broadcast", lane: "deliverables" , note: "Audio loudness: −23 LUFS / R128 (≤ −1 dBTP), or −24 LKFS / ATSC A/85 (US)." }),
  dcp4k: (): MNode => ({ id: "dcp4k", type: "deliverable", label: "DCP 4K", colourspace: "XYZ", eotf: "gamma 2.6", peakNits: "48", container: "J2K/MXF · ST 429", role: "theatrical", lane: "deliverables" , note: "Theatrical mix at reference level (85 dB SPL @ −20 dBFS) — no LKFS normalisation; trailers per TASA Leq(m)." }),
  dcp2k: (): MNode => ({ id: "dcp2k", type: "deliverable", label: "DCP 2K", colourspace: "XYZ", eotf: "gamma 2.6", peakNits: "48", container: "J2K/MXF", role: "theatrical", lane: "deliverables" , note: "Theatrical mix at reference level — no LKFS normalisation." }),
  revhdr: (): MNode => ({ id: "revhdr", type: "viewing", label: "HDR review proxy", colourspace: "Rec.2020 PQ", eotf: "PQ", peakNits: null, container: "H.265", role: "review", lane: "viewing" }),
  revsdr: (): MNode => ({ id: "revsdr", type: "viewing", label: "SDR screener", colourspace: "Rec.709", eotf: "gamma 2.4", peakNits: null, container: "H.264", role: "review", lane: "viewing" }),
};

/** Representative nodes for the editable-builder palette (one per master/deliverable). */
export const MASTERING_PALETTE_NODES: MNode[] = [
  N.arch(), N.nam(),
  N.hdrHero(false), N.dvxml(), N.hdr10(), N.sdr(),
  N.dcdm4k("masters"), N.dcdm2k(),
  N.imf2e(), N.imfsdr(), N.dcp4k(), N.dcp2k(),
  N.revhdr(), N.revsdr(),
];

const OT_PQ = { hdrVariant: "Dolby Vision P8.1", targetName: "UHD 4K" };
const OT_DCI = { hdrVariant: "SDR", targetName: "DCI 4K Scope" };

// The HDR derive-down chain (shared by every strategy once a PQ hero exists).
function hdrDeriveEdges(heroId: string): MEdge[] {
  return [
    { from: heroId, to: "dvxml", op: "analyze", label: "Dolby Vision L1 analysis (min/avg/max)", direction: "lateral", acesManaged: false },
    { from: heroId, to: "dvxml", op: "trim", label: "TID1 trim → SDR Rec.709 100-nit (required first; foundation for the trim ladder)", direction: "down-volume", acesManaged: false },
    { from: heroId, to: "hdr10", op: "cm-derive", label: "Content-map → HDR10 (L1 + L6 static)", direction: "lateral", acesManaged: false },
    { from: "dvxml", to: "hdr10", op: "embed", label: "L6 MaxCLL/MaxFALL drives HDR10", direction: "lateral", acesManaged: false },
    { from: heroId, to: "sdr", op: "cm-derive", label: "DV TID1 map → SDR Rec.709 100 nit (+ manual per-shot trims)", direction: "down-volume", acesManaged: false },
    { from: "dvxml", to: "sdr", op: "trim", label: "L8/L2 TID1 trim drives the SDR derive", direction: "down-volume", acesManaged: false },
    { from: heroId, to: "imf2e", op: "wrap", label: "Wrap PQ essence → IMF App 2E CPL (J2K/MXF)", direction: "lateral", acesManaged: false },
    { from: "dvxml", to: "imf2e", op: "embed", label: "Embed DV metadata, CMVersion [4 1]", direction: "lateral", acesManaged: false },
    { from: "sdr", to: "imfsdr", op: "wrap", label: "Wrap → IMF App 2E SDR (Rec.709) CPL", direction: "lateral", acesManaged: false },
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
    { from: "arch", to: "dcdm4k", op: "regrade", label: "Dedicated theatrical trim off archive → P3-D65 48 nit γ2.6 (fresh grade, not math)", direction: "down-volume", acesManaged: false },
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

export const MASTER_NITS = [1000, 2000, 4000] as const;
export type MasterNits = (typeof MASTER_NITS)[number];

// Colourist-facing notes (the points a reviewing colourist would raise).
const NODE_NOTES: Record<string, string> = {
  hdrHero: "Master to your grading display's peak. 1000 nit is the common house standard; 2000/4000 are used for premium HDR. Pick the value that matches the actual mastering monitor.",
  hdr10: "Same ACES Output Transform as Dolby Vision; carries +L6 MaxCLL/MaxFALL static metadata. HDR10+ is NOT free — it needs its own analysis/trim pass.",
  sdr: "Not a pure conversion: the Dolby Vision TID1 (Rec.709 100-nit) auto-map gets manual L2/L8 per-shot trims for key scenes. Budget a colourist QC pass.",
  dcdm4k: "Cinema wants a DEDICATED 48-nit theatrical trim (especially for laser projectors) graded off the ACES archive — not a tone-map down from the HDR master. Confirm with your post house / Dolby CMU.",
};
// HDR streaming masters whose peak follows the chosen mastering-display nits.
const NITS_NODES = new Set(["hdrHero", "hdr10", "imf2e"]);

/** Build the mastering DAG for a strategy, resolving OT edge labels from the
 *  ACES fixtures for the chosen ACES version and the mastering-display peak. */
export function buildMasterGraph(
  strategy: MasteringStrategy,
  version: AcesVersion,
  masterNits: MasterNits = 1000,
): MasterGraph {
  const base =
    strategy === "hdr-first" ? buildHdrFirst()
    : strategy === "theatrical-first" ? buildTheatricalFirst()
    : buildDualHero();
  const nodes = base.nodes.map((n) => ({
    ...n,
    peakNits: NITS_NODES.has(n.id) && n.role === "streaming-hdr" ? String(masterNits) : n.peakNits,
    note: NODE_NOTES[n.id] ?? n.note,
  }));
  const edges = base.edges.map((e) => {
    if (!e.ot) return e;
    const odt = acesOdtFor(e.ot.hdrVariant, e.ot.targetName);
    const isPq = e.ot.hdrVariant.toLowerCase().includes("dolby");
    return {
      ...e,
      label: `ACES OT → ${version === "2.0" ? odt.label2 : odt.label13}${isPq ? ` @ ${masterNits} nit` : ""}`,
      warning: ACES_INTEROP_WARNING,
    };
  });
  return { strategy, version, nodes, edges };
}

function otLabel(variant: string, target: string, version: AcesVersion, nits?: number): string {
  const odt = acesOdtFor(variant, target);
  const isPq = variant.toLowerCase().includes("dolby");
  return `ACES OT → ${version === "2.0" ? odt.label2 : odt.label13}${isPq && nits ? ` @ ${nits} nit` : ""}`;
}

/** Build a custom mastering DAG from a chosen hero + deliverable set. The derive
 *  direction follows the dynamic-range rules (down-volume derives; up-volume is a
 *  fresh re-grade off the archive, flagged), so the order is computed, not arbitrary. */
export function buildCustomGraph(
  cfg: CustomConfig,
  version: AcesVersion,
  masterNits: MasterNits = 1000,
): MasterGraph {
  const want = new Set(cfg.deliverables);
  const heroIsHdr = cfg.hero === "streaming-hdr";
  const heroIsTheatrical = cfg.hero === "theatrical";
  const heroIsSdr = cfg.hero === "broadcast";

  const nodes: MNode[] = [];
  const edges: MEdge[] = [];
  const add = (n: MNode) => { if (!nodes.some((x) => x.id === n.id)) nodes.push(n); };
  const pq = (n: MNode): MNode => ({ ...n, peakNits: String(masterNits) });

  add(N.grade());

  // A PQ master exists if HDR is wanted OR the hero is HDR.
  const hasPq = want.has("hdr") || heroIsHdr;
  // The archive is needed for any up-volume / dedicated regrade, or if requested.
  const needArch =
    want.has("archive") ||
    (want.has("theatrical") && !heroIsTheatrical) ||
    (hasPq && !heroIsHdr) ||
    (want.has("sdr") && heroIsTheatrical && !hasPq);
  if (needArch) {
    add(N.arch());
    edges.push({ from: "grade", to: "arch", op: "render-archive", label: "Bake graded ACEScct → AP0 EXR (App 5)", direction: "lateral", acesManaged: true });
    if (want.has("archive")) {
      add(N.nam());
      edges.push({ from: "grade", to: "nam", op: "render-archive", label: "Flat pass, OT off → ACES2065-1 AP0 EXR", direction: "lateral", acesManaged: true });
    }
  }

  // --- Hero node + its OT edge ---------------------------------------------
  if (heroIsHdr) {
    add(pq({ ...N.hdrHero(true) }));
    edges.push({ from: "grade", to: "hdrHero", op: "output-transform", label: otLabel("Dolby Vision P8.1", "UHD 4K", version, masterNits), direction: "lateral", acesManaged: true, warning: ACES_INTEROP_WARNING });
  } else if (heroIsTheatrical) {
    add(N.dcdm4k("hero", true));
    edges.push({ from: "grade", to: "dcdm4k", op: "output-transform", label: otLabel("SDR", "DCI 4K Scope", version), direction: "lateral", acesManaged: true, warning: ACES_INTEROP_WARNING });
  } else {
    add({ ...N.sdr(), type: "hero", lane: "hero", isHero: true, acesManaged: true });
    edges.push({ from: "grade", to: "sdr", op: "output-transform", label: otLabel("SDR", "UHD 4K", version), direction: "lateral", acesManaged: true, warning: ACES_INTEROP_WARNING });
  }

  // --- Streaming HDR family ------------------------------------------------
  if (hasPq) {
    if (!heroIsHdr) {
      add(pq({ ...N.hdrHero(false), lane: "masters" }));
      edges.push({ from: "arch", to: "hdrHero", op: "regrade", label: "UP-VOLUME regrade off archive → P3-D65 PQ (fresh grade, not math)", direction: "up-volume", acesManaged: false });
    }
    if (want.has("hdr")) {
      add(N.dvxml()); add(pq(N.hdr10())); add(pq(N.imf2e()));
      edges.push(
        { from: "hdrHero", to: "dvxml", op: "analyze", label: "Dolby Vision L1 analysis (min/avg/max)", direction: "lateral", acesManaged: false },
        { from: "hdrHero", to: "dvxml", op: "trim", label: "TID1 trim → SDR Rec.709 100-nit (required first; foundation for the trim ladder)", direction: "down-volume", acesManaged: false },
        { from: "hdrHero", to: "hdr10", op: "cm-derive", label: "Content-map → HDR10 (L1 + L6 static)", direction: "lateral", acesManaged: false },
        { from: "dvxml", to: "hdr10", op: "embed", label: "L6 MaxCLL/MaxFALL drives HDR10", direction: "lateral", acesManaged: false },
        { from: "hdrHero", to: "imf2e", op: "wrap", label: "Wrap PQ essence → IMF App 2E CPL (J2K/MXF)", direction: "lateral", acesManaged: false },
        { from: "dvxml", to: "imf2e", op: "embed", label: "Embed DV metadata, CMVersion [4 1]", direction: "lateral", acesManaged: false },
      );
      if (want.has("proxies")) { add(N.revhdr()); edges.push({ from: "hdrHero", to: "revhdr", op: "transcode", label: "H.265 HDR review proxy (no new OT)", direction: "lateral", acesManaged: false }); }
    }
  }

  // --- SDR family ----------------------------------------------------------
  if (want.has("sdr") && !heroIsSdr) {
    add(N.sdr()); add(N.imfsdr());
    if (hasPq) {
      edges.push(
        { from: "hdrHero", to: "sdr", op: "cm-derive", label: "DV TID1 map → SDR Rec.709 100 nit (+ manual per-shot trims)", direction: "down-volume", acesManaged: false },
        { from: "dvxml", to: "sdr", op: "trim", label: "L8/L2 TID1 trim drives the SDR derive", direction: "down-volume", acesManaged: false },
      );
    } else {
      edges.push({ from: "arch", to: "sdr", op: "regrade", label: "SDR trim off archive → Rec.709 100 nit (dim-surround, fresh grade)", direction: "down-volume", acesManaged: false });
    }
    edges.push({ from: "sdr", to: "imfsdr", op: "wrap", label: "Wrap → IMF App 2E SDR (Rec.709) CPL", direction: "lateral", acesManaged: false });
    if (want.has("proxies")) { add(N.revsdr()); edges.push({ from: "sdr", to: "revsdr", op: "transcode", label: "H.264 SDR screener (no new OT)", direction: "lateral", acesManaged: false }); }
  } else if (heroIsSdr && want.has("proxies")) {
    add(N.revsdr()); edges.push({ from: "sdr", to: "revsdr", op: "transcode", label: "H.264 SDR screener (no new OT)", direction: "lateral", acesManaged: false });
  }

  // --- Theatrical family ---------------------------------------------------
  if (want.has("theatrical")) {
    if (heroIsTheatrical) {
      add(N.dcdm2k()); add(N.dcp4k()); add(N.dcp2k());
      edges.push(
        { from: "dcdm4k", to: "dcp4k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 4K (ST 429)", direction: "lateral", acesManaged: false },
        { from: "dcdm4k", to: "dcdm2k", op: "downscale", label: "4K → 2K DCI", direction: "lateral", acesManaged: false },
        { from: "dcdm2k", to: "dcp2k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 2K", direction: "lateral", acesManaged: false },
      );
    } else {
      add(N.dcdm4k("masters")); add(N.dcdm2k()); add(N.dcp4k()); add(N.dcp2k());
      edges.push(
        { from: "arch", to: "dcdm4k", op: "regrade", label: "Dedicated theatrical trim off archive → P3-D65 48 nit γ2.6 (fresh grade, not math)", direction: "down-volume", acesManaged: false },
        { from: "dcdm4k", to: "dcdm2k", op: "downscale", label: "4K → 2K DCI", direction: "lateral", acesManaged: false },
        { from: "dcdm4k", to: "dcp4k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 4K (ST 429)", direction: "lateral", acesManaged: false },
        { from: "dcdm2k", to: "dcp2k", op: "wrap", label: "JPEG2000 + MXF wrap → DCP 2K", direction: "lateral", acesManaged: false },
      );
    }
  }

  // Apply colourist notes.
  const finalNodes = nodes.map((n) => ({ ...n, note: NODE_NOTES[n.id] ?? n.note }));
  return { strategy: "custom", version, nodes: finalNodes, edges };
}

// ============================================================================
// Make-order summary — the grade passes a custom config implies, classified by
// HOW the DAG actually produces each master family. Read straight off
// buildCustomGraph's output (not a parallel rule-set) so the two can never
// drift: an Output Transform off the grade is the hero pass; a `regrade` edge is
// a FRESH pass (an up-volume master, or a dedicated dark-surround trim off the
// archive); a content-map / trim is a clean down-volume derive. The Deliverables
// make-plan reads this, so its make-order obeys the same doctrine as this tab.
// ============================================================================
export type MakeStepKind = "hero" | "derive" | "regrade";
export type MasterFamily = "streaming-hdr" | "theatrical" | "broadcast";
export interface MakeStep { family: MasterFamily; kind: MakeStepKind; flag: boolean; }

/** The master node that represents each delivered family in the custom DAG. */
const FAMILY_NODE: Record<MasterFamily, string> = {
  "streaming-hdr": "hdrHero",
  theatrical: "dcdm4k",
  broadcast: "sdr",
};

export function makeOrder(cfg: CustomConfig, version: AcesVersion = "2.0", masterNits: MasterNits = 1000): MakeStep[] {
  const g = buildCustomGraph(cfg, version, masterNits);
  const families: MasterFamily[] = ["streaming-hdr", "theatrical", "broadcast"];
  const steps: MakeStep[] = [];
  for (const family of families) {
    const nodeId = FAMILY_NODE[family];
    if (!g.nodes.some((n) => n.id === nodeId)) continue; // family not in this delivery
    const inbound = g.edges.filter((e) => e.to === nodeId);
    // The pixel op that produces this master: OT (hero) > regrade (fresh) > derive.
    const prod =
      inbound.find((e) => e.op === "output-transform") ??
      inbound.find((e) => e.op === "regrade") ??
      inbound.find((e) => e.op === "cm-derive" || e.op === "trim" || e.op === "downscale");
    const kind: MakeStepKind =
      !prod || prod.op === "output-transform" ? "hero"
      : prod.op === "regrade" ? "regrade"
      : "derive";
    steps.push({ family, kind, flag: kind === "regrade" });
  }
  const rank: Record<MakeStepKind, number> = { hero: 0, derive: 1, regrade: 2 };
  return steps.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
