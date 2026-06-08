import { useMemo, useRef, useState, useEffect, useCallback, lazy, Suspense } from "react";
import {
  SOURCE_FORMATS,
  TARGETS,
  CODECS,
  LENSES,
  CARDS,
  PROXY_CODEC_IDS,
  OFFLOAD_BANDWIDTHS,
  type TargetContainer,
  codecMbps,
  computeExtraction,
  formatNumber,
  formatSize,
  estimateFileSizeGB,
  sourceDisplayed,
  aspectRatioLabel,
  aspectDecimalLabel,
  nativeCodecsForCamera,
  usedSensorDiagonalMm,
  cardRuntimeMinutes,
  offloadHours,
  hdrPeakNits,
  netflixStatusForCamera,
  netflixStatusLabel,
  lensAnamorphicMismatch,
  FitMode,
  Codec,
  HdrVariant,
  LensSpec,
} from "@/lib/formats";
import { SuiteSelect } from "@/components/SuiteSelect";
import { NetflixMark } from "@/components/NetflixMark";
import {
  buildFdl,
  fdlToJson,
  encodeTiff,
  downloadBlob,
  slug,
} from "@/lib/framingChart";
import { renderFramingChart } from "@/lib/framingChartCanvas";
import { buildCameraReportPdf } from "@/lib/cameraReport";
import { AcesPanel } from "@/components/AcesPanel";
import { AcesVersion, acesPipeline } from "@/lib/aces";
import { MasteringStrategy, MasterNits, STRATEGIES, buildMasterGraph, buildCustomGraph } from "@/lib/mastering";
import { PipelineConfig } from "@/lib/pipeline";
import { Metric } from "@/components/Metric";
import { FrameViewer } from "@/components/FrameViewer";
import {
  DeliveryViewer,
  SourceTransform,
  fitWidthScale,
  fitHeightScale,
} from "@/components/DeliveryViewer";
import {
  Upload,
  X,
  Eye,
  Grid3x3,
  Square,
  Maximize2,
  Move,
  RotateCcw,
  Crop,
  Film,
  MonitorPlay,
  HardDrive,
  Aperture,
  Gauge,
  Clipboard,
  Download,
  ShieldCheck,
  Link2,
  Sun,
  Focus,
  ChevronRight,
  Palette,
  Share2,
  GitBranch,
  CalendarClock,
  BookText,
  Calculator,
  FolderOpen,
  ChevronDown,
  Video,
  SquareKanban,
  PackageCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileSizeCalculator } from "@/components/FileSizeCalculator";
import { FovCalculator } from "@/components/FovCalculator";
import { MasteringWorkflow } from "@/components/MasteringWorkflow";
import { WorkflowPipeline } from "@/components/WorkflowPipeline";
import { PostSchedule } from "@/components/PostSchedule";
import { Glossary } from "@/components/Glossary";
import { Tools } from "@/components/Tools";
import { AppMenu } from "@/components/AppMenu";
import { Vendors } from "@/components/Vendors";
import { NewsWatches } from "@/components/NewsWatches";
import { MulticamPlanner } from "@/components/MulticamPlanner";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Deliverables } from "@/components/Deliverables";
import { loadRecipients, recipientsToMasteringConfig } from "@/lib/deliverables";
import { Home, type HomeTab } from "@/components/Home";
import { updateProject, type Project } from "@/lib/projects";
const WorkflowBuilder = lazy(() => import("@/components/WorkflowBuilder")); // code-split: React Flow loads only on the Builder tab
import { masterGraphToFlow, masteringPaletteGroups } from "@/lib/masteringFlow";
import referencePerson from "@/assets/reference-bg.jpg";

// Uploaded reference plate is persisted to localStorage (as a downscaled data
// URL) so it survives a refresh. Blob object URLs can't be persisted.
const PLATE_KEY = "luminafox-ref-plate";
const PLATE_MODE_KEY = "luminafox-ref-plate-mode";
type PlateMode = "guide" | "uploaded" | "none";
function readStoredPlate(): string | null {
  try { return localStorage.getItem(PLATE_KEY); } catch { return null; }
}
function readStoredPlateMode(): PlateMode {
  try {
    const m = localStorage.getItem(PLATE_MODE_KEY);
    return m === "uploaded" || m === "none" ? m : "guide";
  } catch { return "guide"; }
}

