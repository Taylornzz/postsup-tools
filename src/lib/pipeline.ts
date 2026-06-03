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
  | "retain" | "validate" | "decide" | "annotate" | "transcode" | "approve" | "notes";

export interface PStage { id: string; label: string; order: number; track: Track; summary: string; }
export interface PNode { id: string; stage: string; kind: PNodeKind; label: string; detail: string; track: Track; owner?: string; }
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

export const P_EDGE_META: Record<PEdgeOp, { token: string; style: "solid" | "dashed" | "dotted"; back?: boolean; data?: boolean; approve?: boolean }> = {
  approve: { token: "approve ✓", style: "solid", approve: true },
  notes: { token: "notes ↺", style: "dashed", back: true },
  transform: { token: "transform", style: "solid" },
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
  { id: "editorial", order: 5, track: "picture", label: "5 · Offline Editorial → Lock", summary: "The cut-approval ladder on look-baked proxies: Editor's Assembly → Director's Cut → Producer's Cut → Network/Studio Cut → Picture Lock. Lock triggers the turnover (AAF/XML/EDL + ref + change lists + cue sheets) that drives VFX, audio and conform." },
  { id: "audio-edit", order: 5, track: "audio", label: "A2 · Sound Editorial (DME)", summary: "At lock the turnover feeds five disciplines — Dialogue, ADR, Foley, SFX/design, Music — routing into D/M/E predubs." },
  { id: "vfx", order: 6, track: "picture", label: "6 · VFX Pull → Comp → Approve → Master", summary: "The 8-step pull & approval process: shot list → EDL → plate pull (handles agreed in writing) → reference → ingest confirm → comp → ShotGrid/Ftrack version review (the approval gate, with a notes loop) → approved final EXR. Each step has an owner." },
  { id: "conform", order: 7, track: "picture", label: "7 · Online / Conform", summary: "Relink every event proxy → camera-original at full res, VFX masters override their plates; apply cuts/retimes/repos/FDL. Output: the conformed master timeline for the grade." },
  { id: "audio-mix", order: 7, track: "audio", label: "A3 · Final Mix · Masters · Loudness", summary: "D+M+E balanced to picture = creative master → Atmos (objects+bed), channel re-renders, printmaster, M&E. Loudness QC gates each master, then conform to final graded picture." },
  { id: "mastering", order: 8, track: "picture", label: "8 · Grade & Mastering", summary: "Conformed timeline → ACES hero grade → the Output Transform splits to deliverables. This stage is the existing Mastering DAG, folded in." },
  { id: "qc", order: 9, track: "picture", label: "9 · QC (three layers + fix-loops)", summary: "Automated package QC (hard gate) → content/eyeball QC → near-field creative review. Fails loop back upstream on a right-side rail." },
  { id: "delivery", order: 10, track: "picture", label: "10 · Delivery & Wrap", summary: "Picture + audio + subs compose into the IMF CPL and the DCP. The parallel audio column rejoins picture here — its track files are laid into the same IMF." },
  { id: "archive", order: 11, track: "data", label: "11 · Long-Term Archive", summary: "Future-proof masters retained for decades: NAM (scene-referred AP0, no output transform), graded App 5 ACES, camera-original retention, LTO + cloud." },
];

const n = (id: string, stage: string, track: Track, kind: PNodeKind, label: string, detail: string, owner?: string): PNode =>
  ({ id, stage, track, kind, label, detail, owner });

