import { useEffect, useMemo, useState } from "react";
import { Video, Plus, Trash2, HardDrive, Clock, Layers, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SOURCE_FORMATS, CODECS, CARDS, OFFLOAD_BANDWIDTHS,
  codecMbps, estimateFileSizeGB, cardRuntimeMinutes, offloadHours,
  nativeCodecsForCamera, cardsForVendor,
  type SourceFormat,
} from "@/lib/formats";

/** Multicam Planner — plan a multi-camera shoot's data + storage. Each camera (A/B/C…)
 *  carries its own body, codec, fps, card and shoot hours; the engine (codecMbps,
 *  estimateFileSizeGB, cardRuntimeMinutes, offloadHours) is shared with the single-camera
 *  Storage tool, so the numbers match. State is per-project (localStorage). */

type RigCam = {
  id: string;
  label: string;
  sourceId: string;
  codecId: string;
  fps: number;
  cardId: string;
  hoursPerDay: number;
  enabled: boolean;
};
type Globals = { shootDays: number; copies: number; bwId: string; stations: number };

const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120];

let _seq = 0;
const uid = () => `c${Date.now().toString(36)}${(_seq++).toString(36)}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const vendorOf = (camera: string) => camera.split(" ")[0];

const KEY_CAMS = "kaos.multicam.cams";
const KEY_GLOBALS = "kaos.multicam.globals";

function buildCam(label: string): RigCam {
  const src = SOURCE_FORMATS[0];
  const codecs = nativeCodecsForCamera(src.camera);
  const cards = cardsForVendor(vendorOf(src.camera));
  return {
    id: uid(), label,
    sourceId: src.id,
    codecId: codecs[0]?.id ?? CODECS[0].id,
    fps: 24,
    cardId: cards[0]?.id ?? CARDS[0].id,
    hoursPerDay: 4,
    enabled: true,
  };
}
const nextLabel = (n: number) => (n < 26 ? `${String.fromCharCode(65 + n)}-cam` : `Cam ${n + 1}`);

function loadCams(key: string): RigCam[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [buildCam("A-cam")];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return [buildCam("A-cam")];
    return arr
      .filter((c) => c && typeof c.sourceId === "string" && typeof c.codecId === "string")
      .map((c) => ({
        id: typeof c.id === "string" ? c.id : uid(),
        label: typeof c.label === "string" ? c.label : "Cam",
        sourceId: SOURCE_FORMATS.some((s) => s.id === c.sourceId) ? c.sourceId : SOURCE_FORMATS[0].id,
        codecId: CODECS.some((x) => x.id === c.codecId) ? c.codecId : CODECS[0].id,
        fps: Number.isFinite(c.fps) ? c.fps : 24,
        cardId: CARDS.some((x) => x.id === c.cardId) ? c.cardId : CARDS[0].id,
        hoursPerDay: Number.isFinite(c.hoursPerDay) ? clamp(c.hoursPerDay, 0, 24) : 4,
        enabled: c.enabled !== false,
      }));
  } catch { return [buildCam("A-cam")]; }
}
function loadGlobals(key: string): Globals {
  const dflt: Globals = { shootDays: 20, copies: 2, bwId: "tb3", stations: 2 };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return dflt;
    const g = JSON.parse(raw);
    return {
      shootDays: Number.isFinite(g.shootDays) ? clamp(g.shootDays, 1, 365) : dflt.shootDays,
      copies: Number.isFinite(g.copies) ? clamp(g.copies, 1, 3) : dflt.copies,
      bwId: OFFLOAD_BANDWIDTHS.some((b) => b.id === g.bwId) ? g.bwId : dflt.bwId,
      stations: Number.isFinite(g.stations) ? clamp(g.stations, 1, 4) : dflt.stations,
    };
  } catch { return dflt; }
}

const fmtData = (gb: number) =>
  gb >= 1000 ? `${(gb / 1000).toFixed(2)} TB` : gb >= 100 ? `${gb.toFixed(0)} GB` : `${gb.toFixed(1)} GB`;
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

export function MulticamPlanner({ projectName, projectId }: { projectName?: string; projectId?: string }) {
  const suffix = projectId ? `-${projectId}` : "";
  const kCams = KEY_CAMS + suffix, kGlobals = KEY_GLOBALS + suffix;
  const [cams, setCams] = useState<RigCam[]>(() => loadCams(kCams));
  const [g, setG] = useState<Globals>(() => loadGlobals(kGlobals));

  useEffect(() => { try { localStorage.setItem(kCams, JSON.stringify(cams)); } catch { /* ignore */ } }, [cams, kCams]);
  useEffect(() => { try { localStorage.setItem(kGlobals, JSON.stringify(g)); } catch { /* ignore */ } }, [g, kGlobals]);

  // Camera options grouped by body, each body's capture modes underneath.
  const sourcesByCamera = useMemo(() => {
    const m = new Map<string, SourceFormat[]>();
    for (const s of SOURCE_FORMATS) {
      const list = m.get(s.camera) ?? [];
      list.push(s);
      m.set(s.camera, list);
    }
    return [...m.entries()];
  }, []);

  const setCam = (id: string, patch: Partial<RigCam>) =>
    setCams((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  // Changing the body re-validates codec + card against what that brand supports.
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

  const addCam = () => setCams((cs) => [...cs, buildCam(nextLabel(cs.length))]);
  const removeCam = (id: string) => setCams((cs) => (cs.length <= 1 ? cs : cs.filter((c) => c.id !== id)));
  const clearAll = () => {
    if (!window.confirm("Reset the rig to a single camera?")) return;
    setCams([buildCam("A-cam")]);
  };

  // ---- per-camera + combined maths (shared engine) ----
  const bandwidth = OFFLOAD_BANDWIDTHS.find((b) => b.id === g.bwId) ?? OFFLOAD_BANDWIDTHS[0];

  const rows = useMemo(() => cams.map((cam) => {
    const src = SOURCE_FORMATS.find((s) => s.id === cam.sourceId) ?? SOURCE_FORMATS[0];
    const codec = CODECS.find((c) => c.id === cam.codecId) ?? CODECS[0];
    const card = CARDS.find((c) => c.id === cam.cardId) ?? CARDS[0];
    const mbps = codecMbps(codec, src.width, src.height, cam.fps);
    const perHourGB = estimateFileSizeGB(mbps, 3600);
    const dailyGB = cam.enabled ? perHourGB * cam.hoursPerDay : 0;
    const cardMin = cardRuntimeMinutes(card.gb, mbps);
    const cardsPerDay = dailyGB > 0 ? Math.ceil(dailyGB / card.gb) : 0;
    return { cam, src, codec, card, mbps, dailyGB, cardMin, cardsPerDay };
  }), [cams]);

  const totals = useMemo(() => {
    const activeRows = rows.filter((r) => r.cam.enabled);
    const totalDaily = activeRows.reduce((s, r) => s + r.dailyGB, 0);
    const cardsPerDay = activeRows.reduce((s, r) => s + r.cardsPerDay, 0);
    const dailyWithCopies = totalDaily * g.copies;
    const offloadHrs = offloadHours(totalDaily, g.copies, bandwidth.mbps, g.stations);
    const shootTotal = totalDaily * g.shootDays * g.copies;
    return { active: activeRows.length, totalDaily, dailyWithCopies, cardsPerDay, offloadHrs, shootTotal };
  }, [rows, g.copies, g.shootDays, g.stations, bandwidth.mbps]);

  const selCls = "bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]";
  const numCls = "w-16 bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target";

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Video className="size-4 text-guide-target" strokeWidth={1.6} />
          <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Multicam Planner</span>
          {projectName?.trim() && <span className="font-mono text-[11px] text-suite-text-dim truncate max-w-[18ch]">· {projectName.trim()}</span>}
          <span className="font-mono text-[10px] text-suite-text-dim hidden xl:inline">— each camera carries its own body, codec, card &amp; hours; totals combine the rig</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={addCam} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors">
            <Plus className="size-3" strokeWidth={2} /> Camera
          </button>
          <button onClick={clearAll} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* Combined totals + shoot settings (always visible) */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel/60 px-5 py-3">
        <div className="max-w-5xl mx-auto flex flex-wrap items-stretch gap-4">
          {/* Shoot settings */}
          <div className="flex flex-wrap items-end gap-3">
            <Labeled label="Shoot days">
              <input type="number" min={1} max={365} value={g.shootDays}
                onChange={(e) => setG((s) => ({ ...s, shootDays: clamp(parseInt(e.target.value || "1", 10) || 1, 1, 365) }))} className={numCls} />
            </Labeled>
            <Labeled label="Backup copies">
              <input type="number" min={1} max={3} value={g.copies}
                onChange={(e) => setG((s) => ({ ...s, copies: clamp(parseInt(e.target.value || "1", 10) || 1, 1, 3) }))} className={numCls} />
            </Labeled>
            <Labeled label="Offload link">
              <select value={g.bwId} onChange={(e) => setG((s) => ({ ...s, bwId: e.target.value }))} className={cn(selCls, "max-w-[15rem]")}>
                {OFFLOAD_BANDWIDTHS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </Labeled>
            <Labeled label="Stations">
              <input type="number" min={1} max={4} value={g.stations}
                onChange={(e) => setG((s) => ({ ...s, stations: clamp(parseInt(e.target.value || "1", 10) || 1, 1, 4) }))} className={numCls} />
            </Labeled>
          </div>

          {/* Combined stat tiles */}
          <div className="flex-1 min-w-[18rem] grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat icon={Layers} label={`Per day · ${totals.active} cam${totals.active === 1 ? "" : "s"}`} value={fmtData(totals.totalDaily)} primary />
            <Stat icon={Copy} label={`Per day · ×${g.copies}`} value={fmtData(totals.dailyWithCopies)} />
            <Stat icon={Clock} label={`Offload · ${g.stations} station${g.stations === 1 ? "" : "s"}`} value={fmtTime(totals.offloadHrs)} />
            <Stat icon={HardDrive} label={`Whole shoot · ${g.shootDays}d ×${g.copies}`} value={fmtData(totals.shootTotal)} primary />
          </div>
        </div>
      </div>

      {/* Camera cards */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-2.5">
          {rows.map((r) => (
            <div key={r.cam.id} className={cn("rounded-md border bg-suite-panel/60 px-3.5 py-3", r.cam.enabled ? "border-suite-border" : "border-suite-border/50 opacity-60")}>
              <div className="flex items-center gap-2 mb-2.5">
                <button
                  onClick={() => setCam(r.cam.id, { enabled: !r.cam.enabled })}
                  title={r.cam.enabled ? "Rolling — click to mute from totals" : "Muted — click to include"}
                  className={cn("shrink-0 size-2.5 rounded-full border", r.cam.enabled ? "bg-guide-target border-guide-target" : "border-suite-text-dim")}
                />
                <input
                  value={r.cam.label}
                  onChange={(e) => setCam(r.cam.id, { label: e.target.value })}
                  className="w-28 bg-transparent border-0 border-b border-transparent focus:border-suite-border px-0.5 text-[12px] font-mono text-suite-text font-semibold focus:outline-none"
                />
                <div className="ml-auto font-mono text-[12px] text-guide-target font-semibold tabular">
                  {fmtData(r.dailyGB)}<span className="text-suite-text-dim font-normal">/day</span>
                </div>
                <button onClick={() => removeCam(r.cam.id)} disabled={cams.length <= 1}
                  title={cams.length <= 1 ? "Keep at least one camera" : "Remove camera"}
                  className="shrink-0 text-suite-text-dim hover:text-destructive disabled:opacity-30 disabled:hover:text-suite-text-dim">
                  <Trash2 className="size-3.5" strokeWidth={1.6} />
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-2.5">
                <Labeled label="Camera / mode">
                  <select value={r.cam.sourceId} onChange={(e) => changeBody(r.cam.id, e.target.value)} className={cn(selCls, "max-w-[20rem]")}>
                    {sourcesByCamera.map(([camera, modes]) => (
                      <optgroup key={camera} label={camera}>
                        {modes.map((s) => <option key={s.id} value={s.id}>{s.mode}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </Labeled>
                <Labeled label="Codec">
                  <select value={r.cam.codecId} onChange={(e) => setCam(r.cam.id, { codecId: e.target.value })} className={cn(selCls, "max-w-[14rem]")}>
                    {(nativeCodecsForCamera(r.src.camera).length ? nativeCodecsForCamera(r.src.camera) : CODECS).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Labeled>
                <Labeled label="FPS">
                  <select value={r.cam.fps} onChange={(e) => setCam(r.cam.id, { fps: parseFloat(e.target.value) })} className={selCls}>
                    {FPS_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Card">
                  <select value={r.cam.cardId} onChange={(e) => setCam(r.cam.id, { cardId: e.target.value })} className={cn(selCls, "max-w-[15rem]")}>
                    {cardsForVendor(vendorOf(r.src.camera)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Labeled>
                <Labeled label="Hours/day">
                  <input type="number" min={0} max={24} step={0.5} value={r.cam.hoursPerDay}
                    onChange={(e) => setCam(r.cam.id, { hoursPerDay: clamp(parseFloat(e.target.value || "0") || 0, 0, 24) })} className={numCls} />
                </Labeled>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-suite-text-dim">
                <span>{Math.round(r.mbps).toLocaleString()} Mbps</span>
                <span>{r.cardsPerDay > 0 ? `${r.cardsPerDay}× ${r.card.name.replace(/ \d.*$/, "")} / day` : "—"}</span>
                <span>{fmtMin(r.cardMin)} per {r.card.kind ?? "card"}</span>
                <span>{r.src.width.toLocaleString()}×{r.src.height.toLocaleString()}</span>
              </div>
            </div>
          ))}
          <button onClick={addCam} className="self-start mt-1 flex items-center gap-1.5 px-3 py-2 rounded-sm border border-dashed border-suite-border text-suite-text-dim hover:text-suite-text hover:border-suite-border-strong font-mono text-[10px] uppercase tracking-[0.12em]">
            <Plus className="size-3.5" strokeWidth={2} /> Add camera
          </button>

          <p className="mt-3 font-mono text-[9.5px] text-suite-text-dim leading-relaxed">
            Decimal GB/TB (1 TB = 1,000 GB), matching card capacities and Silverstack/Hedge. Bitrates use the same engine as the
            single-camera Storage tool. A starting estimate — confirm against camera tests and your DIT's measured rates.
          </p>
        </div>
      </div>
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
function Stat({ icon: Icon, label, value, primary }: { icon: typeof Layers; label: string; value: string; primary?: boolean }) {
  return (
    <div className={cn("rounded-sm border px-2.5 py-1.5", primary ? "border-guide-target/40 bg-guide-target/5" : "border-suite-border bg-suite-bg/60")}>
      <div className="flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-suite-text-dim">
        <Icon className="size-2.5" strokeWidth={1.8} /> {label}
      </div>
      <div className={cn("font-mono text-[15px] font-semibold tabular mt-0.5", primary ? "text-guide-target" : "text-suite-text")}>{value}</div>
    </div>
  );
}
