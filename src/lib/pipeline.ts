// End-to-end production pipeline — a vertical staged DAG from camera test +
// show LUT through delivery and archive, with a parallel audio track. The
// Grade/Mastering stage folds in the existing Mastering deliverables DAG.
//
// Research-verified (Netflix Partner Help / SMPTE / ACES / Dolby), adversarially
// fact-checked. A planning VIEW, not an automated pipeline.

export type Track = "picture" | "audio" | "data";

export type PNodeKind =
  | "camera-original" | "report" | "look" | "dailies" | "manifest"
  | "vfx-plate" | "vfx-master" | "conform" | "grade" | "master"
  | "qc" | "audio" | "deliverable" | "archive" | "turnover";

export type PEdgeOp =
  | "transform" | "trim" | "wrap" | "regrade" | "output-transform" | "render-archive"
  | "bake" | "checksum-verify" | "manifest" | "sync" | "stack" | "turnover"
  | "comp" | "conform" | "qc-gate" | "qc-fail-loop" | "mix" | "rejoin"
  | "retain" | "validate" | "decide" | "annotate" | "transcode";

export interface PStage { id: string; label: string; order: number; track: Track; summary: string; }
export interface PNode { id: string; stage: string; kind: PNodeKind; label: string; detail: string; track: Track; }
export interface PEdge { from: string; to: string; op: PEdgeOp; label: string; dashed?: boolean; }
export interface PipelineGraph { stages: PStage[]; nodes: PNode[]; edges: PEdge[]; }

export const KIND_ACCENT: Record<PNodeKind, string> = {
  "camera-original": "#4ade80", // hero source — green
  report: "#94a3b8",
  look: "#f59e0b",              // amber
  dailies: "#38bdf8",           // sky
  manifest: "#a78bfa",          // violet (data)
  "vfx-plate": "#2dd4bf",       // teal
  "vfx-master": "#5eead4",
  conform: "#60a5fa",           // blue
  grade: "#22d3ee",             // cyan
  master: "#22d3ee",
  qc: "#fb923c",                // orange (gate)
  audio: "#e879f9",             // fuchsia
  deliverable: "#22d3ee",
  archive: "#a78bfa",
  turnover: "#facc15",          // yellow
};

export const P_EDGE_META: Record<PEdgeOp, { token: string; style: "solid" | "dashed" | "dotted"; back?: boolean; data?: boolean }> = {
  transform: { token: "xform", style: "solid" },
  trim: { token: "slap", style: "solid" },
  wrap: { token: "wrap", style: "dashed" },
  regrade: { token: "grade", style: "solid" },
  "output-transform": { token: "OT", style: "solid" },
  "render-archive": { token: "archive", style: "dotted" },
  bake: { token: "bake", style: "solid" },
  "checksum-verify": { token: "verify", style: "solid", data: true },
  manifest: { token: "MHL", style: "dotted", data: true },
  sync: { token: "sync", style: "dashed" },
  stack: { token: "stack", style: "solid" },
  turnover: { token: "turnover", style: "dashed" },
  comp: { token: "comp", style: "solid" },
  conform: { token: "conform", style: "solid" },
  "qc-gate": { token: "QC ✓", style: "solid" },
  "qc-fail-loop": { token: "QC ✗", style: "dashed", back: true },
  mix: { token: "mix", style: "solid" },
  rejoin: { token: "join", style: "dashed" },
  retain: { token: "store", style: "solid", data: true },
  validate: { token: "check", style: "solid", data: true },
  decide: { token: "decide", style: "dotted" },
  annotate: { token: "meta", style: "dotted" },
  transcode: { token: "proxy", style: "dashed" },
};

