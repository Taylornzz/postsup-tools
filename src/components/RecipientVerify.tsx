import { useState } from "react";
import { RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { specOptions, specStaleness, type Recipient } from "@/lib/deliverables";
import { verifySpec, type SpecVerifyResult } from "@/lib/verifySpec";

/** Spec freshness badge + on-demand "Verify spec" (web search). The result is a field-level
 *  diff the user applies BY HAND — never auto-merged — with sources and a portal-confirm note. */

const SPEC_FIELDS: { key: keyof Recipient; label: string }[] = [
  { key: "region", label: "Region" }, { key: "dr", label: "Colour / range" }, { key: "peakNits", label: "Peak nits" },
  { key: "resolution", label: "Resolution" }, { key: "fps", label: "FPS" }, { key: "container", label: "Container" },
  { key: "audio", label: "Audio" }, { key: "loudness", label: "Loudness" }, { key: "truePeak", label: "True-peak" }, { key: "subtitles", label: "Subtitles" },
];

export function RecipientVerify({ recipient, onPatch }: { recipient: Recipient; onPatch: (p: Partial<Recipient>) => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpecVerifyResult | null>(null);
  const stale = specStaleness(recipient.verified?.at);
  const badge = stale.level === "fresh" ? "text-emerald-400 border-emerald-400/40 bg-emerald-400/10"
    : stale.level === "aging" ? "text-status-warn border-status-warn/40 bg-status-warn/10"
    : stale.level === "stale" ? "text-destructive border-destructive/40 bg-destructive/10"
    : "text-suite-text-dim border-suite-border";

  const diffsFrom = (res: SpecVerifyResult) =>
    SPEC_FIELDS.filter((f) => res.spec[f.key] !== undefined && res.spec[f.key] !== "" && String(res.spec[f.key]) !== String(recipient[f.key] ?? ""));

  const run = async () => {
    if (!recipient.name.trim()) { toast("Name the recipient first so I know which platform to verify"); return; }
    setLoading(true); setResult(null);
    try {
      const cur = { region: recipient.region, dr: recipient.dr, peakNits: recipient.peakNits, resolution: recipient.resolution, fps: recipient.fps, container: recipient.container, audio: recipient.audio, loudness: recipient.loudness, truePeak: recipient.truePeak, subtitles: recipient.subtitles };
      const res = await verifySpec(recipient.name, cur, specOptions());
      setResult(res);
      const diffs = diffsFrom(res);
      if (diffs.length === 0) {
        onPatch({ verified: { at: new Date().toISOString(), confidence: res.confidence, source: "Web-verified — confirm in portal" } });
        toast.success("No changes found — marked verified", { description: res.summary });
      } else {
        toast.success(`${diffs.length} field${diffs.length === 1 ? "" : "s"} may have changed — review below`, { description: res.summary });
      }
    } catch (e) {
      toast.error("Couldn’t verify the spec", { description: e instanceof Error ? e.message : "" });
    } finally { setLoading(false); }
  };

  const apply = (key: keyof Recipient, value: unknown) => {
    // Only stamp the spec "verified" once every diff is reconciled — applying one field
    // shouldn't claim the whole spec was re-checked.
    const remaining = SPEC_FIELDS.filter((f) => f.key !== key && result != null && result.spec[f.key] !== undefined && result.spec[f.key] !== "" && String(result.spec[f.key]) !== String(recipient[f.key] ?? "")).length;
    onPatch({ [key]: value, ...(remaining === 0 ? { verified: { at: new Date().toISOString(), confidence: result?.confidence, source: "Web-verified — confirm in portal" } } : {}) } as Partial<Recipient>);
    setResult((prev) => (prev ? { ...prev, spec: { ...prev.spec, [key]: undefined } } : prev));
  };

  const diffs = result ? diffsFrom(result) : [];

  return (
    <div className="flex flex-col gap-1.5 mb-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn("font-mono text-[8.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full border", badge)} title={recipient.verified?.source || "This spec hasn’t been verified — Verify to web-check it"}>
          {stale.label}{recipient.verified?.confidence ? ` · ${recipient.verified.confidence}` : ""}
        </span>
        <button onClick={run} disabled={loading} className="flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] font-mono border rounded-sm text-guide-source border-guide-source/50 bg-guide-source/10 hover:bg-guide-source/20 disabled:opacity-50 transition-colors">
          <RefreshCw className={cn("size-2.5", loading && "animate-spin")} strokeWidth={2} /> {loading ? "Verifying…" : "Verify spec"}
        </button>
      </div>
      {result && (
        <div className="rounded-sm border border-guide-source/30 bg-guide-source/5 p-2 flex flex-col gap-1.5">
          <div className="font-mono text-[9px] text-status-warn leading-relaxed">⚠ Web-search result — confirm against the platform’s partner portal before delivering. Not the contractual spec.</div>
          {diffs.length === 0 ? (
            <div className="font-mono text-[10px] text-suite-text-muted">No field changes vs your spec.{result.summary ? ` ${result.summary}` : ""}</div>
          ) : diffs.map((f) => (
            <div key={String(f.key)} className="flex items-center gap-2 flex-wrap text-[10px] font-mono">
              <span className="text-suite-text-muted w-[6.5rem] shrink-0">{f.label}</span>
              <span className="text-suite-text-dim line-through">{String(recipient[f.key] ?? "—")}</span>
              <span className="text-suite-text-dim">→</span>
              <span className="text-suite-text">{String(result.spec[f.key])}</span>
              <button onClick={() => apply(f.key, result.spec[f.key])} className="ml-auto px-1.5 py-0.5 rounded-sm border border-guide-target/50 text-guide-target text-[8.5px] uppercase tracking-[0.1em] hover:bg-guide-target/10 transition-colors">Apply</button>
            </div>
          ))}
          {result.sources && result.sources.length > 0 && (
            <div className="flex flex-col gap-0.5 pt-1 border-t border-suite-border/50">
              {result.sources.slice(0, 3).map((s, i) => (
                <a key={i} href={/^https?:\/\//.test(s.url || "") ? s.url : "#"} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-[9px] text-suite-text-dim hover:text-guide-source truncate" title={s.quote || s.url}>
                  <ExternalLink className="size-2.5 shrink-0" strokeWidth={1.7} /> <span className="truncate">{s.url}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
