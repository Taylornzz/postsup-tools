import { useMemo, useState } from "react";
import { SourceFormat, computeFovDof } from "@/lib/formats";
import { Metric } from "@/components/Metric";
import { LensScene3D } from "@/components/LensScene3D";
import { LENS_KITS, nearestFocal } from "@/lib/lensKits";
import { Aperture, Ruler, Crop, Maximize2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

// Reference diagonals for focal-length equivalence.
const FF_DIAG = Math.hypot(36, 24); // 43.27 mm — full frame
const S35_DIAG = Math.hypot(24.89, 18.66); // ~31.1 mm — Super 35 (4-perf / full aperture)

/** Field of view + depth of field for the chosen camera's sensor.
 *  Standard thin-lens model; anamorphic horizontal AOV uses focal ÷ squeeze. */
export function FovCalculator({ source }: { source: SourceFormat }) {
  const [focal, setFocal] = useState(35);
  const [fstop, setFstop] = useState(2.8);
  const [distM, setDistM] = useState(3);

  const sw = source.usedSensorWidthMm ?? source.sensorWidthMm;
  const sh = source.usedSensorHeightMm ?? source.sensorHeightMm;
  const sq = source.squeeze || 1;

  const r = useMemo(() => {
    if (!sw || !sh || focal <= 0) return null;
    const diag = Math.hypot(sw, sh);
    const d = computeFovDof({
      sensorWidthMm: sw, sensorHeightMm: sh, squeeze: sq,
      focalMm: focal, fNumber: fstop, distanceM: distM,
    });
    const cropFF = FF_DIAG / diag;
    const cropS35 = S35_DIAG / diag;
    return {
      diag,
      hAOV: d.hAOV, vAOV: d.vAOV, dAOV: d.dAOV,
      frameW: d.frameW, frameH: d.frameH, coc: d.cocMm,
      hyperfocal: d.hyperfocalM,
      near: d.nearM,
      far: d.farM,
      dof: d.dofM,
      effFF: focal * cropFF,
      effS35: focal * cropS35,
      cropFF,
    };
  }, [sw, sh, sq, focal, fstop, distM]);

  const m = (n: number) => (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2));

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-suite-canvas">
      <div className="max-w-6xl mx-auto p-8 flex flex-col gap-5">
        <div>
          <h2 className="font-mono text-xs tracking-[0.22em] uppercase text-suite-text">
            Field of View · Depth of Field
          </h2>
          <p className="text-[11px] text-suite-text-dim font-mono mt-1">
            {source.camera} — {source.mode}
            {sw && sh ? ` · used sensor ${sw}×${sh} mm${sq !== 1 ? ` · ${sq}× ana` : ""}` : ""}
          </p>
        </div>

        {!r ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SliderField icon={Maximize2} label="Focal Length" unit="mm" value={focal}
                min={8} max={300} step={1} onChange={setFocal} />
              <SliderField icon={Aperture} label="Aperture (f-number)" unit="" value={fstop}
                min={1} max={22} step={0.1} onChange={setFstop} />
              <SliderField icon={Ruler} label="Subject Distance" unit="m" value={distM}
                min={0.3} max={50} step={0.1} onChange={setDistM} />
            </div>
            <p className="text-[11px] text-status-warn font-mono">
              This camera mode has no sensor dimensions — pick a different mode.
            </p>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-5 items-start">
            {/* Left: 3D scene + the sliders that drive it */}
            <div className="flex flex-col gap-4 lg:sticky lg:top-4">
              <LensScene3D
                hAOV={r.hAOV} vAOV={r.vAOV} distM={distM}
                nearM={r.near} farM={r.far}
                frameW={r.frameW} frameH={r.frameH}
                hyperfocalM={r.hyperfocal} focal={focal} fstop={fstop}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SliderField icon={Maximize2} label="Focal Length" unit="mm" value={focal}
                  min={8} max={300} step={1} onChange={setFocal} />
                <SliderField icon={Aperture} label="Aperture (f-number)" unit="" value={fstop}
                  min={1} max={22} step={0.1} onChange={setFstop} />
                <SliderField icon={Ruler} label="Subject Distance" unit="m" value={distM}
                  min={0.3} max={50} step={0.1} onChange={setDistM} />
              </div>
              <LensKitPicker focal={focal} onFocal={setFocal} onFstop={setFstop} />
              <p className="text-[9.5px] text-suite-text-dim font-mono leading-relaxed">
                <span className="text-guide-target">Amber</span> = framing at the subject plane ·{" "}
                <span className="text-emerald-400">green slab</span> = in-focus zone (near→far) ·{" "}
                <span className="text-[#a78bfa]">violet tick</span> = hyperfocal · faint figures behind show how the longer
                lens compresses spacing. Drag to orbit, wheel to zoom.
              </p>
            </div>

            {/* Right: the numbers */}
            <div className="flex flex-col gap-4">
              <section className="border border-suite-border rounded-sm bg-suite-panel p-5">
                <SectionTitle icon={Crop} label="Angle of View" />
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <Metric label="Horizontal" value={`${m(r.hAOV)}°`} accentClass="text-guide-target" />
                  <Metric label="Vertical" value={`${m(r.vAOV)}°`} />
                  <Metric label="Diagonal" value={`${m(r.dAOV)}°`} />
                  <Metric label="Coverage @ dist"
                    value={`${m(r.frameW)}×${m(r.frameH)} m`}
                    hint="Subject-plane width × height" />
                </div>
              </section>

              <section className="border border-suite-border rounded-sm bg-suite-panel p-5">
                <SectionTitle icon={Aperture} label="Depth of Field" />
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <Metric label="Near focus" value={`${m(r.near)} m`} accentClass="text-status-ok" />
                  <Metric label="Far focus"
                    value={r.far === Infinity ? "∞" : `${m(r.far)} m`}
                    accentClass={r.far === Infinity ? "text-guide-target" : undefined} />
                  <Metric label="Total DoF"
                    value={r.dof === Infinity ? "∞" : `${m(r.dof)} m`}
                    accentClass="text-status-warn" />
                  <Metric label="Hyperfocal" value={`${m(r.hyperfocal)} m`}
                    hint="Focus here → ∞ in focus" />
                </div>
                <p className="text-[10px] text-suite-text-dim font-mono mt-3">
                  Circle of confusion {r.coc.toFixed(3)} mm (sensor width {sw.toFixed(1)} mm ÷ 1500, cinema/pCam convention).
                  When subject distance reaches the hyperfocal distance, far focus extends to infinity.
                  DoF uses the geometric f-number — cine lenses are marked in T-stops (~⅓ stop slower than f), so enter the f-number for exact depth.
                </p>
              </section>

              <section className="border border-suite-border rounded-sm bg-suite-panel p-5">
                <SectionTitle icon={Maximize2} label="Focal-Length Equivalence" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
                  <Metric label="Full-frame equiv" value={`${m(r.effFF)} mm`}
                    hint={`crop ×${r.cropFF.toFixed(2)} vs FF`} accentClass="text-guide-target" />
                  <Metric label="Super 35 equiv" value={`${m(r.effS35)} mm`}
                    hint="same framing on S35" />
                  <Metric label="This focal" value={`${focal} mm`}
                    hint={`on ${source.camera.split(" ").slice(0, 2).join(" ")}`} />
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LensKitPicker({ focal, onFocal, onFstop }: {
  focal: number; onFocal: (n: number) => void; onFstop: (n: number) => void;
}) {
  const [kitId, setKitId] = useState("");
  const kit = LENS_KITS.find((k) => k.id === kitId) || null;
  const selectKit = (id: string) => {
    setKitId(id);
    const k = LENS_KITS.find((x) => x.id === id);
    if (k) { onFstop(k.tStop); onFocal(nearestFocal(k, focal)); }
  };
  return (
    <div className="border border-suite-border rounded-sm bg-suite-panel p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted flex items-center gap-1.5">
          <Layers className="size-3" strokeWidth={1.5} /> Lens kit
        </span>
        <select value={kitId} onChange={(e) => selectKit(e.target.value)}
          className="bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target max-w-[60%]">
          <option value="">Custom / none</option>
          {LENS_KITS.map((k) => (
            <option key={k.id} value={k.id}>{k.maker} {k.name}</option>
          ))}
        </select>
      </div>
      {kit && (
        <>
          <div className="flex flex-wrap gap-1">
            {kit.focals.map((f) => {
              const active = focal === f;
              return (
                <button key={f} onClick={() => onFocal(f)} title={`${f} mm prime`}
                  className={cn("px-1.5 py-0.5 rounded-sm border font-mono text-[10px] tabular transition-colors",
                    active ? "bg-guide-target text-suite-bg border-transparent" : "border-suite-border text-suite-text-muted hover:text-suite-text hover:border-suite-border-strong")}>
                  {f}
                </button>
              );
            })}
          </div>
          <p className="text-[9.5px] text-suite-text-dim font-mono leading-relaxed">
            {kit.coverage} · T{kit.tStop.toFixed(1)} wide open{kit.anamorphic ? " · 2× anamorphic" : ""} — {kit.note}
          </p>
        </>
      )}
    </div>
  );
}

function SliderField({
  icon: Icon, label, unit, value, min, max, step, onChange,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string; unit: string; value: number;
  min: number; max: number; step: number; onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">
        <span className="flex items-center gap-1.5"><Icon className="size-3" strokeWidth={1.5} /> {label}</span>
        <span className="font-mono text-suite-text tabular">{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-guide-target" />
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n))); }}
        className="w-full bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono tabular focus:outline-none focus:border-guide-target" />
    </label>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }) {
  return (
    <h3 className={cn("flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-suite-text-muted")}>
      <Icon className="size-3.5" strokeWidth={1.5} /> {label}
    </h3>
  );
}
