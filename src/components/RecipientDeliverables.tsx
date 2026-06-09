import { useEffect, useRef, useState } from "react";
import { Sparkles, Paperclip, Trash2, Plus, Check, X, Languages, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CATEGORIES, OWNERS, STATUSES, newItem, buildDeliverablesList, newLanguage, languageItems,
  type DeliverableItem, type DelivCategory, type DeliveryLanguage, type LangKind, type DelivStatus,
} from "@/lib/deliverablesList";

const statusClass = (s?: DelivStatus) =>
  s === "delivered" ? "text-emerald-400 border-emerald-400/40"
  : s === "qc-fail" ? "text-destructive border-destructive/50"
  : s === "redeliver" ? "text-status-warn border-status-warn/50"
  : s === "wip" ? "text-guide-source border-guide-source/40"
  : "text-suite-text-dim border-suite-border";
import { specOptions, coerceRecipientSpec, type Recipient } from "@/lib/deliverables";

/** A recipient's own deliverables punch-list. Controlled: operates on the recipient's
 *  brief + items (persisted by the parent). The AI brief box + document uploader build
 *  or grow the list; everything is also editable by hand. Used inside each recipient. */

export function RecipientDeliverables({ brief, items, onBriefChange, onItemsChange, autoFocus, sharedCount, onRecipientSpec, languages, onLanguagesChange }: {
  brief: string;
  items: DeliverableItem[];
  onBriefChange: (s: string) => void;
  onItemsChange: (items: DeliverableItem[]) => void;
  autoFocus?: boolean;
  sharedCount?: Map<string, number>;
  onRecipientSpec?: (patch: Partial<Recipient>) => void;
  languages?: DeliveryLanguage[];
  onLanguagesChange?: (langs: DeliveryLanguage[]) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [building, setBuilding] = useState(false);
  const [addCat, setAddCat] = useState<DelivCategory>("picture");
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const briefRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (autoFocus) briefRef.current?.focus(); }, [autoFocus]);

  const setItem = (id: string, patch: Partial<DeliverableItem>) => onItemsChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => onItemsChange(items.filter((i) => i.id !== id));
  const addItem = (category: DelivCategory) => onItemsChange([...items, newItem(category)]);
  const attach = (list: FileList | null) => { if (list && list.length) setFiles((f) => [...f, ...Array.from(list)]); };

  const build = async () => {
    if (!brief.trim() && files.length === 0) { toast("Add a brief or attach a document first"); return; }
    setBuilding(true);
    try {
      const wasEmpty = items.length === 0;
      const { items: built, recipientRaw } = await buildDeliverablesList(brief, files, items, specOptions());
      setFiles([]);
      let specFilled = false;
      if (wasEmpty && recipientRaw && onRecipientSpec) {
        const patch = coerceRecipientSpec(recipientRaw);
        if (Object.keys(patch).length) { onRecipientSpec(patch); specFilled = true; }
      }
      if (built.length > 0) onItemsChange([...items, ...built]);
      if (built.length === 0 && !specFilled) {
        toast(items.length ? "Nothing new to add — the list already covers it" : "Couldn’t itemise that — try a clearer brief");
        return;
      }
      const out = built.filter((i) => !i.inScope).length;
      const head = built.length ? `${items.length ? "Added" : "Built"} ${built.length} item${built.length === 1 ? "" : "s"}` : "Filled the spec";
      toast.success(`${head}${specFilled && built.length ? " + filled the spec" : ""}`, { description: out ? `${out} flagged out of post's scope · verify each.` : "Verify the spec and each item." });
    } catch (e) {
      toast.error("Couldn’t build the list", { description: e instanceof Error ? e.message : "AI request failed." });
    } finally {
      setBuilding(false);
    }
  };

  const langs = languages || [];
  const dedupKey = (i: { label: string; category: string }) => `${i.category}|${i.label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}`;
  const addLangDeliverables = () => {
    if (!langs.length) { toast("Add a language first"); return; }
    const seen = new Set(items.map(dedupKey));
    const fresh = languageItems(langs).filter((it) => { const k = dedupKey(it); if (seen.has(k)) return false; seen.add(k); return true; });
    if (!fresh.length) { toast("Those language deliverables are already on the list"); return; }
    onItemsChange([...items, ...fresh]);
    toast.success(`Added ${fresh.length} language deliverable${fresh.length === 1 ? "" : "s"} — edit owners / notes as needed`);
  };

  const inScope = items.filter((i) => i.inScope).length;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-suite-text-muted">Deliverables</span>
        {items.length > 0 && <span className="font-mono text-[9px] text-suite-text-dim">· {inScope} in scope · {items.length - inScope} not yours</span>}
        {items.length > 0 && <button onClick={() => { if (window.confirm("Clear this recipient’s deliverables list?")) onItemsChange([]); }} title="Clear this list to rebuild it" className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-suite-text-dim hover:text-destructive transition-colors">Clear</button>}
      </div>

      {/* AI brief — describe / drop docs → build or grow */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!dragActive) setDragActive(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragActive(false); }}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); attach(e.dataTransfer?.files ?? null); }}
        className={cn("relative rounded-sm border bg-suite-bg/40 p-2.5 flex flex-col gap-2 transition-colors", dragActive ? "border-guide-source border-dashed bg-guide-source/5" : "border-suite-border")}>
        {dragActive && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-sm bg-suite-panel/85 backdrop-blur-sm pointer-events-none">
            <span className="font-mono text-[11px] text-guide-source flex items-center gap-1.5"><Paperclip className="size-3.5" strokeWidth={1.6} /> Drop documents to attach</span>
          </div>
        )}
        <textarea ref={briefRef} value={brief} onChange={(e) => onBriefChange(e.target.value)} rows={5}
          placeholder="Describe what this recipient needs — paste the email / call notes / a delivery clause…"
          className="w-full resize-y bg-transparent text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none leading-relaxed" />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border border-suite-border bg-suite-panel font-mono text-[9.5px] text-suite-text-muted">
                <Paperclip className="size-2.5" strokeWidth={1.6} /> <span className="truncate max-w-[16ch]">{f.name}</span>
                <button onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} className="text-suite-text-dim hover:text-destructive"><X className="size-2.5" strokeWidth={2} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-2 py-1 text-[9.5px] tracking-[0.12em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            <Paperclip className="size-3" strokeWidth={1.6} /> Attach docs
          </button>
          <input ref={fileRef} type="file" multiple
            accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,image/png,image/jpeg,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden" onChange={(e) => { attach(e.target.files); e.currentTarget.value = ""; }} />
          <button onClick={build} disabled={building} className="flex items-center gap-1.5 px-2.5 py-1 text-[9.5px] tracking-[0.12em] uppercase font-mono border rounded-sm text-guide-source border-guide-source/50 bg-guide-source/10 hover:bg-guide-source/20 disabled:opacity-50 transition-colors">
            <Sparkles className={cn("size-3", building && "animate-pulse")} strokeWidth={2} /> {building ? "Working…" : items.length ? "Grow with AI" : "Build with AI"}
          </button>
          <span className="font-mono text-[9px] text-suite-text-dim">Drag &amp; drop or attach — PDF, Word, Excel, images, text.</span>
        </div>
      </div>

      {/* Language / version matrix — fans out to dub mixes, dub cards, subs/SDH/forced per language */}
      {onLanguagesChange && (
        <details className="rounded-sm border border-suite-border bg-suite-bg/40 group">
          <summary className="cursor-pointer list-none flex items-center gap-2 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-muted hover:text-suite-text select-none">
            <Languages className="size-3" strokeWidth={1.7} /> Languages / versions
            {langs.length > 0 && <span className="text-suite-text-dim normal-case tracking-normal">· {langs.length}</span>}
            <ChevronRight className="ml-auto size-3 transition-transform group-open:rotate-90 text-suite-text-dim" strokeWidth={2} />
          </summary>
          <div className="px-2.5 pb-2.5 flex flex-col gap-1.5">
            {langs.length === 0 && <p className="font-mono text-[9px] text-suite-text-dim">Add the OV + each dub/sub language; “Add deliverables for these” fans them into dub mixes, dub cards, subs, SDH and forced narratives.</p>}
            {langs.map((l, i) => (
              <LangRow key={i} lang={l}
                onChange={(p) => onLanguagesChange(langs.map((x, j) => (j === i ? { ...x, ...p } : x)))}
                onRemove={() => onLanguagesChange(langs.filter((_, j) => j !== i))} />
            ))}
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              <button onClick={() => onLanguagesChange([...langs, langs.length === 0 ? { ...newLanguage("EN"), kind: "OV" as LangKind } : newLanguage()])} className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-[0.12em] font-mono border border-dashed border-suite-border rounded-sm text-suite-text-dim hover:text-suite-text hover:border-suite-border-strong">
                <Plus className="size-2.5" strokeWidth={2} /> language
              </button>
              {langs.length > 0 && (
                <button onClick={addLangDeliverables} className="px-2 py-1 text-[9px] uppercase tracking-[0.12em] font-mono border rounded-sm text-guide-source border-guide-source/50 bg-guide-source/10 hover:bg-guide-source/20">
                  Add deliverables for these
                </button>
              )}
            </div>
          </div>
        </details>
      )}

      {/* The itemised list, grouped by category */}
      {items.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {CATEGORIES.map((cat) => {
            const catItems = items.filter((i) => i.category === cat.id);
            if (catItems.length === 0) return null;
            return (
              <div key={cat.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-muted">{cat.label}</span>
                  <span className="font-mono text-[9px] text-suite-text-dim">· {catItems.length}</span>
                  <div className="flex-1 h-px bg-suite-border/60" />
                  <button onClick={() => addItem(cat.id)} title={`Add a ${cat.label} item`} className="text-suite-text-dim hover:text-suite-text"><Plus className="size-3" strokeWidth={2} /></button>
                </div>
                {catItems.map((it) => <ItemRow key={it.id} item={it} shared={sharedCount?.get(it.id)} onChange={(p) => setItem(it.id, p)} onRemove={() => removeItem(it.id)} />)}
              </div>
            );
          })}
        </div>
      )}

      {/* Add an item by hand */}
      <div className="flex items-center gap-2">
        <button onClick={() => addItem(addCat)} className="flex items-center gap-1.5 px-2 py-1 text-[9.5px] tracking-[0.12em] uppercase font-mono border border-dashed border-suite-border rounded-sm text-suite-text-dim hover:text-suite-text hover:border-suite-border-strong">
          <Plus className="size-3" strokeWidth={2} /> Add item
        </button>
        <select value={addCat} onChange={(e) => setAddCat(e.target.value as DelivCategory)}
          className="bg-suite-bg border border-suite-border rounded-sm px-1.5 py-1 text-[10px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]" title="Category for the next added item">
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
    </div>
  );
}