const BUILTIN_GUIDE = referencePerson;
const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120];
export const VERSION = "v2.0.2";
const CHANGELOG = [
  "v2.0.2 — Mastering tab reorganised. The three reference strategies (HDR-First, Theatrical-First, Dual-Hero) now live under a ‘Guides’ sub-menu, and the old Custom view is now ‘My workflow’ — your editable mastering tree, which you can seed three ways: from your Deliverables recipients, from a guide, or from scratch. The Deliverables tab now sits before Mastering (requirements first, then the plan), and its ‘Open in Mastering’ button seeds My workflow straight from your recipient list.",
  "v2.0.1 — Deliverables now drives the Mastering engine directly: the make-order is computed by the same custom-mastering logic as the Mastering tab (one source of truth), so a theatrical→SDR step — or any up-volume master — is correctly flagged as a fresh re-grade off the ACES archive, not a clean derive. New ‘Open in Mastering’ button hands your recipient list to the Mastering Custom tree with the hero, deliverables and peak nits inferred from your recipients. Vendor directory temporarily hidden while it’s refreshed.",
  "v2.0.0 — Accounts & cloud sync: sign in and your projects sync per-user with row-level security, plus a Resolve-style project manager and a Home launcher. New tools — Multicam Planner (per-camera data + combined rig storage), Task Board (kanban + checklists, with imports from the schedule, workflow and deliverables, and multi-select drag, PDF/CSV/JSON export), Deliverables (multi-recipient delivery plan → make-order, a per-variable checklist, a live workflow chart, and attach contracts/specs per recipient), and News Watches. Vendor directory deepened (DIT/dailies, NZ, captions — 200+ verified). Mastering made customisable. Every tool is now per-project.",
  "v1.9.100 — Removed the tagline strip from the header for a cleaner top bar.",
  "v1.9.99 — New Vendor Directory (top-right menu): 139 verified post-production vendors — facilities, film labs, colour, VFX, audio, DCP/QC, camera rental, plus the global software & hardware the post world runs on. Searchable and filterable by region (AU, NZ, UK, France, Germany, Singapore, Global) and type. Built from the NZ post-super reference + web research, each verified as operating at research time; links open the vendor's site. Confirm current details before relying on a listing.",
  "v1.9.98 — Header: a Login button (placeholder — accounts coming soon) and a top-right menu. Menu has About (who it's for / what it does / why it exists), Send feedback, Privacy, and Terms & disclaimer — the last one is explicit that every figure is reference-only, things change fast so verify against source, and there's no liability for getting it wrong. Vendor directory is in the menu and is the next build.",
  "v1.9.97 — New favicon to match Kaos Theory: a particle tracing a strange-attractor orbit in the brand orange on the dark tile (SVG + 32px PNG + multi-size .ico), replacing the old framing-bracket icon.",
  "v1.9.96 — Wordmark: “KAOS THEORY” now reads in a single orange across the header and entry screen.",
  "v1.9.95 — Renamed to Kaos Theory — tagline “what you're shooting · who it's for · how it gets there”. The app outgrew “post super”: it's now for the whole capture-to-delivery crew — DITs, camera, editorial, online/assists and audio. Updated the wordmark, entry screen, browser tab + social meta and every export brand mark (framing chart, spec sheet, Camera Report PDF, schedule JSON/iCal, FDL creator). Your saved schedules, custom workflows and plates are untouched.",
  "v1.9.94 — Custom Mastering: a small amber hint now appears when your Derived settings (strategy, deliverables, peak nits or ACES version) have changed since you seeded the custom copy — so it's obvious when ‘Re-seed from Mastering’ is worth a click. It clears the moment you re-seed.",
  "v1.9.93 — Mastering Workflow is now customisable: a Derived / Custom toggle. Derived is the same smart auto-built tree (Hero + deliverables → correct order, red up-volume flags). Custom unlocks a fully editable copy of it — drag, rename, connect, add/remove nodes, undo/redo, save named versions and export (PNG/PDF/CSV/JSON), seeded from your current derived tree. Edge colours carry the meaning across (cyan = ACES-managed, red = up-volume re-grade). 'Re-seed from Mastering' refreshes the canvas from Derived after you change strategy or deliverables.",
  "v1.9.92 — Custom Workflow: connections can now carry a label describing the handoff (e.g. 'approved show LUT', 'locked EDL + plates'). Click any line to type one; it shows on the curve and flows through to the CSV and image/PDF exports.",
  "v1.9.91 — Custom Workflow: connections between nodes are now smooth curves (bezier) instead of right-angle steps — easier to follow when nodes branch and cross.",
  "v1.9.90 — Custom Workflow: the × that deletes a connection now only appears when you hover over (or near) that line, keeping the canvas clean. The line also brightens slightly so you can see which one you're about to remove.",
  "v1.9.89 — Custom Workflow: added Undo / Redo (⌘Z / ⌘⇧Z — covers accidental node/connection deletes, drags, template & clear), Save with named versions (save multiple workflows, reload or delete any), and Export to PNG, PDF, CSV (spreadsheet of steps + their connections) and JSON backup.",
  "v1.9.88 — Custom Workflow moved inside the Workflow tab (toggle Production / Custom Workflow) instead of a separate tab. Connections now have a × button to remove them (and a node can branch to many). New 'Template' button drops a basic 6-step skeleton (Camera Test → Shoot/Offload → Editorial → VFX → Grade/Online → Delivery) to build from. Palette steps show a ✓ when they're already on the canvas.",
  "v1.9.87 — New Builder tab: a free-form custom workflow editor (node graph, like a Resolve node tree / mindmap). Tick standard post steps from the palette to drop them in, drag nodes to arrange, drag port→port to connect, click a node to rename / set owner / edit notes / recolour, Delete to remove. Starts from a Camera Test node and saves to the browser. Built on React Flow, loaded only when you open the tab.",
  "v1.9.86 — Capture: removed the two 'Reference Plate' demo entries from the camera list (they weren't real cameras). The uploadable reference-plate feature for the framing chart is unaffected.",
  "v1.9.85 — Planner: zoom in far enough and the timeline switches to a day view — day columns (weekends tinted) and a 'Day view' badge — and dragging / resizing bars now snaps to whole days instead of weeks. Bar labels and the duration field read in days when a phase isn't a whole number of weeks.",
  "v1.9.84 — Capture: added the new GoPro Mission 1 (compact 1-inch 50MP 8K cinema cam) — 8K 16:9 and 4K 16:9 modes, 10-bit HLG.",
  "v1.9.83 — Glossary: fixed 'see also' links that pointed to a verbose label (e.g. 'ODT (Output Transform)') failing to find the page — they now resolve to the real entry (ODT) and land on it.",
  "v1.9.82 — Capture: expanded the DJI line (Air 3S 1-inch, Air 3, Mini 4 Pro, Avata 2 FPV, Osmo Pocket 3 1-inch + Pocket 2), and added GoPro Hero 11 / 12 / 13 Black (1/1.9-inch 8:7 sensor, 5.3K in 8:7 and 16:9; GP-Log on 12/13, HLG on 11). Each maps to its real codec set in Storage (HEVC/H.264 for the consumer drones, Osmo and GoPro).",
  "v1.9.81 — Capture: added an iPhone 15 Pro 4K ProRes 16:9 (landscape) mode alongside the vertical one, and a new DJI drones group — Inspire 3 (Zenmuse X9-8K full-frame, 8K 17:9 + 2.4:1) and Mavic 3 Pro Cine (5.1K Hasselblad). Their native codecs (ProRes RAW / ProRes 422) flow through to the Storage tab.",
  "v1.9.80 — Storage: the recording-codec picker and the codec-comparison table now show only the codecs the chosen camera actually records (e.g. a Canon body shows Canon Cinema RAW + XF-AVC, not RED REDCODE or Sony X-OCN); switching camera resets the codec to a compatible one. Removed the in-app changelog popover (kept in code for history).",
  "v1.9.79 — Audit pass 4 (Planner, Mastering view, Storage, Tools). Planner: long phases no longer get clipped off the timeline or truncated in the PDF/PNG export; you can now Import a schedule JSON to restore a backup (validated), and loading a saved version validates its data. Mastering view: parallel edges between the same two nodes (e.g. Dolby Vision analyse + trim) are spread apart instead of overlapping, and each master/deliverable now carries its audio loudness target (−27 LKFS streaming, −23 LUFS R128, theatrical reference level) on its detail panel. Storage: the media-plan 'fill %' no longer exceeds 100% when a camera needs more than one card a day. Tools: the Frames field rejects fractional/garbage input instead of silently rounding.",
  "v1.9.78 — Audit pass 3 (Glossary, Mastering, Workflow, ACES). Glossary factual fixes: Dolby Vision Profile 5 is 10-bit (not 12), Profile 8 is single-layer (not dual), EBU R128 tolerance is ±0.5 LU non-live / ±1.0 LU live, and the EBU 8-bar pattern is 100/0/100/0. Mastering: the Dolby Vision SDR-trim edge no longer tacks on an unrelated 600-nit target, and the SDR IMF is relabelled App 2E (ST 2067-21, the current consolidated standard). Workflow: removed a VFX edge that looped finals backward into the pre-lock cut, wired Synced Dailies into the offline, and clarified the audio-conform dependency. ACES: tightened the HLG, ACEScct/ACEScc and interchange-encoding notes.",
  "v1.9.77 — Audit pass 2 (Tools + Planner). Timecode: the audio-pull % was inverted (now reads 104.17% pull-up for 24→25, matching the pitch); drop-frame inputs that don't exist (e.g. 00:01:00;00) are now rejected instead of silently shifting. Aspect: 1.33 relabelled '4:3 / Full Aperture' and a true Academy (1.375) added. EDL converter: writes spec-compliant 8-char reels by default, collapses transitions to clean cuts (no malformed lone dissolves), actually skips audio-only tracks as documented, FCPXML source timecode no longer double-counts the asset start (~1h offset), and CSV that lacks reel/clip headers is no longer misread as EDL. Planner: the schedule 'End' date is now the inclusive last working day (was a day late) in the CSV, PDF/PNG and on-screen labels.",
  "v1.9.76 — Audit pass 1 (formats.ts — camera & codec data). Fixed an impossible ALEXA 65 anamorphic mode, a fabricated RED V-RAPTOR S35 8K (→ real 7K), a wrong 1.65x lens credit (Hawk65 → Ultra Vista), a duplicate VENICE 2 mode, and a missing sensor crop on the 6K S35 1.3x. Recalibrated codec data rates that were off: ProRes (whole table was an fps notch high — ~20% at 24/25), REDCODE (~35% low), ARRIRAW HDE (~2.7× understated; it's lossless ~1.7:1), ARRIRAW uncompressed (13-bit). Circle of confusion now uses the cinema width/1500 (was diagonal) so DoF/hyperfocal match pCam; DoF panel notes the f-number vs T-stop point. Storage and framing/optics estimates are now correct.",
  "v1.9.75 — Glossary: re-categorised albert (→ Roles & Paperwork), Cinelab and FotoKem (→ Camera & Capture) out of NZ Industry — they're international.",
  "v1.9.74 — Glossary: removed 11 NZ-specific / facility entries (Park Road Post, Wētā FX, NZ VFX Houses, NZ Post Facilities, NZ Soundstages, NZ Exhibitors, Cause & FX Managed-Service Model, NZ Privacy Act 2020, Screen Industry Workers Act 2022, Te Reo Māori Subtitling, TVNZ On-Air Spec) and pruned their cross-links. Now 574 terms.",
  "v1.9.73 — Added Vercel Web Analytics — privacy-first visitor counts, page views, referrers and country (no IPs, no cookies). Needs enabling once in the Vercel dashboard.",
  "v1.9.72 — Planner now opens pre-filled with the standard post template on a first visit, instead of an empty canvas with a button. Clearing the schedule still gives you the blank empty-state.",
  "v1.9.71 — Private-preview password gate is now continuous (no 24h auto-lift) — it stays on until removed; visitors who enter the password are remembered on their device.",
  "v1.9.70 — Added a temporary private-preview password gate on the live site (auto-lifts after ~24h). Soft wall for sharing, not real security.",
  "v1.9.69 — Planner: the Template now lays down the full 15-item post schedule — Prep, Camera Test, Show Look, PP (keyframe), Shoot, Offload/DIT, Offline, Lock (keyframe), Conform, VFX, Grade, Audio Post, Online, QC, Delivery — with realistic overlapping durations, still anchored to the current week.",
  "v1.9.68 — Tools: the EDL Converter is now a full multi-format sequence converter. It auto-detects and reads CMX3600 EDL, FCP7 / Premiere / Resolve XML, FCPXML (best-effort) and CSV, shows a clean preview table, and converts out to XLSX (native Excel), CSV, EDL (CMX3600, with a reel-name>8 toggle), PDF cut list, or JSON. Drop-frame aware. Like editingtools.io it targets cut lists (transitions become cuts, audio-only tracks skipped). New parsers/writers are unit-tested; XLSX loads on demand so it doesn't bloat startup.",
  "v1.9.67 — New Tools tab: post-production calculators + an EDL converter. Timecode (TC↔frames↔seconds and add/subtract, with proper SMPTE drop-frame for 29.97/59.94), Frame Rate / conform (re-time a duration to a new rate with speed %, audio pull and pitch-shift — the 24→25 PAL speed-up, NTSC 0.1% pull, etc.), Aspect Ratio (W×H → ratio/standard name, and solve a dimension for a target ratio), and an EDL Converter (paste/load a CMX3600 EDL → clean event table → copy/export CSV). Timecode and EDL maths are unit-tested.",
  "v1.9.66 — Glossary: larger, bolder term headings for easier scanning.",
  "v1.9.65 — Planner: the Seed button is now Template — it lays the standard post phases down starting from the current week (not week zero). New Save button keeps named version snapshots in the browser that you can reload or delete anytime. New Export menu: PDF (a proper drawn Gantt chart), PNG image, Calendar (.ics — drop every phase and milestone straight into Google/Apple/Outlook calendar), CSV spreadsheet, and JSON backup.",
  "v1.9.64 — Planner: group-move now works. The date editor was popping up on the first selection and covering the rows below it, so shift-clicks meant for the next bars hit the popover instead. Editing a date (plain click) is now separate from building a multi-selection (shift-click) — shift-click as many bars as you like with nothing in the way, then drag any one to move them all together.",
  "v1.9.63 — Planner: fixed the layout bug where a zoomed-in (wide) timeline stretched the whole panel — pushing the toolbar (Start date, zoom, Seed…) off-screen and stopping drag-to-pan from working. The timeline now scrolls inside its own box, the toolbar always stays in frame, and you can drag anywhere on the canvas (including below the rows) to pan.",
  "v1.9.62 — Planner interaction fixes: the plain mouse wheel now zooms the schedule (no modifier — so it never triggers the browser's page zoom that was pushing the toolbar off-screen; the toolbar always stays in frame). Drag any empty part of the timeline to pan left/right and up/down. Shift-click bars to multi-select, then drag any of them to move the whole group together (relative spacing preserved). Shift-wheel still nudges sideways.",
  "v1.9.61 — Planner: click any bar or keyframe to open a small editor and type an exact date (day-level precision) — plus rename, set duration in weeks, or convert between phase and keyframe. Scrolling fixed: the plain mouse wheel now scrolls the timeline left/right, and ⌘/Ctrl/Alt-wheel zooms (the +/− buttons still zoom too).",
  "v1.9.60 — Planner: rows now reorder (drag the grip handle), you can add your own Keyframes (milestone diamonds) as well as phases, the mouse wheel zooms the week scale (centred on the cursor) with +/− buttons too, and shift-wheel scrolls sideways. Glossary: search is now relevance-ranked — an exact term match jumps to the top (e.g. 'DCP' shows the DCP entry first), then starts-with, then alternate names, then definition hits; A–Z browse stays when the box is empty.",
  "v1.9.59 — Planner reworked into a drag-and-drop weekly Gantt. Each phase is a bar on a week/month timeline — drag the body to move it, drag an edge to resize the duration; Lock shows as a milestone diamond. Set a project start date, hit Seed for the standard phases (Prep · Shoot · Offload · Offline · Lock · Grade · Online · QC · Delivery), and read durations at a glance. Frozen phase column + month/week headers, a Today line, and Today/Add-row controls. Saves to the browser.",
  "v1.9.58 — New Glossary tab: 585 post-production terms, abbreviations and standards — camera & capture, colour & HDR, ACES, editorial, VFX, audio, mastering & delivery, QC, security and NZ industry. Live search (matches term, alternate names and definition), category filters, an A–Z jump rail, and clickable 'see also' cross-links. Built from the NZ post-super reference plus web research and fact-checked.",
  "v1.9.57 — New Planner tab: a Post Schedule. Phase-grouped milestones (Prep · Offline · VFX · Online · Grade · Audio · QC · Delivery) each with an owner, due date and status (To do / In progress / Done / Blocked). Set a delivery date and 'Seed standard' back-dates a full post timeline from it; progress bar, overdue flag and next-up readout up top. Saves to the browser.",
  "v1.9.56 — Renamed to PostSup Tools. Updated the wordmark, browser tab title and every export brand mark (framing chart, spec sheet, Camera Report PDF, FDL creator).",
  "v1.9.55 — Slate block now shows the same rotating chevron the other collapsible panels use, so it's clear it opens — replaced the faint text arrow with the standard ChevronRight on the right edge.",
  "v1.9.54 — Renamed to Southlight Tools — the southern-hemisphere take on the steady, even 'south light' shooters work by. Removed the header byline for a cleaner top bar; updated the wordmark, tab title and every export brand mark.",
  "v1.9.53 — Renamed the product from LuminaFox Frame Matrix to Northlight Guide, with the byline 'Capture · Framing · Delivery' in the header. Updated the wordmark, browser tab title + social meta, and every export brand mark (framing chart, spec sheet, Camera Report PDF, FDL creator). Saved-plate storage keys left unchanged so nothing local breaks.",
  "v1.9.52 — Workflow: the canvas no longer accidentally selects text when you drag to pan or click around — the whole pipeline view is now selection-proof.",
  "v1.9.51 — Workflow: finishing-detail pass. New KDM Key Creation node off the DCP — the full encrypted-DCP key lifecycle (distributor playdate/screen list → cinema projector cert → per-screen KDM tied to CPL UUID + cert thumbprint + validity window + forensic-mark flags → TMS import → auto-expire) plus the classic failures (wrong CPL UUID, UTC-vs-NZST timezone, wrong/expired cert, flag mismatch, InterOp-on-SMPTE). New Late VFX Drop-ins node — finals landing after picture lock are re-conformed shot-by-shot and re-QC'd. New Font Licences paperwork node — embedding rights for titles/subs fonts (desktop ≠ broadcast/streaming). Screeners node is now Security · TPN · Screeners: MPA TPN tiers (Blue/Silver/Gold/Gold Shield) + CSBP v5.3.1 controls + Netflix overlay + the post-super's vendor security register. Grade node notes the DI tool is Resolve OR Baselight — identical ACES→grade→IMF/DCP workflow, only nomenclature and where the IMF/DCP wrap happens differ.",
  "v1.9.50 — Workflow: fixed edge labels overlapping nodes across bands. Canvas chips now always show the compact op token (full text on hover + in the side panel's Produced-by/Feeds), and chips for edges that jump over an intermediate stage (e.g. Mastering → Delivery skipping QC) are suppressed so nothing lands on the in-between nodes.",
  "v1.9.49 — Workflow: filled out the online & the tail. Online/Conform now assembles Main & End Titles, the Graphics package and licensed Archive/Stock footage (clip licence + IDT + frame-rate match) into the online master. New 'Deliverables & Paperwork' stage covers the bundle that ships with the masters: textless/clean, subtitles · SDH · captions, the music cue sheet + returns (APRA AMCOS), conform EDLs + change lists, transcript / as-broadcast script, graphics/titles package, trailers/promos/key art, and the chain-of-title + E&O binder (no binder, no acceptance). Key paperwork is archived with the master.",
  "v1.9.48 — Workflow: fixed edge labels overlapping the cards in tightly-packed stages (the cut ladder, VFX, audio). Same-band edge labels now stay compact and sit in the gap above the node row instead of expanding to a full sentence on top of the nodes; full text is still on hover and in the side panel.",
  "v1.9.47 — mined the NZ post-super reference hard: audio now has a Spotting Session → DME (with mixers/owners), the Loudness node carries every platform target (−27 LKFS Netflix · −23 R128 TVNZ · −24 ATSC Amazon), QC carries the real automated flag categories + NZ-specific issues + the signed QC-report fields, Delivery carries the actual Netflix/Amazon/TVNZ specs + the 9-step DI→DCP with ISDCF naming/KDM, a new Screeners node covers forensic watermarking governance, and Archive covers mezzanine formats + LTO-8/9/LTFS + geo-redundant + checksums. Most nodes now name their owner.",
  "v1.9.46 — Production Workflow ramped up through offline → lock and VFX (from an NZ post-supervisor master reference): the editorial stage is now the full cut-approval ladder (Assembly → Director's → Producer's → Network/Studio → Picture Lock → Turnover package), and VFX is the real 8-step pull & approval process (shot list → EDL → plate pull with agreed handles → reference → ingest confirm → comp → ShotGrid/Ftrack version review → approved final). Every node now carries an OWNER (VFX Editor, 1st AE, Online/Conform, VFX Vendor, VFX Producer + Post Super…), approval/sign-off edges are green, and the Conform node carries the full conform checklist + common problems.",
  "v1.9.45 — the Production Workflow tab now reflects YOUR project: the Camera Original shows the selected camera/codec, the ACES Grade shows the ACES version + resolved IDT + Output Transform, the Mastering stage shows the chosen hero/strategy/nits, and the IMF node shows the delivery target + HDR. The mastering strategy/peak/custom config is now shared between the Mastering and Workflow tabs (one source of truth).",
  "v1.9.44 — new Production Workflow tab: the whole pipeline as a vertical node tree — camera test + show LUT → on-set → DIT offload/verify → dailies → editorial lock → VFX pull/comp/master loop → conform → grade & masters → 3-layer QC (with fail-loops back upstream on a red rail) → delivery → long-term archive, plus a parallel AUDIO column (production sound → DME editorial → final mix/Atmos/printmaster/loudness QC) that re-marries picture at the IMF/DCP wrap. The Grade & Mastering stage folds in the existing Mastering tree (click → open it). Research-driven and adversarially verified (Netflix/SMPTE/ACES/Dolby). Planning view, not an automated pipeline.",
  "v1.9.43 — Mastering Workflow: actually fixed pan/scroll. The canvas container wasn't width-constrained (a missing flexbox min-width:0), so it grew to fit the content and had nothing to scroll — the grab cursor moved but nothing happened. Now it's bounded and scrollable, so drag-to-pan, sideways scroll and the scrollbar all work.",
  "v1.9.42 — Mastering Workflow: fixed horizontal scrolling. The wheel handler was swallowing sideways trackpad/wheel gestures (so the scrollbar never appeared); now horizontal-intent and shift-scroll move the canvas, vertical wheel still zooms, and there's an always-visible thin scrollbar plus drag-to-pan. Added an on-screen hint for the controls.",
  "v1.9.41 — Mastering Workflow gains a Custom strategy: pick the master you grade first (HDR PQ / DCI-P3 theatrical / SDR Rec.709) and toggle which deliverables you need (streaming HDR, theatrical DCP, SDR/Broadcast HD, ACES archive, proxies). The tree derives the order for you — down-volume targets derive cleanly, while anything above the hero's dynamic range is shown as a fresh up-volume re-grade off the archive (flagged red), because that's unavoidable.",
  "v1.9.40 — Mastering Workflow, colourist notes: the mastering-display peak is now selectable (1000 / 2000 / 4000 nit; 1000 default) and flows through the HDR hero, HDR10 and IMF masters and the PQ Output-Transform edge. Node side-panels now carry the caveats a reviewing colourist would raise — the theatrical DCDM is a DEDICATED 48-nit trim (not a tone-map down), the SDR is a DV auto-map + manual per-shot trims, and HDR10+ needs its own pass.",
  "v1.9.39 — Mastering Workflow is now navigable: mouse-wheel zoom toward the cursor, drag-to-pan the canvas, shift+wheel horizontal scroll, and −/＋/Fit zoom controls so you can move across all the lanes (Deliverables / Viewing were off-screen on smaller windows).",
  "v1.9.38 — Mastering Workflow legibility: wider lane spacing; edges now show a compact op token (OT / trim / wrap / REGRADE…) by default instead of overlapping full-sentence labels, with the full transform on hover and when you click a node; metadata sidecars get a dashed pill so they read as 'not a picture master'.",
  "v1.9.37 — new Mastering Workflow tab: a deliverables node-tree (DAG) showing how the grade flows into the ACES archive, a chosen hero master, and down through trim/derive/wrap edges to each deliverable and viewing copy. Pick a strategy — HDR-First, Theatrical-First or Dual-Hero — and the tree re-derives, flagging up-volume re-grades (e.g. theatrical → HDR) in red because they're a fresh grade off the archive, not a clean transform. Output-Transform edges read from the same ACES fixtures as the Optics/ACES tab (2.0/1.3). Research-driven and verified vs Netflix/Dolby/SMPTE.",
  "v1.9.36 — moved Secondary Crop up to sit directly under 'Framing For' (it's the same kind of aspect choice). Removed the redundant '2:1 in UHD/HD 16:9' delivery presets (use a Secondary Crop instead) and the Mastering (IMF / ProRes master) targets for now.",
  "v1.9.35 — your uploaded reference plate is now remembered across refreshes (saved to this device, downscaled + compressed to fit), and it reloads in whatever mode you left it — Guide / Your Plate / Off.",
  "v1.9.34 — UX: the Delivery Spec and ACES Colour Pipeline panels are now obvious expandable cards (bordered, with an icon, a value preview and a chevron) instead of easy-to-miss text. Reference Plate gains a Guide / Your Plate / Off toggle — your uploaded plate is kept when you switch to the guide and back, and a separate Replace / discard control.",
  "v1.9.33 — new LuminaFox favicon (cyan framing brackets + orange centre ring on a dark tile, matching the chart palette) as SVG + multi-size .ico + PNG, replacing the leftover Lovable icon; dropped the stray Lovable Twitter handle.",
  "v1.9.32 — renamed the product from Lumina to LuminaFox (header brand, PNG chart mark, FDL / spec-sheet creator, Camera Report PDF, page title & metadata).",
  "v1.9.31 — exporting a PNG/FDL while a live punch-in (extraction scale) or reframe is active now warns that the chart/FDL is the neutral delivery framing reference and those shot-level adjustments aren't baked in (instead of silently dropping them).",
  "v1.9.30 — ACES now resolves Canon Log 3 (e.g. R5 C) and Blackmagic Film Gen 5 (URSA Cine / Pocket) to their official IDTs instead of 'unknown'. Added ProRes 422 HQ UHD/HD mezzanine master targets; merged the duplicate YouTube Short / Vertical social entries; aligned the camera-count cap (now 1–32 everywhere).",
  "v1.9.29 — storage & codec accuracy: file sizes and card capacities are now decimal (GB = 1e9 bytes, matching Finder / Hedge / Silverstack and how cards are marketed) instead of mixing binary GiB math with decimal-marketed cards. ProRes bitrate now scales on real W×H (anamorphic / tall modes were understated ~25%). Sony X-OCN recalibrated to the verified 8.6K 17:9 figure (LT 1,706 Mbps). DNxHR HQX corrected to 12-bit 4:2:2 (~666 Mbps @ UHD).",
  "v1.9.28 — accuracy pass (audit-driven, spec-verified): Netflix approval corrected (Nikon Z9/Z8 & Fuji GFX100 II removed — not Netflix brands; Sony FX3 promoted to approved; Sony FS7/FS7 II added). Camera specs fixed: RED V-RAPTOR S35 4:3 2x corrected to the real 8K 5760×4320 @ 18.43×13.82 mm (the old 19.66 mm height didn't exist); ALEXA Mini 3.4K OG capped at 30 fps (ARRIRAW); Phantom Flex4K → 938 fps / 16:9 label; C500 Mk II relabelled 17:9; ALEXA Mini 2.8K ana used-height corrected; replaced a fabricated VENICE 2 '1.8× anamorphic' mode with the real 5.8K 6:5 2×. Lenses: Cooke Anamorphic FF+ image circle 52→46.3 mm; S35 & large-format anamorphics now have their own family buckets. Optics DoF caption corrected. Protection slider now spans the full 0–40%; custom-aspect label matches the realized ratio.",
  "v1.9.27 — moved '2:1 in UHD 16:9' and '2:1 in HD 16:9' from Cinema to Broadcast. They're streaming masters (a 2:1 active area inside a 16:9 container with Netflix HDR + streaming audio), not theatrical DCI deliverables.",
  "v1.9.26 — renamed the slate 'DP / Author' field to just 'Author' and dropped the 'DP' prefix from the stamps on the PNG chart, FDL, Camera Report and spec sheet.",
  "v1.9.25 — fixed the secondary-crop label on the PNG chart: it was colliding with (and hidden behind) the FINAL FRAME label at the top-left and was hard to read in violet. It's now at the bottom-left of the crop rectangle in a lighter, legible lavender.",
  "v1.9.24 — added an ACES colour-pipeline reference (ACES 2.0 default, 1.3 optional): from the selected camera + delivery it shows the Input Transform (IDT) with an official-vs-third-party badge, the working/interchange spaces (ACEScct / ACEScg / ACES2065-1) and the Output Transform (display · EOTF · peak nits). It's a read-only readout — Frame Matrix doesn't apply transforms — and it's carried into the Camera Report PDF and the copied spec sheet. Data web-verified and adversarially fact-checked (Nikon N-Log / Fuji F-Log2 correctly flagged as having no official ACES IDT).",
  "v1.9.23 — added a Slate block (00 · Slate): enter Project / Production and DP / Author once, and it's stamped onto the PNG framing chart, the FDL (fdl_creator), the Camera Report PDF, the copied spec sheet, the file names, and the permalink. The date is added automatically.",
  "v1.9.22 — removed UHD 8K as a delivery target (shoot 8K, deliver 4K is the supersampling path) and removed the audio delivery spec (channels / LUFS / dBTP) — this tool is the picture path; loudness is a sound-department concern. Tightens the Delivery panel and the Camera Report.",
  "v1.9.21 — added a downloadable Camera Report (PDF): a printable spec sheet covering source/lens, recording, delivery, extraction, and the full mag/card + offload + proxy storage plan (runtime per card, cards-per-day, on-set inventory, daily footage). Mirrors the on-screen state and the permalink.",
  "v1.9.20 — added a Custom aspect option to 'Framing For': enter any W:H ratio and it drives the framing, chart, FDL and extract math like any preset (persisted in the permalink).",
  "v1.9.19 — new Optics tab: field-of-view (H/V/diagonal + subject-plane coverage), depth of field (near/far/total + hyperfocal, anamorphic-aware), and focal-length equivalence (full-frame / Super 35) for the selected camera. Math is unit-tested.",
  "v1.9.18 — expanded the camera library (ARRI ALEXA Mini, Sony VENICE 1, RED KOMODO, Nikon Z9, Fujifilm GFX100 II, Phantom Flex4K, Canon C700 FF) and the lens library (Master/Ultra Prime, Cooke Panchro/S7, CP.3, Sumire, Thalia, Master/Hawk/Atlas/Panavision anamorphics, etc.); updated Netflix-approval matching for the new bodies.",
  "v1.9.17 — added Saved Setups: save the current camera + framing + storage configuration (stored locally for now), reload it in one click, or delete it. Built on the URL-encoded state, so it's ready to sync to a user account later.",
  "v1.9.16 — fixed the anamorphic PNG export: the chart now renders in desqueezed display space (canvas width = sensor width × squeeze), so the plate, final frame and secondary crop all read at true proportions and match the live viewer. The FDL stays in recorded pixels with the squeeze recorded. Spherical cameras unchanged.",
  "v1.9.15 — Protection now shows a live '% reserved' readout below the slider (previously static helper text); the value updates with the slider, the number field and canvas drag. Reviewed the other slider/readout pairs — all live.",
  "v1.9.14 — widened the left inspector panel (320 → 384px) so labels/hints stop wrapping and the column is shorter.",
  "v1.9.13 — replaced the geometric Netflix 'N' with the official Netflix mark in the approved-camera badges.",
  "v1.9.12 — removed the TIFF export option; chart export is now PNG + FDL.",
  "v1.9.11 — 'Center & Fill' now adheres to the protection frame: it fills so the PROTECTION boundary reaches the widest sensor edge (extraction scale = 1 − protection), leaving the final frame inset by the protection %.",
  "v1.9.10 — added a 'Center & Fill' button (under Extraction Scale): recenters the reframe and sets the extraction to 1.0 so the crop fills to the widest sensor edge.",
  "v1.9.9 — removed the Fit/Fill toggle and merged the Reframe/Extract readout into '02 · Framing & Extract'. The extraction is now always the delivery-aspect cover crop of the sensor (framing aspect set by 'Framing For'); crop %, sensor-retained, pixel-scale and extract-px still shown.",
  "v1.9.8 — fixed drag-to-reframe (broken in v1.9.6): the Extraction Scale size-down now shrinks the frame in both Fit and Fill again, restoring the reframe headroom you pan within. At Extraction Scale 1.0 the frame still fills the sensor edge.",
  "v1.9.7 — FIT now retains the delivery aspect ratio (regression fix): both Fit and Fill keep the final frame at the target aspect. FILL = the target-aspect frame that fits inside the sensor (crops edges); FIT = the target-aspect frame that encloses the whole sensor (no crop, adds letterbox/pillarbox bars).",
  "v1.9.6 — in FILL mode the final frame now fills the sensor to its edge (an extraction size-down no longer pulls it inward; punch-in still allowed), so with the studio plate on you can see the frame filling the captured image. The plate stays cropped to the chosen camera's sensor aspect.",
  "v1.9.5 — aligned the live viewer's frameline colours with the export chart so the boxes are distinguishable: sensor = slate, final frame = cyan, protection = orange, secondary crop = violet (previously the final frame and protection were both amber/orange, which made Fit/Fill changes hard to read).",
  "v1.9.4 — fixed the Fit/Fill toggle, which previously did nothing: FILL now covers (crops the sensor to fill the delivery) while FIT contains (keeps the whole sensor, letterbox/pillarbox, nothing cropped). Crop %, sensor-retained, pixel-scale and method readouts now differ between the two.",
  "v1.9.3 — registration arrows now point to the final-frame edges exactly (tips land on the frameline, per the Netflix reference); the info box moved to centre, below the crosshair; exported chart filenames are date-stamped (YYMMDD_…).",
  "v1.9.2 — added a 'Studio plate background' toggle for the chart export: PNG/TIFF can now be composited over the reference studio image (desqueezed, with a contrast scrim) instead of the clean ASC field. FDL is geometry-only and unaffected.",
  "v1.9.1 — logic pass for DOP / DIT / Post Supervisor use: protection now drawn OUTSIDE the final frame in the live viewer (was inset); secondary delivery crop (e.g. 2:1) is exported onto the framing chart + FDL as a real guide, not just a preview; Sony X-OCN bitrates recalibrated to Sony's published figures; storage unified into the Storage tab (offload + proxies restored there, spec sheet no longer reports frozen defaults); 'deliver 2:1 / protect 16:9' now models the two as different aspects; per-mode fps ceilings warn when exceeded; reference background optimised to a 4K JPEG.",
  "v1.9 — Storage button moved beside Capture & Framing; reframe box can now be resized via corner handles (not just repositioned); framing-chart export rebuilt as a clean ASC/Netflix-style chart — neutral working field (no guide image), four Siemens-star focus targets, inward edge registration marks, rounded framing-decision + protection rectangles, centre crosshair with focus ring, and the LUMINA / FRAME MATRIX brand mark — in our cyan/orange palette.",
  "v1.8 — removed the Source/Delivery view switch (framing view is the only mode); fixed the 'Drag to reframe' badge overlapping the protection label; framing-chart export redesigned with an ASC/Netflix camera-chart feel — rounded framelines, corner brackets + edge-centre registration ticks on the final frame, and a centre crosshair with focus ring (cyan final frame / orange protection flavour kept).",
  "v1.7 — unified project state across both stages: the camera, codec and frame rate chosen in Capture & Framing now flow into the Storage tab (and back), so the two stages can no longer disagree. Codec is no longer force-reset to the camera's native set, keeping the Storage tab's cross-camera codec comparison intact.",
  "v1.6 — restructured to two stages: 'Capture & Framing' (camera + framing intent + reframe/protection) and 'Storage'; removed the standalone Delivery Target menu (its target aspect is now 'Framing For', the framing intent that drives the chart) and folded HDR/audio into a collapsed 'Delivery spec' block; dropped the duplicated Recording panel from the framing view (Storage tab owns it). Framing chart now reads the ASC way — the bright inner rectangle is the FINAL FRAME (framing decision) and the tinted band around it is PROTECTION (reserved headroom); reference/temp background is drawn desqueezed.",
  "v1.5 — downloadable framing chart: full-resolution PNG, LZW-compressed TIFF, and ASC Framing Decision List (.fdl, Netflix/ASC v2.0 standard) exports; Netflix camera-approval shown as the Netflix logo on each approved camera (muted for limited-use) instead of text tags; Protection guide now uses the ASC/Netflix total convention (symmetric inset) so the on-screen overlay matches the exported chart and FDL; added a math/geometry test suite (bitrate, extraction, offload, FDL geometry vs. the canonical ASC sample, TIFF encoder).",
  "v1.4 — color space + transfer per camera; HDR variant selector (Dolby Vision / HDR10 / HDR10+ / HLG / SDR); audio + LUFS targets per delivery; lens image-circle overlay (red flag if uncovered); card runtime + offload-budget calculator; aspect panel split into Sensor · Image when desqueezed; renamed mislabelled modes (ALEXA 35 3.3K 6:5 ana, RED VV 17:9, URSA 6:5 ana, Canon C400/R5C); fixed VV anamorphic sensor-area-used math; replaced impossible Panavision DXL2 6K ana and VENICE 2 8.2K ana with real modes; recalibrated bitrate model — RAW rates ×8 (was 8× understated), Apple ProRes table, added ARRIRAW HDE.",
  "v1.3 — fps + native codec selectors, data-rate (Mbps · GB/hr · TB/day), spec-sheet export, shareable permalink, safe-area overlay, ratio labels, clearer wording.",
  "v1.2 — capture-data corrections: removed 5 impossible modes, added real RED VV/S35/MONSTRO anamorphic modes, fixed ALEXA 65 4.3K ana, BMPCC 6K Pro 16:9 label, Sony 6:5 labels, missing sensor dimensions.",
];

