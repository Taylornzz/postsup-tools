import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  PackageCheck, Plus, Trash2, Sparkles, Send, Copy,
  GitBranch, X, ChevronRight, Star, Download, ChevronDown, CalendarClock, Radar, AlertTriangle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { putFile, getFile, delFile } from "@/lib/fileStore";
import {
  loadRecipients, saveRecipients, newRecipient, blankRecipient, duplicateRecipient, buildPlan, recipientChecklist, sendToBoard,
  buildWorkflowGraph, recipientsToMasteringConfig, HERO_LABEL, DELIVERY_TEMPLATES, recipientFromTemplate,
  sendDeliveriesToSchedule,
  REGIONS, DR_OPTIONS, NITS_OPTIONS, RESOLUTION_OPTIONS, FPS_OPTIONS, CONTAINER_OPTIONS,
  AUDIO_OPTIONS, SUBTITLE_OPTIONS, LOUDNESS_OPTIONS, LOUDNESS_BY_REGION, TRUEPEAK_OPTIONS, TRUEPEAK_BY_REGION, isHdr,
  type Recipient, type Region, type DRId, type DocMeta,
} from "@/lib/deliverables";
import type { CustomConfig, MasterNits } from "@/lib/mastering";
import { RecipientDeliverables } from "./RecipientDeliverables";
import { RecipientVerify } from "./RecipientVerify";
import { ProductionList } from "./ProductionList";
import { exportDeliverables } from "@/lib/deliverablesExport";
import { rollupDeliverables, shareCounts, linkSuggestions, linkBySpecKey, unlinkArtifact } from "@/lib/deliverablesRollup";
import { verifySpec } from "@/lib/verifySpec";
import { loadDrift, saveDrift, driftCandidates, runDriftScan, clearDriftFor, autoDriftDue, markAutoDriftAt, markAutoDriftAttempt, type DriftState } from "@/lib/driftCheck";
import { specOptions, recipientsPersisted } from "@/lib/deliverables";

const DeliverablesFlow = lazy(() => import("./DeliverablesFlow"));

