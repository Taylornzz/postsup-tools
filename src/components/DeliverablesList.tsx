import { useEffect, useRef, useState } from "react";
import { Sparkles, Paperclip, Trash2, Plus, Check, ListChecks, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CATEGORIES, OWNERS, newItem, loadList, saveList, loadBrief, saveBrief, buildDeliverablesList,
  type DeliverableItem, type DelivCategory,
} from "@/lib/deliverablesList";

/** The master deliverables list (punch-list). A natural-language brief + uploaded docs →
 *  AI itemises every artifact (picture / audio / subs / paperwork / marketing), each
 *  flagged in/out of post's scope with an owner + notes, then freely edited. Per-project. */

const sel = "bg-suite-bg border border-suite-border rounded-sm px-1.5 py-1 text-[10px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]";

export function DeliverablesList({ projectId }: { projectId?: string }) {
  const [items, setItems] = useState<DeliverableItem[]>(() => loadList(projectId));
  const [brief, setBrief] = useState<string>(() => loadBrief(projectId));
  const [files, setFiles] = useState<File[]>([]);
  const [building, setBuilding] = useState(false);
  const [addCat, setAddCat] = useState<DelivCategory>("picture");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveList(projectId, items); }, [items, projectId]);
  useEffect(() => { saveBrief(projectId, brief); }, [brief, projectId]);
  // reload when switching project
  useEffect(() => { setItems(loadList(projectId)); setBrief(loadBrief(projectId)); }, [projectId]);

  const setItem = (id: string, patch: Partial<DeliverableItem>) => setItems((is) => is.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  const removeItem = (id: string) => setItems((is) => is.filter((i) => i.id !== id));
  const addItem = (category: DelivCategory) => setItems((is) => [...is, newItem(category)]);

  const attach = (list: FileList | null) => { if (list && list.length) setFiles((f) => [...f, ...Array.from(list)]); };
  const build = async () => {
    if (!brief.trim() && files.length === 0) { toast("Add a brief or attach a document first"); return; }
    setBuilding(true);
    try {
      const built = await buildDeliverablesList(brief, files);
      setItems((is) => [...is, ...built]);
      setFiles([]);
      const out = built.filter((i) => !i.inScope).length;
      toast.success(`Itemised ${built.length} deliverable${built.length === 1 ? "" : "s"}`, { description: `${out} flagged out of post's scope · verify and annotate each one.` });
    } catch (e) {
      toast.error("Couldn’t build the list", { description: e instanceof Error ? e.message : "AI request failed." });
    } finally {
      setBuilding(false);
    }
  };

  const inScope = items.filter((i) => i.inScope).length;

  return (
    <section className="rounded-md border border-suite-border bg-suite-panel/60 px-3.5 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ListChecks className="size-3.5 text-guide-target" strokeWidth={1.6} />
        <h2 className="font-mono text-[11px] tracking-[0.16em] uppercase text-suite-text font-semibold">Deliverables list</h2>
        {items.length > 0 && <span className="font-mono text-[10px] text-suite-text-dim">· {inScope} in scope · {items.length - inScope} not yours</span>}
      </div>

      {/* The brief — paste / write + attach docs → build */}
      <div className="rounded-sm border border-suite-border bg-suite-bg/40 p-2.5 flex flex-col gap-2">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          placeholder="Paste or describe what you've been told to deliver — the email, the call notes, a contract clause…"
          className="w-full resize-y bg-transparent text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none leading-relaxed"
        />
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
          <input ref={fileRef} type="file" multiple accept=".pdf,image/png,image/jpeg,image/webp,.txt,.md,.csv" className="hidden" onChange={(e) => { attach(e.target.files); e.currentTarget.value = ""; }} />
          <button onClick={build} disabled={building} className="flex items-center gap-1.5 px-2.5 py-1 text-[9.5px] tracking-[0.12em] uppercase font-mono border rounded-sm text-guide-source border-guide-source/50 bg-guide-source/10 hover:bg-guide-source/20 disabled:opacity-50 transition-colors">
            <Sparkles className={cn("size-3", building && "animate-pulse")} strokeWidth={2} /> {building ? "Building the list…" : "Build the list"}
          </button>
          <span className="font-mono text-[9px] text-suite-text-dim">AI itemises it — incl. audio (M&E, stems) — and flags what isn't post's job.</span>
        </div>
      </div>

      {/* The itemised list, grouped by category */}
      {items.length === 0 ? (
        <p className="font-mono text-[10px] text-suite-text-dim leading-relaxed px-1">
          No items yet. Write or paste the brief above and hit <span className="text-guide-source">Build the list</span> — or add items by hand below.
        </p>
      ) : (
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
                {catItems.map((it) => <ItemRow key={it.id} item={it} onChange={(p) => setItem(it.id, p)} onRemove={() => removeItem(it.id)} />)}
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
        <select value={addCat} onChange={(e) => setAddCat(e.target.value as DelivCategory)} className={sel} title="Category for the next added item">
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
    </section>
  );
}

function ItemRow({ item, onChange, onRemove }: { item: DeliverableItem; onChange: (patch: Partial<DeliverableItem>) => void; onRemove: () => void }) {
  return (
    <div className={cn("flex items-center gap-2 px-2 py-1.5 rounded-sm border", item.inScope ? "border-suite-border bg-suite-bg/40" : "border-suite-border/40 bg-transparent")}>
      <button onClick={() => onChange({ inScope: !item.inScope })}
        title={item.inScope ? "In your scope — click to mark “not my issue”" : "Not your issue — click to claim it"}
        className={cn("shrink-0 size-3.5 rounded-[3px] border grid place-items-center transition-colors", item.inScope ? "bg-guide-target/15 border-guide-target text-guide-target" : "border-suite-text-dim text-transparent")}>
        {item.inScope ? <Check className="size-2.5" strokeWidth={3} /> : null}
      </button>
      <input value={item.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Deliverable…"
        className={cn("flex-[2] min-w-0 bg-transparent text-[11px] font-mono focus:outline-none", item.inScope ? "text-suite-text" : "text-suite-text-dim line-through")} />
      <select value={item.owner} onChange={(e) => onChange({ owner: e.target.value as DeliverableItem["owner"] })}
        title="Owner" className="shrink-0 bg-suite-bg border border-suite-border rounded-sm px-1 py-0.5 text-[9px] font-mono text-suite-text-muted focus:outline-none focus:border-guide-target [color-scheme:dark]">
        {OWNERS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <input value={item.notes} onChange={(e) => onChange({ notes: e.target.value })} placeholder="notes…"
        className="flex-1 min-w-0 bg-transparent text-[10px] font-mono text-suite-text-muted placeholder:text-suite-text-dim focus:outline-none" />
      <button onClick={onRemove} title="Remove" className="shrink-0 text-suite-text-dim hover:text-destructive"><Trash2 className="size-3" strokeWidth={1.6} /></button>
    </div>
  );
}