function ItemRow({ item, shared, onChange, onRemove }: { item: DeliverableItem; shared?: number; onChange: (patch: Partial<DeliverableItem>) => void; onRemove: () => void }) {
  return (
    <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-sm border", item.inScope ? "border-suite-border bg-suite-bg/40" : "border-suite-border/40 bg-transparent")}>
      <button onClick={() => onChange({ inScope: !item.inScope })}
        title={item.inScope ? "In your scope — click to mark “not my issue”" : "Not your issue — click to claim it"}
        className={cn("shrink-0 size-3.5 rounded-[3px] border grid place-items-center transition-colors", item.inScope ? "bg-guide-target/15 border-guide-target text-guide-target" : "border-suite-text-dim text-transparent")}>
        {item.inScope ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </button>
      <input value={item.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Deliverable…"
        className={cn("flex-[2] min-w-0 bg-transparent text-[11px] font-mono focus:outline-none", item.inScope ? "text-suite-text" : "text-suite-text-dim line-through")} />
      {shared && shared > 1 && (
        <span title={`Same artifact as ${shared - 1} other recipient${shared - 1 === 1 ? "" : "s"} — produced once, not a separate make`}
          className="shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] px-1 py-0.5 rounded-full border border-guide-target/40 text-guide-target/90">shared ×{shared}</span>
      )}
      {(item.version || 1) > 1 && <span className="shrink-0 font-mono text-[8px] text-status-warn" title="Redelivery version">v{item.version}</span>}
      <select value={item.owner} onChange={(e) => onChange({ owner: e.target.value as DeliverableItem["owner"] })}
        title="Owner" className="shrink-0 bg-suite-bg border border-suite-border rounded-sm px-1 py-0.5 text-[9px] font-mono text-suite-text-muted focus:outline-none focus:border-guide-target [color-scheme:dark]">
        {OWNERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <select value={item.status || "todo"} title="Delivery / QC status — Redeliver bumps the version"
        onChange={(e) => { const v = e.target.value as DelivStatus; onChange({ status: v, ...(v === "redeliver" && item.status !== "redeliver" ? { version: (item.version || 1) + 1 } : {}) }); }}
        className={cn("shrink-0 bg-suite-bg border rounded-sm px-1 py-0.5 text-[9px] font-mono focus:outline-none [color-scheme:dark]", statusClass(item.status))}>
        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <input value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="notes…"
        className="flex-1 min-w-0 bg-transparent text-[10px] font-mono text-suite-text-muted placeholder:text-suite-text-dim focus:outline-none" />
      <button onClick={onRemove} title="Remove" className="shrink-0 text-suite-text-dim hover:text-destructive"><Trash2 className="size-3" strokeWidth={1.6} /></button>
    </div>
  );
}

function LangToggle({ on, label, onClick, title }: { on: boolean; label: string; onClick: () => void; title?: string }) {
  return <button onClick={onClick} title={title} className={cn("px-1.5 py-0.5 rounded-sm border font-mono text-[8.5px] uppercase tracking-[0.1em] transition-colors", on ? "text-guide-target border-guide-target/50 bg-guide-target/10" : "text-suite-text-dim border-suite-border hover:text-suite-text")}>{label}</button>;
}

function LangRow({ lang, onChange, onRemove }: { lang: DeliveryLanguage; onChange: (p: Partial<DeliveryLanguage>) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <input value={lang.code} onChange={(e) => onChange({ code: e.target.value })} placeholder="EN / ES-419…"
        className="w-[9ch] bg-suite-bg border border-suite-border rounded-sm px-1.5 py-0.5 text-[10px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target" />
      <select value={lang.kind} onChange={(e) => onChange({ kind: e.target.value as LangKind })}
        title="Original Version vs Versioned (dub / localised)" className="bg-suite-bg border border-suite-border rounded-sm px-1 py-0.5 text-[9px] font-mono text-suite-text-muted focus:outline-none [color-scheme:dark]">
        <option value="OV">OV</option>
        <option value="VF">VF</option>
      </select>
      <LangToggle on={lang.dub} label="dub" title="Dub mix required (vs subtitle-only)" onClick={() => onChange({ dub: !lang.dub })} />
      <LangToggle on={lang.sdh} label="SDH" title="SDH (deaf/HoH) subtitles required" onClick={() => onChange({ sdh: !lang.sdh })} />
      <LangToggle on={lang.forced} label="forced" title="Forced narratives (foreign dialogue / signage)" onClick={() => onChange({ forced: !lang.forced })} />
      <button onClick={onRemove} title="Remove language" className="ml-auto text-suite-text-dim hover:text-destructive"><X className="size-3" strokeWidth={2} /></button>
    </div>
  );
}
