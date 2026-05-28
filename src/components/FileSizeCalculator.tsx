import { useMemo, useState, useEffect } from "react";
import {
  SOURCE_FORMATS,
  CODECS,
  Codec,
  codecMbps,
  estimateFileSizeGB,
  formatSize,
  formatDuration,
  formatNumber,
  CARDS,
  cardsForVendor,
  OFFLOAD_BANDWIDTHS,
  offloadHours,
  PROXY_CODEC_IDS,
} from "@/lib/formats";
import { SuiteSelect } from "@/components/SuiteSelect";
import { Metric } from "@/components/Metric";
import { HardDrive, Clapperboard, Gauge, Calculator, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

const FPS_OPTIONS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60, 100, 120];

export interface FileSizeCalculatorProps {
  /** Shared project state (from the Capture & Framing tab). When provided the
   *  control is "controlled" and edits flow back via the matching setter, so
   *  the camera/codec/fps stay in sync across both tabs. Omitted = standalone. */
  sourceId?: string;
  onSourceChange?: (id: string) => void;
  codecId?: string;
  onCodecChange?: (id: string) => void;
  fps?: number;
  onFpsChange?: (n: number) => void;
}

export function FileSizeCalculator(props: FileSizeCalculatorProps = {}) {
  const [localSourceId, setLocalSourceId] = useState(SOURCE_FORMATS[0].id);
  const [localCodecId, setLocalCodecId] = useState(CODECS[0].id);
  const [localFps, setLocalFps] = useState(24);
  const sourceId = props.sourceId ?? localSourceId;
  const setSourceId = props.onSourceChange ?? setLocalSourceId;
  const codecId = props.codecId ?? localCodecId;
  const setCodecId = props.onCodecChange ?? setLocalCodecId;
  const fps = props.fps ?? localFps;
  const setFps = props.onFpsChange ?? setLocalFps;
  const [durationSec, setDurationSec] = useState(60);
  const [cameras, setCameras] = useState(1);
  const [shootDays, setShootDays] = useState(1);
  const [bwId, setBwId] = useState(OFFLOAD_BANDWIDTHS[0].id);
  const [backupCopies, setBackupCopies] = useState(2);
  const [offloadStations, setOffloadStations] = useState(2);
  const [proxyCodecId, setProxyCodecId] = useState(PROXY_CODEC_IDS[0].id);

  const source = SOURCE_FORMATS.find((s) => s.id === sourceId)!;
  const codec = CODECS.find((c) => c.id === codecId)!;

  // Camera brand → compatible media (e.g. "ARRI" → Codex + CFexpress)
  const vendor = source.camera.split(" ")[0];
  const compatibleCards = useMemo(() => cardsForVendor(vendor), [vendor]);
  const [cardId, setCardId] = useState(compatibleCards[0]?.id ?? CARDS[0].id);
  useEffect(() => {
    if (!compatibleCards.some((c) => c.id === cardId)) {
      setCardId(compatibleCards[0]?.id ?? CARDS[0].id);
    }
  }, [compatibleCards, cardId]);
  const card = CARDS.find((c) => c.id === cardId) ?? compatibleCards[0] ?? CARDS[0];
  const mediaWord = card.kind === "mag" ? "mag" : card.kind === "drive" ? "drive" : "card";

  const mbps = useMemo(
    () => codecMbps(codec, source.width, source.height, fps),
    [codec, source, fps],
  );
  const perCamGB = useMemo(
    () => estimateFileSizeGB(mbps, durationSec),
    [mbps, durationSec],
  );
  const perDayGB = perCamGB * cameras;
  const totalGB = perDayGB * shootDays;
  const perMinuteGB = estimateFileSizeGB(mbps, 60);
  const perHourGB = estimateFileSizeGB(mbps, 3600);

  // Offload budget — per shoot day, across backups and parallel stations.
  const bandwidth = OFFLOAD_BANDWIDTHS.find((b) => b.id === bwId) ?? OFFLOAD_BANDWIDTHS[0];
  const offloadHrs = useMemo(
    () => offloadHours(perDayGB, backupCopies, bandwidth.mbps, offloadStations),
    [perDayGB, backupCopies, bandwidth.mbps, offloadStations],
  );

  // Proxy footprint — proxy codec at HD/delivery res, scaled to the whole shoot.
  const proxy = useMemo(() => {
    const entry = PROXY_CODEC_IDS.find((p) => p.id === proxyCodecId) ?? PROXY_CODEC_IDS[0];
    const c = CODECS.find((x) => x.id === entry.id);
    if (!c) return null;
    const w = entry.resolutionTier === "hd" ? 1920 : 3840;
    const h = entry.resolutionTier === "hd" ? 1080 : 2160;
    const pMbps = codecMbps(c, w, h, fps);
    const totalProxyGB = estimateFileSizeGB(pMbps, durationSec) * cameras * shootDays;
    return { name: c.name, mbps: pMbps, totalGB: totalProxyGB };
  }, [proxyCodecId, fps, durationSec, cameras, shootDays]);
  const proxyRatio = proxy && totalGB > 0 ? proxy.totalGB / totalGB : 0;

  const sourceOptions = SOURCE_FORMATS.map((s) => ({
    value: s.id,
    label: `${s.camera} — ${s.mode} (${formatNumber(s.width)}×${formatNumber(s.height)})`,
    group: s.camera.split(" ")[0],
  }));

  // Group codecs by vendor for nice select grouping
  const codecOptions = CODECS.map((c) => ({
    value: c.id,
    label: c.name,
    group: c.vendor,
  }));

  // Comparison table — every codec at the chosen res/fps/duration
  const comparison = useMemo(() => {
    return CODECS.map((c) => {
      const m = codecMbps(c, source.width, source.height, fps);
      const gb = estimateFileSizeGB(m, durationSec) * cameras * shootDays;
      return { codec: c, mbps: m, gb };
    }).sort((a, b) => b.mbps - a.mbps);
  }, [source, fps, durationSec, cameras, shootDays]);

  return (
    <div className="flex-1 min-h-0 flex">
      {/* Left controls */}
      <aside className="w-80 shrink-0 bg-suite-panel border-r border-suite-border flex flex-col overflow-y-auto">
        <section className="p-5 border-b border-suite-border flex flex-col gap-4">
          <SectionHeader label="01 · Source" dotClass="bg-guide-source" />
          <SuiteSelect
            label="Camera & Mode"
            value={sourceId}
            onChange={setSourceId}
            options={sourceOptions}
          />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Metric
              label="Resolution"
              value={`${formatNumber(source.width)}×${formatNumber(source.height)}`}
              accentClass="text-guide-source"
            />
            <Metric
              label="Megapixels"
              value={`${((source.width * source.height) / 1_000_000).toFixed(2)} MP`}
            />
          </div>
        </section>

        <section className="p-5 border-b border-suite-border flex flex-col gap-4">
          <SectionHeader label="02 · Codec" dotClass="bg-guide-target" />
          <SuiteSelect
            label="Recording Codec"
            value={codecId}
            onChange={setCodecId}
            options={codecOptions}
          />
          <div className="text-[10px] leading-relaxed text-suite-text-dim font-mono">
            {codec.rateLabel}
          </div>
        </section>

        <section className="p-5 border-b border-suite-border flex flex-col gap-4">
          <SectionHeader label="03 · Capture Settings" />
          <FpsControl value={fps} onChange={setFps} />
          <DurationControl
            value={durationSec}
            onChange={setDurationSec}
          />
          <CameraCountControl value={cameras} onChange={setCameras} />
          <ShootDaysControl value={shootDays} onChange={setShootDays} />
        </section>

        <section className="p-5 border-b border-suite-border flex flex-col gap-4">
          <SectionHeader label="04 · On-Set Media" />
          <SuiteSelect
            label={`${vendor} compatible ${mediaWord}s`}
            value={cardId}
            onChange={setCardId}
            options={compatibleCards.map((c) => ({
              value: c.id,
              label: `${c.name} · ${(c.gb / 1024).toFixed(c.gb % 1024 === 0 ? 0 : 2)} TB`,
            }))}
          />
          <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono -mt-2">
            Inventory assumes 3× rotation per day — 1 in camera, 1 offloading (24 hr turnaround), 1 spare.
          </p>
        </section>

        <section className="p-5 border-b border-suite-border flex flex-col gap-4">
          <SectionHeader label="05 · Offload & Proxies" />
          <SuiteSelect
            label="Offload Bandwidth"
            value={bwId}
            onChange={setBwId}
            options={OFFLOAD_BANDWIDTHS.map((b) => ({ value: b.id, label: b.label }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">Backups</span>
              <div className="flex gap-1">
                {[1, 2, 3].map((n) => (
                  <button key={n} type="button" onClick={() => setBackupCopies(n)}
                    className={cn("px-2 py-1 text-[10px] font-mono tabular rounded-sm border transition-colors",
                      backupCopies === n ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text" : "border-suite-border text-suite-text-muted hover:text-suite-text")}>{n}×</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted" title="Parallel offload stations — daily offload time divides by this count.">Stations</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} type="button" onClick={() => setOffloadStations(n)}
                    className={cn("px-2 py-1 text-[10px] font-mono tabular rounded-sm border transition-colors",
                      offloadStations === n ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text" : "border-suite-border text-suite-text-muted hover:text-suite-text")}>{n}</button>
                ))}
              </div>
            </div>
          </div>
          <SuiteSelect
            label="Proxy Codec"
            value={proxyCodecId}
            onChange={setProxyCodecId}
            options={PROXY_CODEC_IDS.map(({ id }) => {
              const c = CODECS.find((x) => x.id === id);
              return c ? { value: c.id, label: c.name, group: c.family } : null;
            }).filter(Boolean) as { value: string; label: string; group?: string }[]}
          />
        </section>
      </aside>

      {/* Main panel */}
      <div className="flex-1 min-w-0 overflow-y-auto bg-suite-canvas">
        <div className="max-w-5xl mx-auto p-8 flex flex-col gap-8">
          {/* Headline metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BigMetric
              icon={Gauge}
              label="Bitrate"
              value={`${mbps >= 1000 ? (mbps / 1000).toFixed(2) + " Gbps" : mbps.toFixed(0) + " Mbps"}`}
              hint={`${(mbps / 8).toFixed(1)} MB/s per camera`}
              tone="ok"
            />
            <BigMetric
              icon={HardDrive}
              label={`Total · ${formatDuration(durationSec)} × ${cameras} cam${cameras !== 1 ? "s" : ""} × ${shootDays} day${shootDays !== 1 ? "s" : ""}`}
              value={formatSize(totalGB)}
              hint={shootDays > 1 ? `${formatSize(perDayGB)} per day` : cameras > 1 ? `${formatSize(perCamGB)} per camera` : undefined}
              tone="warn"
            />
            <BigMetric
              icon={Clapperboard}
              label="Per Hour"
              value={formatSize(perHourGB)}
              hint={`${formatSize(perMinuteGB)} / min`}
            />
          </div>

          {/* Media plan — how many cards/mags do you need? */}
          <MediaPlan
            perCamGB={perCamGB}
            perDayGB={perDayGB}
            totalGB={totalGB}
            cardGB={card.gb}
            cardName={card.name}
            mediaWord={mediaWord}
            cameras={cameras}
            shootDays={shootDays}
          />

          {/* Offload + proxy budget */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <BigMetric
              icon={HardDrive}
              label={`Offload / Day · ${backupCopies}× · ${offloadStations} station${offloadStations !== 1 ? "s" : ""}`}
              value={Number.isFinite(offloadHrs) ? `${offloadHrs.toFixed(1)} h` : "—"}
              hint={`${formatSize(perDayGB)}/day × ${backupCopies} via ${bandwidth.mbps} MB/s`}
              tone={offloadHrs > 8 ? "warn" : "ok"}
            />
            {proxy && (
              <BigMetric
                icon={Layers}
                label="Proxies · whole shoot"
                value={formatSize(proxy.totalGB)}
                hint={`${proxy.name} · ${(proxyRatio * 100).toFixed(1)}% of camera footage`}
              />
            )}
            <BigMetric
              icon={Clapperboard}
              label="Camera + Proxy"
              value={formatSize(totalGB + (proxy?.totalGB ?? 0))}
              hint="total managed footprint"
              tone="warn"
            />
          </div>

          {/* Comparison table */}
          <section className="border border-suite-border rounded-sm bg-suite-panel">
            <header className="flex items-center justify-between px-4 py-3 border-b border-suite-border">
              <div className="flex items-center gap-2">
                <Calculator className="size-3.5 text-suite-text-muted" strokeWidth={1.5} />
                <h3 className="text-[10px] font-semibold tracking-[0.22em] uppercase text-suite-text-muted">
                  Codec Comparison · {source.camera} {source.mode} @ {fps} fps · {formatDuration(durationSec)}
                  {cameras > 1 ? ` × ${cameras} cams` : ""}
                  {shootDays > 1 ? ` × ${shootDays} days` : ""}
                </h3>
              </div>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="text-[10px] tracking-[0.18em] uppercase text-suite-text-dim border-b border-suite-border">
                    <th className="px-4 py-2 text-left font-normal">Codec</th>
                    <th className="px-4 py-2 text-left font-normal">Vendor</th>
                    <th className="px-4 py-2 text-left font-normal">Family</th>
                    <th className="px-4 py-2 text-right font-normal">Bitrate</th>
                    <th className="px-4 py-2 text-right font-normal">Total Size</th>
                    <th className="px-4 py-2 text-right font-normal">Per Hour</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(({ codec: c, mbps: m, gb }) => {
                    const active = c.id === codecId;
                    const hourGB = estimateFileSizeGB(m, 3600) * cameras * shootDays;
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setCodecId(c.id)}
                        className={cn(
                          "border-b border-suite-border/50 cursor-pointer transition-colors",
                          active
                            ? "bg-suite-panel-elevated text-suite-text"
                            : "hover:bg-suite-panel-elevated/50 text-suite-text-muted",
                        )}
                      >
                        <td className="px-4 py-2.5">{c.name}</td>
                        <td className="px-4 py-2.5 text-suite-text-dim">{c.vendor}</td>
                        <td className="px-4 py-2.5 text-suite-text-dim">{c.family}</td>
                        <td className="px-4 py-2.5 text-right tabular">
                          {m >= 1000 ? `${(m / 1000).toFixed(2)} Gbps` : `${m.toFixed(0)} Mbps`}
                        </td>
                        <td className={cn("px-4 py-2.5 text-right tabular", active && "text-status-warn")}>
                          {formatSize(gb)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular text-suite-text-dim">
                          {formatSize(hourGB)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono max-w-2xl">
            Estimates derived from published vendor bitrates & bits-per-pixel ratios for variable-rate
            codecs. Real-world sizes vary with scene complexity (RAW/RAW-like) and audio/metadata
            payloads. Use as a planning baseline, not a billing figure.
          </p>
        </div>
      </div>
    </div>
  );
}

function MediaPlan({
  perCamGB,
  perDayGB,
  totalGB,
  cardGB,
  cardName,
  mediaWord,
  cameras,
  shootDays,
}: {
  perCamGB: number;
  perDayGB: number;
  totalGB: number;
  cardGB: number;
  cardName: string;
  mediaWord: string;
  cameras: number;
  shootDays: number;
}) {
  // Each camera fills cards independently → ceil per camera, then sum.
  const cardsPerCamPerDay = Math.max(1, Math.ceil(perCamGB / cardGB));
  const cardsPerDay = cardsPerCamPerDay * cameras;
  // Rotation: 1 in camera, 1 being offloaded (24h turnaround), 1 spare.
  const onSetInventory = cardsPerDay * 3;
  const totalCardLoads = Math.max(1, Math.ceil(totalGB / cardGB));
  const utilisation = (perCamGB / cardGB) * 100;

  return (
    <section className="border border-suite-border rounded-sm bg-suite-panel">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-suite-border">
        <Layers className="size-3.5 text-suite-text-muted" strokeWidth={1.5} />
        <h3 className="text-[10px] font-semibold tracking-[0.22em] uppercase text-suite-text-muted">
          Media Plan · {cardName}
        </h3>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-suite-border">
        <MediaCell
          label={`${mediaWord}s / cam / day`}
          value={`${cardsPerCamPerDay}`}
          hint={`${formatSize(perCamGB)} ÷ ${formatSize(cardGB)} · ${utilisation.toFixed(0)}% fill`}
        />
        <MediaCell
          label={`${mediaWord}s / day`}
          value={`${cardsPerDay}`}
          hint={`${cardsPerCamPerDay} × ${cameras} cam${cameras !== 1 ? "s" : ""} · ${formatSize(perDayGB)}`}
          tone="warn"
        />
        <MediaCell
          label="On-set inventory"
          value={`${onSetInventory}`}
          hint={`3× rotation (in cam + offload + spare)`}
          tone="warn"
        />
        <MediaCell
          label={`Total ${mediaWord} loads`}
          value={`${totalCardLoads}`}
          hint={`across ${shootDays} day${shootDays !== 1 ? "s" : ""} · ${formatSize(totalGB)}`}
        />
      </div>
      <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono px-4 py-3 border-t border-suite-border">
        Rule of thumb: keep <span className="text-suite-text">{onSetInventory}</span>{" "}
        {mediaWord}s on set per day — <span className="text-suite-text">{cardsPerDay}</span> in camera,{" "}
        <span className="text-suite-text">{cardsPerDay}</span> being offloaded (24 hr turnaround), and{" "}
        <span className="text-suite-text">{cardsPerDay}</span> spare for AC turnaround / partial-fill protection takes.
      </p>
    </section>
  );
}

function MediaCell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="bg-suite-panel p-4 flex flex-col gap-1">
      <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-xl tabular text-suite-text",
          tone === "ok" && "text-status-ok",
          tone === "warn" && "text-status-warn",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[10px] text-suite-text-dim font-mono">{hint}</span>}
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

function DurationControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const presets = [
    { label: "30s", v: 30 },
    { label: "1m", v: 60 },
    { label: "5m", v: 300 },
    { label: "10m", v: 600 },
    { label: "30m", v: 1800 },
    { label: "1h", v: 3600 },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
          Duration
        </span>
        <span className="font-mono text-xs text-suite-text">{formatDuration(value)}</span>
      </div>
      <input
        type="range"
        min={1}
        max={7200}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-suite-text cursor-pointer"
      />
      <div className="flex flex-wrap gap-1 pt-1">
        {presets.map((p) => (
          <button
            key={p.v}
            type="button"
            onClick={() => onChange(p.v)}
            className={cn(
              "px-2 py-1 text-[10px] font-mono rounded-sm border transition-colors",
              value === p.v
                ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text"
                : "border-suite-border text-suite-text-muted hover:text-suite-text",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CameraCountControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
          Cameras
        </span>
        <span className="font-mono text-xs text-suite-text">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          className="size-7 border border-suite-border rounded-sm hover:bg-suite-panel-elevated text-suite-text-muted hover:text-suite-text transition-colors"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          max={32}
          value={value}
          onChange={(e) => onChange(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
          className="flex-1 bg-suite-bg border border-suite-border rounded-sm px-2 py-1 font-mono text-xs text-suite-text focus:outline-none focus:border-suite-border-strong"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(32, value + 1))}
          className="size-7 border border-suite-border rounded-sm hover:bg-suite-panel-elevated text-suite-text-muted hover:text-suite-text transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

function ShootDaysControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const presets = [1, 3, 5, 10, 20, 30];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
          Shoot Days
        </span>
        <span className="font-mono text-xs text-suite-text">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          className="size-7 border border-suite-border rounded-sm hover:bg-suite-panel-elevated text-suite-text-muted hover:text-suite-text transition-colors"
        >
          −
        </button>
        <input
          type="number"
          min={1}
          max={365}
          value={value}
          onChange={(e) => onChange(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
          className="flex-1 bg-suite-bg border border-suite-border rounded-sm px-2 py-1 font-mono text-xs text-suite-text focus:outline-none focus:border-suite-border-strong"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(365, value + 1))}
          className="size-7 border border-suite-border rounded-sm hover:bg-suite-panel-elevated text-suite-text-muted hover:text-suite-text transition-colors"
        >
          +
        </button>
      </div>
      <div className="flex flex-wrap gap-1 pt-1">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "px-2 py-1 text-[10px] font-mono rounded-sm border transition-colors",
              value === p
                ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text"
                : "border-suite-border text-suite-text-muted hover:text-suite-text",
            )}
          >
            {p}d
          </button>
        ))}
      </div>
    </div>
  );
}

function BigMetric({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="border border-suite-border rounded-sm bg-suite-panel p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-suite-text-muted">
        <Icon className="size-3.5" strokeWidth={1.5} />
        <span className="text-[10px] tracking-[0.2em] uppercase">{label}</span>
      </div>
      <span
        className={cn(
          "font-mono text-2xl tabular text-suite-text",
          tone === "ok" && "text-status-ok",
          tone === "warn" && "text-status-warn",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[10px] text-suite-text-dim font-mono">{hint}</span>}
    </div>
  );
}