export const NODES: PNode[] = [
  // 1 — Camera Test & Look Dev
  n("t-test", "test", "picture", "camera-original", "Camera Test Footage", "Chart + talent test: grey card, ColorChecker, skin tones, exposure sweep, noise ramps."),
  n("t-eval", "test", "picture", "report", "Evaluation Report", "Latitude / noise / skin assessed through a neutral viewing transform on a calibrated display."),
  n("t-decide", "test", "picture", "report", "Camera / Codec / EI Decision", "Locks body, recording codec, base EI/rated ISO, sensor mode/res, WB baseline."),
  n("t-grade", "test", "picture", "look", "Reference Grade", "Colourist grades look-dev frames to DOP intent in ACEScct on a reference display."),
  n("t-cdl", "test", "picture", "look", "ASC-CDL", "10 numbers: Slope/Offset/Power per RGB + Saturation. out = ((in·slope)+offset)^power; a live parametric trim."),
  n("t-lut", "test", "picture", "look", "Creative Show LUT (.cube)", "Bakes the creative look + output transform; fixed in/out colourspace. The shared 'film' look."),
  // 2 — On-set
  n("p-orig", "production", "picture", "camera-original", "Camera Original (RAW/Log)", "Recorded clips on mag/card — the hero negative. NEVER has the look baked in.", "Camera / DIT"),
  n("p-monitor", "production", "picture", "look", "Monitoring Look Chain", "CDL+LUT in a LUT box / live-grade between camera and monitor — VIEW only, non-destructive."),
  n("p-report", "production", "picture", "report", "Camera Report / Circle Takes", "Per-clip lens, T-stop, EI, ND, circle-take flags, scene/take. Sidecar metadata."),
  // A1 — Production sound
  n("a-prod", "audio-prod", "audio", "audio", "Production Sound", "Lav + boom multitrack, iso + mono/LR guide, TC jam-synced. Polyphonic BWF/iXML."),
  n("a-sync", "audio-prod", "audio", "audio", "Audio Sync / Ingest", "Marry field audio to dailies by TC or waveform; AAF/OMF reference; guide track follows offline."),
  // 3 — Offload
  n("o-verified", "offload", "data", "camera-original", "Verified Camera Original", "The hero negative after a hash-verified offload — 'recorded' becomes 'safe'.", "DIT / Data Manager"),
  n("o-mhl", "offload", "data", "manifest", "ASC-MHL Manifest", "Path + checksum per file; generational Gen1/Gen2+ across backups. MD5/SHA1/xxHash."),
  n("o-backup", "offload", "data", "manifest", "Backup Sets (3-2-1)", "3 copies, 2 media, 1 off-site: typically 2 shuttle drives + 1 LTO/LTFS."),
  n("o-qc", "offload", "data", "qc", "Ingest / Technical QC", "All clips offloaded + verified, no dropped frames/corruption, metadata complete."),
  // 4 — Dailies
  n("d-dailies", "dailies", "picture", "dailies", "Dailies (look baked)", "Transcodes with show LUT + CDL baked, Rec.709 default (PQ only on HDR pipelines)."),
  n("d-proxy", "dailies", "picture", "dailies", "Editorial Proxies", "ProRes Proxy / DNxHR LB / H.264, look baked, matching TC/reel for conform."),
  n("d-synced", "dailies", "picture", "dailies", "Synced Dailies", "Dailies/proxies married to production sound by TC/clap."),
  // 5 — Offline Editorial → Lock (the cut-approval ladder)
  n("e-assembly", "editorial", "picture", "dailies", "Editor's Assembly", "Built continuously through principal photography on look-baked proxies — first string-out → assembly.", "Editor"),
  n("e-dircut", "editorial", "picture", "dailies", "Director's Cut", "~10 weeks after wrap (feature) or per-episode (TV). The director's vision of the cut.", "Editor + Director"),
  n("e-prodcut", "editorial", "picture", "dailies", "Producer's Cut", "1–3 weeks after the director's cut — producer notes addressed.", "Producer"),
  n("e-netcut", "editorial", "picture", "dailies", "Network / Studio Cut", "Per the notes cycle — network/studio sign-off rounds.", "Network / Studio"),
  n("e-lock", "editorial", "picture", "turnover", "Picture Lock", "Date agreed in the schedule — NO further picture changes. Triggers the turnover, the VFX pull and audio editorial.", "Post Supervisor"),
  n("e-turnover", "editorial", "picture", "turnover", "Turnover Package", "Locked AAF/XML/EDL (File_129 preserves long source names) · reference H.264 w/ burn-ins (TC, reel, scene, take) · change lists vs previous turnover (per reel/episode) · VFX / music / sound cue sheets · audio OMF/AAF w/ embedded media · subtitle scripts.", "1st Assistant Editor"),
  // A2 — Sound editorial (DME)
  n("a-spot", "audio-edit", "audio", "audio", "Spotting Session", "Director + editor + sound designer walk the locked cut to spot every sound need — the brief for all of audio post.", "Director + Sound Designer"),
  n("a-dx", "audio-edit", "audio", "audio", "Dialogue / ADR", "Dialogue clean-up + edit; ADR cued and recorded where production sound is unusable → the D predub.", "Dialogue Editor"),
  n("a-fx", "audio-edit", "audio", "audio", "Foley / SFX / Design", "Performed foley (footsteps, cloth, props) + designed FX + hard-effects edit → the E predub.", "Sound Designer / Foley"),
  n("a-music", "audio-edit", "audio", "audio", "Music", "Score + source/licensed cues; clearance and delivery from composer / music supervisor → the M predub.", "Composer / Music Sup"),
  n("a-premix", "audio-edit", "audio", "audio", "Premix D/M/E (stems)", "Split and rough-mix each stem (Dialogue / Music / Effects) on a calibrated dub stage at reference SPL.", "Re-recording Mixer"),
  // 6 — VFX Pull → Comp → Approve → Master (8-step process, with owners)
  n("v-shotlist", "vfx", "picture", "turnover", "VFX Shot List", "Compiled from the locked-edit offline — per-shot IDs, methodology, frame ranges, difficulty. The master line-up.", "VFX Editor"),
  n("v-edl", "vfx", "picture", "turnover", "EDL / XML Export", "Pulled from Avid/Premiere — the exact events to pull plates for, with source reels.", "1st Assistant Editor"),
  n("v-plate", "vfx", "picture", "vfx-plate", "Plate Pull (8–16f handles)", "16-bit EXR, ACES2065-1 or ACEScg per vendor spec. Handles 8–16f (24–48f for matchmove / retimes) — agree in writing; a too-short handle = an expensive re-pull. ≥UHD, lens/tracking metadata.", "Online / Conform"),
  n("v-ref", "vfx", "picture", "look", "Reference + Burn-in", "Offline reference (H.264) + burn-in metadata (TC, scene, take) supplied alongside the plate — not baked.", "VFX Editor"),
  n("v-ingest", "vfx", "picture", "qc", "Ingest Confirmation", "Vendor confirms receipt & plate integrity (frame count, handles, colourspace) before work starts.", "VFX Vendor"),
  n("v-comp", "vfx", "picture", "vfx-master", "VFX Comp (WIP)", "Composite in scene-linear ACES; per-shot WIP versions named per the convention.", "VFX Vendor"),
  n("v-review", "vfx", "picture", "qc", "Version Review (ShotGrid/Ftrack)", "Daily/weekly WIP review. Notes → revisions loop. The creative + technical APPROVAL gate before a shot can go final.", "VFX Producer + Post Super"),
  n("v-master", "vfx", "picture", "vfx-master", "Final EXR → Conform", "Approved locked EXR sequence — UNGRADED, same colourspace/res/handles as plate. Overrides the original plate at conform (full res).", "Online / Finishing"),
  // 7 — Conform
  n("c-timeline", "conform", "picture", "conform", "Conformed Timeline", "Match the offline back to camera masters at full res — a DNxHR-proxy decision becomes a pixel-perfect cut on the original ARRIRAW. Checklist: EDL matches the locked reference exactly · all reel names map to camera-master filenames (no orphans) · tracks colour-coded (VFX/stock/captures/archive/primary) · opticals & speed ramps flagged · handles preserved for the colourist · output res = grade working res. Watch for: missing reels, unresolved speed ramps (need original not transcode), archive in wrong gamma (needs IDT), mixed frame rates (29.97 stock in a 25p show).", "Online / Finishing"),
  // A3 — Final mix · masters · loudness
  n("a-final", "audio-mix", "audio", "audio", "Final Mix", "Dialogue + music + effects balanced to picture in the room @ reference SPL. The branch point for all downstream masters.", "Re-recording Mixer"),
  n("a-atmos", "audio-mix", "audio", "audio", "Atmos / Object Mix", "Object-based re-render from the stem bed (7.1.4 min). Rides the IMF as an IAB track (ST 2067-201); ADM BWAV is the alt printmaster.", "Atmos Mixer"),
  n("a-print", "audio-mix", "audio", "audio", "Printmasters / M&E", "Final deliverable files per spec. Native printmaster is the master; 5.1 / 2.0 auto-derived (no upmix). M&E (music & effects) for foreign dubs.", "Re-recording Mixer"),
  n("a-loud", "audio-mix", "audio", "qc", "Loudness QC", "Measure per delivery domain (BS.1770) and file a LUFS report: Netflix −27 LKFS dialog-gated · −2 dBTP. TVNZ / EBU R128 −23 LUFS · TP −1 dBTP. Amazon / ATSC A/85 −24 LUFS · −2 dBTP. Different targets = different masters.", "Mixer + QC"),
  n("a-conform", "audio-mix", "audio", "audio", "Audio Conform", "Re-sync to the FINAL graded picture (not the offline): frame-exact length, project frame rate, long-form sync check.", "Re-recording Mixer"),
  // 8 — Grade & Mastering
  n("m-grade", "mastering", "picture", "grade", "ACES Grade (hero)", "ACEScct working, AP1, mid-grey 15.0. The single creative master. HDR Originals master in Dolby Vision. Grade order: colour test → pre-grade → attended grade (director + DOP) → client review → HDR pass (trim SDR) → finals.", "Colourist (DI)"),
  n("m-master", "mastering", "picture", "master", "Mastering DAG ▸", "The existing Mastering deliverables DAG — hero master, trims, NAM, deliverable masters. Open it to expand."),
  // 9 — QC (three layers + fix-loops)
  n("q-auto", "qc", "picture", "qc", "Automated Package QC", "Photon (IMF XML) → IMF validation → automated QC. Flags: video (black/frozen frames, interlacing, macroblocking) · audio (silence, clipping, phase, mono-sum, loudness out-of-spec) · subtitles (timing overlap, line overrun, unreadable chars) · metadata (missing Dolby Vision XML, wrong CPL hash, missing CPL/PKL) · structural (CPL references missing assets, OPL/audio-track mismatch). Hard gate — a fail blocks upload.", "QC House"),
  n("q-content", "qc", "picture", "qc", "Content / Eyeball QC", "Manual QC: Spot 5-point or Full for Originals. NZ-specific watch-list: frame-rate mismatch (25p show with 23.976 co-pro elements), legal vs full range (broadcast = legal), te reo Māori subtitle macrons (TTML Unicode), archive in wrong colour space (Rec.601 SD in a Rec.709 show). Production-Will-Fix vs Creative-Intent.", "QC House"),
  n("q-review", "qc", "picture", "qc", "Near-field / Creative Review + QC Report", "Director/DP creative sign-off in a calibrated reference environment. A QC report (format, TC, fps, aspect, colour/transfer, MaxCLL/MaxFALL, integrated LUFS, true peak, result: Pass/Fail/Conditional) is signed by the QC house AND the Post Super before any copies distribute. Change notes → regrade.", "Post Supervisor"),
  // 10 — Delivery & Wrap
  n("del-imf", "delivery", "picture", "deliverable", "IMF Package (App 2E)", "Netflix/Amazon mezzanine. UHD 3840×2160 or HD 1920×1080; JPEG2000 (or ProRes 4444 XQ). SDR Rec.709/BT.1886 limited 10-bit · HDR Rec.2020 PQ (HDR10 static + optional Dolby Vision P8.1). Audio 48 kHz/24-bit PCM, 5.1 + 2.0 + Atmos, −27 LUFS. Deliverables bundle: textless, proxy, M&E, stems, NAM, end-cards, TTML subs, QC report. (Amazon: per-title in Video Central, IMSC1 captions, −24 LUFS.)", "Mastering House"),
  n("del-dcp", "delivery", "picture", "deliverable", "DCP (theatrical)", "DI master → theatrical P3-D65 trim (often a separate DCP grade on a DCI projector) → XYZ γ2.6 12-bit → JPEG2000 (avg bitrate, 250 Mbit/s hard ceiling) → Op1a MXF per reel → SMPTE-TT subs + Atmos IAB → CPL+PKL+ASSETMAP (hashed, signed) → AES-128 + KDM. ISDCF name e.g. TITLE_FTR-1_F-178_EN-XX_INT-TD_51_4K_STUDIO_DATE_FACILITY_OV. Full-pass screen on a calibrated DCI projector before sign-off.", "DCP Mastering House"),
  n("del-bcast", "delivery", "picture", "deliverable", "Broadcast File (TVNZ)", "TVNZ on-air: 1080i50 XDCAM HD422 50 Mbps MXF OP1a (ProRes for TVNZ+). 48 kHz/24-bit, EBU R128 −23 LUFS, TP −1 dBTP, 4ch (stereo + M&E). CC = Teletext page 801 or MXF sidecar. Delivery slate + countdown clock per format spec.", "Mastering House"),
  n("del-screener", "delivery", "picture", "deliverable", "Screeners (forensic WM)", "Per-user forensic watermark (NAGRA NexGuard, Irdeto TraceMark) on every review/screener copy — identifies the exact recipient if leaked. Governance: never an unwatermarked link, never a shared login, revoke after the window, audit every screener issued, click-through NDA. The post super owns this.", "Post Supervisor"),
  // 11 — Long-Term Archive
  n("arc-nam", "archive", "data", "archive", "NAM (Non-Graded)", "Texted, fully conformed, final VFX, scene-referred ACES2065-1/AP0, NO output transform. 16-bit EXR (10-bit DPX only if ≥50% of capture was 10-bit).", "Mastering House"),
  n("arc-gam", "archive", "data", "archive", "GAM / App 5 IMF", "Graded uncompressed ACES essence wrapped MXF in IMF App 5 (ST 2067-50). Other mezzanines: ProRes 4444 XQ, DNxHR 444/HQX, J2K MXF OP1a, DPX, EXR.", "Mastering House"),
  n("arc-cam", "archive", "data", "archive", "Camera-Original + Project", "RAW pre-debayer, native gamut, no baked looks; + conform/EDL, CDL/LUTs, VFX masters, M&E, printmaster, cue sheets.", "Post Supervisor"),
  n("arc-lto", "archive", "data", "manifest", "LTO + Cloud (3-2-1)", "LTO-8 (12 TB) / LTO-9 (18 TB) with LTFS, written to TWO geo-separated physical locations (a hard requirement for Netflix/Amazon originals) + cloud cold storage. Checksums (MD5 / xxHash / SHA-256) generated at creation and verified on restore. MovieLabs 2030 pushes toward cloud-native masters.", "Data Manager / Vault"),
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
  // 5 — the cut-approval ladder
  { from: "d-proxy", to: "e-assembly", op: "transcode", label: "Cut on look-baked proxies" },
  { from: "e-assembly", to: "e-dircut", op: "approve", label: "String-out → director's cut" },
  { from: "e-dircut", to: "e-prodcut", op: "approve", label: "Director's-cut notes addressed → producer's cut" },
  { from: "e-prodcut", to: "e-netcut", op: "approve", label: "Producer's-cut notes → network/studio cut" },
  { from: "e-netcut", to: "e-lock", op: "approve", label: "Final sign-off → PICTURE LOCK" },
  { from: "e-lock", to: "e-turnover", op: "turnover", label: "Lock triggers the turnover package" },
  // A2
  { from: "e-turnover", to: "a-spot", op: "turnover", label: "Locked-picture turnover → spotting session" },
  { from: "a-spot", to: "a-dx", op: "transform", label: "Spot dialogue / ADR needs" },
  { from: "a-spot", to: "a-fx", op: "transform", label: "Spot FX / foley / design needs" },
  { from: "a-spot", to: "a-music", op: "transform", label: "Spot music needs" },
  { from: "a-sync", to: "a-dx", op: "transform", label: "Synced field tracks into dialogue edit" },
  { from: "a-dx", to: "a-premix", op: "mix", label: "Predub D" },
  { from: "a-fx", to: "a-premix", op: "mix", label: "Predub E" },
  { from: "a-music", to: "a-premix", op: "mix", label: "Predub M" },
  // 6 — VFX 8-step pull & approval
  { from: "e-lock", to: "v-shotlist", op: "turnover", label: "VFX editor compiles the shot list from the locked offline" },
  { from: "v-shotlist", to: "v-edl", op: "transform", label: "Pull the EDL/XML for the VFX events" },
  { from: "v-edl", to: "v-plate", op: "transform", label: "Relink to camera-original; pull plates with handles" },
  { from: "e-turnover", to: "v-ref", op: "regrade", label: "Offline reference (H.264) + burn-in metadata" },
  { from: "v-plate", to: "v-ingest", op: "transform", label: "Deliver plates to the vendor, per spec" },
  { from: "v-ingest", to: "v-comp", op: "qc-gate", label: "Receipt & integrity confirmed → comp begins" },
  { from: "v-ref", to: "v-comp", op: "transform", label: "Supply the look reference alongside the plate" },
  { from: "v-comp", to: "v-review", op: "qc-gate", label: "Submit WIP for review" },
  { from: "v-review", to: "v-comp", op: "notes", label: "Notes → revisions (back to vendor)" },
  { from: "v-review", to: "v-master", op: "approve", label: "Creative + technical sign-off → publish final EXR" },
  { from: "v-master", to: "e-netcut", op: "trim", label: "Final comps slapped back into the cut" },
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
  { from: "m-master", to: "del-screener", op: "transcode", label: "Per-user forensic watermark on every screener" },
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
