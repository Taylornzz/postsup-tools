import { SourceFormat } from "@/lib/formats";
import {
  AcesVersion,
  acesPipeline,
  ACES_VERSION_NOTE,
  ACES_INTEROP_WARNING,
} from "@/lib/aces";
import { cn } from "@/lib/utils";

interface AcesPanelProps {
  source: SourceFormat;
  hdrVariant: string;
  targetName: string;
  version: AcesVersion;
  onVersionChange: (v: AcesVersion) => void;
}

/** Read-only ACES pipeline reference: IDT → working space → Output Transform,
 *  keyed off the selected camera colour science and delivery / HDR variant. */
export function AcesPanel({ source, hdrVariant, targetName, version, onVersionChange }: AcesPanelProps) {
  const p = acesPipeline(source, hdrVariant, targetName, version);
  const out = version === "2.0" ? p.odt.label2 : p.odt.label13;

  return (
    <div className="flex flex-col gap-3 pt-3">
      {/* Version toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-suite-text-muted">ACES Version</span>
        <div className="flex gap-1">
          {(["2.0", "1.3"] as AcesVersion[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onVersionChange(v)}
              className={cn(
                "px-2 py-0.5 text-[10px] font-mono tabular rounded-sm border transition-colors",
                version === v
                  ? "bg-suite-panel-elevated border-suite-border-strong text-suite-text"
                  : "border-suite-border text-suite-text-muted hover:text-suite-text",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono">{ACES_VERSION_NOTE[version]}</p>

      {/* Pipeline flow */}
      <Stage label="① Input · IDT" accent="text-guide-source">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-suite-text">{p.idt.label}</span>
          <span
            className={cn(
              "px-1.5 py-0.5 text-[9px] tracking-wide uppercase rounded-sm border",
              p.idt.official
                ? "text-status-ok border-status-ok/40 bg-status-ok/10"
                : "text-status-warn border-status-warn/40 bg-status-warn/10",
            )}
          >
            {p.idt.official ? "Official ACES" : "Third-party"}
          </span>
        </div>
        <Hint>→ {p.idt.mapsInto}</Hint>
        {p.idt.note && <Hint>{p.idt.note}</Hint>}
      </Stage>

      <Stage label="② Working space" accent="text-suite-text">
        <span className="font-mono text-[11px] text-suite-text">{p.grade.name} <span className="text-suite-text-dim">· grade</span></span>
        <Hint>{p.grade.use}</Hint>
        <Hint>{p.vfx.name} — {p.vfx.use}</Hint>
        <Hint>{p.interchange.name} — {p.interchange.use}</Hint>
      </Stage>

      <Stage label="③ Output · Transform" accent="text-guide-target">
        <span className="font-mono text-[11px] text-guide-target">{out}</span>
        <Hint>{p.odt.display} · {p.odt.eotf} · {p.odt.peakNits} nits</Hint>
        {p.odt.note && <Hint>{p.odt.note}</Hint>}
        {version === "1.3" && <Hint>2.0 equivalent: {p.odt.label2}</Hint>}
      </Stage>

      <p className="text-[10px] leading-relaxed text-suite-text-dim font-mono border-t border-suite-border/60 pt-2">
        {ACES_INTEROP_WARNING}
      </p>
    </div>
  );
}

function Stage({ label, accent, children }: { label: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-l-2 border-suite-border pl-2.5">
      <span className={cn("text-[9px] tracking-[0.18em] uppercase", accent)}>{label}</span>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[10px] leading-relaxed text-suite-text-dim font-mono">{children}</span>;
}
