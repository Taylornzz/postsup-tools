import { useEffect, useRef, useState } from "react";
import { Radar, X, ExternalLink, Loader2 } from "lucide-react";
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
            <button onClick={() => dismissOne(f)} className="ml-auto text-suite-text-dim hover:text-suite-text" title="Dismiss"><X className="size-3" strokeWidth={2} /></button>
          </li>
        ))}
      </ul>
      <p className="font-mono text-[9px] text-suite-text-dim leading-relaxed">
        Suggestions from a monthly web check — verify, then ask to add the ones you want.
        <button onClick={() => run(true)} disabled={running} className="ml-2 text-suite-text-muted hover:text-suite-text underline-offset-2 hover:underline disabled:opacity-50">Check now</button>
      </p>
    </div>
  );
}
