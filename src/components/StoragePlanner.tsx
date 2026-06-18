import { useEffect, useMemo, useRef, useState } from "react";
import { HardDrive, Plus, Trash2, Clock, Layers, Copy, Gauge, Calculator, Film, Check, ChevronDown, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SOURCE_FORMATS, CODECS, CARDS, OFFLOAD_BANDWIDTHS, PROXY_CODEC_IDS,
  codecMbps, estimateFileSizeGB, cardRuntimeMinutes, offloadHours,
  nativeCodecsForCamera, cardsForVendor, cameraVendor as vendorOf, formatSize,
  type SourceFormat,
} from "@/lib/formats";

/** Storage — media & data planning for a single camera or a whole rig. Each camera
 *  (A/B/C…) carries its own body, codec, fps, card, hours/day AND shoot days, with its
 *  media plan + codec comparison in-card. Only rig-wide things (backups, offload link,
 *  stations, proxy codec) sit up top. The engine is shared. Per-project. */

type RigCam = {
  id: string; label: string;
  sourceId: string; codecId: string; fps: number;
  cardId: string; hoursPerDay: number; shootDays: number; enabled: boolean;
  setupId?: string; // set when added from a saved Capture setup
};
type SetupSpec = { id: string; name: string; sourceId: string; codecId?: string; fps?: number; cardId?: string };
type Globals = { copies: number; bwId: string; stations: number; proxyCodecId: string; verify: boolean };

const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120];

