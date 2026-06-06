import { useEffect, useMemo, useState } from "react";
import {
  PackageCheck, Plus, Trash2, AlertTriangle, ListChecks, Crown, ArrowDownToLine, Flame, Sparkles, Send,
  Paperclip, FileText, GitBranch, Cloud, X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { putFile, getFile, delFile } from "@/lib/fileStore";
import {
  loadRecipients, saveRecipients, newRecipient, buildPlan, recipientChecklist, sendToBoard,
  commitToWorkflow, hasCustomWorkflow,
  REGIONS, DR_OPTIONS, NITS_OPTIONS, RESOLUTION_OPTIONS, FPS_OPTIONS, CONTAINER_OPTIONS,
  AUDIO_OPTIONS, SUBTITLE_OPTIONS, LOUDNESS_OPTIONS, LOUDNESS_BY_REGION, isHdr,
  type Recipient, type Region, type DRId, type Pass, type DocMeta,
} from "@/lib/deliverables";

export function Deliverables({ projectName, projectId, onCommitToWorkflow }: { projectName?: string; projectId?: string; onCommitToWorkflow?: () => void }) {
  const [recipients, setRecipients] = useState<Recipient[]>(() => loadRecipients(projectId));
  useEffect(() => { saveRecipients(projectId, recipients); }, [recipients, projectId]);

  const plan = useMemo(() => buildPlan(recipients), [recipients]);

  const patch = (id: string, p: Partial<Recipient>) => setRecipients((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const changeRegion = (id: string, region: Region) => patch(id, { region, loudness: LOUDNESS_BY_REGION[region] || "" });
  const add = () => setRecipients((rs) => [...rs, newRecipient(`Recipient ${rs.length + 1}`)]);
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

  const commit = () => {
    if (!recipients.length) { toast("Add a recipient first."); return; }
    if (hasCustomWorkflow(projectId) && !window.confirm("This replaces your current Custom Workflow with the delivery plan. Your saved workflow versions are kept. Continue?")) return;
    commitToWorkflow(projectId, recipients, plan);
    toast.success("Committed to the Custom Workflow", { description: "Opening the builder…" });
    onCommitToWorkflow?.();
  };
  const cloudSoon = (name: string) => toast(`${name} import is coming soon`, { description: "For now add the file directly — cloud connect arrives with the AI ingest." });

  const addFiles = async (recipientId: string, fileList: FileList) => {
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

  const sel = "bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]";

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
          <button onClick={add} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors">
            <Plus className="size-3" strokeWidth={2} /> Recipient
          </button>
          <button onClick={push} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            <Send className="size-3" strokeWidth={1.6} /> To board
          </button>
          <button onClick={commit} title="Fan the plan out into the Custom Workflow builder" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono rounded-sm text-suite-bg bg-guide-target hover:bg-guide-target/90 transition-colors">
            <GitBranch className="size-3" strokeWidth={2} /> Commit → Workflow
          </button>
          <button onClick={reset} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="max-w-5xl mx-auto flex flex-col gap-4">
          {/* Verify banner */}
          <div className="flex gap-2 rounded-sm border border-status-warn/40 bg-status-warn/5 px-3 py-2">
            <AlertTriangle className="size-3.5 shrink-0 text-status-warn mt-0.5" strokeWidth={1.8} />
            <p className="font-mono text-[10px] leading-relaxed text-suite-text-dim">
              A planning aid — the make-order is derived from the dynamic-range rules, but <span className="text-suite-text-muted">every spec here must be confirmed against each recipient's own delivery document</span>. A wrong container or loudness means a rejected master.
            </p>
          </div>

          {/* Make plan */}
          <section className="rounded-md border border-suite-border bg-suite-panel/50 p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <ListChecks className="size-3.5 text-guide-target" strokeWidth={1.7} />
              <h3 className="font-mono text-[11px] tracking-[0.16em] uppercase text-suite-text font-semibold">Make plan</h3>
              <span className="font-mono text-[10px] text-suite-text-dim">— grade once, derive the rest</span>
            </div>
            {plan.passes.length === 0 ? (
              <p className="font-mono text-[11px] text-suite-text-dim">Add a recipient to see the plan.</p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {plan.passes.map((p, i) => <PassRow key={i} index={i} pass={p} />)}
              </ol>
            )}
            {(plan.common.length > 0 || plan.watchOuts.length > 0) && (
              <div className="mt-3 pt-3 border-t border-suite-border/60 grid sm:grid-cols-2 gap-3">
                {plan.common.length > 0 && (
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim mb-1">Shared across all</div>
                    <div className="flex flex-wrap gap-1">
                      {plan.common.map((c) => <span key={c} className="font-mono text-[10px] px-1.5 py-0.5 rounded-full border border-suite-border text-suite-text-muted">{c}</span>)}
                    </div>
                  </div>
                )}
                {plan.watchOuts.length > 0 && (
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-status-warn mb-1">Watch-outs</div>
                    <ul className="flex flex-col gap-1">
                      {plan.watchOuts.map((w) => <li key={w} className="font-mono text-[10px] text-suite-text-muted leading-relaxed flex gap-1.5"><span className="text-status-warn">!</span>{w}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Recipients */}
          <div className="flex flex-col gap-2.5">
            {recipients.map((r) => {
              const checks = recipientChecklist(r);
              return (
                <div key={r.id} className="rounded-md border border-suite-border bg-suite-panel/60 px-3.5 py-3">
                  <div className="flex items-center gap-2 mb-2.5">
                    <input
                      value={r.name}
                      onChange={(e) => patch(r.id, { name: e.target.value })}
                      placeholder="Recipient / platform…"
                      className="flex-1 min-w-0 bg-transparent border-0 border-b border-transparent focus:border-suite-border px-0.5 text-[13px] font-mono text-suite-text font-semibold focus:outline-none"
                    />
                    <select value={r.region} onChange={(e) => changeRegion(r.id, e.target.value as Region)} className={sel} title="Region — sets a default loudness target">
                      {REGIONS.map((rg) => <option key={rg} value={rg}>{rg}</option>)}
                    </select>
                    <button onClick={() => remove(r.id)} title="Remove recipient" className="shrink-0 text-suite-text-dim hover:text-destructive"><Trash2 className="size-3.5" strokeWidth={1.6} /></button>
                  </div>

                  <div className="flex flex-wrap items-end gap-2.5">
                    <Field label="Colour / range">
                      <select value={r.dr} onChange={(e) => patch(r.id, { dr: e.target.value as DRId })} className={sel}>
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
                        {RESOLUTION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="FPS">
                      <select value={r.fps} onChange={(e) => patch(r.id, { fps: parseFloat(e.target.value) })} className={sel}>
                        {FPS_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </Field>
                    <Field label="Container">
                      <select value={r.container} onChange={(e) => patch(r.id, { container: e.target.value })} className={cn(sel, "max-w-[11rem]")}>
                        {CONTAINER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Audio">
                      <select value={r.audio} onChange={(e) => patch(r.id, { audio: e.target.value })} className={sel}>
                        {AUDIO_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Loudness">
                      <select value={r.loudness} onChange={(e) => patch(r.id, { loudness: e.target.value })} className={cn(sel, "max-w-[14rem]")}>
                        {[r.loudness, ...LOUDNESS_OPTIONS.filter((o) => o !== r.loudness)].filter(Boolean).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Subtitles">
                      <select value={r.subtitles} onChange={(e) => patch(r.id, { subtitles: e.target.value })} className={cn(sel, "max-w-[13rem]")}>
                        {SUBTITLE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                    <label className="flex items-center gap-1.5 font-mono text-[10px] text-suite-text-muted pb-1.5 cursor-pointer">
                      <input type="checkbox" checked={r.textless} onChange={(e) => patch(r.id, { textless: e.target.checked })} className="accent-guide-target" />
                      Textless
                    </label>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                    <input value={r.naming} onChange={(e) => patch(r.id, { naming: e.target.value })} placeholder="Naming convention (optional)…"
                      className="flex-1 min-w-[12rem] bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[10px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target" />
                    <input value={r.qc} onChange={(e) => patch(r.id, { qc: e.target.value })} placeholder="QC (Photon / Baton / platform)…"
                      className="flex-1 min-w-[10rem] bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[10px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target" />
                  </div>

                  {/* Attachments — source docs for this recipient */}
                  <div className="mt-2.5 pt-2.5 border-t border-suite-border/50">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-suite-text-dim mr-0.5">Source docs</span>
                      <label className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-suite-border text-suite-text-dim hover:text-suite-text hover:border-suite-border-strong cursor-pointer font-mono text-[9.5px]">
                        <Paperclip className="size-3" strokeWidth={1.7} /> Add file
                        <input type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) addFiles(r.id, e.target.files); e.target.value = ""; }} />
                      </label>
                      <CloudBtn label="Drive" onClick={() => cloudSoon("Google Drive")} />
                      <CloudBtn label="Box" onClick={() => cloudSoon("Box")} />
                      <CloudBtn label="OneDrive" onClick={() => cloudSoon("OneDrive")} />
                    </div>
                    {(r.documents || []).length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        {(r.documents || []).map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 font-mono text-[10px]">
                            <FileText className="size-3 text-suite-text-dim shrink-0" strokeWidth={1.6} />
                            <button onClick={() => openFile(doc)} className="truncate text-suite-text-muted hover:text-guide-target text-left">{doc.name}</button>
                            <span className="text-suite-text-dim shrink-0">{fmtSize(doc.size)} · {new Date(doc.addedAt).toLocaleDateString()}</span>
                            <button onClick={() => removeFile(r.id, doc)} title="Remove" className="ml-auto text-suite-text-dim hover:text-destructive shrink-0"><X className="size-3" strokeWidth={2} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 font-mono text-[9.5px] text-suite-text-dim">{checks.length} variables to confirm{(r.documents || []).length ? ` · ${(r.documents || []).length} doc${(r.documents || []).length === 1 ? "" : "s"} attached` : ""}{r.notes ? ` · ${r.notes}` : ""}</div>
                </div>
              );
            })}
            {recipients.length === 0 && (
              <div className="text-center py-12">
                <PackageCheck className="size-7 text-suite-text-dim mx-auto mb-3" strokeWidth={1.4} />
                <p className="font-mono text-[12px] text-suite-text-muted">No recipients yet.</p>
                <button onClick={add} className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border font-mono text-[10px] uppercase tracking-[0.1em] text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20">
                  <Plus className="size-3.5" strokeWidth={2} /> Add a recipient
                </button>
              </div>
            )}
          </div>

          {/* Phase-1 note */}
          <div className="flex gap-2 rounded-sm border border-guide-target/30 bg-guide-target/5 px-3 py-2">
            <Sparkles className="size-3.5 shrink-0 text-guide-target mt-0.5" strokeWidth={1.6} />
            <p className="font-mono text-[10px] leading-relaxed text-suite-text-dim">
              Attach the contract / spec / email to a recipient — it's stored on this device. <span className="text-suite-text-muted">Coming next: an AI reads those docs and pre-fills each recipient</span> with the source line beside every field so you verify it. Cloud-drive connect (Drive / Box / OneDrive) lands then too.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const PASS_META = {
  hero: { icon: Crown, color: "#f59e0b", tag: "GRADE" },
  derive: { icon: ArrowDownToLine, color: "#34d399", tag: "DERIVE" },
  regrade: { icon: Flame, color: "#f87171", tag: "RE-GRADE" },
} as const;

function PassRow({ index, pass }: { index: number; pass: Pass }) {
  const m = PASS_META[pass.kind];
  return (
    <li className="flex items-start gap-2.5 rounded-sm border border-suite-border bg-suite-bg/50 px-2.5 py-2">
      <span className="mt-0.5 font-mono text-[10px] text-suite-text-dim tabular w-4 shrink-0">{index + 1}</span>
      <m.icon className="size-3.5 mt-0.5 shrink-0" strokeWidth={1.7} style={{ color: m.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[12px] text-suite-text font-semibold">{pass.label}</span>
          <span className="font-mono text-[8px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full border" style={{ color: m.color, borderColor: m.color + "66" }}>{m.tag}</span>
          {pass.flag && <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-status-warn">fresh pass</span>}
        </div>
        {pass.note && <p className="font-mono text-[10px] text-suite-text-muted leading-relaxed mt-0.5">{pass.note}</p>}
        {pass.covers.length > 0 && <p className="font-mono text-[9.5px] text-suite-text-dim mt-0.5">covers: {pass.covers.join(" · ")}</p>}
      </div>
    </li>
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

const fmtSize = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${Math.round(b / 1e3)} KB` : `${b} B`);

function CloudBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={`${label} — coming soon`} className="inline-flex items-center gap-1 px-2 py-1 rounded-sm border border-dashed border-suite-border text-suite-text-dim hover:text-suite-text font-mono text-[9.5px]">
      <Cloud className="size-3" strokeWidth={1.6} /> {label}
    </button>
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