export const STAGES: PStage[] = [
  { id: "test", order: 1, track: "picture", label: "1 · Camera Test & Look Dev", summary: "Shoot a chart/talent test, evaluate latitude/noise/skin through a neutral ACES viewing transform, lock camera/codec/EI, then author the show look as a fixed LUT + a live CDL trim." },
  { id: "production", order: 2, track: "picture", label: "2 · On-Set Capture & Monitoring", summary: "Principal photography. The camera records the hero negative untouched; the CDL+LUT look chain is loaded into a LUT box for monitoring only (non-destructive)." },
  { id: "audio-prod", order: 2, track: "audio", label: "A1 · Production Sound & Sync", summary: "The audio column begins at the shoot — location multitrack (lav+boom, iso+guide, TC jam-synced), synced to dailies." },
  { id: "offload", order: 3, track: "data", label: "3 · DIT Cart — Offload · Verify · Backup", summary: "Verified multi-destination offload (xxHash/MD5/SHA1), ASC-MHL manifest, 3-2-1 backup incl LTO, and an ingest/technical QC gate before footage leaves the cart." },
  { id: "dailies", order: 4, track: "picture", label: "4 · Dailies & Proxies", summary: "Look-baked dailies (show LUT + per-setup CDL, primary only) and editorial proxies. Production sound syncs in — the first audio re-marry to picture." },
  { id: "editorial", order: 5, track: "picture", label: "5 · Offline Editorial → Lock", summary: "Cut on look-baked proxies. At picture-lock, export a TURNOVER (EDL/AAF/XML) — the single source of truth driving both the VFX pull and the conform." },
  { id: "audio-edit", order: 5, track: "audio", label: "A2 · Sound Editorial (DME)", summary: "At lock the turnover feeds five disciplines — Dialogue, ADR, Foley, SFX/design, Music — routing into D/M/E predubs." },
  { id: "vfx", order: 6, track: "picture", label: "6 · VFX Pull → Comp → Master", summary: "Pull plates from camera-original (not proxies) via IDT, deliver with look reference, vendor composites in scene-linear, QC with a revision loop, return ungraded VFX masters that override plates at conform." },
  { id: "conform", order: 7, track: "picture", label: "7 · Online / Conform", summary: "Relink every event proxy → camera-original at full res, VFX masters override their plates; apply cuts/retimes/repos/FDL. Output: the conformed master timeline for the grade." },
  { id: "audio-mix", order: 7, track: "audio", label: "A3 · Final Mix · Masters · Loudness", summary: "D+M+E balanced to picture = creative master → Atmos (objects+bed), channel re-renders, printmaster, M&E. Loudness QC gates each master, then conform to final graded picture." },
  { id: "mastering", order: 8, track: "picture", label: "8 · Grade & Mastering", summary: "Conformed timeline → ACES hero grade → the Output Transform splits to deliverables. This stage is the existing Mastering DAG, folded in." },
  { id: "qc", order: 9, track: "picture", label: "9 · QC (three layers + fix-loops)", summary: "Automated package QC (hard gate) → content/eyeball QC → near-field creative review. Fails loop back upstream on a right-side rail." },
  { id: "delivery", order: 10, track: "picture", label: "10 · Delivery & Wrap", summary: "Picture + audio + subs compose into the IMF CPL and the DCP. The parallel audio column rejoins picture here — its track files are laid into the same IMF." },
  { id: "archive", order: 11, track: "data", label: "11 · Long-Term Archive", summary: "Future-proof masters retained for decades: NAM (scene-referred AP0, no output transform), graded App 5 ACES, camera-original retention, LTO + cloud." },
];

const n = (id: string, stage: string, track: Track, kind: PNodeKind, label: string, detail: string): PNode =>
  ({ id, stage, track, kind, label, detail });