let _seq = 0;
const uid = () => `c${Date.now().toString(36)}${(_seq++).toString(36)}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Reuse the Multicam keys so any rig already planned carries straight over.
const KEY_CAMS = "kaos.multicam.cams";
const KEY_GLOBALS = "kaos.multicam.globals";

function buildCam(label: string, days: number, seed?: { sourceId?: string; codecId?: string; fps?: number }): RigCam {
  const src = SOURCE_FORMATS.find((s) => s.id === seed?.sourceId) ?? SOURCE_FORMATS[0];
  const codecs = nativeCodecsForCamera(src.camera);
  const cards = cardsForVendor(vendorOf(src.camera));
  const codecId = codecs.some((c) => c.id === seed?.codecId) ? seed!.codecId! : (codecs[0]?.id ?? CODECS[0].id);
  return {
    id: uid(), label, sourceId: src.id, codecId,
    fps: Number.isFinite(seed?.fps) ? seed!.fps! : 24,
    cardId: cards[0]?.id ?? CARDS[0].id, hoursPerDay: 4, shootDays: days, enabled: true,
  };
}
function buildCamFromSetup(s: SetupSpec, days: number): RigCam {
  const src = SOURCE_FORMATS.find((x) => x.id === s.sourceId) ?? SOURCE_FORMATS[0];
  const codecs = nativeCodecsForCamera(src.camera);
  const cards = cardsForVendor(vendorOf(src.camera));
  return {
    id: uid(), label: s.name || "Setup", sourceId: src.id,
    codecId: codecs.some((c) => c.id === s.codecId) ? s.codecId! : (codecs[0]?.id ?? CODECS[0].id),
    fps: Number.isFinite(s.fps) ? s.fps! : 24,
    cardId: CARDS.some((c) => c.id === s.cardId) ? s.cardId! : (cards[0]?.id ?? CARDS[0].id),
    hoursPerDay: 4, shootDays: days, enabled: true, setupId: s.id,
  };
}
// Lowest unused A-cam/B-cam/… so remove-then-add never reuses a label still in the rig.
// Default camera names: Cam A, Cam B, Cam C… (lowest unused letter). Editable; reorderable.
const nextLabel = (cams: { label: string }[]) => {
  const used = new Set(cams.map((c) => c.label));
  for (let i = 0; i < 26; i++) { const l = `Cam ${String.fromCharCode(65 + i)}`; if (!used.has(l)) return l; }
  return `Cam ${cams.length + 1}`;
};
// Migrate the old "A-cam" default naming to "Cam A" (leaves custom names untouched).
const migrateLabel = (l: string) => /^[A-Z]-cam$/.test(l) ? `Cam ${l[0]}` : l;

function loadCams(key: string, days: number, seed?: { sourceId?: string; codecId?: string; fps?: number }): RigCam[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [buildCam("Cam A", days, seed)];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return [buildCam("Cam A", days, seed)];
    return arr
      .filter((c) => c && typeof c.sourceId === "string" && typeof c.codecId === "string")
      .map((c) => ({
        id: typeof c.id === "string" ? c.id : uid(),
        label: typeof c.label === "string" ? migrateLabel(c.label) : "Cam",
        sourceId: SOURCE_FORMATS.some((s) => s.id === c.sourceId) ? c.sourceId : SOURCE_FORMATS[0].id,
        codecId: CODECS.some((x) => x.id === c.codecId) ? c.codecId : CODECS[0].id,
        fps: Number.isFinite(c.fps) ? c.fps : 24,
        cardId: CARDS.some((x) => x.id === c.cardId) ? c.cardId : CARDS[0].id,
        hoursPerDay: Number.isFinite(c.hoursPerDay) ? clamp(c.hoursPerDay, 0, 24) : 4,
        shootDays: Number.isFinite(c.shootDays) ? clamp(c.shootDays, 1, 365) : days, // migrate from old global
        enabled: c.enabled !== false,
        setupId: typeof c.setupId === "string" ? c.setupId : undefined,
      }));
  } catch { return [buildCam("Cam A", days, seed)]; }
}
function loadGlobals(key: string): Globals {
  const dflt: Globals = { copies: 2, bwId: "tb3", stations: 2, proxyCodecId: PROXY_CODEC_IDS[0].id, verify: true };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return dflt;
    const g = JSON.parse(raw);
    return {
      copies: Number.isFinite(g.copies) ? clamp(g.copies, 1, 3) : dflt.copies,
      bwId: OFFLOAD_BANDWIDTHS.some((b) => b.id === g.bwId) ? g.bwId : dflt.bwId,
      stations: Number.isFinite(g.stations) ? clamp(g.stations, 1, 4) : dflt.stations,
      proxyCodecId: PROXY_CODEC_IDS.some((p) => p.id === g.proxyCodecId) ? g.proxyCodecId : dflt.proxyCodecId,
      verify: typeof g.verify === "boolean" ? g.verify : true,
    };
  } catch { return dflt; }
}
// Old global shoot-days (pre per-camera) → used to migrate existing rigs.
function legacyDays(key: string): number {
  try { const g = JSON.parse(localStorage.getItem(key) || "{}"); return Number.isFinite(g.shootDays) ? clamp(g.shootDays, 1, 365) : 20; } catch { return 20; }
}

const fmtData = (gb: number) => (gb >= 1000 ? `${(gb / 1000).toFixed(2)} TB` : gb >= 100 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`);
const fmtTime = (hours: number) => {
  if (!isFinite(hours)) return "—";
  const m = Math.round(hours * 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
const fmtMin = (min: number) => {
  if (!isFinite(min)) return "—";
  const m = Math.round(min);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};

export function StoragePlanner({ projectName, projectId, seedSourceId, seedCodecId, seedFps, setups = [] }: {
  projectName?: string; projectId?: string;
  seedSourceId?: string; seedCodecId?: string; seedFps?: number;
  setups?: SetupSpec[];
}) {
  const suffix = projectId ? `-${projectId}` : "";
  const kCams = KEY_CAMS + suffix, kGlobals = KEY_GLOBALS + suffix;
  const dfltDays = useMemo(() => legacyDays(kGlobals), [kGlobals]);
  const [cams, setCams] = useState<RigCam[]>(() => loadCams(kCams, dfltDays, { sourceId: seedSourceId, codecId: seedCodecId, fps: seedFps }));
  const [g, setG] = useState<Globals>(() => loadGlobals(kGlobals));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [cmpOpen, setCmpOpen] = useState<Set<string>>(() => new Set()); // per-camera codec-comparison table

  useEffect(() => { try { localStorage.setItem(kCams, JSON.stringify(cams)); } catch { /* ignore */ } }, [cams, kCams]);
  useEffect(() => { try { localStorage.setItem(kGlobals, JSON.stringify(g)); } catch { /* ignore */ } }, [g, kGlobals]);

  const sourcesByCamera = useMemo(() => {
    const m = new Map<string, SourceFormat[]>();
    for (const s of SOURCE_FORMATS) { const list = m.get(s.camera) ?? []; list.push(s); m.set(s.camera, list); }
    return [...m.entries()];
  }, []);

  const setCam = (id: string, patch: Partial<RigCam>) => setCams((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const changeBody = (id: string, sourceId: string) => {
    const src = SOURCE_FORMATS.find((s) => s.id === sourceId);
    if (!src) return;
    const codecs = nativeCodecsForCamera(src.camera);
    const cards = cardsForVendor(vendorOf(src.camera));
    setCams((cs) => cs.map((c) => {
      if (c.id !== id) return c;
      const codecId = codecs.some((x) => x.id === c.codecId) ? c.codecId : (codecs[0]?.id ?? CODECS[0].id);
      const cardId = cards.some((x) => x.id === c.cardId) ? c.cardId : (cards[0]?.id ?? CARDS[0].id);
      return { ...c, sourceId, codecId, cardId };
    }));
  };
  const addCam = () => setCams((cs) => { const c = buildCam(nextLabel(cs), cs[0]?.shootDays ?? dfltDays); setExpanded((e) => new Set(e).add(c.id)); return [...cs, c]; });
  const duplicateCam = (id: string) => setCams((cs) => {
    const i = cs.findIndex((c) => c.id === id);
    if (i < 0) return cs;
    const copy: RigCam = { ...cs[i], id: uid(), label: nextLabel(cs), setupId: undefined };
    setExpanded((e) => new Set(e).add(copy.id));
    const next = cs.slice(); next.splice(i + 1, 0, copy); return next;
  });
  const removeCam = (id: string) => setCams((cs) => cs.filter((c) => c.id !== id));
  const reset = () => { if (window.confirm("Clear all cameras from the rig?")) { setCams([]); setExpanded(new Set()); } };

  // ---- drag-to-reorder cameras (grip handle) ----
  const dragCam = useRef<string | null>(null);
  const [overCam, setOverCam] = useState<{ id: string; after: boolean } | null>(null);
  const onCamDragStart = (id: string) => (e: React.DragEvent) => { dragCam.current = id; e.dataTransfer.effectAllowed = "move"; };
  const onCamDragOver = (id: string) => (e: React.DragEvent) => {
    if (!dragCam.current || dragCam.current === id) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    setOverCam((p) => (p?.id === id && p.after === after ? p : { id, after }));
  };
  const onCamDrop = (id: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragCam.current;
    dragCam.current = null; setOverCam(null);
    if (!from || from === id) return;
    // Compute the insert side from THIS event (not the dragover state, which can lag).
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    setCams((cs) => {
      const item = cs.find((c) => c.id === from);
      if (!item) return cs;
      const without = cs.filter((c) => c.id !== from);
      let at = without.findIndex((c) => c.id === id);
      if (at < 0) return cs;
      if (after) at += 1;
      without.splice(at, 0, item);
      return without;
    });
  };
  const onCamDragEnd = () => { dragCam.current = null; setOverCam(null); };
  const toggleExpand = (id: string) => setExpanded((e) => { const n = new Set(e); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleCmp = (id: string) => setCmpOpen((e) => { const n = new Set(e); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSetup = (s: SetupSpec) => setCams((cs) => {
    // Un-ticking removes the camera even if it's the last one — an empty rig is a supported
    // state (removeCam/reset both allow it), so don't silently no-op the only camera.
    if (cs.some((c) => c.setupId === s.id)) return cs.filter((c) => c.setupId !== s.id);
    const cam = buildCamFromSetup(s, cs[0]?.shootDays ?? dfltDays); setExpanded((e) => new Set(e).add(cam.id)); return [...cs, cam];
  });

  const bandwidth = OFFLOAD_BANDWIDTHS.find((b) => b.id === g.bwId) ?? OFFLOAD_BANDWIDTHS[0];
  const proxyEntry = PROXY_CODEC_IDS.find((p) => p.id === g.proxyCodecId) ?? PROXY_CODEC_IDS[0];
  const proxyCodec = CODECS.find((c) => c.id === proxyEntry.id);

  const rows = useMemo(() => cams.map((cam) => {
    const src = SOURCE_FORMATS.find((s) => s.id === cam.sourceId) ?? SOURCE_FORMATS[0];
    const codec = CODECS.find((c) => c.id === cam.codecId) ?? CODECS[0];
    const card = CARDS.find((c) => c.id === cam.cardId) ?? CARDS[0];
    const mbps = codecMbps(codec, src.width, src.height, cam.fps);
    const perHourGB = estimateFileSizeGB(mbps, 3600);
    const camDaily = perHourGB * cam.hoursPerDay;          // this camera's footage / day
    const dailyGB = cam.enabled ? camDaily : 0;            // counted toward the rig
    const shootCam = camDaily * cam.shootDays;             // this camera, whole shoot (1 copy)
    const cardMin = cardRuntimeMinutes(card.gb, mbps);
    const cardsPerDay = camDaily > 0 ? Math.ceil(camDaily / card.gb) : 0;
    const totalLoads = Math.max(1, Math.ceil(shootCam / Math.max(card.gb, 1)));
    const util = cam.hoursPerDay > 0 && cardsPerDay > 0 ? (camDaily / (cardsPerDay * card.gb)) * 100 : 0;
    const mediaWord = card.kind === "mag" ? "mag" : card.kind === "drive" ? "drive" : "card";
    let proxyGB = 0;
    if (proxyCodec) {
      const w = proxyEntry.resolutionTier === "hd" ? 1920 : 3840;
      const h = proxyEntry.resolutionTier === "hd" ? 1080 : 2160;
      proxyGB = estimateFileSizeGB(codecMbps(proxyCodec, w, h, cam.fps), cam.hoursPerDay * 3600) * cam.shootDays;
    }
    const comparison = nativeCodecsForCamera(src.camera).map((c) => {
      const m = codecMbps(c, src.width, src.height, cam.fps);
      return { codec: c, mbps: m, gb: estimateFileSizeGB(m, cam.hoursPerDay * 3600) * cam.shootDays };
    }).sort((a, b) => b.mbps - a.mbps);
    return { cam, src, codec, card, mbps, perHourGB, camDaily, dailyGB, shootCam, cardMin, cardsPerDay, totalLoads, util, mediaWord, proxyGB, comparison };
  }), [cams, proxyCodec, proxyEntry]);

  const totals = useMemo(() => {
    const active = rows.filter((r) => r.cam.enabled);
    const totalDaily = active.reduce((s, r) => s + r.dailyGB, 0);
    const cardsPerDay = active.reduce((s, r) => s + r.cardsPerDay, 0);
    const shootTotal = active.reduce((s, r) => s + r.shootCam, 0);
    const proxyTotal = active.reduce((s, r) => s + r.proxyGB, 0);
    const transferHrs = offloadHours(totalDaily, g.copies, bandwidth.mbps, g.stations); // card/mag → drive copy
    const verifyHrs = g.verify ? transferHrs : 0;                                       // checksum read-back ≈ same again
    const days = active.map((r) => r.cam.shootDays);
    const spanMin = days.length ? Math.min(...days) : 0;
    const spanMax = days.length ? Math.max(...days) : 0;
    return {
      count: active.length, totalDaily, cardsPerDay, onSet: cardsPerDay * 3,
      transferHrs, verifyHrs, offloadHrs: transferHrs + verifyHrs,
      shootTotal, shootWithCopies: shootTotal * g.copies, proxyTotal,
      // peak day = everyone rolling; whole-shoot sums each camera's own days.
      spanMin, spanMax, uniformDays: new Set(days).size <= 1, avgPerDay: spanMax > 0 ? shootTotal / spanMax : 0,
    };
  }, [rows, g.copies, g.stations, g.verify, bandwidth.mbps]);
  const proxyRatio = totals.shootTotal > 0 ? totals.proxyTotal / totals.shootTotal : 0;

  /** Copy the whole storage plan (per camera + rig totals) as paste-anywhere text. */
  const exportPlan = () => {
    const f = (gb: number) => (gb >= 1000 ? `${(gb / 1000).toFixed(2)} TB` : `${Math.round(gb)} GB`);
    const lines: string[] = [
      `STORAGE PLAN${projectName?.trim() ? ` — ${projectName.trim()}` : ""}`,
      `${new Date().toLocaleString()} · ${totals.count} camera${totals.count === 1 ? "" : "s"} · ${g.copies}× copies${g.verify ? " + checksum verify" : ""} · ${bandwidth.label || ""}`,
      "",
      ...rows.filter((r) => r.cam.enabled).map((r) =>
        `• ${r.cam.label || r.src.camera} — ${r.src.camera} ${r.src.mode} · ${r.codec.name} @ ${r.cam.fps}fps · ${r.cam.hoursPerDay}h/day × ${r.cam.shootDays} days
  ${f(r.camDaily)}/day · ${f(r.shootCam)} shoot total · ${r.cardsPerDay} ${r.mediaWord}s/day (${r.card.name}, ~${Math.round(r.cardMin)} min each)${r.proxyGB ? ` · proxies ${f(r.proxyGB)}` : ""}`),
      "",
      `RIG TOTALS`,
      `Daily (all rolling): ${f(totals.totalDaily)} · ${totals.cardsPerDay} loads/day`,
      `Whole shoot (1 copy): ${f(totals.shootTotal)} · with ${g.copies}× copies: ${f(totals.shootWithCopies)}`,
      `Proxies: ${f(totals.proxyTotal)} (${Math.round(proxyRatio * 100)}% of OCF)`,
      `Grand total to store: ${f(totals.shootWithCopies + totals.proxyTotal)}`,
      `Daily offload: ${totals.transferHrs.toFixed(1)}h copy${g.verify ? ` + ${totals.verifyHrs.toFixed(1)}h verify = ${totals.offloadHrs.toFixed(1)}h` : ""} (${g.stations} station${g.stations === 1 ? "" : "s"})`,
    ];
    const text = lines.join("\n");
    const slug = (projectName?.trim() || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const filename = `${slug ? slug + "-" : ""}storage-plan.txt`;
    // Download a .txt — reliable and visible, unlike clipboard (which needs focus/permission and
    // silently no-ops otherwise). Fall back to clipboard only if the download can't be created.
    try {
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success("Storage plan downloaded", { description: filename });
    } catch {
      navigator.clipboard?.writeText(text).then(
        () => toast.success("Storage plan copied to clipboard"),
        () => toast.error("Couldn't export the storage plan"),
      );
    }
  };

  const sel = "bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target";
  const num = "w-16 bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target";

  const grandTotal = totals.shootWithCopies + totals.proxyTotal;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <HardDrive className="size-4 text-guide-target" strokeWidth={1.6} />
          <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Storage</span>
          {projectName?.trim() && <span className="font-mono text-[11px] text-suite-text-dim truncate max-w-[18ch]">· {projectName.trim()}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={addCam} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors">
            <Plus className="size-3" strokeWidth={2} /> Camera
          </button>
          <button onClick={exportPlan} title="Download the full storage plan (per camera + rig totals) as a text file" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            Export
          </button>
          <button onClick={reset} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-2.5">
          {/* Section header — you're looking at cameras */}
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-suite-text font-semibold">Cameras</span>
            <span className="font-mono text-[10px] text-suite-text-dim">{cams.length ? `${cams.length} in rig · click one to edit` : "none yet"}</span>
          </div>

          {/* Saved Capture setups → drop in as cameras */}
          {setups.length > 0 && (
            <div className="rounded-md border border-suite-border bg-suite-panel/40 px-3.5 py-3">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-suite-text-dim mb-2">From saved setups <span className="text-suite-text-dim/70 normal-case tracking-normal">· tick to add as a camera, then tweak or add more</span></div>
              <div className="flex flex-wrap gap-1.5">
                {setups.map((s) => {
                  const on = cams.some((c) => c.setupId === s.id);
                  return (
                    <button key={s.id} type="button" onClick={() => toggleSetup(s)}
                      className={cn("flex items-center gap-1.5 px-2 py-1 rounded-sm border font-mono text-[10px] transition-colors",
                        on ? "border-guide-target/50 bg-guide-target/10 text-guide-target" : "border-suite-border text-suite-text-muted hover:text-suite-text hover:border-suite-border-strong")}>
                      <span className={cn("size-2.5 rounded-[2px] border grid place-items-center shrink-0", on ? "bg-guide-target border-guide-target" : "border-suite-text-dim")}>{on && <Check className="size-2 text-suite-bg" strokeWidth={3} />}</span>
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Camera cards — collapsed by default; click a row to open its settings + plan */}
          {cams.length === 0 ? (
            <div className="rounded-md border border-dashed border-suite-border bg-suite-panel/30 px-4 py-10 text-center flex flex-col items-center gap-2.5">
              <HardDrive className="size-7 text-suite-text-dim" strokeWidth={1.3} />
              <p className="font-mono text-[11px] text-suite-text-muted">No cameras in the rig.</p>
              <p className="font-mono text-[10px] text-suite-text-dim max-w-sm leading-relaxed">Add a camera to start planning storage{setups.length ? ", or tick a saved Capture setup above to drop one in" : ""}.</p>
              <button onClick={addCam} className="mt-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border font-mono text-[10px] uppercase tracking-[0.12em] text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20">
                <Plus className="size-3.5" strokeWidth={2} /> Add a camera
              </button>
            </div>
          ) : (<>
          {rows.map((r, idx) => {
            const isOpen = expanded.has(r.cam.id);
            const showCmp = cmpOpen.has(r.cam.id);
            return (
              <div key={r.cam.id}
                onDragOver={onCamDragOver(r.cam.id)} onDrop={onCamDrop(r.cam.id)}
                className={cn("rounded-md border bg-suite-panel/60 transition-colors", r.cam.enabled ? "border-suite-border" : "border-suite-border/50 opacity-60", isOpen && "border-guide-target/40",
                  dragCam.current === r.cam.id && "opacity-50",
                  overCam?.id === r.cam.id && (overCam.after ? "shadow-[0_3px_0_0_#f59e0b]" : "shadow-[0_-3px_0_0_#f59e0b]"))}>
                {/* Collapsed header row — clean & scannable. Click the summary or chevron to open. */}
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <button draggable onDragStart={onCamDragStart(r.cam.id)} onDragEnd={onCamDragEnd}
                    title="Drag to reorder" aria-label="Drag to reorder camera"
                    className="shrink-0 cursor-grab active:cursor-grabbing text-suite-text-dim hover:text-suite-text">
                    <GripVertical className="size-3.5" strokeWidth={1.6} />
                  </button>
                  <button onClick={() => setCam(r.cam.id, { enabled: !r.cam.enabled })}
                    title={r.cam.enabled ? "Rolling — click to mute from rig totals" : "Muted — click to include"}
                    className={cn("shrink-0 size-2.5 rounded-full border", r.cam.enabled ? "bg-guide-target border-guide-target" : "border-suite-text-dim")} />
                  <span className="shrink-0 grid place-items-center size-5 rounded bg-suite-bg border border-suite-border font-mono text-[10px] font-bold text-suite-text-muted tabular">{idx + 1}</span>
                  <input value={r.cam.label} onChange={(e) => setCam(r.cam.id, { label: e.target.value })}
                    title="Camera label"
                    className="w-24 shrink-0 bg-transparent border-0 border-b border-transparent hover:border-suite-border/60 focus:border-suite-border px-0.5 text-[12px] font-mono text-suite-text font-semibold focus:outline-none" />
                  {/* one-line summary doubles as the expand hit-area */}
                  <button onClick={() => toggleExpand(r.cam.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                    <span className="truncate font-mono text-[10px] text-suite-text-dim">
                      <span className="text-suite-text-muted">{r.src.camera}</span>
                      <span className="text-suite-text-dim/70"> · {r.src.mode} · {r.codec.name} · {r.cam.fps} fps · {r.cam.hoursPerDay}h × {r.cam.shootDays}d</span>
                    </span>
                  </button>
                  <span className="shrink-0 font-mono text-[13px] text-guide-target font-semibold tabular" title={`${fmtData(r.camDaily)}/day · ${r.cam.hoursPerDay} h/day × ${r.cam.shootDays} days`}>{fmtData(r.shootCam)}</span>
                  <button onClick={() => toggleExpand(r.cam.id)} title={isOpen ? "Collapse" : "Edit this camera"}
                    className="shrink-0 flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-suite-text-muted hover:text-suite-text">
                    <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} strokeWidth={1.8} />
                  </button>
                  <button onClick={() => duplicateCam(r.cam.id)} title="Duplicate this camera" className="shrink-0 text-suite-text-dim hover:text-suite-text">
                    <Copy className="size-3.5" strokeWidth={1.6} />
                  </button>
                  <button onClick={() => removeCam(r.cam.id)} title="Remove camera" className="shrink-0 text-suite-text-dim hover:text-destructive">
                    <Trash2 className="size-3.5" strokeWidth={1.6} />
                  </button>
                </div>

                {/* Open: this camera's settings + media plan + (optional) codec comparison */}
                {isOpen && (
                  <div className="border-t border-suite-border/60 px-3.5 py-3 flex flex-col gap-3 bg-suite-bg/30">
                    <div className="flex flex-wrap items-end gap-2.5">
                      <Labeled label="Camera / mode">
                        <select value={r.cam.sourceId} onChange={(e) => changeBody(r.cam.id, e.target.value)} className={cn(sel, "max-w-[19rem]")}>
                          {sourcesByCamera.map(([camera, modes]) => (
                            <optgroup key={camera} label={camera}>{modes.map((s) => <option key={s.id} value={s.id}>{s.mode}</option>)}</optgroup>
                          ))}
                        </select>
                      </Labeled>
                      <Labeled label="Codec">
                        <select value={r.cam.codecId} onChange={(e) => setCam(r.cam.id, { codecId: e.target.value })} className={cn(sel, "max-w-[13rem]")}>
                          {(nativeCodecsForCamera(r.src.camera).length ? nativeCodecsForCamera(r.src.camera) : CODECS).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </Labeled>
                      <Labeled label="FPS">
                        <select value={r.cam.fps} onChange={(e) => setCam(r.cam.id, { fps: parseFloat(e.target.value) })} className={sel}>
                          {FPS_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </Labeled>
                      <Labeled label="Card">
                        <select value={r.cam.cardId} onChange={(e) => setCam(r.cam.id, { cardId: e.target.value })} className={cn(sel, "max-w-[14rem]")}>
                          {cardsForVendor(vendorOf(r.src.camera)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </Labeled>
                      <Labeled label="Hours/day">
                        <input type="number" min={0} max={24} step={0.5} value={r.cam.hoursPerDay} onChange={(e) => setCam(r.cam.id, { hoursPerDay: clamp(parseFloat(e.target.value || "0") || 0, 0, 24) })} className={num} />
                      </Labeled>
                      <Labeled label="Shoot days">
                        <input type="number" min={1} max={365} value={r.cam.shootDays} onChange={(e) => setCam(r.cam.id, { shootDays: clamp(parseInt(e.target.value || "1", 10) || 1, 1, 365) })} className={num} />
                      </Labeled>
                    </div>

                    {/* this camera's at-a-glance numbers */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-suite-text-dim">
                      <span>{r.mbps >= 1000 ? `${(r.mbps / 1000).toFixed(2)} Gbps` : `${Math.round(r.mbps).toLocaleString()} Mbps`}</span>
                      <span>{fmtData(r.perHourGB)}/hr</span>
                      <span>{fmtData(r.camDaily)}/day</span>
                      <span>{r.src.width.toLocaleString()}×{r.src.height.toLocaleString()}</span>
                    </div>

                    {/* media plan */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-suite-border rounded-sm overflow-hidden border border-suite-border">
                      <MediaCell label={`${r.mediaWord}s / day`} value={`${r.cardsPerDay}`} hint={`${fmtData(r.camDaily)} · ${r.util.toFixed(0)}% fill`} />
                      <MediaCell label="On-set inventory" value={`${r.cardsPerDay * 3}`} hint="3× rotation" warn />
                      <MediaCell label={`runtime / ${r.mediaWord}`} value={fmtMin(r.cardMin)} hint={fmtData(r.card.gb)} />
                      <MediaCell label={`total ${r.mediaWord} loads`} value={`${r.totalLoads}`} hint={`${r.cam.shootDays}d · ${fmtData(r.shootCam)}`} />
                    </div>
                    <p className="font-mono text-[10px] text-suite-text-dim">
                      Proxies (<span className="text-suite-text-muted">{proxyCodec?.name}</span>) for this camera: <span className="text-suite-text-muted">{fmtData(r.proxyGB)}</span> over {r.cam.shootDays} days — part of the rig's proxy total below.
                    </p>

                    {/* codec comparison — its own tuck so the open card stays light */}
                    <div>
                      <button onClick={() => toggleCmp(r.cam.id)} className="flex items-center gap-1.5 font-mono text-[10px] text-suite-text-muted hover:text-suite-text">
                        <ChevronDown className={cn("size-3 transition-transform", showCmp && "rotate-180")} strokeWidth={1.8} />
                        <Calculator className="size-3" strokeWidth={1.5} /> Compare codecs for this camera
                      </button>
                      {showCmp && (
                        <div className="mt-2 border border-suite-border rounded-sm bg-suite-panel overflow-hidden">
                          <header className="flex items-center gap-2 px-3 py-2 border-b border-suite-border">
                            <h4 className="text-[9px] font-semibold tracking-[0.18em] uppercase text-suite-text-muted">{r.src.camera} {r.src.mode} · {r.cam.hoursPerDay}h × {r.cam.shootDays}d · tap a row to pick</h4>
                          </header>
                          <table className="w-full font-mono text-[11px]">
                            <thead>
                              <tr className="text-[9px] tracking-[0.16em] uppercase text-suite-text-dim border-b border-suite-border">
                                <th className="px-3 py-1.5 text-left font-normal">Codec</th>
                                <th className="px-3 py-1.5 text-right font-normal">Bitrate</th>
                                <th className="px-3 py-1.5 text-right font-normal">Whole shoot</th>
                                <th className="px-3 py-1.5 text-right font-normal">Per hour</th>
                              </tr>
                            </thead>
                            <tbody>
                              {r.comparison.map(({ codec: c, mbps: m, gb }) => {
                                const active = c.id === r.cam.codecId;
                                return (
                                  <tr key={c.id} onClick={() => setCam(r.cam.id, { codecId: c.id })}
                                    className={cn("border-b border-suite-border/40 cursor-pointer transition-colors", active ? "bg-suite-panel-elevated text-suite-text" : "hover:bg-suite-panel-elevated/50 text-suite-text-muted")}>
                                    <td className="px-3 py-1.5">{c.name}</td>
                                    <td className="px-3 py-1.5 text-right tabular">{m >= 1000 ? `${(m / 1000).toFixed(2)} Gbps` : `${m.toFixed(0)} Mbps`}</td>
                                    <td className={cn("px-3 py-1.5 text-right tabular", active && "text-status-warn")}>{formatSize(gb)}</td>
                                    <td className="px-3 py-1.5 text-right tabular text-suite-text-dim">{formatSize(estimateFileSizeGB(m, 3600))}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={addCam} className="self-start mt-1 flex items-center gap-1.5 px-3 py-2 rounded-sm border border-dashed border-suite-border text-suite-text-dim hover:text-suite-text hover:border-suite-border-strong font-mono text-[10px] uppercase tracking-[0.12em]">
            <Plus className="size-3.5" strokeWidth={2} /> Add camera
          </button>
          </>)}

          {/* ───────── RIG TOTAL — the result, at the bottom ───────── */}
          {totals.count > 0 && (
          <div className="mt-3 border-t border-suite-border pt-4 flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <Layers className="size-3 text-guide-target self-center" strokeWidth={1.8} />
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-suite-text font-semibold">Rig total</span>
              <span className="font-mono text-[10px] text-suite-text-dim">{totals.count} camera{totals.count === 1 ? "" : "s"}{totals.spanMax > 0 ? (totals.uniformDays ? ` · ${totals.spanMax}-day shoot` : ` · ${totals.spanMin}–${totals.spanMax}-day shoots`) : ""}</span>
            </div>

            {/* the knobs that drive the totals */}
            <div className="rounded-md border border-suite-border bg-suite-panel/40 px-4 py-3 flex flex-col gap-2">
              <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-suite-text-dim">Rig settings <span className="text-suite-text-dim/70 normal-case tracking-normal">· these drive the totals below</span></div>
              <div className="flex flex-wrap items-end gap-3">
                <Labeled label="Backup copies"><input type="number" min={1} max={3} value={g.copies} onChange={(e) => setG((s) => ({ ...s, copies: clamp(parseInt(e.target.value || "1", 10) || 1, 1, 3) }))} className={num} /></Labeled>
                <Labeled label={`Offload link · ${bandwidth.mbps} MB/s`}>
                  <select value={g.bwId} onChange={(e) => setG((s) => ({ ...s, bwId: e.target.value }))} className={cn(sel, "max-w-[18rem]")}>
                    {OFFLOAD_BANDWIDTHS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Stations"><input type="number" min={1} max={4} value={g.stations} onChange={(e) => setG((s) => ({ ...s, stations: clamp(parseInt(e.target.value || "1", 10) || 1, 1, 4) }))} className={num} /></Labeled>
                <Labeled label="Verify">
                  <button type="button" onClick={() => setG((s) => ({ ...s, verify: !s.verify }))} title="Verified offload — checksum read-back of every copy (MHL / xxHash), ≈ doubles the copy time"
                    className={cn("flex items-center gap-1.5 px-2 py-1 rounded-sm border font-mono text-[11px] transition-colors", g.verify ? "border-guide-target/50 bg-guide-target/10 text-guide-target" : "border-suite-border text-suite-text-muted hover:text-suite-text")}>
                    <span className={cn("size-2.5 rounded-[2px] border grid place-items-center shrink-0", g.verify ? "bg-guide-target border-guide-target" : "border-suite-text-dim")}>{g.verify && <Check className="size-2 text-suite-bg" strokeWidth={3} />}</span>
                    {g.verify ? "On" : "Off"}
                  </button>
                </Labeled>
                <Labeled label="Proxy codec">
                  <select value={g.proxyCodecId} onChange={(e) => setG((s) => ({ ...s, proxyCodecId: e.target.value }))} className={cn(sel, "max-w-[12rem]")}>
                    {PROXY_CODEC_IDS.map((p) => { const c = CODECS.find((x) => x.id === p.id); return c ? <option key={p.id} value={p.id}>{c.name}</option> : null; })}
                  </select>
                </Labeled>
              </div>
            </div>

            {/* hero number */}
            <div className="rounded-md border-2 border-guide-target/50 bg-guide-target/10 px-5 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-guide-target/90 font-semibold">Total storage to provision</span>
                <span className="font-mono text-[34px] font-bold text-guide-target tabular leading-none">{fmtData(grandTotal)}</span>
              </div>
              <div className="font-mono text-[10px] text-suite-text-dim leading-relaxed max-w-[22rem]">
                footage <span className="text-suite-text-muted">{fmtData(totals.shootWithCopies)}</span> (×{g.copies} cop{g.copies === 1 ? "y" : "ies"} of {fmtData(totals.shootTotal)})<br />
                + proxies <span className="text-suite-text-muted">{fmtData(totals.proxyTotal)}</span> ({proxyCodec?.name}, 1 set)
              </div>
            </div>

            {/* supporting stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              <Stat icon={Layers} label={totals.uniformDays ? "Footage / day" : "Peak day · all cams"} value={fmtData(totals.totalDaily)} hint={totals.uniformDays ? `${totals.count} cam${totals.count === 1 ? "" : "s"} · 1 copy` : `busiest day · ${totals.count} cams rolling`} />
              <Stat icon={Clock} label={`Offload / day${g.verify ? " · verified" : ""}`} value={fmtTime(totals.offloadHrs)} hint={`copy ${fmtTime(totals.transferHrs)}${g.verify ? ` + verify ${fmtTime(totals.verifyHrs)}` : ""}`} warn={totals.offloadHrs > 8} />
              <Stat icon={HardDrive} label="On set · 3× rotation" value={`${totals.onSet} ${totals.onSet === 1 ? "unit" : "units"}`} hint="in cam + offload + spare" />
              <Stat icon={Copy} label={`Footage · ×${g.copies} copies`} value={fmtData(totals.shootWithCopies)} hint={`${fmtData(totals.shootTotal)} × ${g.copies}`} />
              <Stat icon={Film} label={`Proxies · ${proxyCodec?.name ?? ""}`} value={fmtData(totals.proxyTotal)} hint={`+${(proxyRatio * 100).toFixed(0)}% · 1 set`} />
            </div>

            {!totals.uniformDays && (
            <div className="font-mono text-[10px] text-suite-text-muted leading-relaxed border-l-2 border-guide-target/40 pl-2">
              Cameras shoot different lengths ({totals.spanMin}–{totals.spanMax} days) — <span className="text-suite-text">Peak day</span> is the busiest day with every camera rolling (it sizes offload &amp; on-set cards); <span className="text-suite-text">Whole shoot</span> sums each camera’s own days ≈ <span className="text-suite-text">{fmtData(totals.avgPerDay)}</span>/day averaged over {totals.spanMax} days.
            </div>
            )}
            <div className="font-mono text-[10px] text-suite-text-dim leading-relaxed">
              Offload <span className="text-suite-text-dim/70">(card/mag → drive)</span>: move <span className="text-suite-text-muted">{fmtData(totals.totalDaily * g.copies)}</span>/day (×{g.copies} cop{g.copies === 1 ? "y" : "ies"}) over {bandwidth.label.replace(/\s*\(.*\)/, "")} <span className="text-suite-text-muted">{bandwidth.mbps} MB/s</span> × {g.stations} station{g.stations === 1 ? "" : "s"} → copy <span className="text-suite-text-muted">{fmtTime(totals.transferHrs)}</span>{g.verify ? <> + verify <span className="text-suite-text-muted">{fmtTime(totals.verifyHrs)}</span></> : null} = <span className="text-suite-text">{fmtTime(totals.offloadHrs)}</span>/day.
            </div>
          </div>
          )}

          <p className="mt-3 font-mono text-[9.5px] text-suite-text-dim leading-relaxed">
            Decimal GB/TB (1 TB = 1,000 GB), matching card capacities and Silverstack/Hedge. Bitrates use published vendor rates &amp; bits-per-pixel ratios. A starting estimate — confirm against camera tests and your DIT's measured rates.
          </p>
        </div>
      </div>

      {/* Slim pinned total — always visible while you edit cameras above */}
      {totals.count > 0 && (
        <div className="shrink-0 border-t border-guide-target/40 bg-suite-panel px-5 py-2 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-suite-text-dim shrink-0">Total to provision</span>
            <span className="font-mono text-[18px] font-bold text-guide-target tabular leading-none shrink-0">{fmtData(grandTotal)}</span>
            <span className="font-mono text-[10px] text-suite-text-dim truncate hidden sm:inline">· {totals.count} cam{totals.count === 1 ? "" : "s"} · footage {fmtData(totals.shootWithCopies)} + proxies {fmtData(totals.proxyTotal)}</span>
          </div>
          <span className="font-mono text-[10px] text-suite-text-dim shrink-0 hidden md:inline">offload <span className={cn(totals.offloadHrs > 8 ? "text-status-warn" : "text-suite-text-muted")}>{fmtTime(totals.offloadHrs)}</span>/day</span>
        </div>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-suite-text-dim">{label}</span>
      {children}
    </label>
  );
}
function Stat({ icon: Icon, label, value, hint, primary, warn }: { icon: typeof Layers; label: string; value: string; hint?: string; primary?: boolean; warn?: boolean }) {
  return (
    <div className={cn("rounded-sm border px-2.5 py-1.5", primary ? "border-guide-target/40 bg-guide-target/5" : warn ? "border-status-warn/40 bg-status-warn/5" : "border-suite-border bg-suite-bg/60")}>
      <div className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-suite-text-dim"><Icon className="size-2.5" strokeWidth={1.8} /> {label}</div>
      <div className={cn("font-mono text-[15px] font-semibold tabular mt-0.5", primary ? "text-guide-target" : warn ? "text-status-warn" : "text-suite-text")}>{value}</div>
      {hint && <div className="font-mono text-[8px] text-suite-text-dim/80 mt-0.5 truncate" title={hint}>{hint}</div>}
    </div>
  );
}
function MediaCell({ label, value, hint, warn }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="bg-suite-panel p-3 flex flex-col gap-0.5">
      <span className="text-[9px] tracking-[0.16em] uppercase text-suite-text-muted">{label}</span>
      <span className={cn("font-mono text-lg tabular text-suite-text", warn && "text-status-warn")}>{value}</span>
      {hint && <span className="text-[9px] text-suite-text-dim font-mono">{hint}</span>}
    </div>
  );
}
