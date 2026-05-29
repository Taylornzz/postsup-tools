import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  SOURCE_FORMATS,
  TARGETS,
  CODECS,
  LENSES,
  CARDS,
  PROXY_CODEC_IDS,
  OFFLOAD_BANDWIDTHS,
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
  AudioChannelConfig,
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
  Volume2,
  Focus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FileSizeCalculator } from "@/components/FileSizeCalculator";
import referencePerson from "@/assets/reference-bg.jpg";

const BUILTIN_GUIDE = referencePerson;
const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120];
const VERSION = "v1.9.13";
const CHANGELOG = [
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
type AppTab = "frame" | "storage";

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

const Index = () => {
  // Hydrate from URL once
  const [appTab, setAppTab] = useState<AppTab>(
    (readParam(URL_KEYS.tab) as AppTab) === "storage" ? "storage" : "frame",
  );
  const [sourceId, setSourceId] = useState<string>(() => {
    const id = readParam(URL_KEYS.src);
    return id && SOURCE_FORMATS.some((s) => s.id === id) ? id : SOURCE_FORMATS[0].id;
  });
  const [targetId, setTargetId] = useState<string>(() => {
    const id = readParam(URL_KEYS.tgt);
    return id && TARGETS.some((t) => t.id === id) ? id : "uhd-4k";
  });
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
  const [refImage, setRefImage] = useState<string | null>(BUILTIN_GUIDE);
  // Composite the studio plate behind the exported chart (PNG/TIFF) instead of
  // the clean ASC-style field. FDL is geometry-only and ignores this.
  const [exportWithImage, setExportWithImage] = useState(false);
  const [usingBuiltin, setUsingBuiltin] = useState(true);
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
    return Math.max(1, Math.min(12, Math.round(n)));
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
  // Audio channel layout override (per delivery target)
  const [audioChannels, setAudioChannels] = useState<AudioChannelConfig | null>(() => {
    const v = readParam(URL_KEYS.aud) as AudioChannelConfig | null;
    return v ?? null;
  });
  // Delivery-intent crop (drawn on top of the source extraction frame)
  const [deliveryCropId, setDeliveryCropId] = useState<string>(() => {
    const id = readParam(URL_KEYS.dcr);
    return id && DELIVERY_CROPS.some((c) => c.id === id) ? id : "none";
  });
  const deliveryCrop = DELIVERY_CROPS.find((c) => c.id === deliveryCropId) ?? DELIVERY_CROPS[0];

  const source = SOURCE_FORMATS.find((s) => s.id === sourceId)!;
  const target = TARGETS.find((t) => t.id === targetId)!;
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

  // Audio variants — clamp to what the target supports.
  const supportedAudio: AudioChannelConfig[] =
    target.audioVariants ?? (target.audio ? [target.audio.channels] : []);
  const audioInUse: AudioChannelConfig | null =
    audioChannels && supportedAudio.includes(audioChannels)
      ? audioChannels
      : (supportedAudio[0] ?? target.audio?.channels ?? null);

  // Netflix camera-approval status (for source badge)
  const netflixStatus = useMemo(
    () => netflixStatusForCamera(source.camera),
    [source.camera],
  );

  // Supersampled when the source has more pixels across the extracted area
  // than the delivery — Netflix-preferred path (8K → 4K, 6K → 4K, etc.).
  const isSupersampled = ext.scale < 0.999;

  // Persist core state to URL (debounced via microtask)
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
    if (audioInUse) params.set(URL_KEYS.aud, audioInUse);
    params.set(URL_KEYS.exs, String(extractionScale));
    if (deliveryCropId !== "none") params.set(URL_KEYS.dcr, deliveryCropId);
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", next);
  }, [
    appTab, sourceId, targetId, codecId, fps, fitMode, viewMode,
    desqueeze, showThirds, showSafeArea, showMask, showGuides, pixelTrue,
    hdrInUse, lensId, cardId, backupCopies, bwId,
    recordHoursPerDay, cameraCount, proxyCodecId, protectionPct,
    offloadStations, audioInUse, extractionScale, deliveryCropId,
  ]);

  const resetReframe = () => setReframeOffset({ x: 0, y: 0 });
  const resetExtractionScale = () => setExtractionScale(1);
  const resetTransform = () => setSourceTransform({ scale: 1, x: 0, y: 0 });

  useEffect(() => {
    setSourceTransform((t) => ({ ...t, x: 0, y: 0 }));
  }, [sourceId, targetId, desqueeze]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setRefImage(url);
    setUsingBuiltin(false);
  };

  const useBuiltin = () => {
    setRefImage(BUILTIN_GUIDE);
    setUsingBuiltin(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const clearImage = () => {
    setRefImage(null);
    setUsingBuiltin(false);
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
  const targetOptions = TARGETS.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.ratioLabel})`,
    group: t.group,
  }));
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
    const audioLine = target.audio
      ? `  Audio      : ${target.audio.channels} · ${target.audio.lufs} LUFS · ${target.audio.truePeakDb} dBTP`
      : "";
    const lines = [
      `LUMINA FRAME MATRIX — SPEC SHEET ${VERSION}`,
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
      audioLine,
      "",
      `EXTRACTION (delivery-aspect cover crop)`,
      `  Extract Px : ${formatNumber(sourcePxAcrossExtraction)} × ${formatNumber(Math.round(ext.extractH))}`,
      `  H Crop     : ${(ext.cropPctH * 100).toFixed(1)}%`,
      `  V Crop     : ${(ext.cropPctV * 100).toFixed(1)}%`,
      `  Sensor Used: ${(ext.usedArea * 100).toFixed(1)}% (of source area retained)`,
      `  Pixel Scale: ${ext.scale.toFixed(3)}× — ${ext.scale > 1.001 ? "UPSCALE (target larger than extraction)" : "downscale / supersampled (safe)"}`,
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
  ]);

  // Downloadable framing chart — PNG / TIFF raster + ASC FDL (Netflix-style).
  // `protectionPct` is treated as the ASC FDL total protection fraction
  // (symmetric inset), matching the ASC/Netflix convention.
  const exportFramingChart = useCallback(
    async (format: "png" | "tiff" | "fdl") => {
      try {
        const protection = Math.max(0, Math.min(0.9, protectionPct / 100));
        const creator = `Lumina Frame Matrix ${VERSION}`;
        const d = new Date();
        const yymmdd = `${String(d.getFullYear() % 100).padStart(2, "0")}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
        const base = `${yymmdd}_${slug(source.camera)}_${slug(source.mode)}_${slug(target.name)}_framingchart`;

        if (format === "fdl") {
          const fdl = buildFdl({ source, target, protection, creator, secondaryCropAR: deliveryCrop.ar });
          downloadBlob(
            new Blob([fdlToJson(fdl)], { type: "application/json" }),
            `${base}.fdl`,
          );
          toast.success("FDL downloaded");
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
          creator,
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
    [source, target, protectionPct, showThirds, showSafeArea, refImage, exportWithImage, deliveryCrop.ar, deliveryCrop.label],
  );

  // Source aspect labels (for clarity-fix wording)
  const srcAspectName = aspectRatioLabel(srcDisp.width, srcDisp.height);
  const srcAspectDec = aspectDecimalLabel(srcDisp.width, srcDisp.height);
  const tgtAspectDec = aspectDecimalLabel(
    target.activeWidth ?? target.width,
    target.activeHeight ?? target.height,
  );

  return (
    <div className="h-dvh w-full bg-suite-bg text-suite-text flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-suite-border bg-suite-panel">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-guide-source shadow-[0_0_8px_hsl(var(--guide-source))]" />
          <h1 className="font-mono text-xs tracking-[0.22em] uppercase">
            <span className="text-suite-text-muted">LUMINA</span>
            <span className="text-suite-text-dim mx-1">/</span>
            <span className="text-suite-text">
              {appTab === "frame" ? "CAPTURE & FRAMING" : "STORAGE"}
            </span>
          </h1>
          <VersionBadge />
        </div>
        <div className="flex items-center gap-2">
          <FrameTabButton active={appTab === "frame"} onClick={() => setAppTab("frame")} />
          <StorageTabButton active={appTab === "storage"} onClick={() => setAppTab("storage")} />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-[10px] font-mono tracking-widest uppercase text-suite-text-muted">
            {appTab === "frame" ? "Camera · Framing · Protection" : "Codec · Bitrate · Footprint"}
          </span>
        </div>
      </header>

      {appTab === "storage" ? (
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
        <aside className="w-80 shrink-0 bg-suite-panel border-r border-suite-border flex flex-col overflow-y-auto">
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

            {/* Delivery spec — HDR / audio: not framing, kept collapsed but
                still carried into the spec sheet + FDL export. */}
            <details className="group border-t border-suite-border/60 pt-3">
              <summary className="cursor-pointer list-none text-[10px] tracking-[0.18em] uppercase text-suite-text-muted hover:text-suite-text flex items-center gap-1.5 select-none">
                <span className="transition-transform group-open:rotate-90">▸</span>
                Delivery spec · HDR &amp; audio
              </summary>
              <div className="flex flex-col gap-4 pt-3">
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
                {supportedAudio.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted flex items-center gap-1.5">
                      <Volume2 className="size-3" strokeWidth={1.5} /> Audio Layout
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {supportedAudio.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAudioChannels(v)}
                          className={cn(
                            "px-2 py-1 text-[10px] font-mono tabular rounded-sm border transition-colors",
                            audioInUse === v
                              ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text"
                              : "border-suite-border text-suite-text-muted hover:text-suite-text",
                          )}
                          title={v === "7.1.4 Atmos" ? "Dolby Atmos — required for Netflix / Apple TV+ / Disney+ premium tiers" : undefined}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Metric
                    label="HDR · Peak"
                    value={hdrInUse}
                    hint={`${hdrPeakNits(hdrInUse)} nits${hdrInUse === "Dolby Vision P8.1" ? " · DV required for Netflix HDR" : ""}`}
                  />
                  {target.audio && (
                    <Metric
                      label="Audio · LUFS"
                      value={`${audioInUse ?? target.audio.channels} · ${target.audio.lufs}`}
                      hint={`${target.audio.truePeakDb} dBTP true-peak${audioInUse === "7.1.4 Atmos" ? " · Atmos premium tier" : ""}`}
                    />
                  )}
                </div>
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
                max={20}
                step={0.5}
                value={Math.min(protectionPct, 20)}
                onChange={(e) => setProtectionPct(Number(e.target.value))}
                className="w-full accent-guide-target"
              />
              <div className="flex items-center justify-between text-[9px] tracking-[0.18em] uppercase text-suite-text-dim">
                <span>0%</span>
                <span className="text-suite-text-muted">drag the dashed box on canvas</span>
                <span>20%</span>
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
            {/* Secondary delivery crop — a *different* aspect (e.g. a 2:1 or 2.39
                extract, or a 9:16 social pull) the operator also composes to. It
                is drawn inside the primary final frame and IS written onto the
                framing chart + FDL as a second framing intent. */}
            <div className="flex flex-col gap-2 px-1 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted"
                  title="A SECONDARY delivery crop (e.g. 2:1, 2.39 scope, 9:16 social) that the camera operator also frames to. Drawn inside the primary final frame and exported onto the framing chart + FDL as a second framing intent. The primary deliverable is still set by 'Framing For'."
                >
                  Secondary Crop · on chart
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
                title="Choose a delivery-intent aspect ratio to overlay on the source view"
              >
                {DELIVERY_CROPS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
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
                  {usingBuiltin ? "BUILT-IN" : refImage ? "UPLOADED" : "NONE"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={useBuiltin}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[10px] tracking-[0.18em] uppercase border rounded-sm transition-colors",
                    usingBuiltin
                      ? "border-guide-source/60 text-guide-source bg-guide-source/5"
                      : "border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated",
                  )}
                  title="Use the built-in person guide image — auto-cropped to the selected camera's aspect ratio"
                >
                  <Aperture className="size-3" strokeWidth={1.5} />
                  Guide
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-[10px] tracking-[0.18em] uppercase border border-suite-border hover:border-suite-border-strong hover:bg-suite-panel-elevated transition-colors rounded-sm"
                  title="Upload your own reference image"
                >
                  <Upload className="size-3" strokeWidth={1.5} />
                  {refImage && !usingBuiltin ? "Replace" : "Upload"}
                </button>
                {refImage && (
                  <button
                    onClick={clearImage}
                    className="px-2 py-2 border border-suite-border hover:border-destructive/60 hover:text-destructive transition-colors rounded-sm"
                    aria-label="Clear image"
                    title="Hide image — show neutral fill"
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

          {/* Export / Share */}
          <section className="p-5 mt-auto border-t border-suite-border flex flex-col gap-2">
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
  return (
    <div className="relative group">
      <button
        type="button"
        className="text-[10px] text-suite-text-dim ml-2 font-mono hover:text-suite-text transition-colors cursor-help"
      >
        {VERSION}
      </button>
      <div className="absolute left-0 top-full mt-2 w-80 z-50 hidden group-hover:block group-focus-within:block">
        <div className="bg-suite-panel border border-suite-border rounded-sm p-3 shadow-xl">
          <h3 className="text-[9px] tracking-[0.22em] uppercase text-suite-text-muted mb-2">
            Changelog
          </h3>
          <ul className="flex flex-col gap-2">
            {CHANGELOG.map((line) => (
              <li key={line} className="text-[10px] leading-relaxed text-suite-text-dim font-mono">
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
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
              if (Number.isFinite(n)) onCamerasChange(Math.max(1, Math.min(12, Math.round(n))));
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