export const NODES: PNode[] = [
  // 1 — Camera Test & Look Dev
  n("t-test", "test", "picture", "camera-original", "Camera Test Footage", "Chart + talent test: grey card, ColorChecker, skin tones, exposure sweep, noise ramps."),
  n("t-eval", "test", "picture", "report", "Evaluation Report", "Latitude / noise / skin assessed through a neutral viewing transform on a calibrated display."),
  n("t-decide", "test", "picture", "report", "Camera / Codec / EI Decision", "Locks body, recording codec, base EI/rated ISO, sensor mode/res, WB baseline."),
  n("t-grade", "test", "picture", "look", "Reference Grade", "Colourist grades look-dev frames to DOP intent in ACEScct on a reference display."),
  n("t-cdl", "test", "picture", "look", "ASC-CDL", "10 numbers: Slope/Offset/Power per RGB + Saturation. out = ((in·slope)+offset)^power; a live parametric trim."),
  n("t-lut", "test", "picture", "look", "Creative Show LUT (.cube)", "Bakes the creative look + output transform; fixed in/out colourspace. The shared 'film' look."),
  // 2 — On-set
  n("p-orig", "production", "picture", "camera-original", "Camera Original (RAW/Log)", "Recorded clips on mag/card — the hero negative. NEVER has the look baked in."),
  n("p-monitor", "production", "picture", "look", "Monitoring Look Chain", "CDL+LUT in a LUT box / live-grade between camera and monitor — VIEW only, non-destructive."),
  n("p-report", "production", "picture", "report", "Camera Report / Circle Takes", "Per-clip lens, T-stop, EI, ND, circle-take flags, scene/take. Sidecar metadata."),
  // A1 — Production sound
  n("a-prod", "audio-prod", "audio", "audio", "Production Sound", "Lav + boom multitrack, iso + mono/LR guide, TC jam-synced. Polyphonic BWF/iXML."),
  n("a-sync", "audio-prod", "audio", "audio", "Audio Sync / Ingest", "Marry field audio to dailies by TC or waveform; AAF/OMF reference; guide track follows offline."),
  // 3 — Offload
  n("o-verified", "offload", "data", "camera-original", "Verified Camera Original", "The hero negative after a hash-verified offload — 'recorded' becomes 'safe'."),
  n("o-mhl", "offload", "data", "manifest", "ASC-MHL Manifest", "Path + checksum per file; generational Gen1/Gen2+ across backups. MD5/SHA1/xxHash."),
  n("o-backup", "offload", "data", "manifest", "Backup Sets (3-2-1)", "3 copies, 2 media, 1 off-site: typically 2 shuttle drives + 1 LTO/LTFS."),
  n("o-qc", "offload", "data", "qc", "Ingest / Technical QC", "All clips offloaded + verified, no dropped frames/corruption, metadata complete."),
  // 4 — Dailies
  n("d-dailies", "dailies", "picture", "dailies", "Dailies (look baked)", "Transcodes with show LUT + CDL baked, Rec.709 default (PQ only on HDR pipelines)."),
  n("d-proxy", "dailies", "picture", "dailies", "Editorial Proxies", "ProRes Proxy / DNxHR LB / H.264, look baked, matching TC/reel for conform."),
  n("d-synced", "dailies", "picture", "dailies", "Synced Dailies", "Dailies/proxies married to production sound by TC/clap."),
  // 5 — Editorial
  n("e-cut", "editorial", "picture", "dailies", "Offline Cut (proxy)", "ProRes/DNx sequence, show-LUT + CDL baked — looks right, not colour-accurate."),
  n("e-turnover", "editorial", "picture", "turnover", "Turnover (EDL/AAF/XML)", "EDL File_129 (preserves long source names) / AAF / FCPXML — source names + VFX locators + retimes."),
  // A2 — Sound editorial
  n("a-dx", "audio-edit", "audio", "audio", "Dialogue / ADR", "Dialogue clean-up + edit and re-recorded ADR lines → the D predub."),
  n("a-fx", "audio-edit", "audio", "audio", "Foley / SFX / Design", "Foley to picture + sound design/SFX → the E predub."),
  n("a-music", "audio-edit", "audio", "audio", "Music", "Score + source/licensed cues → the M predub."),
  n("a-premix", "audio-edit", "audio", "audio", "Premix D/M/E (stems)", "Three predubs D/M/E on a calibrated dub stage at reference SPL."),
  // 6 — VFX
  n("v-plate", "vfx", "picture", "vfx-plate", "VFX Plate (pulled)", "Camera-original → IDT → AP0 ACES2065-1 16-bit EXR (or Camera-Linear EXR / Camera-Log DPX). Handles, ≥UHD, lens/tracking metadata."),
  n("v-ref", "vfx", "picture", "look", "Reference Bundle", "Graded ref frames + CDL + show-LUT must accompany the plate (supplied alongside, not baked)."),
  n("v-comp", "vfx", "picture", "vfx-master", "VFX Comp (versions)", "Vendor composite in scene-linear ACES; per-shot versions named per the spec."),
  n("v-qc", "vfx", "picture", "qc", "VFX Media Review QC", "Colour round-trip, handles, naming, creative slap-in. Fail loops back to vendor."),
  n("v-master", "vfx", "picture", "vfx-master", "VFX Master (final)", "Final EXR, UNGRADED, same colourspace/res/handles as plate. Overrides the original plate at conform."),
  // 7 — Conform
  n("c-timeline", "conform", "picture", "conform", "Conformed Timeline", "Full-res relinked master sequence, VFX masters override plates, colour-managed. Hands to the grade."),
  // A3 — Final mix
  n("a-final", "audio-mix", "audio", "audio", "Final Mix", "D+M+E balanced to picture @ reference SPL. The branch point for all downstream masters."),
  n("a-atmos", "audio-mix", "audio", "audio", "Atmos Master", "Objects + bed (7.1.4 min). Rides the IMF as an IAB track (ST 2067-201); ADM BWAV is the alt printmaster."),
  n("a-print", "audio-mix", "audio", "audio", "Printmaster / M&E", "Native printmaster is the delivered master; 5.1/2.0 auto-derived (no upmix). M&E for foreign dubs."),
  n("a-loud", "audio-mix", "audio", "qc", "Loudness QC", "BS.1770: Netflix near-field −27 LKFS dialog-gated · −2 dBTP. Broadcast = R128/A85 (different domain)."),
  n("a-conform", "audio-mix", "audio", "audio", "Audio Conform", "Re-sync to the FINAL graded picture (not offline): frame-exact length, project frame rate."),
  // 8 — Grade & Mastering
  n("m-grade", "mastering", "picture", "grade", "ACES Grade (hero)", "ACEScct working, AP1, mid-grey 15.0. The single creative master. HDR Originals master in Dolby Vision."),
  n("m-master", "mastering", "picture", "master", "Mastering DAG ▸", "The existing Mastering deliverables DAG — hero master, trims, NAM, deliverable masters. Open it to expand."),
  // 9 — QC
  n("q-auto", "qc", "picture", "qc", "Automated Package QC", "Photon (IMF XML) → IMF validation → automated QC (channels, levels). Hard gate; a fail blocks upload."),
  n("q-content", "qc", "picture", "qc", "Content / Eyeball QC", "Manual QC: Spot 5-point or Full for Originals. Production-Will-Fix vs Creative-Intent."),
  n("q-review", "qc", "picture", "qc", "Near-field / Creative Review", "Director/DP creative sign-off in a calibrated reference environment. Change notes → regrade."),
  // 10 — Delivery
  n("del-imf", "delivery", "picture", "deliverable", "IMF Package (App 2E)", "CPL + PKL + ASSETMAP. Picture JPEG2000 (App 2E ST 2067-21); audio IAB/PCM track files. Timed text delivered separately (Netflix path)."),
  n("del-dcp", "delivery", "picture", "deliverable", "DCP (theatrical)", "From DCDM (12-bit X′Y′Z′, γ2.6, ST 428-1) → JPEG2000 12-bit + KDM (ST 429)."),
  n("del-bcast", "delivery", "picture", "deliverable", "Broadcast File (optional)", "OP1a MXF/ProRes, Rec.709 SDR or PQ/HLG, loudness-normalised R128/A85 per region."),
  // 11 — Archive
  n("arc-nam", "archive", "data", "archive", "NAM (Non-Graded)", "Texted, fully conformed, final VFX, scene-referred ACES2065-1/AP0, NO output transform. 16-bit EXR."),
  n("arc-gam", "archive", "data", "archive", "GAM / App 5 IMF", "Graded uncompressed ACES essence wrapped MXF in IMF App 5 (ST 2067-50)."),
  n("arc-cam", "archive", "data", "archive", "Camera-Original + Project", "RAW pre-debayer native gamut, no baked looks; + conform/EDL, CDL/LUTs, VFX masters, M&E, printmaster."),
  n("arc-lto", "archive", "data", "manifest", "LTO + Cloud (3-2-1)", "LTO-8/9 two geo-separated copies + cloud cold storage; checksum manifest per file."),
];

