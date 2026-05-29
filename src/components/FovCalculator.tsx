import { useMemo, useState } from "react";
import { SourceFormat, computeFovDof } from "@/lib/formats";
import { Metric } from "@/components/Metric";
import { Aperture, Ruler, Crop, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Reference diagonals for focal-length equivalence.
const FF_DIAG = Math.hypot(36, 24); // 43.27 mm — full frame
const S35_DIAG = Math.hypot(24.89, 18.66); // ~31.1 mm — Super 35 (3-perf)

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
      <div className="max-w-3xl mx-auto p-8 flex flex-col gap-6">
        <div>
          <h2 className="font-mono text-xs tracking-[0.22em] uppercase text-suite-text">
            Field of View · Depth of Field
          </h2>
          <p className="text-[11px] text-suite-text-dim font-mono mt-1">
            {source.camera} — {source.mode}
            {sw && sh ? ` · used sensor ${sw}×${sh} mm${sq !== 1 ? ` · ${sq}× ana` : ""}` : ""}
          </p>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <SliderField icon={Maximize2} label="Focal Length" unit="mm" value={focal}
            min={8} max={300} step={1} onChange={setFocal} />
          <SliderField icon={Aperture} label="Aperture (T/f)" unit="" value={fstop}
            min={1} max={22} step={0.1} onChange={setFstop} />
          <SliderField icon={Ruler} label="Subject Distance" unit="m" value={distM}
            min={0.3} max={50} step={0.1} onChange={setDistM} />
        </div>

        {!r ? (
          <p className="text-[11px] text-status-warn font-mono">
            This camera mode has no sensor dimensions — pick a different mode.
          </p>
        ) : (
          <>
            {/* Angle of view */}
            <section className="border border-suite-border rounded-sm bg-suite-panel p-5">
              <SectionTitle icon={Crop} label="Angle of View" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                <Metric label="Horizontal" value={`${m(r.hAOV)}°`} accentClass="text-guide-target" />
                <Metric label="Vertical" value={`${m(r.vAOV)}°`} />
                <Metric label="Diagonal" value={`${m(r.dAOV)}°`} />
                <Metric label="Coverage @ dist"
                  value={`${m(r.frameW)}×${m(r.frameH)} m`}
                  hint="Subject-plane width × height" />
              </div>
            </section>

            {/* Depth of field */}
            <section className="border border-suite-border rounded-sm bg-suite-panel p-5">
              <SectionTitle icon={Aperture} label="Depth of Field" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
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
                Circle of confusion {r.coc.toFixed(3)} mm (sensor Ø {r.diag.toFixed(1)} mm ÷ 1500).
                At T/f below ~the hyperfocal, far focus reaches infinity.
              </p>
            </section>

            {/* Equivalence */}
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
          </>
        )}
      </div>
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
