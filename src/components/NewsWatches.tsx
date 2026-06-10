import { useMemo, useState } from "react";
import {
  Newspaper, Plus, Bell, Rss, Trash2, Pencil, RefreshCw, X, ChevronRight,
  Mail, Calendar, Check, ExternalLink, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listWatches, saveWatch, deleteWatch, toggleWatch, markWatchRun,
  listDigests, addDigest, clearDigests, buildSampleDigest, digestFromResult,
  planFromPrompt, REGION_PRESETS, regionLabel,
  type Watch, type Cadence, type Delivery, type Digest,
} from "@/lib/watches";
import { fetchNewsDigest } from "@/lib/newsDigest";

const CADENCES: { id: Cadence; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
];
const DELIVERIES: { id: Delivery; label: string; icon: typeof Mail }[] = [
  { id: "both", label: "Email + feed", icon: Bell },
  { id: "email", label: "Email only", icon: Mail },
  { id: "feed", label: "In-app feed", icon: Rss },
];

const domainOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

export function NewsWatches() {
  const [view, setView] = useState<"watches" | "feed">("watches");
  const [watches, setWatches] = useState<Watch[]>(() => listWatches());
  const [digests, setDigests] = useState<Digest[]>(() => listDigests());
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<Watch | null>(null);
  const [running, setRunning] = useState<Set<string>>(new Set());

  const refreshWatches = () => setWatches(listWatches());
  const refreshDigests = () => setDigests(listDigests());

  const openNew = () => { setEditing(null); setComposing(true); };
  const openEdit = (w: Watch) => { setEditing(w); setComposing(true); };

  const onSaved = () => { setComposing(false); setEditing(null); refreshWatches(); };

  const setBusy = (id: string, on: boolean) =>
    setRunning((s) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; });

  // Run a watch for real: search the web via /api/news-digest. If the live service is
  // unreachable (e.g. local dev), fall back to the clearly-flagged sample so the UI still works.
  const runWatch = async (w: Watch, opts: { silent?: boolean } = {}) => {
    if (running.has(w.id)) return;
    setBusy(w.id, true);
    try {
      const result = await fetchNewsDigest(w);
      addDigest(digestFromResult(w, result));
      markWatchRun(w.id);
      refreshWatches();
      refreshDigests();
      if (!opts.silent) {
        setView("feed");
        if (result.noResults) toast("Nothing fresh right now", { description: `No new reporting on “${w.topic}”. Try again later or widen the topic.` });
        else toast.success("Digest ready", { description: `${result.items.length} item${result.items.length === 1 ? "" : "s"} for “${w.topic}”.` });
      }
    } catch (e) {
      // Offline / not-deployed fallback — sample digest, clearly labelled.
      addDigest(buildSampleDigest(w));
      refreshDigests();
      if (!opts.silent) {
        setView("feed");
        toast("Showing a sample digest", { description: (e as Error).message || "Live news runs on the deployed site." });
      }
    } finally {
      setBusy(w.id, false);
    }
  };

  const runAll = async () => {
    const active = watches.filter((w) => w.enabled);
    if (!active.length) { toast("No active watches to refresh."); return; }
    toast(`Refreshing ${active.length} watch${active.length === 1 ? "" : "es"}…`);
    for (const w of active) await runWatch(w, { silent: true });
    setView("feed");
    refreshDigests();
    toast.success("All watches refreshed.");
  };

  const remove = (w: Watch) => { deleteWatch(w.id); refreshWatches(); toast("Watch deleted."); };

  const onToggle = (w: Watch) => { toggleWatch(w.id, !w.enabled); refreshWatches(); };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Newspaper className="size-4 text-guide-target" strokeWidth={1.6} />
            <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">News Watches</span>
            <span className="font-mono text-[10px] text-suite-text-dim tabular">{watches.length}</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <Seg active={view === "watches"} onClick={() => setView("watches")} icon={Bell} label="My watches" count={watches.length} />
            <Seg active={view === "feed"} onClick={() => setView("feed")} icon={Rss} label="Feed" count={digests.length} />
            {watches.some((w) => w.enabled) && (
              <button
                onClick={runAll}
                disabled={running.size > 0}
                title="Fetch a fresh digest for every active watch"
                className="ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border font-mono text-[10px] tracking-[0.1em] uppercase text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("size-3.5", running.size > 0 && "animate-spin")} strokeWidth={2} /> Refresh all
              </button>
            )}
            <button
              onClick={openNew}
              className="ml-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border font-mono text-[10px] tracking-[0.1em] uppercase text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors"
            >
              <Plus className="size-3.5" strokeWidth={2} /> New watch
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="max-w-3xl mx-auto">
          {/* Status note */}
          <div className="flex gap-2 rounded-sm border border-suite-border bg-suite-bg/60 px-3 py-2 mb-4">
            <Sparkles className="size-3.5 shrink-0 text-guide-target mt-0.5" strokeWidth={1.8} />
            <p className="font-mono text-[10px] leading-relaxed text-suite-text-dim">
              Hit <span className="text-suite-text-muted">Refresh</span> on any watch for a live, web-searched digest in your feed.
              Watches save on this device. <span className="text-suite-text-muted">Automatic scheduled runs and emailed summaries</span>{" "}
              aren’t switched on yet — for now you pull a digest whenever you want one.
            </p>
          </div>

          {view === "watches"
            ? (watches.length === 0
                ? <Empty onNew={openNew} />
                : <div className="flex flex-col gap-2.5">{watches.map((w) => (
                    <WatchCard key={w.id} w={w} busy={running.has(w.id)} onRun={() => runWatch(w)} onEdit={() => openEdit(w)} onDelete={() => remove(w)} onToggle={() => onToggle(w)} />
                  ))}</div>)
            : <Feed digests={digests} onClear={() => { clearDigests(); refreshDigests(); }} onNew={openNew} />}
        </div>
      </div>

      {composing && (
        <Composer
          initial={editing}
          onClose={() => { setComposing(false); setEditing(null); }}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// ---- Watch card ----
function WatchCard({ w, busy, onRun, onEdit, onDelete, onToggle }: {
  w: Watch; busy: boolean; onRun: () => void; onEdit: () => void; onDelete: () => void; onToggle: () => void;
}) {
  const where = w.regions.length ? w.regions.map(regionLabel).join(" · ") : "Worldwide";
  const deliv = DELIVERIES.find((d) => d.id === w.delivery)!;
  return (
    <div className={cn("rounded-md border bg-suite-panel/60 px-3.5 py-3 transition-colors", w.enabled ? "border-suite-border" : "border-suite-border/50 opacity-60")}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          title={w.enabled ? "Watching — click to pause" : "Paused — click to resume"}
          className={cn("mt-0.5 shrink-0 grid place-items-center size-5 rounded-full border transition-colors", w.enabled ? "border-guide-target/60 bg-guide-target/15 text-guide-target" : "border-suite-border text-suite-text-dim")}
        >
          {w.enabled ? <Check className="size-3" strokeWidth={2.5} /> : <span className="size-1.5 rounded-full bg-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[13px] text-suite-text font-semibold leading-snug">{w.topic}</div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {(w.regions.length ? w.regions : ["Global"]).map((r) => (
              <span key={r} className="font-mono text-[8.5px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full border border-guide-target/40 text-guide-target">{regionLabel(r)}</span>
            ))}
            <span className="font-mono text-[9.5px] text-suite-text-dim inline-flex items-center gap-1"><Calendar className="size-2.5" strokeWidth={1.8} />{w.cadence}</span>
            <span className="font-mono text-[9.5px] text-suite-text-dim inline-flex items-center gap-1"><deliv.icon className="size-2.5" strokeWidth={1.8} />{deliv.label}</span>
          </div>
          {w.keywords.length > 0 && (
            <div className="mt-1 font-mono text-[10px] text-suite-text-dim">also tracking: {w.keywords.join(", ")}</div>
          )}
          {w.lastRunAt && (
            <div className="mt-1 font-mono text-[9px] text-suite-text-dim">last refreshed {new Date(w.lastRunAt).toLocaleString()}</div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            title="Refresh now — fetch a live digest"
            onClick={onRun}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-2 h-7 rounded-sm border font-mono text-[9.5px] tracking-[0.08em] uppercase text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors disabled:opacity-60"
          >
            {busy
              ? <><Loader2 className="size-3.5 animate-spin" strokeWidth={1.8} /> Checking…</>
              : <><RefreshCw className="size-3.5" strokeWidth={1.8} /> Refresh</>}
          </button>
          <IconBtn title="Edit watch" onClick={onEdit}><Pencil className="size-3.5" strokeWidth={1.8} /></IconBtn>
          <IconBtn title="Delete watch" onClick={onDelete}><Trash2 className="size-3.5" strokeWidth={1.8} /></IconBtn>
        </div>
      </div>
    </div>
  );
}

// ---- Feed ----
function Feed({ digests, onClear, onNew }: { digests: Digest[]; onClear: () => void; onNew: () => void }) {
  if (digests.length === 0) {
    return (
      <div className="text-center py-16">
        <Rss className="size-7 text-suite-text-dim mx-auto mb-3" strokeWidth={1.4} />
        <p className="font-mono text-[12px] text-suite-text-muted">No digests yet.</p>
        <p className="font-mono text-[10px] text-suite-text-dim mt-1">Open a watch and hit <span className="text-suite-text-muted">Preview</span> to see a sample here, or <button onClick={onNew} className="text-guide-target underline">create a watch</button>.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex justify-end mb-2">
        <button onClick={onClear} className="font-mono text-[10px] text-suite-text-dim hover:text-status-warn inline-flex items-center gap-1"><Trash2 className="size-3" strokeWidth={1.8} /> Clear feed</button>
      </div>
      <div className="flex flex-col gap-3">
        {digests.map((d) => (
          <article key={d.id} className="rounded-md border border-suite-border bg-suite-panel/60 px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="font-mono text-[12px] text-suite-text font-semibold">{d.watchTopic}</span>
              {d.sample && <span className="font-mono text-[8px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full bg-status-warn/15 text-status-warn border border-status-warn/30">Sample</span>}
              <span className="font-mono text-[9.5px] text-suite-text-dim ml-auto">{new Date(d.createdAt).toLocaleString()}</span>
            </div>
            <p className="font-mono text-[11.5px] leading-relaxed text-suite-text-muted mb-2.5">{d.tldr}</p>
            <div className="flex flex-col divide-y divide-suite-border/40">
              {d.items.map((it, i) => (
                <a key={i} href={it.url} target="_blank" rel="noopener noreferrer"
                  className={cn("group flex items-start gap-2 py-1.5", it.url === "#" && "pointer-events-none")}>
                  <ChevronRight className="size-3 mt-0.5 shrink-0 text-suite-text-dim group-hover:text-guide-target" strokeWidth={2} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[11px] text-suite-text group-hover:text-guide-target leading-snug">{it.title}</div>
                    <div className="font-mono text-[9.5px] text-suite-text-dim inline-flex items-center gap-1">
                      {it.source}{it.url !== "#" && <>· {domainOf(it.url)} <ExternalLink className="size-2.5" strokeWidth={1.8} /></>}{it.date ? ` · ${it.date}` : ""}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

// ---- Composer (plain-English → clarify → save) ----
function Composer({ initial, onClose, onSaved }: { initial: Watch | null; onClose: () => void; onSaved: () => void }) {
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
  const [raw, setRaw] = useState(initial?.topic ?? "");
  const [topic, setTopic] = useState(initial?.topic ?? "");
  const [regions, setRegions] = useState<string[]>(initial?.regions ?? []);
  const [needsRegion, setNeedsRegion] = useState(false);
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join(", "));
  const [cadence, setCadence] = useState<Cadence>(initial?.cadence ?? "weekly");
  const [delivery, setDelivery] = useState<Delivery>(initial?.delivery ?? "both");
  const [customRegion, setCustomRegion] = useState("");

  const allRegionIds = useMemo(() => {
    const ids = REGION_PRESETS.map((r) => r.id);
    for (const r of regions) if (!ids.includes(r)) ids.push(r);
    return ids;
  }, [regions]);

  const toClarify = () => {
    const plan = planFromPrompt(raw);
    if (!plan.topic) { toast.error("Tell me what to watch first."); return; }
    setTopic(plan.topic);
    setRegions(plan.regions);
    setNeedsRegion(plan.needsRegion);
    setStep(2);
  };

  const toggleRegion = (id: string) =>
    setRegions((rs) => (rs.includes(id) ? rs.filter((x) => x !== id) : [...rs, id]));

  const addCustomRegion = () => {
    const v = customRegion.trim();
    if (!v) return;
    if (!regions.includes(v)) setRegions((rs) => [...rs, v]);
    setCustomRegion("");
  };

  const save = () => {
    if (!topic.trim()) { toast.error("A topic is required."); return; }
    saveWatch({
      id: initial?.id,
      createdAt: initial?.createdAt,
      topic: topic.trim(),
      regions,
      keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      cadence,
      delivery,
      enabled: initial?.enabled ?? true,
    });
    toast.success(initial ? "Watch updated." : "Watch created.", { description: "Saved on this device." });
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] flex flex-col rounded-lg border border-suite-border-strong bg-suite-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-suite-border">
          <h2 className="font-mono text-xs tracking-[0.18em] uppercase text-suite-text font-semibold inline-flex items-center gap-2">
            <Newspaper className="size-4 text-guide-target" strokeWidth={1.6} />
            {initial ? "Edit watch" : "New watch"}
          </h2>
          <button onClick={onClose} className="text-suite-text-muted hover:text-suite-text"><X className="size-4" strokeWidth={2} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {step === 1 ? (
            <div>
              <label className="block font-mono text-[11px] text-suite-text mb-1.5">What do you want to keep an eye on?</label>
              <p className="font-mono text-[10px] text-suite-text-dim mb-2 leading-relaxed">Plain English. Mention a place if you have one in mind — I'll ask if you don't.</p>
              <textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={3}
                autoFocus
                placeholder={"e.g. News about the new Lord of the Rings film\nor: where the next Outlander season is shooting in the UK"}
                className="w-full bg-suite-bg border border-suite-border rounded-sm px-3 py-2 text-[12px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target resize-y"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["New Lord of the Rings film", "Outlander UK production news", "Avatar sequels — NZ", "What James Cameron is shooting next"].map((ex) => (
                  <button key={ex} onClick={() => setRaw(ex)} className="font-mono text-[9.5px] px-2 py-1 rounded-full border border-suite-border text-suite-text-dim hover:text-suite-text hover:border-suite-border-strong">{ex}</button>
                ))}
              </div>
              <button onClick={toClarify} className="mt-4 w-full px-3 py-2 text-[11px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors inline-flex items-center justify-center gap-2">
                Next <ChevronRight className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* AI-style clarify line */}
              <div className="flex gap-2 rounded-sm border border-guide-target/30 bg-guide-target/5 px-3 py-2">
                <Sparkles className="size-3.5 shrink-0 text-guide-target mt-0.5" strokeWidth={1.6} />
                <p className="font-mono text-[11px] leading-relaxed text-suite-text-muted">
                  Watching <span className="text-suite-text">“{topic}”</span>.{" "}
                  {needsRegion
                    ? "Which part of the world should I track — pick one or more below (or leave as worldwide)."
                    : "I picked up the region(s) below — adjust if needed."}
                </p>
              </div>

              {/* Topic (editable) */}
              <Field label="Topic">
                <input value={topic} onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1.5 text-[12px] font-mono text-suite-text focus:outline-none focus:border-guide-target" />
              </Field>

              {/* Regions */}
              <Field label="Region(s)">
                <div className="flex flex-wrap gap-1.5">
                  {allRegionIds.map((id) => (
                    <Chip key={id} label={regionLabel(id)} active={regions.includes(id)} onClick={() => toggleRegion(id)} />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <input
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomRegion(); } }}
                    placeholder="Add another place (e.g. Atlanta, Ireland)…"
                    className="flex-1 bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1 text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
                  />
                  <button onClick={addCustomRegion} className="px-2 py-1 rounded-sm border border-suite-border text-suite-text-dim hover:text-suite-text"><Plus className="size-3.5" strokeWidth={2} /></button>
                </div>
              </Field>

              {/* Cadence */}
              <Field label="How often">
                <div className="flex gap-1.5">
                  {CADENCES.map((c) => <Chip key={c.id} label={c.label} active={cadence === c.id} onClick={() => setCadence(c.id)} />)}
                </div>
              </Field>

              {/* Delivery */}
              <Field label="Delivery">
                <div className="flex flex-wrap gap-1.5">
                  {DELIVERIES.map((d) => <Chip key={d.id} label={d.label} active={delivery === d.id} onClick={() => setDelivery(d.id)} />)}
                </div>
                {delivery !== "feed" && (
                  <p className="mt-1.5 font-mono text-[9.5px] text-suite-text-dim">Email isn't connected yet — until launch these still appear in your in-app feed.</p>
                )}
              </Field>

              {/* Keywords */}
              <Field label="Sharpen it (optional)">
                <input value={keywords} onChange={(e) => setKeywords(e.target.value)}
                  placeholder="extra terms, comma-separated — cast, studio, director…"
                  className="w-full bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1.5 text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target" />
              </Field>

              <div className="flex items-center gap-2 pt-1">
                {!initial && (
                  <button onClick={() => setStep(1)} className="px-3 py-2 text-[11px] tracking-[0.12em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text">Back</button>
                )}
                <button onClick={save} className="flex-1 px-3 py-2 text-[11px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors inline-flex items-center justify-center gap-2">
                  <Check className="size-3.5" strokeWidth={2} /> {initial ? "Save changes" : "Create watch"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- small UI helpers ----
function Seg({ active, onClick, icon: Icon, label, count }: { active: boolean; onClick: () => void; icon: typeof Bell; label: string; count: number }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border font-mono text-[10px] tracking-[0.08em] uppercase transition-colors",
      active ? "text-suite-text border-suite-border-strong bg-suite-panel-elevated" : "text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg")}>
      <Icon className="size-3.5" strokeWidth={1.8} /> {label}
      <span className="text-suite-text-dim tabular">{count}</span>
    </button>
  );
}
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("px-2.5 py-1 rounded-full border font-mono text-[10px] tracking-[0.04em] transition-colors",
      active ? "text-suite-bg bg-guide-target border-transparent" : "text-suite-text-muted hover:text-suite-text border-suite-border bg-suite-bg")}>
      {label}
    </button>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-suite-text-dim mb-1.5">{label}</div>
      {children}
    </div>
  );
}
function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="grid place-items-center size-7 rounded-sm border border-suite-border text-suite-text-dim hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
      {children}
    </button>
  );
}
function Empty({ onNew }: { onNew: () => void }) {
  return (
    <div className="text-center py-16">
      <Bell className="size-7 text-suite-text-dim mx-auto mb-3" strokeWidth={1.4} />
      <p className="font-mono text-[12px] text-suite-text-muted">No watches yet.</p>
      <p className="font-mono text-[10px] text-suite-text-dim mt-1 mb-4">Track a film, a production, or a region — in plain English.</p>
      <button onClick={onNew} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm border font-mono text-[10px] tracking-[0.1em] uppercase text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20">
        <Plus className="size-3.5" strokeWidth={2} /> Create your first watch
      </button>
    </div>
  );
}
