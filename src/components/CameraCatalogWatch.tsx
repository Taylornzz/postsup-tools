import { useEffect, useRef, useState } from "react";
import { Radar, X, ExternalLink, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  currentCameraNames, fetchCameraWatch, loadCameraWatch, saveCameraWatch,
  cameraWatchDue, markCameraWatchAt, markCameraWatchAttempt, activeFlags, dismissFlagged,
  type CameraWatchState,
} from "@/lib/cameraWatch";

/** Monthly background check that flags current cinema cameras missing from the catalog.
 *  Suggestions only — the user reviews and asks for the ones they want added. Silent + cheap
 *  (Haiku, capped web searches), throttled like spec-drift, never fired by a click except "Check now". */
export function CameraCatalogWatch() {
  const [state, setState] = useState<CameraWatchState | null>(() => loadCameraWatch());
  const [running, setRunning] = useState(false);
  const fired = useRef(false);
  const unmounted = useRef(false);
  useEffect(() => () => { unmounted.current = true; }, []);

  const run = async (manual: boolean) => {
    const now = Date.now();
    markCameraWatchAttempt(now);
    setRunning(true);
    try {
      const { summary, flagged } = await fetchCameraWatch(currentCameraNames());
      markCameraWatchAt(now);
      const prevDismissed = state?.dismissed || [];
      const next: CameraWatchState = { flagged, summary, checkedAt: new Date(now).toISOString(), dismissed: prevDismissed };
      saveCameraWatch(next);
      if (!unmounted.current) setState(next);
      if (manual) toast.success(flagged.length ? `${flagged.length} camera${flagged.length === 1 ? "" : "s"} to consider` : "Catalog looks current", { description: summary || undefined });
    } catch (e) {
      if (manual) toast.error("Couldn't run the catalog check", { description: e instanceof Error ? e.message : "" });
    } finally {
      if (!unmounted.current) setRunning(false);
    }
  };

  // Auto-run at most monthly, on first mount of the Capture tab.
  useEffect(() => {
    if (fired.current) return;
    if (!cameraWatchDue(Date.now())) return;
    fired.current = true;
    run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flags = activeFlags(state);
  // "Accept" isn't a one-click catalog write on purpose: a flag can be wrong (a model can
  // invent a body that doesn't exist), so adding always goes through a human verify step.
  // This copies a ready request to paste to Claude, which checks the specs before adding.
  const copyAdd = (f: typeof flags[number]) => {
    const name = `${f.brand} ${f.model}`.trim();
    const req = `Add the ${name} to the camera catalog.`;
    navigator.clipboard?.writeText(req).then(
      () => toast.success("Add request copied", { description: `Paste it to Claude. It verifies specs, then adds ${name}.` }),
      () => toast.error("Couldn't copy", { description: `Ask Claude: "${req}"` }),
    );
  };
  const dismissOne = (f: typeof flags[number]) => { const n = dismissFlagged(state, f); setState(n); saveCameraWatch(n); };
  const dismissAll = () => { const n = state ? { ...state, dismissed: [...new Set([...(state.dismissed || []), ...flags.map((f) => `${f.brand} ${f.model}`.toLowerCase().trim())])] } : state; setState(n); saveCameraWatch(n); };

  if (!flags.length) return null;

  return (
    <div className="rounded-md border border-status-warn/30 bg-status-warn/5 px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Radar className="size-3.5 shrink-0 text-status-warn" strokeWidth={1.8} />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-status-warn font-semibold">{flags.length} camera{flags.length === 1 ? "" : "s"} may be missing</span>
        {state?.checkedAt && <span className="font-mono text-[9px] text-suite-text-dim">checked {new Date(state.checkedAt).toLocaleDateString()}</span>}
        {running && <Loader2 className="size-3 animate-spin text-suite-text-dim" strokeWidth={2} />}
        <button onClick={dismissAll} className="ml-auto text-suite-text-dim hover:text-suite-text" title="Dismiss all"><X className="size-3.5" strokeWidth={2} /></button>
      </div>
      <ul className="flex flex-col gap-1">
        {flags.map((f) => (
          <li key={`${f.brand} ${f.model}`} className="flex items-baseline gap-2 flex-wrap font-mono text-[10px]">
            <span className="text-suite-text font-semibold">{f.brand} {f.model}</span>
            {f.year && <span className="text-suite-text-dim">{f.year}</span>}
            {f.keySpecs && <span className="text-suite-text-muted">{f.keySpecs}</span>}
            <a href={/^https?:\/\//.test(f.source) ? f.source : "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-guide-source hover:underline" title={f.source}>
              <ExternalLink className="size-2.5" strokeWidth={1.7} /> source
            </a>
            <button onClick={() => copyAdd(f)} className="ml-auto inline-flex items-center gap-0.5 text-guide-target hover:underline" title="Copy a request to paste to Claude. It verifies the specs, then adds it">
              <Plus className="size-2.5" strokeWidth={2.2} /> add
            </button>
            <button onClick={() => dismissOne(f)} className="inline-flex items-center gap-0.5 text-suite-text-dim hover:text-suite-text" title="Hide this suggestion for good">
              <X className="size-3" strokeWidth={2} /> dismiss
            </button>
          </li>
        ))}
      </ul>
      <p className="font-mono text-[9px] text-suite-text-dim leading-relaxed">
        Monthly web check, suggestions only. <span className="text-guide-target">add</span> copies a request to paste to Claude (it verifies specs before adding); <span className="text-suite-text-muted">dismiss</span> hides one for good.
        <button onClick={() => run(true)} disabled={running} className="ml-2 text-suite-text-muted hover:text-suite-text underline-offset-2 hover:underline disabled:opacity-50">Check now</button>
      </p>
    </div>
  );
}