export const EDGES: PEdge[] = [
  // 1
  { from: "t-test", to: "t-eval", op: "transform", label: "Neutral ACES viewing transform on a calibrated display" },
  { from: "t-eval", to: "t-decide", op: "decide", label: "Evaluation feeds the camera/codec/EI spec" },
  { from: "t-grade", to: "t-cdl", op: "regrade", label: "Express the reference grade as a CDL (SOP + sat)" },
  { from: "t-grade", to: "t-lut", op: "bake", label: "Render the look + output transform into a .cube" },
  { from: "t-cdl", to: "t-lut", op: "stack", label: "Look chain: CDL first (working), LUT second (display)" },
  // 2
  { from: "t-lut", to: "p-monitor", op: "wrap", label: "Load CDL + LUT into the LUT box / live-grade" },
  { from: "p-orig", to: "p-monitor", op: "transform", label: "VIEW only — non-destructive monitoring", dashed: true },
  { from: "p-orig", to: "p-report", op: "annotate", label: "Clip metadata + circle takes sidecar" },
  // A1
  { from: "a-prod", to: "a-sync", op: "sync", label: "TC / waveform sync, AAF/OMF reference" },
  // 3
  { from: "p-orig", to: "o-verified", op: "checksum-verify", label: "Offload + hash gate — 'recorded' → 'safe'" },
  { from: "o-verified", to: "o-mhl", op: "manifest", label: "Emit ASC-MHL (path + checksum, generational)" },
  { from: "o-verified", to: "o-backup", op: "checksum-verify", label: "Cascading 3-2-1 copy, byte-verified" },
  { from: "o-verified", to: "o-qc", op: "qc-gate", label: "Ingest/technical QC must pass before handoff" },
  // 4
  { from: "o-verified", to: "d-dailies", op: "bake", label: "Transcode with show LUT + CDL baked" },
  { from: "o-verified", to: "d-proxy", op: "transcode", label: "Proxy gen, look baked, edit codec" },
  { from: "a-prod", to: "d-synced", op: "sync", label: "TC/clap marry of production sound (first audio touch-point)" },
  // 5
  { from: "d-proxy", to: "e-cut", op: "transcode", label: "Cut on proxies" },
  { from: "e-cut", to: "e-turnover", op: "turnover", label: "Export the decision list at picture-lock" },
  // A2
  { from: "e-turnover", to: "a-dx", op: "turnover", label: "Locked-picture AAF/OMF turnover" },
  { from: "a-sync", to: "a-dx", op: "transform", label: "Synced field tracks into dialogue edit" },
  { from: "a-dx", to: "a-premix", op: "mix", label: "Predub D" },
  { from: "a-fx", to: "a-premix", op: "mix", label: "Predub E" },
  { from: "a-music", to: "a-premix", op: "mix", label: "Predub M" },
  // 6
  { from: "e-turnover", to: "v-plate", op: "transform", label: "Parse VFX locators → pull events; relink to camera-original" },
  { from: "e-cut", to: "v-ref", op: "regrade", label: "Extract dailies look / CDL / LUT as vendor reference" },
  { from: "v-plate", to: "v-comp", op: "comp", label: "Deliver plate → vendor compositing" },
  { from: "v-ref", to: "v-comp", op: "transform", label: "Supply look reference alongside the plate" },
  { from: "v-comp", to: "v-qc", op: "qc-gate", label: "Technical + creative QC review" },
  { from: "v-qc", to: "v-comp", op: "qc-fail-loop", label: "Kickback / revisions loop" },
  { from: "v-qc", to: "v-master", op: "wrap", label: "Approve & publish the final EXR master" },
  { from: "v-master", to: "e-cut", op: "trim", label: "Slap-comp finals back into editorial" },
  // 7
  { from: "e-turnover", to: "c-timeline", op: "conform", label: "Relink proxy → camera-original full-res; cuts/retimes/FDL" },
  { from: "v-master", to: "c-timeline", op: "transform", label: "VFX master EXR overrides the original plate at its event" },
  // A3
  { from: "a-premix", to: "a-final", op: "mix", label: "D + M + E balance @ reference SPL" },
  { from: "a-final", to: "a-atmos", op: "mix", label: "Objects + bed" },
  { from: "a-atmos", to: "a-print", op: "mix", label: "Printmaster; 5.1/2.0 auto-derived; M&E for dubs" },
  { from: "a-print", to: "a-loud", op: "trim", label: "Measure loudness per delivery domain" },
  { from: "a-loud", to: "a-conform", op: "mix", label: "Pass → conform to the final picture" },
  // 8
  { from: "c-timeline", to: "m-grade", op: "transform", label: "IDT / already-ACES into the ACEScct working space" },
  { from: "m-grade", to: "m-master", op: "output-transform", label: "Apply the ACES Output Transform; hero + trims + NAM" },
  { from: "m-grade", to: "arc-nam", op: "render-archive", label: "Flat pass → scene-referred ACES2065-1/AP0 NAM" },
  // 9
  { from: "m-master", to: "q-auto", op: "validate", label: "Deliver the IMF/package for automated validation" },
  { from: "q-auto", to: "q-content", op: "qc-gate", label: "Auto-QC clear → Manual QC" },
  { from: "q-auto", to: "m-master", op: "qc-fail-loop", label: "FAIL: re-wrap / re-encode — blocks upload" },
  { from: "q-content", to: "q-review", op: "qc-gate", label: "Content clear → creative review" },
  { from: "q-content", to: "m-grade", op: "qc-fail-loop", label: "Production-Will-Fix artefact → regrade" },
  { from: "q-review", to: "m-grade", op: "qc-fail-loop", label: "Change notes → regrade" },
  { from: "q-review", to: "del-imf", op: "qc-gate", label: "Creative sign-off → delivery" },
  // 10
  { from: "m-master", to: "del-imf", op: "wrap", label: "Picture + CPL compose (after QC pass)" },
  { from: "a-conform", to: "del-imf", op: "rejoin", label: "Audio track files laid into the SAME IMF CPL — re-marry" },
  { from: "m-master", to: "del-dcp", op: "transform", label: "DCDM X′Y′Z′ bake → JPEG2000 12-bit + KDM" },
  { from: "a-conform", to: "del-dcp", op: "rejoin", label: "5.1/7.1 PCM + Atmos aux reels — theatrical sound" },
  { from: "m-master", to: "del-bcast", op: "transform", label: "Rec.709/HDR + loudness-normalise + OP1a wrap" },
  // 11
  { from: "del-imf", to: "arc-gam", op: "retain", label: "Graded App 5 ACES archive" },
  { from: "arc-nam", to: "arc-cam", op: "validate", label: "Colour-check NAM against the original camera files" },
  { from: "arc-nam", to: "arc-lto", op: "retain", label: "Write to LTO + cloud, checksum" },
  { from: "arc-gam", to: "arc-lto", op: "retain", label: "Write to LTO + cloud" },
  { from: "arc-cam", to: "arc-lto", op: "retain", label: "Second geo-separated copy" },
  { from: "a-print", to: "arc-lto", op: "retain", label: "Archive Atmos ADM/IAB, DME stems, printmaster, M&E" },
];