export function Deliverables({ projectName, projectId, onSendToMastering }: {
  projectName?: string;
  projectId?: string;
  onSendToMastering?: (config: CustomConfig, nits: MasterNits) => void;
}) {
  const [recipients, setRecipients] = useState<Recipient[]>(() => loadRecipients(projectId));
  // Sampled BEFORE the save effect below runs — that effect persists the seed examples on the
  // very first mount, so checking recipientsPersisted() any later always says true and the
  // "skip untouched seed projects" drift gate becomes dead code.
  const [persistedAtMount] = useState(() => recipientsPersisted(projectId));
  const [focusBriefId, setFocusBriefId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set()); // recipients open for editing (collapsed by default)
  const toggleOpen = (id: string) => setOpenIds((e) => { const n = new Set(e); n.has(id) ? n.delete(id) : n.add(id); return n; });
  useEffect(() => { saveRecipients(projectId, recipients); }, [recipients, projectId]);
  const splitRef = useRef<HTMLDivElement>(null);
  const [chartW, setChartW] = useState<number>(() => { const v = Number(localStorage.getItem("kaos.deliverables.chartW")); return v >= 320 ? v : 480; });
  useEffect(() => { try { localStorage.setItem("kaos.deliverables.chartW", String(Math.round(chartW))); } catch { /* ignore */ } }, [chartW]);

  const plan = useMemo(() => buildPlan(recipients), [recipients]);
  const graph = useMemo(() => buildWorkflowGraph(recipients, plan), [recipients, plan]);
  const mastering = useMemo(() => recipientsToMasteringConfig(recipients), [recipients]);
  const rollup = useMemo(() => rollupDeliverables(recipients), [recipients]);
  const shared = useMemo(() => shareCounts(rollup), [rollup]);
  const linkSugg = useMemo(() => linkSuggestions(recipients), [recipients]);
  const linkArtifact = (specKey: string) => {
    setRecipients((rs) => linkBySpecKey(rs, specKey));
    toast.success("Linked as one make-once artifact", { description: "Shared across recipients — naming & timing stay per-recipient. Unlink any time." });
  };
  const unlinkArt = (artifactId: string) => setRecipients((rs) => unlinkArtifact(rs, artifactId));

  // ---- spec-drift: a silent background check, ~monthly, no button to click ----
  const [drift, setDrift] = useState<DriftState | null>(() => loadDrift(projectId));
  const [driftRunning, setDriftRunning] = useState(false);
  useEffect(() => { setDrift(loadDrift(projectId)); }, [projectId]);
  const dismissDrift = () => { setDrift(null); saveDrift(projectId, null); };
  const dismissDriftFor = (id: string) => { const next = clearDriftFor(drift, id); setDrift(next); saveDrift(projectId, next); };

  // Runs automatically when a project is open, at most once a month, only the recipients
  // worth checking, silent + non-blocking. Stamped only when it actually reached the service
  // (so local dev / offline just retries next open). Never triggered by a click — no cost surprise.
  const autoFired = useRef(false);
  // Unmount-only cancellation. The effect re-runs on every recipients edit, so a per-run
  // `cancelled` flag flipped in its cleanup would discard an in-flight (paid) scan the moment
  // the user typed anything — results dropped, spinner stuck on, retry stamp already burned.
  const unmounted = useRef(false);
  useEffect(() => () => { unmounted.current = true; }, []);
  useEffect(() => {
    if (autoFired.current) return;
    const now = Date.now();
    // Skip untouched seed/example projects, and respect the monthly + retry throttle.
    if (!persistedAtMount || !autoDriftDue(projectId, now)) return;
    const candidates = driftCandidates(recipients);
    if (!candidates.length) return;
    autoFired.current = true;
    markAutoDriftAttempt(projectId, now); // stamp the attempt so a failed run won't re-fire on every tab revisit
    setDriftRunning(true);
    const opts = specOptions();
    const verify = (r: Recipient) => verifySpec(r.name, { region: r.region, dr: r.dr, peakNits: r.peakNits, resolution: r.resolution, fps: r.fps, container: r.container, audio: r.audio, loudness: r.loudness, truePeak: r.truePeak, subtitles: r.subtitles }, opts);
    runDriftScan(candidates, verify, {})
      .then(({ state, checked }) => {
        if (checked === 0) return;                       // 0 reached → offline/local; don't burn the month
        markAutoDriftAt(projectId, now);
        saveDrift(projectId, state);                     // persist even if unmounted — the scan completed
        if (!unmounted.current) setDrift(state);
      })
      .catch(() => { /* offline — retry next open */ })
      .finally(() => { if (!unmounted.current) setDriftRunning(false); });
  }, [projectId, recipients, persistedAtMount]);
  const [flowKey, setFlowKey] = useState(0);
  const resetLayout = () => {
    try { localStorage.removeItem(`kaos.deliverables.flowpos${projectId ? `-${projectId}` : ""}`); } catch { /* ignore */ }
    setFlowKey((k) => k + 1);
  };

  const patch = (id: string, p: Partial<Recipient>) => setRecipients((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const changeRegion = (id: string, region: Region) => patch(id, { region, loudness: LOUDNESS_BY_REGION[region] || "", truePeak: TRUEPEAK_BY_REGION[region] || "" });
  const add = () => setRecipients((rs) => [...rs, newRecipient(`Recipient ${rs.length + 1}`)]);
  const addWithAI = () => { const r = blankRecipient(`Recipient ${recipients.length + 1}`); setRecipients((rs) => [...rs, r]); setFocusBriefId(r.id); setOpenIds((e) => new Set(e).add(r.id)); };
  const setMain = (id: string) => setRecipients((rs) => rs.map((r) => ({ ...r, isMain: r.id === id ? !r.isMain : false })));
  const dup = async (r: Recipient) => {
    const copy = duplicateRecipient(r);
    // Copy attachment blobs under fresh ids — shared ids would let "delete recipient"
    // destroy files the other one still references.
    for (const d of r.documents || []) {
      try {
        const blob = await getFile(d.id);
        if (!blob) continue;
        const id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        await putFile(id, blob);
        copy.documents!.push({ ...d, id });
      } catch { /* skip files that can't be copied */ }
    }
    setRecipients((rs) => { const i = rs.findIndex((x) => x.id === r.id); return [...rs.slice(0, i + 1), copy, ...rs.slice(i + 1)]; });
    setOpenIds((e) => new Set(e).add(copy.id));
  };
  const addTemplate = (id: string) => {
    const t = DELIVERY_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const nr = recipientFromTemplate(t);
    setRecipients((rs) => [...rs, nr]);
    setOpenIds((e) => new Set(e).add(nr.id));
    toast.success(`Added ${t.name}`, { description: "Starter spec — confirm against the platform's current delivery document." });
  };
  const remove = (id: string) => {
    const r = recipients.find((x) => x.id === id);
    (r?.documents || []).forEach((d) => { delFile(d.id).catch(() => {}); });
    setRecipients((rs) => rs.filter((r) => r.id !== id));
  };
  const reset = () => { if (window.confirm("Reset recipients to the starter examples?")) setRecipients(loadRecipientsSeed()); };

  const push = () => {
    if (!recipients.length) { toast("Add a recipient first."); return; }
    const { added } = sendToBoard(projectId, recipients, plan);
    if (added === 0) toast("Already on the board", { description: "Nothing new to add — open Task Board to see it." });
    else toast.success(`Sent ${added} card${added === 1 ? "" : "s"} to the Task Board`, { description: "Grade passes + a checklist per recipient." });
  };

  const pushToPlanner = () => {
    const dated = recipients.filter((r) => r.due).length;
    if (!dated) { toast("Set a due date first", { description: "Add a delivery due date to a recipient (the date field by its name), then send to the Planner." }); return; }
    const { added, updated, skipped } = sendDeliveriesToSchedule(projectId, recipients);
    const bits = [added ? `${added} added` : "", updated ? `${updated} updated` : ""].filter(Boolean).join(" · ") || "already in sync";
    toast.success("Delivery dates → Planner", { description: `${bits}${skipped ? ` · ${skipped} without a date skipped` : ""}. Open the Planner to see the milestones.` });
  };

  const openInMastering = () => {
    if (!recipients.length) { toast("Add a recipient first."); return; }
    if (!onSendToMastering) return;
    onSendToMastering(mastering.config, mastering.masterNits);
    toast.success("Opened in Mastering", { description: `Custom tree built from these recipients — hero: ${HERO_LABEL[mastering.config.hero]}.` });
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const rect = splitRef.current?.getBoundingClientRect();
      if (!rect) return;
      setChartW(Math.max(320, Math.min(rect.right - ev.clientX, rect.width - 380)));
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const addFiles = async (recipientId: string, fileList: FileList | File[]) => {
    const metas: DocMeta[] = [];
    for (const f of Array.from(fileList)) {
      const id = `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      try { await putFile(id, f); } catch { toast.error(`Couldn't store ${f.name}.`); continue; }
      metas.push({ id, name: f.name, type: f.type || f.name.split(".").pop() || "file", size: f.size, addedAt: new Date().toISOString() });
    }
    if (metas.length) {
      setRecipients((rs) => rs.map((r) => (r.id === recipientId ? { ...r, documents: [...(r.documents || []), ...metas] } : r)));
      toast.success(`Attached ${metas.length} file${metas.length === 1 ? "" : "s"}`);
    }
  };
  const openFile = async (doc: DocMeta) => {
    try { const blob = await getFile(doc.id); if (!blob) { toast.error("File not found."); return; } const url = URL.createObjectURL(blob); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 30000); }
    catch { toast.error("Couldn't open the file."); }
  };
  const removeFile = async (recipientId: string, doc: DocMeta) => {
    try { await delFile(doc.id); } catch { /* ignore */ }
    setRecipients((rs) => rs.map((r) => (r.id === recipientId ? { ...r, documents: (r.documents || []).filter((d) => d.id !== doc.id) } : r)));
  };

  const sel = "bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target";

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <PackageCheck className="size-4 text-guide-target" strokeWidth={1.6} />
          <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Deliverables</span>
          {projectName?.trim() && <span className="font-mono text-[11px] text-suite-text-dim truncate max-w-[18ch]">· {projectName.trim()}</span>}
          <span className="font-mono text-[10px] text-suite-text-dim tabular">{plan.gradeCount} grade{plan.gradeCount === 1 ? "" : "s"} → {plan.deliverableCount} deliverable{plan.deliverableCount === 1 ? "" : "s"}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onSendToMastering && recipients.length > 0 && (
            <button onClick={openInMastering} title="Build this as a custom tree in the Mastering tab" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors">
              <GitBranch className="size-3" strokeWidth={1.7} /> Open in Mastering
            </button>
          )}
          <div className="relative">
            <button onClick={() => setShowExport((s) => !s)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
              <Download className="size-3" strokeWidth={1.6} /> Export <ChevronDown className="size-3" strokeWidth={2} />
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-1 flex flex-col">
                  <button onClick={() => { exportDeliverables("pdf", recipients, rollup, projectName?.trim() || ""); setShowExport(false); }} className="text-left px-2.5 py-1.5 text-[11px] font-mono text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated rounded-sm">PDF — handoff document</button>
                  <button onClick={() => { exportDeliverables("csv", recipients, rollup, projectName?.trim() || ""); setShowExport(false); }} className="text-left px-2.5 py-1.5 text-[11px] font-mono text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated rounded-sm">CSV — spreadsheet</button>
                </div>
              </>
            )}
          </div>
          <button onClick={push} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            <Send className="size-3" strokeWidth={1.6} /> To board
          </button>
          <button onClick={pushToPlanner} title="Add each recipient's delivery due date to the Planner as a milestone" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            <CalendarClock className="size-3" strokeWidth={1.6} /> To planner
          </button>
          {driftRunning && (
            <span title="Checking platform specs for changes since you set up — runs automatically about once a month" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono text-suite-text-dim">
              <Loader2 className="size-3 animate-spin" strokeWidth={2} /> Checking specs…
            </span>
          )}
          <button onClick={reset} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            Reset
          </button>
        </div>
      </div>

      <div ref={splitRef} className="flex-1 min-h-0 flex">
        <div className="flex-1 min-w-0 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4 max-w-3xl">
          {/* Build options — how to add deliverables + open the derived plan in Mastering */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-mono text-[11px] tracking-[0.16em] uppercase text-suite-text font-semibold mr-1">Deliverables</h3>
            <button onClick={addWithAI} title="Add a recipient and build its deliverables with AI" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-source border-guide-source/50 bg-guide-source/10 hover:bg-guide-source/20 transition-colors">
              <Sparkles className="size-3" strokeWidth={2} /> Build with AI
            </button>
            <select value="" onChange={(e) => addTemplate(e.target.value)} className={cn(sel, "max-w-[15rem] !text-guide-target !border-guide-target/50 uppercase tracking-[0.14em]")} title="Add a recipient pre-filled from a platform template, then grow it">
              <option value="">⬚ Build from template…</option>
              {DELIVERY_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {drift && drift.drifted.length > 0 && (
            <div className="rounded-md border border-status-warn/30 bg-status-warn/5 px-3 py-2 flex items-center gap-2">
              <Radar className="size-3.5 shrink-0 text-status-warn" strokeWidth={1.8} />
              <p className="font-mono text-[10px] text-suite-text-muted leading-relaxed min-w-0">
                <span className="text-status-warn font-semibold">{drift.drifted.length} spec{drift.drifted.length === 1 ? "" : "s"} changed</span> since you set up (auto-checked {new Date(drift.checkedAt).toLocaleDateString()}) — see the note under {drift.drifted.length === 1 ? "that recipient" : "each flagged recipient"}. Heads-up only; your plan stays as-is until you change it.
              </p>
              <button onClick={dismissDrift} className="ml-auto shrink-0 text-suite-text-dim hover:text-suite-text" title="Dismiss all drift notes"><X className="size-3.5" strokeWidth={2} /></button>
            </div>
          )}

          {/* Recipients — collapsed by default; click a row to open its spec + deliverables */}
          <div className="flex flex-col gap-2.5">
            {recipients.map((r, idx) => {
              const checks = recipientChecklist(r);
              const isOpen = openIds.has(r.id);
              const rDrift = drift?.drifted.find((d) => d.id === r.id);
              const drLabel = DR_OPTIONS.find((d) => d.id === r.dr)?.label;
              const summaryBits = [r.region, drLabel, r.resolution, r.container, r.fps ? `${r.fps} fps` : ""].filter(Boolean);
              return (
                <div key={r.id} className={cn("rounded-md border bg-suite-panel/60 transition-colors", r.isMain ? "border-guide-target/50" : isOpen ? "border-guide-target/40" : "border-suite-border")}>
                  {/* Collapsed header — number, name, a plain spec summary, click to open */}
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                    <button onClick={() => setMain(r.id)}
                      title={r.isMain ? "Main deliverable — sets the source cadence the others convert from. Click to unset." : "Mark as the main deliverable — sets the source frame-rate the others derive from (grade order itself is set by dynamic range in Mastering)"}
                      className={cn("shrink-0 transition-colors", r.isMain ? "text-guide-target" : "text-suite-text-dim hover:text-suite-text")}>
                      <Star className="size-3.5" strokeWidth={1.7} fill={r.isMain ? "currentColor" : "none"} />
                    </button>
                    <span className="shrink-0 grid place-items-center size-5 rounded bg-suite-bg border border-suite-border font-mono text-[10px] font-bold text-suite-text-muted tabular">{idx + 1}</span>
                    <input
                      value={r.name}
                      onChange={(e) => patch(r.id, { name: e.target.value })}
                      placeholder="Recipient / platform…"
                      title="Recipient name"
                      className="w-40 shrink-0 bg-transparent border-0 border-b border-transparent hover:border-suite-border/60 focus:border-suite-border px-0.5 text-[13px] font-mono text-suite-text font-semibold focus:outline-none"
                    />
                    {/* summary doubles as the expand hit-area */}
                    <button onClick={() => toggleOpen(r.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                      <span className="truncate font-mono text-[10px] text-suite-text-dim">
                        {summaryBits.length ? summaryBits.join(" · ") : <span className="text-suite-text-dim/60">no spec yet — click to add</span>}
                      </span>
                    </button>
                    {rDrift && <span title="Spec drift flagged — open to see what changed" className="shrink-0 flex"><AlertTriangle className="size-3.5 text-status-warn" strokeWidth={2} /></span>}
                    {r.due && <span className="shrink-0 font-mono text-[9.5px] text-suite-text-dim tabular hidden sm:inline" title="Delivery due date">{r.due}</span>}
                    <span className="shrink-0 font-mono text-[9.5px] text-suite-text-dim tabular hidden md:inline" title="Spec variables still to confirm">{checks.length} to confirm</span>
                    <button onClick={() => toggleOpen(r.id)} title={isOpen ? "Collapse" : "Edit this recipient"} className="shrink-0 text-suite-text-muted hover:text-suite-text">
                      <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} strokeWidth={1.8} />
                    </button>
                    <button onClick={() => dup(r)} title="Duplicate this recipient (clone its spec + deliverables)" className="shrink-0 text-suite-text-dim hover:text-suite-text"><Copy className="size-3.5" strokeWidth={1.6} /></button>
                    <button onClick={() => remove(r.id)} title="Remove recipient" className="shrink-0 text-suite-text-dim hover:text-destructive"><Trash2 className="size-3.5" strokeWidth={1.6} /></button>
                  </div>

                  {/* Open: region + due, verify, drift, full spec, naming/qc, this recipient's deliverables */}
                  {isOpen && (
                  <div className="border-t border-suite-border/60 px-3.5 py-3">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-suite-text-dim">Region</span>
                    <select value={r.region} onChange={(e) => changeRegion(r.id, e.target.value as Region)} className={sel} title="Region — sets a default loudness target">
                      <option value="">—</option>
                      {REGIONS.map((rg) => <option key={rg} value={rg}>{rg}</option>)}
                    </select>
                    <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-suite-text-dim ml-2">Due</span>
                    <input type="date" value={r.due || ""} onChange={(e) => patch(r.id, { due: e.target.value })} title="Delivery due date" className="shrink-0 bg-suite-bg border border-suite-border rounded-sm px-1.5 py-1 text-[10px] font-mono text-suite-text-muted focus:outline-none focus:border-guide-target [color-scheme:dark] max-w-[8.5rem]" />
                  </div>

                  <RecipientVerify recipient={r} onPatch={(p) => patch(r.id, p)} />

                  {rDrift && (
                      <div className="mt-2 rounded-sm border border-status-warn/40 bg-status-warn/5 px-2.5 py-2">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="size-3 shrink-0 text-status-warn" strokeWidth={2} />
                          <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-status-warn font-semibold">Spec changed since you set up</span>
                          <span className="font-mono text-[9px] text-suite-text-dim">checked {new Date(rDrift.checkedAt).toLocaleDateString()}</span>
                          <button onClick={() => dismissDriftFor(r.id)} className="ml-auto text-suite-text-dim hover:text-suite-text" title="Dismiss this note"><X className="size-3" strokeWidth={2} /></button>
                        </div>
                        <ul className="mt-1.5 flex flex-col gap-0.5">
                          {rDrift.diffs.map((d, i) => (
                            <li key={i} className="font-mono text-[10px] text-suite-text-muted">
                              <span className="text-suite-text-dim">{d.label}:</span> {d.from || "—"} <span className="text-status-warn">→</span> {d.to}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1.5 font-mono text-[9px] text-suite-text-dim leading-relaxed">
                          What current public reporting says — not a required change. A show already in production delivers to its agreed spec; only change if you've re-confirmed with the platform. Use <span className="text-suite-text-muted">Verify spec</span> above to see sources and apply any field by hand.
                        </p>
                      </div>
                  )}

                  <div className="flex flex-wrap items-end gap-2.5">
                    <Field label="Colour / range">
                      <select value={r.dr} onChange={(e) => patch(r.id, { dr: e.target.value as DRId })} className={sel}>
                        <option value="">—</option>
                        {DR_OPTIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                      </select>
                    </Field>
                    {isHdr(r.dr) && (
                      <Field label="Peak nits">
                        <select value={r.peakNits} onChange={(e) => patch(r.id, { peakNits: parseInt(e.target.value, 10) })} className={sel}>
                          {NITS_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </Field>
                    )}
                    <Field label="Resolution">
                      <select value={r.resolution} onChange={(e) => patch(r.id, { resolution: e.target.value })} className={cn(sel, "max-w-[12rem]")}>
                        <option value="">—</option>
                        {RESOLUTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="FPS">
                      <select value={r.fps || ""} onChange={(e) => patch(r.id, { fps: e.target.value ? parseFloat(e.target.value) : 0 })} className={sel}>
                        <option value="">—</option>
                        {FPS_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </Field>
                    <button onClick={() => patch(r.id, { fpsNative: !r.fpsNative })}
                      title={r.fpsNative ? "Accepts the native source frame rate — no standards conversion (most streamers). Click to lock to a fixed fps." : "Locked to this fps — the Workflow flags a standards conversion if it differs from the source. Click if the platform accepts the native source fps."}
                      className={cn("self-end mb-[3px] px-2 py-1 rounded-sm border font-mono text-[9px] uppercase tracking-[0.12em] transition-colors", r.fpsNative ? "text-guide-source border-guide-source/50 bg-guide-source/10" : "text-suite-text-dim border-suite-border hover:text-suite-text hover:border-suite-border-strong")}>
                      native fps
                    </button>
                    <Field label="Container">
                      <select value={r.container} onChange={(e) => patch(r.id, { container: e.target.value })} className={cn(sel, "max-w-[11rem]")}>
                        <option value="">—</option>
                        {CONTAINER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Audio">
                      <select value={r.audio} onChange={(e) => patch(r.id, { audio: e.target.value })} className={sel}>
                        <option value="">—</option>
                        {AUDIO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Loudness">
                      <select value={r.loudness} onChange={(e) => patch(r.id, { loudness: e.target.value })} className={cn(sel, "max-w-[14rem]")}>
                        <option value="">—</option>
                        {[r.loudness, ...LOUDNESS_OPTIONS.filter((o) => o !== r.loudness)].filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="True-peak">
                      <select value={r.truePeak} onChange={(e) => patch(r.id, { truePeak: e.target.value })} className={cn(sel, "max-w-[12rem]")} title="Maximum true-peak ceiling (dBTP)">
                        <option value="">—</option>
                        {[r.truePeak, ...TRUEPEAK_OPTIONS.filter((o) => o !== r.truePeak)].filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Subtitles">
                      <select value={r.subtitles} onChange={(e) => patch(r.id, { subtitles: e.target.value })} className={cn(sel, "max-w-[13rem]")}>
                        <option value="">—</option>
                        {SUBTITLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                    <input value={r.naming} onChange={(e) => patch(r.id, { naming: e.target.value })} placeholder="Naming convention (optional)…"
                      className="flex-1 min-w-[12rem] bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[10px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target" />
                    <input value={r.qc} onChange={(e) => patch(r.id, { qc: e.target.value })} placeholder="QC (Photon / Baton / platform)…"
                      className="flex-1 min-w-[10rem] bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[10px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target" />
                  </div>

                  {/* This recipient's deliverables — AI brief + itemised punch-list */}
                  <div className="mt-2.5 pt-2.5 border-t border-suite-border/50">
                    <RecipientDeliverables
                      brief={r.brief || ""}
                      items={r.deliverables || []}
                      onBriefChange={(brief) => patch(r.id, { brief })}
                      onItemsChange={(deliverables) => patch(r.id, { deliverables })}
                      autoFocus={focusBriefId === r.id}
                      sharedCount={shared}
                      onRecipientSpec={(p) => patch(r.id, p)}
                      container={r.container}
                      languages={r.languages || []}
                      onLanguagesChange={(languages) => patch(r.id, { languages })}
                      aiLog={r.aiLog || []}
                      onLogChange={(aiLog) => patch(r.id, { aiLog })}
                      documents={r.documents || []}
                      onAttach={(fl) => addFiles(r.id, fl)}
                      onOpenDoc={openFile}
                      onRemoveDoc={(d) => removeFile(r.id, d)}
                    />
                  </div>


                  <div className="mt-2 font-mono text-[9.5px] text-suite-text-dim">{checks.length} variables to confirm{(r.documents || []).length ? ` · ${(r.documents || []).length} doc${(r.documents || []).length === 1 ? "" : "s"} attached` : ""}{r.notes ? ` · ${r.notes}` : ""}</div>
                  </div>
                  )}
                </div>
              );
            })}
            {recipients.length === 0 && (
              <div className="text-center py-12">
                <PackageCheck className="size-7 text-suite-text-dim mx-auto mb-3" strokeWidth={1.4} />
                <p className="font-mono text-[12px] text-suite-text-muted">No recipients yet.</p>
                <p className="mt-1 font-mono text-[10px] text-suite-text-dim">Use <span className="text-guide-source">Build with AI</span> or <span className="text-guide-target">Build from template</span> above.</p>
              </div>
            )}
          </div>

          {/* How-to note */}
          <div className="flex gap-2 rounded-sm border border-guide-target/30 bg-guide-target/5 px-3 py-2">
            <Sparkles className="size-3.5 shrink-0 text-guide-target mt-0.5" strokeWidth={1.6} />
            <p className="font-mono text-[10px] leading-relaxed text-suite-text-dim">
              <span className="text-suite-text-muted">Drop a spec, email or call notes onto any recipient's AI box</span> — it itemises the deliverables and fills the spec dropdowns, which you then verify against the platform's own delivery document. Everything stays on this device. Cloud-drive connect (Drive / Box / OneDrive) is still to come.
            </p>
          </div>

          {/* ───────── Summary, at the bottom: watch-outs + the combined make-once list ───────── */}
          {(plan.watchOuts.length > 0 || rollup.some((g) => g.inScope)) && (
            <div className="mt-1 border-t border-suite-border pt-4 flex flex-col gap-2.5">
              {plan.watchOuts.length > 0 && (
                <div className="rounded-sm border border-status-warn/30 bg-status-warn/5 px-3 py-2">
                  <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-status-warn mb-1">⚠ Watch-outs</div>
                  <ul className="flex flex-col gap-0.5">
                    {plan.watchOuts.map((w) => <li key={w} className="font-mono text-[10px] text-suite-text-muted leading-relaxed flex gap-1.5"><span className="text-status-warn">!</span>{w}</li>)}
                  </ul>
                </div>
              )}
              <ProductionList groups={rollup} suggestions={linkSugg} onLink={linkArtifact} onUnlink={unlinkArt} />
            </div>
          )}
        </div>
        </div>
        <div onMouseDown={startResize} title="Drag to resize" className="hidden lg:block w-1.5 shrink-0 cursor-col-resize bg-suite-border hover:bg-guide-target/60 transition-colors" />
        <aside style={{ width: chartW }} className="hidden lg:flex shrink-0 flex-col bg-suite-canvas">
          <div className="shrink-0 flex items-center gap-2 px-3.5 py-2.5 border-b border-suite-border">
            <GitBranch className="size-3.5 text-guide-target" strokeWidth={1.7} />
            <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-suite-text font-semibold">Workflow</span>
            <span className="font-mono text-[10px] text-suite-text-dim ml-auto hidden xl:inline">drag to arrange</span>
            <button onClick={resetLayout} title="Reset the node layout" className="font-mono text-[9px] uppercase tracking-[0.1em] text-suite-text-dim hover:text-suite-text border border-suite-border rounded-sm px-1.5 py-0.5">Reset layout</button>
          </div>
          <div className="flex-1 min-h-0">
            <Suspense fallback={<div className="h-full grid place-items-center font-mono text-[10px] text-suite-text-dim">Loading chart…</div>}>
              <DeliverablesFlow key={flowKey} graph={graph} projectId={projectId} />
            </Suspense>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-suite-text-dim">{label}</span>
      {children}
    </label>
  );
}



// Re-seed helper — the three starter rows from the brief (all editable).
function loadRecipientsSeed(): Recipient[] {
  return [
    { ...newRecipient("Paramount+ USA"), region: "US", dr: "dolby-vision", peakNits: 1000, resolution: "UHD 3840×2160", fps: 23.976, container: "IMF App 2E", audio: "5.1.4 Atmos", loudness: "-24 LKFS (ATSC A/85)", subtitles: "Sidecar (IMSC/TTML)", textless: true, qc: "Photon + platform", notes: "Example — confirm against the real Paramount+ delivery spec." },
    { ...newRecipient("TVNZ"), region: "NZ", dr: "sdr", resolution: "1080p 1920×1080", fps: 25, container: "ProRes 422 HQ", audio: "5.1", loudness: "-24 LKFS", subtitles: "Closed captions (CEA-608/708)", textless: true, notes: "Example — confirm against the real TVNZ delivery spec." },
    { ...newRecipient("ABC Sydney"), region: "AU", dr: "sdr", resolution: "1080p 1920×1080", fps: 25, container: "AS-11 DPP", audio: "5.1", loudness: "-24 LKFS (Free TV OP-59)", subtitles: "Closed captions (CEA-608/708)", textless: true, notes: "Example — confirm against the real ABC delivery spec." },
  ];
}