const HDR_VARIANTS: HdrVariant[] = ["SDR", "HDR10", "HDR10+", "Dolby Vision P8.1", "HLG"];

// Common offload bandwidth references (MB/s).
type ViewMode = "source" | "delivery";
type AppTab = "home" | "frame" | "storage" | "optics" | "mastering" | "workflow" | "planner" | "glossary" | "tools" | "vendors" | "news" | "multicam" | "board" | "deliverables";
type WorkflowView = "production" | "custom";
type MasteringMode = "guides" | "myworkflow";

// --- URL state helpers ------------------------------------------------------
const URL_KEYS = {
  src: "s",
  tgt: "t",
  codec: "c",
  fps: "fps",
  fit: "fit",
  view: "v",
  desq: "dq",
  thirds: "tr",
  safe: "sa",
  mask: "mk",
  guides: "g",
  pixel: "px",
  tab: "tab",
  hdr: "hdr",
  lens: "lens",
  card: "card",
  copies: "cp",
  bw: "bw",
  rec: "rec",
  cams: "cam",
  prx: "prx",
  prot: "pp",
  stn: "stn",
  aud: "aud",
  exs: "exs",
  dcr: "dcr",
  cw: "cw",
  ch: "ch",
  proj: "proj",
  auth: "auth",
  aces: "aces",
} as const;