/** Live project context — when supplied, key pipeline nodes reflect the actual
 *  camera, IDT, ACES version, delivery target and mastering choice. */
export interface PipelineConfig {
  camera?: string;
  cameraMode?: string;
  codec?: string;
  idt?: string;
  idtOfficial?: boolean;
  acesVersion?: string;
  outputTransform?: string;
  delivery?: string;
  deliveryRes?: string;
  hdr?: string;
  hdrNits?: number;
  masteringHero?: string;
  masteringStrategy?: string;
  masterNits?: number;
}

export function buildPipeline(cfg?: PipelineConfig): PipelineGraph {
  if (!cfg) return { stages: STAGES, nodes: NODES, edges: EDGES };

  const cam = cfg.camera ?? "";
  const hdrLine = cfg.hdr ? `${cfg.hdr}${cfg.hdrNits ? ` · ${cfg.hdrNits} nit` : ""}` : "";
  const overrides: Record<string, { label?: string; detail?: (base: string) => string }> = {
    "t-test": { detail: (b) => (cam ? `${cam} chart/talent test. ` : "") + b },
    "p-orig": {
      label: cam ? `Camera Original · ${cam}` : undefined,
      detail: (b) => (cam ? `${cam} · ${cfg.cameraMode ?? ""} · ${cfg.codec ?? ""}. ` : "") + b,
    },
    "o-verified": { detail: (b) => (cam ? `${cam} · ${cfg.codec ?? ""}. ` : "") + b },
    "d-dailies": {
      detail: (b) => (cfg.hdr && cfg.hdr !== "SDR" ? "PQ dailies (HDR pipeline). " : "") + b,
    },
    "m-grade": {
      label: cfg.acesVersion ? `ACES Grade · ACES ${cfg.acesVersion}` : undefined,
      detail: (b) =>
        (cfg.idt ? `IDT: ${cfg.idt}${cfg.idtOfficial === false ? " (third-party — verify)" : ""} · ` : "") +
        (cfg.acesVersion ? `ACES ${cfg.acesVersion} · ` : "") +
        (cfg.outputTransform ? `OT → ${cfg.outputTransform}. ` : "") + b,
    },
    "m-master": {
      label: cfg.masteringStrategy ? `Mastering · ${cfg.masteringStrategy} ▸` : undefined,
      detail: () =>
        `Hero: ${cfg.masteringHero ?? "—"}${cfg.masterNits ? ` · ${cfg.masterNits} nit` : ""}` +
        (cfg.outputTransform ? ` · OT → ${cfg.outputTransform}` : "") +
        ". The existing Mastering deliverables DAG — open it to expand.",
    },
    "del-imf": {
      label: cfg.delivery ? `IMF · ${cfg.delivery}` : undefined,
      detail: (b) => (cfg.delivery ? `${cfg.delivery} · ${cfg.deliveryRes ?? ""}${hdrLine ? ` · ${hdrLine}` : ""}. ` : "") + b,
    },
  };

  const nodes = NODES.map((n) => {
    const o = overrides[n.id];
    if (!o) return n;
    return { ...n, label: o.label ?? n.label, detail: o.detail ? o.detail(n.detail) : n.detail };
  });
  return { stages: STAGES, nodes, edges: EDGES };
}