const DELIVERY_CROPS: { id: string; label: string; ar: number | null }[] = [
  { id: "none",    label: "None (match target)", ar: null },
  { id: "2.39",    label: "2.39:1 Anamorphic Scope", ar: 2.39 },
  { id: "2.35",    label: "2.35:1 Classic Scope",    ar: 2.35 },
  { id: "2.20",    label: "2.20:1 70mm",             ar: 2.20 },
  { id: "2.00",    label: "2.00:1 Univisium",        ar: 2.00 },
  { id: "1.90",    label: "1.90:1 DCI Full",         ar: 1.90 },
  { id: "1.85",    label: "1.85:1 Flat",             ar: 1.85 },
  { id: "1.78",    label: "1.78:1 (16:9)",           ar: 16 / 9 },
  { id: "1.66",    label: "1.66:1 European",         ar: 5 / 3 },
  { id: "1.50",    label: "1.50:1 (3:2)",            ar: 3 / 2 },
  { id: "1.33",    label: "1.33:1 (4:3)",            ar: 4 / 3 },
  { id: "1.00",    label: "1:1 Square",              ar: 1 },
  { id: "0.80",    label: "4:5 Portrait",            ar: 4 / 5 },
  { id: "0.5625",  label: "9:16 Vertical",           ar: 9 / 16 },
];

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}
function readBool(name: string, fallback: boolean): boolean {
  const v = readParam(name);
  if (v == null) return fallback;
  return v === "1" || v === "true";
}
function readNum(name: string, fallback: number): number {
  const v = readParam(name);
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Saved setups — stored locally for now; the same shape can later sync to a
// user account (id/name/query are all that's needed to restore a full config,
// since the entire app state is URL-encoded).
type SavedSetup = { id: string; name: string; query: string; ts: number };
const SETUPS_KEY = "lumina-frame-setups";
function readSavedSetups(): SavedSetup[] {
  try {
    const raw = localStorage.getItem(SETUPS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

const Index = ({ project, onSwitchProject }: { project: Project; onSwitchProject: () => void }) => {
  // Hydrate from URL once
  const [appTab, setAppTab] = useState<AppTab>(() => {
    const t = readParam(URL_KEYS.tab) as AppTab;
    return t === "storage" || t === "optics" || t === "mastering" || t === "workflow" || t === "planner" || t === "glossary" || t === "tools" || t === "vendors" || t === "news" || t === "multicam" || t === "board" || t === "deliverables" || t === "frame" ? t : "home";
  });
  const [workflowView, setWorkflowView] = useState<WorkflowView>(() => {
    try { return localStorage.getItem(`postsup-workflow-view-${project.id}`) === "custom" ? "custom" : "production"; } catch { return "production"; }
  });
  useEffect(() => { try { localStorage.setItem(`postsup-workflow-view-${project.id}`, workflowView); } catch { /* ignore */ } }, [workflowView, project.id]);
  const [masteringMode, setMasteringMode] = useState<MasteringMode>(() => {
    try { return localStorage.getItem(`postsup-mastering-mode-${project.id}`) === "myworkflow" ? "myworkflow" : "guides"; } catch { return "guides"; }
  });
  useEffect(() => { try { localStorage.setItem(`postsup-mastering-mode-${project.id}`, masteringMode); } catch { /* ignore */ } }, [masteringMode, project.id]);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [mwRemount, setMwRemount] = useState(0);
  const [lastTab, setLastTab] = useState<HomeTab | null>(() => {
    try { const v = localStorage.getItem("kaos-last-tab"); return v ? (v as HomeTab) : null; } catch { return null; }
  });
  useEffect(() => {
    if (appTab !== "home") {
      setLastTab(appTab as HomeTab);
      try { localStorage.setItem("kaos-last-tab", appTab); } catch { /* ignore */ }
    }
  }, [appTab]);
  const [sourceId, setSourceId] = useState<string>(() => {
    const id = readParam(URL_KEYS.src);
    return id && SOURCE_FORMATS.some((s) => s.id === id) ? id : SOURCE_FORMATS[0].id;
  });
  const [targetId, setTargetId] = useState<string>(() => {
    const id = readParam(URL_KEYS.tgt);
    return id === "custom" || (id && TARGETS.some((t) => t.id === id)) ? id : "uhd-4k";
  });
  // Custom delivery aspect (W:H ratio) — used when targetId === "custom".
  const [customW, setCustomW] = useState<number>(() => readNum(URL_KEYS.cw, 2.39));
  const [customH, setCustomH] = useState<number>(() => readNum(URL_KEYS.ch, 1));
  const [showGuides, setShowGuides] = useState(() => readBool(URL_KEYS.guides, true));
  const [showMask, setShowMask] = useState(() => readBool(URL_KEYS.mask, true));
  const [showThirds, setShowThirds] = useState(() => readBool(URL_KEYS.thirds, false));
  const [showSafeArea, setShowSafeArea] = useState(() => readBool(URL_KEYS.safe, false));
  const [desqueeze, setDesqueeze] = useState(() => readBool(URL_KEYS.desq, true));
  const [pixelTrue, setPixelTrue] = useState(() => readBool(URL_KEYS.pixel, false));
  // Fit/Fill removed — the extraction is always the delivery-aspect cover crop
  // of the sensor (the framing aspect is chosen in §02 Framing).
  const fitMode: FitMode = "fill";
  // Delivery view removed — the framing/source view is the only mode now.
  const viewMode: ViewMode = "source";
  const [fps, setFps] = useState<number>(() => readNum(URL_KEYS.fps, 24));
  const [reframeOffset, setReframeOffset] = useState({ x: 0, y: 0 });
  const [sourceTransform, setSourceTransform] = useState<SourceTransform>({
    scale: 1,
    x: 0,
    y: 0,
  });
  // Reference plate — the uploaded image is kept separately from the active
  // selection (so Guide ⇄ Your Plate ⇄ Off doesn't lose it) AND persisted to
  // localStorage so it survives a page refresh.
  const [uploadedImage, setUploadedImage] = useState<string | null>(() => readStoredPlate());
  const [plateMode, setPlateMode] = useState<PlateMode>(() => {
    const m = readStoredPlateMode();
    return m === "uploaded" && !readStoredPlate() ? "guide" : m;
  });
  const refImage =
    plateMode === "guide" ? BUILTIN_GUIDE : plateMode === "uploaded" ? uploadedImage : null;
  const usingBuiltin = plateMode === "guide";
  // Composite the studio plate behind the exported chart (PNG/TIFF) instead of
  // the clean ASC-style field. FDL is geometry-only and ignores this.
  const [exportWithImage, setExportWithImage] = useState(false);
  // Saved setups (localStorage; ready to sync to an account later).
  const [savedSetups, setSavedSetups] = useState<SavedSetup[]>(() => readSavedSetups());
  const fileRef = useRef<HTMLInputElement>(null);

  // HDR + lens + storage planning
  const [hdr, setHdr] = useState<HdrVariant>(() => {
    const v = readParam(URL_KEYS.hdr) as HdrVariant | null;
    return v && HDR_VARIANTS.includes(v) ? v : "SDR";
  });
  const [lensId, setLensId] = useState<string>(() => {
    const id = readParam(URL_KEYS.lens);
    return id && LENSES.some((l) => l.id === id) ? id : "none";
  });
  const [cardId, setCardId] = useState<string>(() => {
    const id = readParam(URL_KEYS.card);
    return id && CARDS.some((c) => c.id === id) ? id : "cfx-1tb";
  });
  const [backupCopies, setBackupCopies] = useState<number>(() => {
    const n = readNum(URL_KEYS.copies, 2);
    return Math.max(1, Math.min(3, Math.round(n)));
  });
  const [bwId, setBwId] = useState<string>(() => {
    const id = readParam(URL_KEYS.bw);
    return id && OFFLOAD_BANDWIDTHS.some((b) => b.id === id) ? id : "tb3";
  });
  // Production planning — drives daily totals + proxy estimates
  const [recordHoursPerDay, setRecordHoursPerDay] = useState<number>(() => {
    const n = readNum(URL_KEYS.rec, 4);
    return Math.max(0.5, Math.min(24, n));
  });
  const [cameraCount, setCameraCount] = useState<number>(() => {
    const n = readNum(URL_KEYS.cams, 1);
    return Math.max(1, Math.min(32, Math.round(n)));
  });
  const [proxyCodecId, setProxyCodecId] = useState<string>(() => {
    const id = readParam(URL_KEYS.prx);
    return id && PROXY_CODEC_IDS.some((p) => p.id === id)
      ? id
      : PROXY_CODEC_IDS[0].id;
  });
  // Protection / framing-safe inset (% of extraction frame, per edge).
  // Mirrors Netflix Production Tech Tools' "Protection" — directors / DPs use
  // it to reserve headroom for repositioning, VFX paint, or 4:3-mobile crops.
  const [protectionPct, setProtectionPct] = useState<number>(() => {
    const n = readNum(URL_KEYS.prot, 0);
    return Math.max(0, Math.min(40, n));
  });
  // Extraction scale — punch in (>1) or size down (<1) the target window inside
  // the source. Lets DPs reserve extra unused source area outside the delivery
  // frame for VFX, repositioning, or a deliberate overshoot.
  const [extractionScale, setExtractionScale] = useState<number>(() => {
    const n = readNum(URL_KEYS.exs, 1);
    return Math.max(0.25, Math.min(2, n));
  });
  // Parallel offload stations (1–4): DITs commonly run multiple stations to
  // halve / quarter ingest time. Daily offload hours divide by this count.
  const [offloadStations, setOffloadStations] = useState<number>(() => {
    const n = readNum(URL_KEYS.stn, 2);
    return Math.max(1, Math.min(4, Math.round(n)));
  });
  // Slate metadata — project + author, stamped onto every export & permalink.
  const [projectName, setProjectName] = useState<string>(() => readParam(URL_KEYS.proj) ?? "");
  const [authorName, setAuthorName] = useState<string>(() => readParam(URL_KEYS.auth) ?? "");
  // ACES reference version (2.0 default, 1.3 optional).
  const [acesVersion, setAcesVersion] = useState<AcesVersion>(() =>
    readParam(URL_KEYS.aces) === "1.3" ? "1.3" : "2.0",
  );
  // Mastering config — lifted here so the Mastering tab AND the Workflow tab
  // (which reflects it) share one source of truth.
  const mConfigKey = `postsup-mastering-config-${project.id}`;
  const readMConfig = (): { strategy?: MasteringStrategy; nits?: MasterNits } => {
    try { const r = localStorage.getItem(mConfigKey); return r ? JSON.parse(r) : {}; } catch { return {}; }
  };
  // Guide strategy (one of the three presets) + the mastering-display peak. The old
  // "custom" strategy is gone — bespoke trees now live in "My workflow".
  const [masteringStrategy, setMasteringStrategy] = useState<MasteringStrategy>(() => {
    const s = readMConfig().strategy;
    return s === "hdr-first" || s === "theatrical-first" || s === "dual-hero" ? s : "hdr-first";
  });
  const [masterNits, setMasterNits] = useState<MasterNits>(() => readMConfig().nits ?? 1000);
  useEffect(() => {
    try { localStorage.setItem(mConfigKey, JSON.stringify({ strategy: masteringStrategy, nits: masterNits })); } catch { /* ignore */ }
  }, [masteringStrategy, masterNits, mConfigKey]);
  const masteringPalette = useMemo(() => masteringPaletteGroups(), []);
  const masteringGuides = useMemo(() => STRATEGIES.filter((s) => s.id !== "custom"), []);
  const guideName = masteringGuides.find((s) => s.id === masteringStrategy)?.name ?? "";
  const mwBuilderKey = `postsup-mastering-builder-${project.id}`;
  // "My workflow" seeds — start a bespoke tree from your deliverables, from the
  // selected guide, or from scratch.
  const seedFromDeliverables = useCallback(() => {
    const { config, masterNits: n } = recipientsToMasteringConfig(loadRecipients(project.id));
    return masterGraphToFlow(buildCustomGraph(config, acesVersion, n));
  }, [project.id, acesVersion]);
  const seedFromGuide = useCallback(
    () => masterGraphToFlow(buildMasterGraph(masteringStrategy, acesVersion, masterNits)),
    [masteringStrategy, acesVersion, masterNits],
  );
  const seedFromScratch = useCallback((): ReturnType<typeof masterGraphToFlow> => ({
    nodes: [{ id: "grade", type: "step", position: { x: 280, y: 200 }, data: { label: "Grade / DSM", owner: "ACEScct", color: "#4ade80" } }],
    edges: [],
  }), []);
  // Delivery-intent crop (drawn on top of the source extraction frame)
  const [deliveryCropId, setDeliveryCropId] = useState<string>(() => {
    const id = readParam(URL_KEYS.dcr);
    return id && DELIVERY_CROPS.some((c) => c.id === id) ? id : "none";
  });
  const deliveryCrop = DELIVERY_CROPS.find((c) => c.id === deliveryCropId) ?? DELIVERY_CROPS[0];

  const source = SOURCE_FORMATS.find((s) => s.id === sourceId)!;
  // Custom delivery aspect → a synthetic 4K-class target at the chosen ratio.
  const customAR = customW > 0 && customH > 0 ? customW / customH : 1.7778;
  const customTarget: TargetContainer = useMemo(() => {
    const w = customAR >= 1 ? 3840 : Math.round(2160 * customAR);
    const h = customAR >= 1 ? Math.round(3840 / customAR) : 2160;
    // Label from the REALIZED pixels so the shown ratio == the ratio actually
    // used by the extraction math (avoids a typed-vs-rounded mismatch).
    const realizedLabel = `${(w / h).toFixed(2)}:1`;
    return {
      id: "custom",
      group: "Cinema",
      name: `Custom ${realizedLabel}`,
      width: w,
      height: h,
      ratioLabel: realizedLabel,
      hdrVariants: ["SDR"],
    };
  }, [customAR]);
  const target = targetId === "custom" ? customTarget : (TARGETS.find((t) => t.id === targetId) ?? TARGETS[0]);
  const ext = useMemo(
    () => computeExtraction(source, target, fitMode),
    [source, target, fitMode],
  );
  const srcDisp = sourceDisplayed(source);

  // Native codecs for current source camera
  const availableCodecs = useMemo(
    () => nativeCodecsForCamera(source.camera),
    [source.camera],
  );
  const [codecId, setCodecId] = useState<string>(() => {
    const id = readParam(URL_KEYS.codec);
    if (id && CODECS.some((c) => c.id === id)) return id;
    return availableCodecs[0]?.id ?? CODECS[0].id;
  });

  // Codec is now chosen in the Storage tab (shared state) and may be compared
  // across cameras, so we no longer force it back to the camera's native set.
  const codec: Codec = CODECS.find((c) => c.id === codecId) ?? availableCodecs[0] ?? CODECS[0];

  const mbps = useMemo(
    () => codecMbps(codec, source.width, source.height, fps),
    [codec, source.width, source.height, fps],
  );
  const perHourGB = estimateFileSizeGB(mbps, 3600);
  // Total camera footage planned per day = bitrate × hours rolling × number of cameras.
  const perDayGB = perHourGB * recordHoursPerDay * cameraCount;

  // Card runtime + offload budget
  const card = CARDS.find((c) => c.id === cardId) ?? CARDS[1];
  const cardMin = useMemo(() => cardRuntimeMinutes(card.gb, mbps), [card.gb, mbps]);
  const bandwidth = OFFLOAD_BANDWIDTHS.find((b) => b.id === bwId) ?? OFFLOAD_BANDWIDTHS[0];
  const offloadHrs = useMemo(
    () => offloadHours(perDayGB, backupCopies, bandwidth.mbps, offloadStations),
    [perDayGB, backupCopies, bandwidth.mbps, offloadStations],
  );

  // Proxy footprint per day — proxy codec at HD/delivery res, all cameras.
  const proxyPlan = useMemo(() => {
    const entry = PROXY_CODEC_IDS.find((p) => p.id === proxyCodecId) ?? PROXY_CODEC_IDS[0];
    const c = CODECS.find((x) => x.id === entry.id);
    if (!c) return null;
    const w = entry.resolutionTier === "hd" ? 1920 : 3840;
    const h = entry.resolutionTier === "hd" ? 1080 : 2160;
    const pMbps = codecMbps(c, w, h, fps);
    const perDay = estimateFileSizeGB(pMbps, 3600 * recordHoursPerDay) * cameraCount;
    return { name: c.name, perDayGB: perDay, ratioPct: perDayGB > 0 ? (perDay / perDayGB) * 100 : 0 };
  }, [proxyCodecId, fps, recordHoursPerDay, cameraCount, perDayGB]);

  // Lens coverage + anamorphic/spherical mismatch
  const lens = LENSES.find((l) => l.id === lensId) ?? LENSES[0];
  const sensorDiagMm = usedSensorDiagonalMm(source);
  const lensCovers =
    lens.id === "none" || sensorDiagMm == null || lens.diameterMm >= sensorDiagMm;
  const lensSqueezeMismatch = lensAnamorphicMismatch(lens, source);

  // HDR variants — clamp to what the target supports.
  const supportedHdr: HdrVariant[] = target.hdrVariants ?? ["SDR"];
  useEffect(() => {
    if (!supportedHdr.includes(hdr)) setHdr(supportedHdr[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);
  const hdrInUse: HdrVariant = supportedHdr.includes(hdr) ? hdr : supportedHdr[0];

  // ACES reference pipeline (read-only) for the current camera + delivery.
  const acesRef = acesPipeline(source, hdrInUse, target.name, acesVersion);

  // Live project context fed to the Production Workflow tab so its nodes reflect
  // the actual camera, IDT, ACES version, delivery target and mastering choice.
  const masteringHero =
    masteringStrategy === "hdr-first" ? "HDR PQ (Dolby Vision)"
    : masteringStrategy === "theatrical-first" ? "DCI-P3 theatrical"
    : "HDR PQ + DCI-P3";
  const pipelineConfig: PipelineConfig = useMemo(() => ({
    camera: source.camera,
    cameraMode: source.mode,
    codec: codec.name,
    idt: acesRef.idt.label,
    idtOfficial: acesRef.idt.official,
    acesVersion,
    outputTransform: acesVersion === "2.0" ? acesRef.odt.label2 : acesRef.odt.label13,
    delivery: target.name,
    deliveryRes: `${target.width}×${target.height}`,
    hdr: hdrInUse,
    hdrNits: hdrPeakNits(hdrInUse),
    masteringHero,
    masteringStrategy: STRATEGIES.find((s) => s.id === masteringStrategy)?.name,
    masterNits,
  }), [source.camera, source.mode, codec.name, acesRef.idt, acesRef.odt, acesVersion, target.name, target.width, target.height, hdrInUse, masteringHero, masteringStrategy, masterNits]);

  // Netflix camera-approval status (for source badge)
  const netflixStatus = useMemo(
    () => netflixStatusForCamera(source.camera),
    [source.camera],
  );

  // Supersampled when the source has more pixels across the extracted area
  // than the delivery — Netflix-preferred path (8K → 4K, 6K → 4K, etc.).
  const isSupersampled = ext.scale < 0.999;

  // Persist core state to the URL, and (debounced) into the active project's record.
  const projectRef = useRef(project); projectRef.current = project;
  const projectSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    params.set(URL_KEYS.tab, appTab);
    params.set(URL_KEYS.src, sourceId);
    params.set(URL_KEYS.tgt, targetId);
    params.set(URL_KEYS.codec, codecId);
    params.set(URL_KEYS.fps, String(fps));
    params.set(URL_KEYS.fit, fitMode);
    params.set(URL_KEYS.view, viewMode);
    params.set(URL_KEYS.desq, desqueeze ? "1" : "0");
    params.set(URL_KEYS.thirds, showThirds ? "1" : "0");
    params.set(URL_KEYS.safe, showSafeArea ? "1" : "0");
    params.set(URL_KEYS.mask, showMask ? "1" : "0");
    params.set(URL_KEYS.guides, showGuides ? "1" : "0");
    params.set(URL_KEYS.pixel, pixelTrue ? "1" : "0");
    params.set(URL_KEYS.hdr, hdrInUse);
    params.set(URL_KEYS.lens, lensId);
    params.set(URL_KEYS.card, cardId);
    params.set(URL_KEYS.copies, String(backupCopies));
    params.set(URL_KEYS.bw, bwId);
    params.set(URL_KEYS.rec, String(recordHoursPerDay));
    params.set(URL_KEYS.cams, String(cameraCount));
    params.set(URL_KEYS.prx, proxyCodecId);
    params.set(URL_KEYS.prot, String(protectionPct));
    params.set(URL_KEYS.stn, String(offloadStations));
    params.set(URL_KEYS.exs, String(extractionScale));
    if (deliveryCropId !== "none") params.set(URL_KEYS.dcr, deliveryCropId);
    if (targetId === "custom") {
      params.set(URL_KEYS.cw, String(customW));
      params.set(URL_KEYS.ch, String(customH));
    }
    if (projectName.trim()) params.set(URL_KEYS.proj, projectName.trim());
    if (authorName.trim()) params.set(URL_KEYS.auth, authorName.trim());
    if (acesVersion !== "2.0") params.set(URL_KEYS.aces, acesVersion);
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}?${query}`);
    // Save this project's full capture state (the URL query) into its record, debounced.
    if (projectSaveTimer.current) clearTimeout(projectSaveTimer.current);
    projectSaveTimer.current = setTimeout(() => {
      updateProject(projectRef.current.id, { data: { ...(projectRef.current.data || {}), url: query } });
    }, 800);
  }, [
    appTab, sourceId, targetId, codecId, fps, fitMode, viewMode,
    desqueeze, showThirds, showSafeArea, showMask, showGuides, pixelTrue,
    hdrInUse, lensId, cardId, backupCopies, bwId,
    recordHoursPerDay, cameraCount, proxyCodecId, protectionPct,
    offloadStations, extractionScale, deliveryCropId,
    customW, customH, projectName, authorName, acesVersion,
  ]);

  const resetReframe = () => setReframeOffset({ x: 0, y: 0 });
  const resetExtractionScale = () => setExtractionScale(1);
  const resetTransform = () => setSourceTransform({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    setSourceTransform((t) => ({ ...t, x: 0, y: 0 }));
  }, [sourceId, targetId, desqueeze]);

  // Remember which plate mode is active across refreshes.
  useEffect(() => {
    try { localStorage.setItem(PLATE_MODE_KEY, plateMode); } catch { /* ignore */ }
  }, [plateMode]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Downscale (cap longest edge) + JPEG so it fits in localStorage.
        const MAX = 1920;
        const k = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k));
        const h = Math.max(1, Math.round(img.height * k));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(img, 0, 0, w, h);
        let dataUrl = String(reader.result);
        try { dataUrl = c.toDataURL("image/jpeg", 0.85); } catch { /* keep original */ }
        setUploadedImage(dataUrl);
        setPlateMode("uploaded");
        try {
          localStorage.setItem(PLATE_KEY, dataUrl);
        } catch {
          toast.warning("Plate set for this session — too large to remember after a refresh.");
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(f);
  };

  const useBuiltin = () => setPlateMode("guide");
  const usePlate = () => uploadedImage && setPlateMode("uploaded");
  const plateOff = () => setPlateMode("none");

  // Discard the uploaded plate entirely (and fall back to the guide).
  const removeUpload = () => {
    setUploadedImage(null);
    setPlateMode((m) => (m === "uploaded" ? "guide" : m));
    try { localStorage.removeItem(PLATE_KEY); } catch { /* ignore */ }
    if (fileRef.current) fileRef.current.value = "";
  };

  // Source options grouped by camera maker — include displayed (desqueezed) aspect ratio
  // and Netflix approval badge (✓ Approved · ◐ Limited · ✗ Not approved).
  const sourceOptions = SOURCE_FORMATS.map((s) => {
    const displayedW = s.width * s.squeeze;
    const ar = aspectRatioLabel(displayedW, s.height);
    const nfx = netflixStatusForCamera(s.camera);
    const icon =
      nfx === "approved" ? (
        <NetflixMark className="h-3 w-3" title="Netflix Approved" />
      ) : nfx === "limited" ? (
        <NetflixMark className="h-3 w-3 text-suite-text-dim" muted title="Netflix Limited Use" />
      ) : undefined;
    return {
      value: s.id,
      label: `${s.camera} — ${s.mode} · ${ar}`,
      group: s.camera.split(" ")[0],
      icon,
    };
  });
  const targetOptions = [
    ...TARGETS.map((t) => ({
      value: t.id,
      label: `${t.name} (${t.ratioLabel})`,
      group: t.group,
    })),
    { value: "custom", label: `Custom aspect (${customAR.toFixed(2)}:1)`, group: "Custom" },
  ];
  const codecOptions = availableCodecs.map((c) => ({
    value: c.id,
    label: c.name,
    group: c.family,
  }));

  // --- Spec sheet copy / share ---------------------------------------------
  // Robust clipboard write — handles iframed previews where the async API
  // is blocked by Permissions-Policy. Falls back to a hidden textarea +
  // execCommand('copy'), and finally to a download.
  const writeClipboard = useCallback(async (text: string, filename: string) => {
    // 1) Try the modern async API (works on the deployed origin)
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
        return;
      }
    } catch {
      // fall through
    }
    // 2) Hidden textarea + execCommand fallback (works inside most iframes)
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        toast.success("Copied to clipboard");
        return;
      }
    } catch {
      // fall through
    }
    // 3) Last resort — download as a .txt file
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.message("Clipboard blocked — downloaded as file instead", {
        description: filename,
      });
    } catch {
      toast.error("Couldn't copy or download spec sheet");
    }
  }, []);

  const copyPermalink = useCallback(async () => {
    await writeClipboard(window.location.href, "lumina-permalink.txt");
  }, [writeClipboard]);

  // --- Saved setups (local) ---------------------------------------------------
  const persistSetups = useCallback((next: SavedSetup[]) => {
    setSavedSetups(next);
    try {
      localStorage.setItem(SETUPS_KEY, JSON.stringify(next));
    } catch {
      /* storage may be unavailable (private mode) — keep in-memory */
    }
  }, []);
  const saveCurrentSetup = useCallback(() => {
    const suggested = `${source.camera} · ${target.name}`;
    const name = window.prompt("Name this setup", suggested);
    if (!name) return;
    const setup: SavedSetup = {
      id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()),
      name: name.trim() || suggested,
      query: window.location.search,
      ts: Date.now(),
    };
    persistSetups([setup, ...savedSetups].slice(0, 50));
    toast.success("Setup saved");
  }, [source.camera, target.name, savedSetups, persistSetups]);
  const loadSetup = useCallback((s: SavedSetup) => {
    // Whole app state is URL-encoded, so restoring is just navigating to it.
    window.location.search = s.query;
  }, []);
  const deleteSetup = useCallback(
    (id: string) => persistSetups(savedSetups.filter((s) => s.id !== id)),
    [savedSetups, persistSetups],
  );

  const copySpecSheet = useCallback(async () => {
    const srcAspectName = aspectRatioLabel(srcDisp.width, srcDisp.height);
    const srcAspectDec = aspectDecimalLabel(srcDisp.width, srcDisp.height);
    const sensorAspectName = aspectRatioLabel(source.width, source.height);
    const sensorAspectDec = aspectDecimalLabel(source.width, source.height);
    const tgtAspectName = target.ratioLabel;
    const sourcePxAcrossExtraction = Math.round(ext.extractW / source.squeeze);
    const sensorLine = source.sensorWidthMm
      ? source.usedSensorWidthMm && source.usedSensorWidthMm !== source.sensorWidthMm
        ? `  Sensor     : ${source.sensorWidthMm} × ${source.sensorHeightMm} mm (full) · ${source.usedSensorWidthMm} × ${source.usedSensorHeightMm} mm (used)`
        : `  Sensor     : ${source.sensorWidthMm} × ${source.sensorHeightMm} mm`
      : "";
    const lensLine = lens.id !== "none"
      ? `  Lens       : ${lens.name} · Ø ${lens.diameterMm} mm — ${
          lensCovers ? "COVERS sensor" : "DOES NOT cover (vignette)"
        }${sensorDiagMm ? ` · sensor Ø ${sensorDiagMm.toFixed(1)} mm` : ""}`
      : "";
    const colorLine = source.colorSpace
      ? `  Color      : ${source.colorSpace} / ${source.oetf}`
      : "";
    const aspectLine = source.squeeze !== 1
      ? `  Aspect     : Sensor ${sensorAspectName} (${sensorAspectDec}) · Image ${srcAspectName} (${srcAspectDec})`
      : `  Aspect     : ${srcAspectName} (${srcAspectDec})`;
    const lines = [
      `KAOS THEORY — SPEC SHEET ${VERSION}`,
      projectName.trim() ? `  Project    : ${projectName.trim()}` : "",
      authorName.trim() ? `  Author     : ${authorName.trim()}` : "",
      `  Date       : ${new Date().toISOString().slice(0, 10)}`,
      "",
      `SOURCE`,
      `  Camera     : ${source.camera}`,
      `  Mode       : ${source.mode}`,
      `  Resolution : ${formatNumber(source.width)} × ${formatNumber(source.height)} (recorded)`,
      `  Squeeze    : ${source.squeeze === 1 ? "1.0× spherical" : `${source.squeeze}× anamorphic`}`,
      source.squeeze !== 1
        ? `  Displayed  : ${formatNumber(srcDisp.width)} × ${formatNumber(srcDisp.height)} (after desqueeze)`
        : "",
      aspectLine,
      sensorLine,
      colorLine,
      lensLine,
      `  Megapixels : ${((source.width * source.height) / 1_000_000).toFixed(2)} MP`,
      "",
      `RECORDING`,
      `  Codec      : ${codec.name}`,
      `  Frame Rate : ${fps} fps`,
      `  Bitrate    : ${mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbps` : `${mbps.toFixed(0)} Mbps`} (${(mbps / 8).toFixed(1)} MB/s)`,
      `  Per Hour   : ${formatSize(perHourGB)}`,
      `  (full storage / offload / proxy plan → Storage tab)`,
      "",
      `DELIVERY`,
      `  Container  : ${target.name}`,
      `  Resolution : ${formatNumber(target.width)} × ${formatNumber(target.height)}`,
      target.activeWidth
        ? `  Active     : ${formatNumber(target.activeWidth)} × ${formatNumber(target.activeHeight!)} (active picture area)`
        : "",
      `  Aspect     : ${tgtAspectName}`,
      `  HDR        : ${hdrInUse} · ${hdrPeakNits(hdrInUse)} nits peak`,
      "",
      `EXTRACTION (delivery-aspect cover crop)`,
      `  Extract Px : ${formatNumber(sourcePxAcrossExtraction)} × ${formatNumber(Math.round(ext.extractH))}`,
      `  H Crop     : ${(ext.cropPctH * 100).toFixed(1)}%`,
      `  V Crop     : ${(ext.cropPctV * 100).toFixed(1)}%`,
      `  Sensor Used: ${(ext.usedArea * 100).toFixed(1)}% (of source area retained)`,
      `  Pixel Scale: ${ext.scale.toFixed(3)}× — ${ext.scale > 1.001 ? "UPSCALE (target larger than extraction)" : "downscale / supersampled (safe)"}`,
      "",
      `COLOUR · ACES ${acesVersion}`,
      `  Input IDT  : ${acesRef.idt.label}${acesRef.idt.official ? "" : " (third-party — no official ACES IDT)"}`,
      `  Working    : ${acesRef.grade.name} (grade) · ${acesRef.vfx.name} (VFX) · ${acesRef.interchange.name}`,
      `  Output     : ${acesVersion === "2.0" ? acesRef.odt.label2 : acesRef.odt.label13}`,
      `  Display    : ${acesRef.odt.display} · ${acesRef.odt.eotf} · ${acesRef.odt.peakNits} nits`,
      "",
      `LINK`,
      `  ${typeof window !== "undefined" ? window.location.href : ""}`,
    ].filter(Boolean);
    const text = lines.join("\n");
    await writeClipboard(text, "lumina-spec-sheet.txt");
  }, [
    writeClipboard,
    source, srcDisp, target, codec, fps, mbps, perHourGB, perDayGB, ext, fitMode,
    hdrInUse, lens, lensCovers, sensorDiagMm, card, cardMin, backupCopies, bandwidth, offloadHrs,
    projectName, authorName, acesRef, acesVersion,
  ]);

  // Downloadable framing chart — PNG / TIFF raster + ASC FDL (Netflix-style).
  // `protectionPct` is treated as the ASC FDL total protection fraction
  // (symmetric inset), matching the ASC/Netflix convention.
  const exportFramingChart = useCallback(
    async (format: "png" | "tiff" | "fdl") => {
      try {
        const protection = Math.max(0, Math.min(0.9, protectionPct / 100));
        const proj = projectName.trim();
        const author = authorName.trim();
        // FDL/text creator string carries project + DP so the metadata travels.
        const creator = `${proj ? proj + " — " : ""}${author ? author + " — " : ""}Kaos Theory ${VERSION}`;
        // The chart/FDL is the NEUTRAL delivery framing reference (ASC convention) —
        // live punch-in / reframe are shot-level previews and are not baked in. Warn
        // so the operator isn't misled into thinking the export captured them.
        const reframed = extractionScale !== 1 || reframeOffset.x !== 0 || reframeOffset.y !== 0;
        const d = new Date();
        const yymmdd = `${String(d.getFullYear() % 100).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
        const base = `${yymmdd}_${proj ? slug(proj) + "_" : ""}${slug(source.camera)}_${slug(source.mode)}_${slug(target.name)}_framingchart`;

        if (format === "fdl") {
          const fdl = buildFdl({ source, target, protection, creator, secondaryCropAR: deliveryCrop.ar });
          downloadBlob(
            new Blob([fdlToJson(fdl)], { type: "application/json" }),
            `${base}.fdl`,
          );
          toast.success("FDL downloaded");
          if (reframed) toast.warning("Neutral delivery framing exported — live punch-in / reframe are not baked into the FDL.");
          return;
        }

        // Load the studio plate only when the user opts to composite it behind the chart.
        let refEl: HTMLImageElement | null = null;
        if (exportWithImage && refImage) {
          refEl = await new Promise<HTMLImageElement | null>((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
            img.src = refImage;
          });
        }

        const canvas = renderFramingChart({
          source,
          target,
          protection,
          showThirds,
          showSafeArea,
          creator: `Kaos Theory ${VERSION}`,
          projectName: proj || undefined,
          authorName: author || undefined,
          referenceImage: refEl,
          secondaryCropAR: deliveryCrop.ar,
          secondaryCropLabel: deliveryCrop.ar != null ? deliveryCrop.label.split(" ")[0] : undefined,
        });

        if (format === "png") {
          const blob: Blob | null = await new Promise((r) =>
            canvas.toBlob((b) => r(b), "image/png"),
          );
          if (!blob) throw new Error("PNG encode failed");
          downloadBlob(blob, `${base}.png`);
          toast.success("PNG framing chart downloaded");
          if (reframed) toast.warning("Neutral delivery framing exported — live punch-in / reframe are not baked into the chart.");
        } else {
          const ctx = canvas.getContext("2d")!;
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const tiff = encodeTiff(canvas.width, canvas.height, data);
          downloadBlob(new Blob([tiff], { type: "image/tiff" }), `${base}.tiff`);
          toast.success("TIFF framing chart downloaded");
        }
      } catch (e) {
        console.error(e);
        toast.error("Framing-chart export failed");
      }
    },
    [source, target, protectionPct, showThirds, showSafeArea, refImage, exportWithImage, deliveryCrop.ar, deliveryCrop.label, projectName, authorName, extractionScale, reframeOffset],
  );

  // Source aspect labels (for clarity-fix wording)
  const srcAspectName = aspectRatioLabel(srcDisp.width, srcDisp.height);
  const srcAspectDec = aspectDecimalLabel(srcDisp.width, srcDisp.height);
  const tgtAspectDec = aspectDecimalLabel(
    target.activeWidth ?? target.width,
    target.activeHeight ?? target.height,
  );

  // Camera & Storage report (PDF) — mirrors the on-screen / permalink state.
  const exportCameraReport = useCallback(() => {
    try {
      const dt = new Date();
      const yy = String(dt.getFullYear() % 100).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const blob = buildCameraReportPdf({
        version: VERSION,
        dateLabel: `${dt.getFullYear()}-${mm}-${dd}`,
        url: typeof window !== "undefined" ? window.location.href : "",
        projectName: projectName.trim() || undefined,
        authorName: authorName.trim() || undefined,
        camera: source.camera,
        mode: source.mode,
        recordedW: source.width,
        recordedH: source.height,
        squeeze: source.squeeze,
        displayedW: srcDisp.width,
        displayedH: srcDisp.height,
        imageAspectLabel: `${srcAspectName} (${srcAspectDec})`,
        sensorAspectLabel: `${aspectRatioLabel(source.width, source.height)} (${aspectDecimalLabel(source.width, source.height)})`,
        sensorWidthMm: source.sensorWidthMm,
        sensorHeightMm: source.sensorHeightMm,
        usedSensorWidthMm: source.usedSensorWidthMm,
        usedSensorHeightMm: source.usedSensorHeightMm,
        colorSpace: source.colorSpace,
        oetf: source.oetf,
        megapixels: (source.width * source.height) / 1_000_000,
        lensName: lens.name,
        lensDiameterMm: lens.diameterMm,
        lensCovers,
        lensIsNone: lens.id === "none",
        sensorDiagMm,
        codecName: codec.name,
        fps,
        mbps,
        perHourGB,
        targetName: target.name,
        targetW: target.width,
        targetH: target.height,
        targetAspectLabel: target.ratioLabel,
        hdr: hdrInUse,
        hdrNits: hdrPeakNits(hdrInUse),
        extractPxW: Math.round(ext.extractW / source.squeeze),
        extractPxH: Math.round(ext.extractH),
        cropPctH: ext.cropPctH,
        cropPctV: ext.cropPctV,
        usedArea: ext.usedArea,
        scale: ext.scale,
        recordHoursPerDay,
        cameraCount,
        perDayGB,
        cardName: card.name,
        cardGB: card.gb,
        cardKind: card.kind,
        cardRuntimeMin: cardMin,
        bandwidthLabel: bandwidth.label,
        bandwidthMbps: bandwidth.mbps,
        backupCopies,
        offloadStations,
        offloadHrs,
        proxyName: proxyPlan?.name ?? null,
        proxyPerDayGB: proxyPlan?.perDayGB ?? null,
        proxyRatioPct: proxyPlan?.ratioPct ?? null,
        acesVersion,
        acesIdt: acesRef.idt.label,
        acesIdtOfficial: acesRef.idt.official,
        acesGrade: `${acesRef.grade.name} (grade) · ${acesRef.vfx.name} (VFX)`,
        acesInterchange: acesRef.interchange.name,
        acesOdt: acesVersion === "2.0" ? acesRef.odt.label2 : acesRef.odt.label13,
        acesOdtDisplay: `${acesRef.odt.display} · ${acesRef.odt.eotf} · ${acesRef.odt.peakNits} nits`,
      });
      downloadBlob(blob, `${yy}${mm}${dd}_${projectName.trim() ? slug(projectName.trim()) + "_" : ""}${slug(source.camera)}_${slug(source.mode)}_camera-report.pdf`);
      toast.success("Camera report (PDF) downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Report export failed");
    }
  }, [
    source, srcDisp, srcAspectName, srcAspectDec, lens, lensCovers, sensorDiagMm,
    codec, fps, mbps, perHourGB, target, hdrInUse, ext,
    recordHoursPerDay, cameraCount, perDayGB, card, cardMin, bandwidth,
    backupCopies, offloadStations, offloadHrs, proxyPlan, projectName, authorName,
    acesRef, acesVersion,
  ]);

  return (
    <div className="h-dvh w-full bg-suite-bg text-suite-text flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-suite-border bg-suite-panel">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-guide-source shadow-[0_0_8px_hsl(var(--guide-source))]" />
          <h1 className="font-mono text-xs tracking-[0.22em] uppercase">
            <button onClick={() => setAppTab("home")} className="text-guide-target hover:opacity-80 transition-opacity" title="Home">KAOS THEORY</button>
            <span className="text-suite-text-dim mx-1">/</span>
            <button onClick={onSwitchProject} className="inline-flex items-center gap-1 text-suite-text hover:text-guide-target hover:border-suite-border-strong transition-colors max-w-[200px] border border-suite-border rounded-sm px-1.5 py-0.5 -my-0.5 align-middle" title="Switch project — back to all projects">
              <FolderOpen className="size-3 shrink-0 opacity-70" strokeWidth={1.8} />
              <span className="truncate normal-case tracking-normal">{project.name}</span>
              <ChevronDown className="size-3 shrink-0 opacity-60" strokeWidth={2} />
            </button>
          </h1>
          <VersionBadge />
        </div>
        <div className="flex items-center gap-2">
          <FrameTabButton active={appTab === "frame"} onClick={() => setAppTab("frame")} />
          <OpticsTabButton active={appTab === "optics"} onClick={() => setAppTab("optics")} />
          <StorageTabButton active={appTab === "storage"} onClick={() => setAppTab("storage")} />
          <MulticamTabButton active={appTab === "multicam"} onClick={() => setAppTab("multicam")} />
          <DeliverablesTabButton active={appTab === "deliverables"} onClick={() => setAppTab("deliverables")} />
          <MasteringTabButton active={appTab === "mastering"} onClick={() => setAppTab("mastering")} />
          <WorkflowTabButton active={appTab === "workflow"} onClick={() => setAppTab("workflow")} />
          <PlannerTabButton active={appTab === "planner"} onClick={() => setAppTab("planner")} />
          <BoardTabButton active={appTab === "board"} onClick={() => setAppTab("board")} />
          <GlossaryTabButton active={appTab === "glossary"} onClick={() => setAppTab("glossary")} />
          <ToolsTabButton active={appTab === "tools"} onClick={() => setAppTab("tools")} />
        </div>
        <AppMenu version={VERSION} onOpenVendors={() => setAppTab("vendors")} onOpenNews={() => setAppTab("news")} onProjects={onSwitchProject} />
      </header>

      {appTab === "home" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <Home onNavigate={(t) => setAppTab(t)} lastTab={lastTab} />
        </main>
      ) : appTab === "tools" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <Tools />
        </main>
      ) : appTab === "glossary" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <Glossary />
        </main>
      ) : appTab === "vendors" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <Vendors />
        </main>
      ) : appTab === "news" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <NewsWatches />
        </main>
      ) : appTab === "multicam" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <MulticamPlanner projectName={projectName} projectId={project.id} />
        </main>
      ) : appTab === "board" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <KanbanBoard projectName={projectName} projectId={project.id} />
        </main>
      ) : appTab === "deliverables" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <Deliverables
            projectName={projectName}
            projectId={project.id}
            onSendToMastering={(config, nits) => {
              // Deliverables is the requirements layer: seed "My workflow" in the
              // Mastering tab with a bespoke tree built from these recipients.
              setMasterNits(nits);
              try { localStorage.setItem(mwBuilderKey, JSON.stringify(masterGraphToFlow(buildCustomGraph(config, acesVersion, nits)))); } catch { /* ignore */ }
              setMwRemount((k) => k + 1);
              setMasteringMode("myworkflow");
              setAppTab("mastering");
            }}
          />
        </main>
      ) : appTab === "planner" ? (
        <main className="flex-1 flex min-h-0 min-w-0">
          <PostSchedule projectName={projectName} projectId={project.id} />
        </main>
      ) : appTab === "workflow" ? (
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="shrink-0 border-b border-suite-border bg-suite-panel px-3 py-1.5 flex items-center gap-1.5">
            {([["production", "Production"], ["custom", "Custom Workflow"]] as [WorkflowView, string][]).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setWorkflowView(v)}
                className={cn("px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm transition-colors",
                  workflowView === v ? "bg-status-ok/15 text-status-ok border-status-ok/50" : "text-suite-text-muted hover:text-suite-text border-suite-border bg-suite-bg")}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 flex min-h-0 min-w-0">
            {workflowView === "custom" ? (
              <Suspense fallback={<div className="flex-1 grid place-items-center font-mono text-[11px] text-suite-text-dim">Loading…</div>}>
                <WorkflowBuilder storageKey={`postsup-builder-${project.id}`} versionsKey={`postsup-builder-versions-${project.id}`} />
              </Suspense>
            ) : (
              <WorkflowPipeline onOpenMastering={() => setAppTab("mastering")} config={pipelineConfig} />
            )}
          </div>
        </main>
      ) : appTab === "mastering" ? (
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="shrink-0 border-b border-suite-border bg-suite-panel px-3 py-1.5 flex items-center gap-1.5">
            {/* Guides — the three reference strategies, in a sub-menu */}
            <div className="relative">
              <button type="button" onClick={() => setGuidesOpen((o) => !o)}
                className={cn("flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm transition-colors",
                  masteringMode === "guides" ? "bg-status-ok/15 text-status-ok border-status-ok/50" : "text-suite-text-muted hover:text-suite-text border-suite-border bg-suite-bg")}>
                Guides{masteringMode === "guides" ? ` · ${guideName}` : ""} <span className="text-[8px] leading-none">▾</span>
              </button>
              {guidesOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setGuidesOpen(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-1 flex flex-col">
                    {masteringGuides.map((g) => (
                      <button key={g.id} type="button"
                        onClick={() => { setMasteringStrategy(g.id); setMasteringMode("guides"); setGuidesOpen(false); }}
                        className={cn("text-left px-2 py-1.5 rounded font-mono text-[11px] hover:bg-suite-panel-elevated",
                          masteringMode === "guides" && masteringStrategy === g.id ? "text-status-ok" : "text-suite-text-muted hover:text-suite-text")}>
                        {g.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* My workflow — your editable tree */}
            <button type="button" onClick={() => setMasteringMode("myworkflow")}
              className={cn("px-2.5 py-1 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm transition-colors",
                masteringMode === "myworkflow" ? "bg-status-ok/15 text-status-ok border-status-ok/50" : "text-suite-text-muted hover:text-suite-text border-suite-border bg-suite-bg")}>
              My workflow
            </button>
            <span className="font-mono text-[10px] text-suite-text-dim hidden lg:inline ml-1">
              {masteringMode === "guides"
                ? "Reference trees — how the grade flows to every deliverable for each strategy."
                : "Your editable tree — seed it from your deliverables, a guide, or from scratch."}
            </span>
          </div>
          <div className="flex-1 flex min-h-0 min-w-0">
            {masteringMode === "myworkflow" ? (
              <Suspense fallback={<div className="flex-1 grid place-items-center font-mono text-[11px] text-suite-text-dim">Loading…</div>}>
                <WorkflowBuilder
                  key={mwRemount}
                  storageKey={mwBuilderKey}
                  versionsKey={`postsup-mastering-builder-versions-${project.id}`}
                  title="My workflow"
                  makeSeed={seedFromDeliverables}
                  paletteGroups={masteringPalette}
                  seedActions={[
                    { label: "From deliverables", confirm: "Replace the canvas with a fresh tree built from your Deliverables recipients? (this is undoable)", make: seedFromDeliverables },
                    { label: `From guide · ${guideName}`, confirm: "Replace the canvas with the selected guide's tree? (this is undoable)", make: seedFromGuide },
                    { label: "From scratch", confirm: "Clear the canvas back to a single Grade node? (this is undoable)", make: seedFromScratch },
                  ]}
                />
              </Suspense>
            ) : (
              <MasteringWorkflow
                version={acesVersion}
                onVersionChange={setAcesVersion}
                strategy={masteringStrategy}
                masterNits={masterNits}
                onMasterNitsChange={setMasterNits}
              />
            )}
          </div>
        </main>
      ) : appTab === "optics" ? (
        <main className="flex-1 flex min-h-0">
          <FovCalculator source={source} />
        </main>
      ) : appTab === "storage" ? (
        <main className="flex-1 flex min-h-0">
          <FileSizeCalculator
            sourceId={sourceId}
            onSourceChange={setSourceId}
            codecId={codecId}
            onCodecChange={setCodecId}
            fps={fps}
            onFpsChange={setFps}
          />
        </main>
      ) : (
      <main className="flex-1 flex min-h-0">
        {/* Left inspector */}
        <aside className="w-96 shrink-0 bg-suite-panel border-r border-suite-border flex flex-col overflow-y-auto">
          {/* Slate — project + DP, stamped onto every export. */}
          <section className="px-5 py-3 border-b border-suite-border">
            <details className="group">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-[10px] tracking-[0.18em] uppercase text-suite-text-muted hover:text-suite-text select-none">
                <span className="shrink-0">00 · Slate</span>
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono normal-case tracking-normal text-suite-text-dim truncate text-right">
                    {projectName.trim() || "untitled"}
                    {authorName.trim() ? ` · ${authorName.trim()}` : ""}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-suite-text-muted transition-transform group-open:rotate-90" strokeWidth={2} />
                </span>
              </summary>
              <div className="flex flex-col gap-3 pt-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted">Project / Production</span>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. Untitled Feature"
                    maxLength={80}
                    className="w-full bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-guide-target"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted">Author</span>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="e.g. Mark Taylor"
                    maxLength={60}
                    className="w-full bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-guide-target"
                  />
                </label>
                <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono">
                  Stamped onto the PNG chart, FDL, Camera Report and permalink. Date is added automatically.
                </p>
              </div>
            </details>
          </section>
          {/* Source */}
          <section className="p-5 border-b border-suite-border flex flex-col gap-4">
            <SectionHeader
              label="01 · Capture"
              dotClass="bg-guide-source"
            />
            <SuiteSelect
              label="Capture System"
              value={sourceId}
              onChange={(v) => {
                setSourceId(v);
                resetReframe();
              }}
              options={sourceOptions}
            />
            {source.squeeze !== 1 && (
              <ToggleRow
                icon={Maximize2}
                label={`Desqueeze (${source.squeeze}×)`}
                value={desqueeze}
                onChange={setDesqueeze}
              />
            )}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Metric
                label="Resolution"
                value={`${formatNumber(source.width)}×${formatNumber(source.height)}`}
                accentClass="text-guide-source"
              />
              <Metric
                label="Squeeze"
                value={source.squeeze === 1 ? "1.0× Spherical" : `${source.squeeze}× Anamorphic`}
              />
              {source.squeeze !== 1 ? (
                <Metric
                  label="Aspect · Sensor / Image"
                  value={`${aspectRatioLabel(source.width, source.height)} · ${srcAspectName}`}
                  hint={`${aspectDecimalLabel(source.width, source.height)} → ${srcAspectDec} after desqueeze`}
                />
              ) : (
                <Metric label="Aspect" value={`${srcAspectName} · ${srcAspectDec}`} />
              )}
              <Metric
                label="Megapixels"
                value={`${((source.width * source.height) / 1_000_000).toFixed(2)} MP`}
              />
              {source.sensorWidthMm && (
                <Metric
                  label="Sensor"
                  value={
                    source.usedSensorWidthMm && source.usedSensorWidthMm !== source.sensorWidthMm
                      ? `${source.usedSensorWidthMm}×${source.usedSensorHeightMm} mm`
                      : `${source.sensorWidthMm}×${source.sensorHeightMm} mm`
                  }
                  hint={
                    source.usedSensorWidthMm && source.usedSensorWidthMm !== source.sensorWidthMm
                      ? `Used area · full ${source.sensorWidthMm}×${source.sensorHeightMm} mm`
                      : undefined
                  }
                />
              )}
              {source.colorSpace && (
                <Metric
                  label="Color · OETF"
                  value={source.oetf ?? "—"}
                  hint={source.colorSpace}
                />
              )}
              {source.squeeze !== 1 && (
                <Metric
                  label="Desqueezed"
                  value={`${formatNumber(srcDisp.width)}×${formatNumber(srcDisp.height)}`}
                />
              )}
              {netflixStatus && (
                <Metric
                  label="Netflix Status"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      {netflixStatus === "approved" ? (
                        <>
                          <NetflixMark className="h-3.5 w-3.5" title="Netflix Approved" />
                          Approved
                        </>
                      ) : netflixStatus === "limited" ? (
                        <>
                          <NetflixMark className="h-3.5 w-3.5" muted title="Netflix Limited Use" />
                          Limited Use
                        </>
                      ) : (
                        "✗ Not Approved"
                      )}
                    </span>
                  }
                  accentClass={
                    netflixStatus === "approved" ? "text-status-ok" :
                    netflixStatus === "limited"  ? "text-status-warn" :
                    "text-destructive"
                  }
                  hint={
                    netflixStatus === "approved"
                      ? "Cleared for primary capture on Netflix Originals (≥90% runtime)"
                      : netflixStatus === "limited"
                      ? "B-cam / specialty / non-fiction only"
                      : "Cannot be used for primary capture on a Netflix Original"
                  }
                />
              )}
            </div>
            {/* Lens picker — image-circle vs sensor diagonal */}
            <SuiteSelect
              label="Lens (image-circle check)"
              value={lensId}
              onChange={setLensId}
              options={LENSES.map((l) => ({ value: l.id, label: l.name, group: l.family }))}
            />
            {lens.id !== "none" && sensorDiagMm != null && (
              <Metric
                label="Lens Coverage"
                value={lensCovers ? "✓ Covers" : "✗ Vignette"}
                accentClass={lensCovers ? "text-status-ok" : "text-destructive"}
                hint={`Ø ${lens.diameterMm} mm vs sensor Ø ${sensorDiagMm.toFixed(1)} mm`}
              />
            )}
            {lensSqueezeMismatch && (
              <div
                className="px-3 py-2 border border-destructive/50 bg-destructive/10 rounded-sm text-[10px] leading-relaxed text-destructive font-mono"
                title="The lens optical design doesn't match the capture mode — anamorphic glass on a spherical sensor mode (or vice-versa) produces wrong squeeze and unusable footage."
              >
                ⚠ Lens / sensor mismatch — {lens.family.includes("Anamorphic") ? "anamorphic lens on spherical mode" : "spherical lens on anamorphic mode"}.
              </div>
            )}
          </section>

          {/* Framing — the delivery aspect you're framing for (drives the chart) */}
          <section className="p-5 border-b border-suite-border flex flex-col gap-4">
            <SectionHeader
              label="02 · Framing & Extract"
              dotClass={target.group === "Social" ? "bg-guide-social" : "bg-guide-target"}
            />
            <SuiteSelect
              label="Framing For (Delivery Aspect)"
              value={targetId}
              onChange={(v) => {
                setTargetId(v);
                resetReframe();
              }}
              options={targetOptions}
            />
            {targetId === "custom" && (
              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted">Width</span>
                  <input type="number" min={0.1} step={0.01} value={customW}
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) { setCustomW(n); resetReframe(); } }}
                    className="w-full bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono tabular focus:outline-none focus:border-guide-target" />
                </label>
                <span className="pb-1.5 text-suite-text-dim font-mono">:</span>
                <label className="flex flex-col gap-1 flex-1">
                  <span className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted">Height</span>
                  <input type="number" min={0.1} step={0.01} value={customH}
                    onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n > 0) { setCustomH(n); resetReframe(); } }}
                    className="w-full bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono tabular focus:outline-none focus:border-guide-target" />
                </label>
                <span className="pb-1.5 text-[10px] font-mono text-suite-text tabular">{customAR.toFixed(2)}:1</span>
              </div>
            )}
            {/* Secondary crop — a *sub-aspect* inside the delivery frame (e.g. a
                2:1 or 2.39 extract, or a 9:16 social pull) the operator also
                composes to. Drawn inside the primary final frame and written onto
                the framing chart + FDL as a second framing intent. Sits here next
                to the primary delivery aspect since it's the same kind of choice. */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted"
                  title="A SECONDARY delivery crop (e.g. 2:1, 2.39 scope, 9:16 social) that the camera operator also frames to. Drawn inside the primary final frame and exported onto the framing chart + FDL as a second framing intent. The primary deliverable is still set by 'Framing For'."
                >
                  Secondary Crop (on chart)
                </span>
                {deliveryCropId !== "none" && (
                  <button
                    onClick={() => setDeliveryCropId("none")}
                    className="text-[9px] tracking-[0.18em] uppercase text-suite-text-muted hover:text-suite-text transition-colors"
                  >
                    clear
                  </button>
                )}
              </div>
              <select
                value={deliveryCropId}
                onChange={(e) => setDeliveryCropId(e.target.value)}
                className="w-full bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-guide-target"
                title="Choose a secondary delivery-intent aspect ratio to overlay inside the final frame"
              >
                {DELIVERY_CROPS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Metric
                label="Resolution"
                value={`${formatNumber(target.width)}×${formatNumber(target.height)}`}
                accentClass={target.group === "Social" ? "text-guide-social" : "text-guide-target"}
              />
              <Metric label="Aspect" value={`${target.ratioLabel} · ${tgtAspectDec}`} />
              {isSupersampled && (
                <Metric
                  label="Supersampled"
                  value={`✓ ${(1 / ext.scale).toFixed(2)}×`}
                  accentClass="text-status-ok"
                  hint="Source has more pixels than delivery — Netflix-preferred path"
                />
              )}
            </div>

            {/* Delivery spec — HDR: not framing, kept collapsed but still
                carried into the spec sheet + FDL export. */}
            <details className="group mt-3 border border-suite-border rounded-sm bg-suite-panel-elevated/40 hover:bg-suite-panel-elevated/70 transition-colors">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-3 py-2.5 select-none">
                <span className="flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase text-suite-text font-semibold">
                  <Sun className="size-3.5 text-guide-target" strokeWidth={1.6} />
                  Delivery Spec · HDR
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-suite-text-dim tabular hidden sm:inline">{hdrInUse}</span>
                  <ChevronRight className="size-4 text-suite-text-muted transition-transform group-open:rotate-90" strokeWidth={2} />
                </span>
              </summary>
              <div className="flex flex-col gap-4 px-3 pb-3 pt-1">
                {supportedHdr.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted flex items-center gap-1.5">
                      <Sun className="size-3" strokeWidth={1.5} /> HDR Variant
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {supportedHdr.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setHdr(v)}
                          className={cn(
                            "px-2 py-1 text-[10px] font-mono tabular rounded-sm border transition-colors",
                            hdrInUse === v
                              ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text"
                              : "border-suite-border text-suite-text-muted hover:text-suite-text",
                          )}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <Metric
                  label="HDR · Peak"
                  value={hdrInUse}
                  hint={`${hdrPeakNits(hdrInUse)} nits${hdrInUse === "Dolby Vision P8.1" ? " · DV required for Netflix HDR" : ""}`}
                />
              </div>
            </details>

            {/* ACES colour-pipeline reference — read-only IDT / working / ODT. */}
            <details className="group mt-3 border border-suite-border rounded-sm bg-suite-panel-elevated/40 hover:bg-suite-panel-elevated/70 transition-colors">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-3 py-2.5 select-none">
                <span className="flex items-center gap-2 text-[11px] tracking-[0.14em] uppercase text-suite-text font-semibold">
                  <Palette className="size-3.5 text-guide-target" strokeWidth={1.6} />
                  ACES Colour Pipeline
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-suite-text-dim tabular hidden sm:inline">v{acesVersion}</span>
                  <ChevronRight className="size-4 text-suite-text-muted transition-transform group-open:rotate-90" strokeWidth={2} />
                </span>
              </summary>
              <div className="px-3 pb-3">
              <AcesPanel
                source={source}
                hdrVariant={hdrInUse}
                targetName={target.name}
                version={acesVersion}
                onVersionChange={setAcesVersion}
              />
              </div>
            </details>

            {/* Extract readout — merged into Framing (Fit/Fill removed; the
                extraction is the delivery-aspect cover crop of the sensor). */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-suite-border/60">
                <Metric
                  label="H Crop"
                  value={`${(ext.cropPctH * 100).toFixed(1)}%`}
                  accentClass={ext.cropPctH > 0.001 ? "text-status-warn" : "text-status-ok"}
                />
                <Metric
                  label="V Crop"
                  value={`${(ext.cropPctV * 100).toFixed(1)}%`}
                  accentClass={ext.cropPctV > 0.001 ? "text-status-warn" : "text-status-ok"}
                />
                <Metric
                  label="Sensor Retained"
                  value={`${(ext.usedArea * 100).toFixed(1)}%`}
                  hint="Source area kept after crop"
                />
                <Metric
                  label="Pixel Scale"
                  value={
                    <span className={ext.scale > 1.001 ? "text-status-warn" : "text-status-ok"}>
                      {ext.scale.toFixed(2)}×
                    </span>
                  }
                  hint={
                    ext.scale > 1.001
                      ? `Upscale (target > extract)`
                      : `Supersampled · safe downscale`
                  }
                />
                <Metric
                  label="Extract Px"
                  value={`${formatNumber(Math.round(ext.extractW / source.squeeze))}×${formatNumber(Math.round(ext.extractH))}`}
                />
                <Metric
                  label="Method"
                  value={
                    ext.cropPctV > ext.cropPctH ? "Cover · T/B crop"
                    : ext.cropPctH > ext.cropPctV ? "Cover · L/R crop"
                    : "Exact fit"
                  }
                  hint="Delivery-aspect crop of the sensor"
                />
              </div>
            </section>

          {/* View options */}
          <section className="p-5 flex flex-col gap-3">
            <SectionHeader label="View" />
            <div className="flex flex-col gap-1">
              <ToggleRow
                icon={Move}
                label="Pixel-true scale"
                value={pixelTrue}
                onChange={setPixelTrue}
                hint="Show source at true pixel size vs target — reveals reframe headroom"
              />
              <ToggleRow icon={Eye} label="Guides" value={showGuides} onChange={setShowGuides} />
              <ToggleRow icon={Square} label="Mask" value={showMask} onChange={setShowMask} />
              <ToggleRow icon={Grid3x3} label="Rule of thirds" value={showThirds} onChange={setShowThirds} />
              <ToggleRow
                icon={ShieldCheck}
                label="Safe action / title"
                value={showSafeArea}
                onChange={setShowSafeArea}
                hint="93% safe action · 90% safe title (SMPTE/EBU)"
              />
              {(reframeOffset.x !== 0 || reframeOffset.y !== 0) && (
                <button
                  onClick={resetReframe}
                  className="mt-1 flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-suite-panel-elevated transition-colors text-left text-xs text-suite-text-muted"
                >
                  <RotateCcw className="size-3.5" strokeWidth={1.5} />
                  Recenter extraction
                </button>
              )}
            </div>
            {/* Protection inset — Netflix-style framing reservation */}
            <div className="flex flex-col gap-2 px-1 pt-2">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted"
                  title="Protection — reserve a percentage of the frame around the edges as headroom for repositioning, VFX paint, or alternate (e.g. 4:3 mobile) crops. Drag the dashed rectangle on the canvas to change it live."
                >
                  Protection
                </span>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <input
                    type="number"
                    min={0}
                    max={40}
                    step={0.5}
                    value={protectionPct}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) {
                        setProtectionPct(Math.max(0, Math.min(40, n)));
                      }
                    }}
                    className="w-14 bg-suite-panel-elevated border border-suite-border rounded-sm px-1.5 py-1 text-right tabular focus:outline-none focus:border-guide-target"
                  />
                  <span className="text-suite-text-dim">%</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={40}
                step={0.5}
                value={protectionPct}
                onChange={(e) => setProtectionPct(Number(e.target.value))}
                className="w-full accent-guide-target"
              />
              <div className="flex items-center justify-between text-[9px] tracking-[0.18em] uppercase text-suite-text-dim">
                <span>0%</span>
                <span className="text-suite-text tabular">
                  {protectionPct.toFixed(protectionPct % 1 === 0 ? 0 : 1)}% reserved
                </span>
                <span>40%</span>
              </div>
            </div>
            {/* Extraction scale — punch in / size down inside the source */}
            <div className="flex flex-col gap-2 px-1 pt-2">
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted"
                  title="Scale the delivery extraction inside the source. Below 1.00× shrinks the target window — leaving more unused source area around it (VFX paint, reframe headroom, deliberate overshoot). Above 1.00× punches in, requiring an upscale."
                >
                  Extraction Scale
                </span>
                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <input
                    type="number"
                    min={0.25}
                    max={2}
                    step={0.05}
                    value={Number(extractionScale.toFixed(2))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) {
                        setExtractionScale(Math.max(0.25, Math.min(2, n)));
                      }
                    }}
                    className="w-14 bg-suite-panel-elevated border border-suite-border rounded-sm px-1.5 py-1 text-right tabular focus:outline-none focus:border-guide-target"
                  />
                  <span className="text-suite-text-dim">×</span>
                </div>
              </div>
              <input
                type="range"
                min={0.25}
                max={2}
                step={0.05}
                value={extractionScale}
                onChange={(e) => setExtractionScale(Number(e.target.value))}
                className="w-full accent-guide-target"
              />
              <div className="flex items-center justify-between text-[9px] tracking-[0.18em] uppercase text-suite-text-dim">
                <span>0.25× size down</span>
                {extractionScale !== 1 ? (
                  <button
                    onClick={resetExtractionScale}
                    className="text-suite-text-muted hover:text-suite-text transition-colors"
                  >
                    reset 1.00×
                  </button>
                ) : (
                  <span className="text-suite-text-muted">1.00× native</span>
                )}
                <span>2× punch in</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Fill so the PROTECTION frame reaches the widest sensor edge —
                  // the final frame sits inset by the protection amount.
                  setExtractionScale(Math.max(0.25, Math.min(2, 1 - protectionPct / 100)));
                  resetReframe();
                }}
                className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 text-[10px] tracking-[0.18em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
                title="Recenter and fill so the protection frame reaches the widest sensor edge (final frame inset by the protection %)."
              >
                <Crop className="size-3" strokeWidth={1.5} />
                Center &amp; Fill
              </button>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted"
                  title="Reference image used to visualize the framing. The built-in guide is a loosely-framed person plate; Upload swaps it for your own image. Both are auto-cropped to the selected camera aspect."
                >
                  Reference Plate
                </span>
                <span className="font-mono text-[9px] text-suite-text-dim tabular">
                  {plateMode === "guide" ? "GUIDE" : plateMode === "uploaded" ? "YOUR PLATE" : "OFF"}
                </span>
              </div>
              {/* Segmented toggle — switch freely without losing the upload. */}
              <div className="flex gap-1 p-0.5 bg-suite-bg border border-suite-border rounded-sm">
                {([
                  { id: "guide", label: "Guide", on: () => useBuiltin(), disabled: false, title: "Built-in person guide, auto-cropped to the camera aspect" },
                  { id: "uploaded", label: "Your Plate", on: () => usePlate(), disabled: !uploadedImage, title: uploadedImage ? "Your uploaded reference plate" : "Upload a plate first" },
                  { id: "none", label: "Off", on: () => plateOff(), disabled: false, title: "Neutral field — no reference image" },
                ] as const).map((seg) => (
                  <button
                    key={seg.id}
                    onClick={seg.on}
                    disabled={seg.disabled}
                    title={seg.title}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-[10px] tracking-[0.16em] uppercase rounded-[3px] transition-colors",
                      plateMode === seg.id
                        ? "bg-guide-source/15 text-guide-source"
                        : seg.disabled
                          ? "text-suite-text-dim/40 cursor-not-allowed"
                          : "text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated",
                    )}
                  >
                    {seg.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[10px] tracking-[0.18em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
                  title="Upload your own reference image (kept even when you switch to the guide)"
                >
                  <Upload className="size-3" strokeWidth={1.5} />
                  {uploadedImage ? "Replace plate" : "Upload plate"}
                </button>
                {uploadedImage && (
                  <button
                    onClick={removeUpload}
                    className="px-2 py-2 border border-suite-border hover:border-destructive/60 hover:text-destructive transition-colors rounded-sm"
                    aria-label="Remove uploaded plate"
                    title="Discard the uploaded plate"
                  >
                    <X className="size-3" strokeWidth={1.5} />
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
              </div>
            </div>
          </section>

          {/* Saved Setups */}
          <section className="p-5 mt-auto border-t border-suite-border flex flex-col gap-2">
            <SectionHeader label="Saved Setups" />
            <button
              onClick={saveCurrentSetup}
              className="flex items-center justify-center gap-2 px-3 py-2 text-[10px] tracking-[0.18em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
              title="Save the current camera + framing + storage configuration to this device"
            >
              <ShieldCheck className="size-3" strokeWidth={1.5} />
              Save Current Setup
            </button>
            {savedSetups.length === 0 ? (
              <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono">
                No saved setups yet — saved locally on this device.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {savedSetups.map((s) => (
                  <div key={s.id} className="flex items-center gap-1">
                    <button
                      onClick={() => loadSetup(s)}
                      className="flex-1 min-w-0 text-left px-2 py-1.5 text-[10px] font-mono border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm truncate"
                      title={`Load · saved ${new Date(s.ts).toLocaleString()}`}
                    >
                      {s.name}
                    </button>
                    <button
                      onClick={() => deleteSetup(s.id)}
                      className="px-2 py-1.5 border border-suite-border hover:border-destructive/60 hover:text-destructive transition-colors rounded-sm"
                      aria-label="Delete setup"
                      title="Delete"
                    >
                      <X className="size-3" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Export / Share */}
          <section className="p-5 border-t border-suite-border flex flex-col gap-2">
            <SectionHeader label="Export · Share" />
            <button
              onClick={copySpecSheet}
              className="flex items-center justify-center gap-2 px-3 py-2 text-[10px] tracking-[0.18em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
              title="Copy a one-page plain-text spec sheet to the clipboard"
            >
              <Clipboard className="size-3" strokeWidth={1.5} />
              Copy Spec Sheet
            </button>
            <button
              onClick={copyPermalink}
              className="flex items-center justify-center gap-2 px-3 py-2 text-[10px] tracking-[0.18em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
              title="Share-safe link — all settings encoded in the URL"
            >
              <Link2 className="size-3" strokeWidth={1.5} />
              Copy Permalink
            </button>

            <div className="mt-1 pt-2 border-t border-suite-border/60 flex flex-col gap-2">
              <span className="text-[9px] tracking-[0.2em] text-suite-text-dim uppercase">
                Framing Chart · {formatNumber(source.width)}×{formatNumber(source.height)}
              </span>
              <button
                type="button"
                onClick={() => setExportWithImage((v) => !v)}
                className="flex items-center justify-between gap-2 px-2 py-1.5 text-[10px] tracking-[0.14em] uppercase border border-suite-border hover:border-suite-border-strong transition-colors rounded-sm"
                title="PNG/TIFF only: composite the studio reference plate behind the chart instead of the clean field. FDL is unaffected."
              >
                <span className="flex items-center gap-1.5 text-suite-text-muted">
                  <Eye className="size-3" strokeWidth={1.5} /> Studio plate background
                </span>
                <span className={cn("font-mono", exportWithImage ? "text-status-ok" : "text-suite-text-dim")}>
                  {exportWithImage ? "ON" : "OFF"}
                </span>
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => exportFramingChart("png")}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] tracking-[0.14em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
                  title="Download a full-resolution framing chart as PNG"
                >
                  <Download className="size-3" strokeWidth={1.5} />
                  PNG
                </button>
                <button
                  onClick={() => exportFramingChart("fdl")}
                  className="flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] tracking-[0.14em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
                  title="Download an ASC Framing Decision List (.fdl) — Netflix/ASC standard"
                >
                  <Download className="size-3" strokeWidth={1.5} />
                  FDL
                </button>
              </div>
              <button
                onClick={exportCameraReport}
                className="flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] tracking-[0.14em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
                title="Download a printable PDF spec sheet — camera, framing, extraction, plus mag/card runtime, offload & proxy storage plan"
              >
                <Download className="size-3" strokeWidth={1.5} />
                Camera Report (PDF)
              </button>
            </div>
          </section>
        </aside>

        {/* Canvas */}
        <section className="flex-1 min-w-0 flex flex-col">
          {viewMode === "source" ? (
            <FrameViewer
              source={source}
              target={target}
              showGuides={showGuides}
              showMask={showMask}
              showThirds={showThirds}
              showSafeArea={showSafeArea}
              desqueeze={desqueeze}
              pixelTrue={pixelTrue}
              fitMode={fitMode}
              reframeOffset={reframeOffset}
              onReframeChange={setReframeOffset}
              protectionPct={protectionPct}
              onProtectionChange={(p) => setProtectionPct(Math.max(0, Math.min(40, p)))}
              extractionScale={extractionScale}
              onExtractionScaleChange={setExtractionScale}
              deliveryCropAR={deliveryCrop.ar}
              deliveryCropLabel={deliveryCrop.ar != null ? deliveryCrop.label.split(" ")[0] : undefined}
              referenceImage={refImage}
            />
          ) : (
            <DeliveryViewer
              source={source}
              target={target}
              desqueeze={desqueeze}
              showGuides={showGuides}
              showThirds={showThirds}
              showSafeArea={showSafeArea}
              transform={sourceTransform}
              onTransformChange={setSourceTransform}
              referenceImage={refImage}
              protectionPct={protectionPct}
              onProtectionChange={(p) => setProtectionPct(Math.max(0, Math.min(40, p)))}
            />
          )}
          {/* Bottom status bar */}
          <footer className="h-7 shrink-0 border-t border-suite-border bg-suite-panel flex items-center justify-between px-4 font-mono text-[10px] text-suite-text-dim">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <div className="size-1.5 rounded-full bg-status-ok" />
                Pipeline: {viewMode === "delivery" ? "delivery view · drag/wheel/pinch" : "linear · center extract"}
              </span>
              <span className="flex items-center gap-1.5">
                <Gauge className="size-3" strokeWidth={1.5} />
                {codec.name} @ {fps} fps · {mbps >= 1000 ? `${(mbps / 1000).toFixed(2)} Gbps` : `${mbps.toFixed(0)} Mbps`}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>{source.camera}</span>
              <span className="text-suite-text-dim">→</span>
              <span>{target.name}</span>
            </div>
          </footer>
        </section>
      </main>
      )}
    </div>
  );
};

function VersionBadge() {
  // Changelog kept in code (CHANGELOG above) for history, but no longer surfaced in the UI.
  return <span className="text-[10px] text-suite-text-dim ml-2 font-mono">{VERSION}</span>;
}

function SectionHeader({ label, dotClass }: { label: string; dotClass?: string }) {
  return (
    <header className="flex items-center justify-between">
      <h2 className="text-[10px] font-semibold tracking-[0.22em] text-suite-text-muted uppercase">
        {label}
      </h2>
      {dotClass && <div className={cn("size-2 rounded-full", dotClass)} />}
    </header>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  value,
  onChange,
  hint,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-sm",
        "hover:bg-suite-panel-elevated transition-colors text-left",
      )}
      title={hint}
    >
      <span className="flex items-center gap-2 text-xs text-suite-text min-w-0">
        <Icon className="size-3.5 text-suite-text-muted shrink-0" strokeWidth={1.5} />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={cn(
          "relative w-7 h-3.5 rounded-full transition-colors",
          value ? "bg-suite-text" : "bg-suite-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-2.5 rounded-full transition-all",
            value ? "left-3.5 bg-suite-bg" : "left-0.5 bg-suite-text-muted",
          )}
        />
      </span>
    </button>
  );
}

function FpsControl({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
        Frame Rate
      </span>
      <div className="flex flex-wrap gap-1">
        {FPS_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            className={cn(
              "px-2 py-1 text-[10px] font-mono tabular rounded-sm border transition-colors",
              value === f
                ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text"
                : "border-suite-border text-suite-text-muted hover:text-suite-text",
            )}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function FitModeToggle({
  value,
  onChange,
}: {
  value: FitMode;
  onChange: (v: FitMode) => void;
}) {
  const opts: { id: FitMode; label: string; hint: string }[] = [
    { id: "fit", label: "Fit", hint: "Contain target inside source — pillar/letterbox if aspect differs" },
    { id: "fill", label: "Fill", hint: "Cover target with source — crops top/bottom or sides" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Crop className="size-3 text-suite-text-muted" strokeWidth={1.5} />
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
          Fit Mode
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 p-0.5 bg-suite-bg border border-suite-border rounded-sm">
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            title={o.hint}
            className={cn(
              "px-2 py-1.5 text-[10px] tracking-[0.18em] uppercase font-mono rounded-[2px] transition-colors",
              value === o.id
                ? "bg-suite-panel-elevated text-suite-text"
                : "text-suite-text-muted hover:text-suite-text",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShootPlanControls({
  hours,
  onHoursChange,
  cameras,
  onCamerasChange,
}: {
  hours: number;
  onHoursChange: (n: number) => void;
  cameras: number;
  onCamerasChange: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
          Record Hours / Day
        </span>
        <div className="flex items-center bg-suite-bg border border-suite-border rounded-sm">
          <button
            type="button"
            onClick={() => onHoursChange(Math.max(0.5, +(hours - 0.5).toFixed(1)))}
            className="px-2 py-1 text-suite-text-muted hover:text-suite-text"
            aria-label="Decrease hours"
          >
            −
          </button>
          <input
            type="number"
            min={0.5}
            max={24}
            step={0.5}
            value={hours}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onHoursChange(Math.max(0.5, Math.min(24, n)));
            }}
            className="flex-1 bg-transparent text-center text-xs font-mono tabular text-suite-text focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onHoursChange(Math.min(24, +(hours + 0.5).toFixed(1)))}
            className="px-2 py-1 text-suite-text-muted hover:text-suite-text"
            aria-label="Increase hours"
          >
            +
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
          Cameras
        </span>
        <div className="flex items-center bg-suite-bg border border-suite-border rounded-sm">
          <button
            type="button"
            onClick={() => onCamerasChange(Math.max(1, cameras - 1))}
            className="px-2 py-1 text-suite-text-muted hover:text-suite-text"
            aria-label="Decrease cameras"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={12}
            step={1}
            value={cameras}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) onCamerasChange(Math.max(1, Math.min(32, Math.round(n))));
            }}
            className="flex-1 bg-transparent text-center text-xs font-mono tabular text-suite-text focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onCamerasChange(Math.min(12, cameras + 1))}
            className="px-2 py-1 text-suite-text-muted hover:text-suite-text"
            aria-label="Increase cameras"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function ProxyEstimates({
  target,
  fps,
  perDayGB,
  recordHoursPerDay,
  cameraCount,
  proxyCodecId,
  onProxyCodecChange,
}: {
  target: (typeof TARGETS)[number];
  fps: number;
  perDayGB: number;
  recordHoursPerDay: number;
  cameraCount: number;
  proxyCodecId: string;
  onProxyCodecChange: (id: string) => void;
}) {
  const proxyOptions = useMemo(
    () =>
      PROXY_CODEC_IDS.map(({ id }) => {
        const c = CODECS.find((x) => x.id === id);
        return c ? { value: c.id, label: c.name, group: c.family } : null;
      }).filter(Boolean) as { value: string; label: string; group?: string }[],
    [],
  );

  const selected = useMemo(() => {
    const entry =
      PROXY_CODEC_IDS.find((p) => p.id === proxyCodecId) ?? PROXY_CODEC_IDS[0];
    const c = CODECS.find((x) => x.id === entry.id);
    if (!c) return null;
    const tgtW = target.activeWidth ?? target.width;
    const tgtH = target.activeHeight ?? target.height;
    const w = entry.resolutionTier === "hd" ? 1920 : tgtW;
    const h = entry.resolutionTier === "hd" ? 1080 : tgtH;
    const mbps = codecMbps(c, w, h, fps);
    const perHourGB = estimateFileSizeGB(mbps, 3600);
    const perCamDay = perHourGB * recordHoursPerDay;
    const totalDay = perCamDay * cameraCount;
    return { codec: c, w, h, mbps, perHourGB, perCamDay, totalDay };
  }, [proxyCodecId, target, fps, recordHoursPerDay, cameraCount]);

  if (!selected) return null;
  const ratioVsCamera = perDayGB > 0 ? selected.totalDay / perDayGB : 0;
  const ratioClass =
    ratioVsCamera > 1
      ? "text-status-warn"
      : ratioVsCamera > 0.5
        ? "text-suite-text"
        : "text-status-ok";

  return (
    <div className="flex flex-col gap-2 pt-3 mt-1 border-t border-suite-border">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
          Proxies
        </span>
        <span className="text-[9px] tracking-[0.14em] uppercase font-mono text-suite-text-dim">
          {recordHoursPerDay} h × {cameraCount} cam{cameraCount > 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono">
        Transcoded proxy size at delivery resolution ({selected.w}×{selected.h}),
        scaled to total camera footage shot per day.
      </p>
      <SuiteSelect
        label="Proxy Codec"
        value={proxyCodecId}
        onChange={onProxyCodecChange}
        options={proxyOptions}
      />
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Metric
          label="Bitrate"
          value={
            selected.mbps >= 1000
              ? `${(selected.mbps / 1000).toFixed(2)} Gbps`
              : `${selected.mbps.toFixed(0)} Mbps`
          }
          hint={`${(selected.mbps / 8).toFixed(1)} MB/s · per camera`}
        />
        <Metric
          label="Per Hour"
          value={formatSize(selected.perHourGB)}
          hint="per camera"
        />
        <Metric
          label="Per Camera / Day"
          value={formatSize(selected.perCamDay)}
          hint={`${recordHoursPerDay} h rolling`}
        />
        <Metric
          label="Total / Day"
          value={
            <span className={ratioClass}>{formatSize(selected.totalDay)}</span>
          }
          hint={`${(ratioVsCamera * 100).toFixed(0)}% of camera footage`}
        />
      </div>
    </div>
  );
}

function FrameTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-suite-bg border border-suite-border rounded-sm">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono rounded-[2px] transition-colors",
          active
            ? "bg-status-ok/15 text-status-ok shadow-[inset_0_0_0_1px_hsl(var(--status-ok)/0.4)]"
            : "text-suite-text-muted hover:text-suite-text",
        )}
      >
        <Aperture className="size-3" strokeWidth={1.5} />
        Capture &amp; Framing
      </button>
    </div>
  );
}

function StorageTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Storage / file size calculator"
    >
      <HardDrive className="size-3" strokeWidth={1.5} />
      Storage
    </button>
  );
}

function DeliverablesTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Deliverables — multi-recipient delivery plan"
    >
      <PackageCheck className="size-3" strokeWidth={1.5} />
      Deliverables
    </button>
  );
}

function BoardTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Task board — kanban + checklists"
    >
      <SquareKanban className="size-3" strokeWidth={1.5} />
      Board
    </button>
  );
}

function MulticamTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Multicam planner — combined data &amp; storage across cameras"
    >
      <Video className="size-3" strokeWidth={1.5} />
      Multicam
    </button>
  );
}

function OpticsTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Optics — field of view, depth of field, focal equivalence"
    >
      <Aperture className="size-3" strokeWidth={1.5} />
      Optics
    </button>
  );
}

function MasteringTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Mastering Workflow — deliverables node tree (grade → masters → trims → deliverables)"
    >
      <Share2 className="size-3" strokeWidth={1.5} />
      Mastering
    </button>
  );
}

function ToolsTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Post Tools — timecode, frame-rate, aspect-ratio calculators + EDL converter"
    >
      <Calculator className="size-3" strokeWidth={1.5} />
      Tools
    </button>
  );
}

function GlossaryTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Glossary — every post-production term, abbreviation and standard"
    >
      <BookText className="size-3" strokeWidth={1.5} />
      Glossary
    </button>
  );
}

function PlannerTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Post Schedule — phase milestones, owners, due dates and status"
    >
      <CalendarClock className="size-3" strokeWidth={1.5} />
      Planner
    </button>
  );
}

function WorkflowTabButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono border rounded-sm transition-colors",
        active
          ? "bg-status-ok/15 text-status-ok border-status-ok/50"
          : "text-suite-text-muted hover:text-suite-text border-suite-border hover:border-suite-border-strong bg-suite-bg",
      )}
      title="Production Workflow — full pipeline: camera test → set → dailies → VFX → conform → grade → QC → delivery → archive, + audio"
    >
      <GitBranch className="size-3" strokeWidth={1.5} />
      Workflow
    </button>
  );
}

function ViewModeSwitch({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  const opts: { id: ViewMode; label: string; icon: React.ComponentType<any>; hint: string }[] = [
    {
      id: "source",
      label: "Source",
      icon: Film,
      hint: "Inspect the capture frame and how the target extracts from it",
    },
    {
      id: "delivery",
      label: "Delivery",
      icon: MonitorPlay,
      hint: "See the final delivered frame — drag, wheel or pinch to scale source inside it",
    },
  ];
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-suite-bg border border-suite-border rounded-sm">
      {opts.map((o) => {
        const Icon = o.icon;
        const active = value === o.id;
        const activeClass =
          o.id === "delivery"
            ? "bg-status-ok/15 text-status-ok shadow-[inset_0_0_0_1px_hsl(var(--status-ok)/0.4)]"
            : "bg-status-warn/15 text-status-warn shadow-[inset_0_0_0_1px_hsl(var(--status-warn)/0.4)]";
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            title={o.hint}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 text-[10px] tracking-[0.18em] uppercase font-mono rounded-[2px] transition-colors",
              active ? activeClass : "text-suite-text-muted hover:text-suite-text",
            )}
          >
            <Icon className="size-3" strokeWidth={1.5} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function DeliveryTransformPanel({
  transform,
  onChange,
  onReset,
  onFitWidth,
  onFitHeight,
  onFill,
}: {
  transform: SourceTransform;
  onChange: (t: SourceTransform) => void;
  onReset: () => void;
  onFitWidth: () => void;
  onFitHeight: () => void;
  onFill: () => void;
}) {
  const scalePct = Math.round(transform.scale * 100);
  return (
    <section className="p-5 border-b border-suite-border flex flex-col gap-4 bg-suite-canvas/50">
      <SectionHeader label="04 · Delivery Transform" />

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
            Source Scale
          </span>
          <span className="font-mono text-sm tabular text-suite-text">{scalePct}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={400}
          step={1}
          value={scalePct}
          onChange={(e) =>
            onChange({ ...transform, scale: Number(e.target.value) / 100 })
          }
          className="w-full accent-suite-text cursor-pointer"
        />
        <div className="flex justify-between text-[9px] font-mono text-suite-text-dim">
          <span>10%</span>
          <span>100% · COVER</span>
          <span>400%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1 p-0.5 bg-suite-bg border border-suite-border rounded-sm">
        <button
          type="button"
          onClick={onFitWidth}
          title="Fit source width to delivery — letterbox top/bottom"
          className="px-2 py-1.5 text-[10px] tracking-[0.18em] uppercase font-mono rounded-[2px] text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated transition-colors"
        >
          Fit W
        </button>
        <button
          type="button"
          onClick={onFitHeight}
          title="Fit source height to delivery — pillarbox sides"
          className="px-2 py-1.5 text-[10px] tracking-[0.18em] uppercase font-mono rounded-[2px] text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated transition-colors"
        >
          Fit H
        </button>
        <button
          type="button"
          onClick={onFill}
          title="Cover delivery with source — crops the longer axis"
          className="px-2 py-1.5 text-[10px] tracking-[0.18em] uppercase font-mono rounded-[2px] text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated transition-colors"
        >
          Fill
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Pos X" value={`${Math.round(transform.x)} px`} />
        <Metric label="Pos Y" value={`${Math.round(transform.y)} px`} />
      </div>

      <button
        onClick={onReset}
        className="flex items-center justify-center gap-2 px-2 py-1.5 rounded-sm hover:bg-suite-panel-elevated transition-colors text-xs text-suite-text-muted border border-suite-border"
      >
        <RotateCcw className="size-3.5" strokeWidth={1.5} />
        Reset transform
      </button>

      <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono">
        Drag the canvas to reposition · scroll wheel to scale · pinch on touch.
        At 100% the source covers the delivery (matching the auto-extraction).
      </p>
    </section>
  );
}

export default Index;
