import { useEffect, useMemo, useRef, useState } from "react";
import {
  SquareKanban, Plus, Trash2, X, Check, Square, CheckSquare, Download, ListChecks,
  CalendarClock, ChevronDown, CalendarRange, Film, Workflow as WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { STAGES } from "@/lib/pipeline";
import { buildMasterGraph, buildCustomGraph, type CustomConfig, type MasteringStrategy, type MasterNits } from "@/lib/mastering";

/** Kanban Board — a per-project task board with drag-between columns and a checklist
 *  (the "basic to-do") on every card. State is per-project in localStorage, like the
 *  Post Schedule. Native HTML5 drag-and-drop; export to JSON. */

type Check = { id: string; text: string; done: boolean };
type Card = { id: string; title: string; notes: string; color: string; checks: Check[]; due?: string };
type Column = { id: string; name: string; cards: Card[] };

const PALETTE = ["#64748b", "#38bdf8", "#22d3ee", "#a78bfa", "#facc15", "#f59e0b", "#e879f9", "#f87171", "#34d399", "#fb7185"];
const KEY_BOARD = "kaos.board.v1";

let _seq = 0;
const uid = (p = "k") => `${p}${Date.now().toString(36)}${(_seq++).toString(36)}`;

const mkCheck = (text: string, done = false): Check => ({ id: uid("ch"), text, done });
const mkCard = (title: string, color = PALETTE[0], checks: Check[] = [], notes = ""): Card => ({ id: uid("cd"), title, notes, color, checks });

// ---- date helpers (local-tz, ISO yyyy-mm-dd) ----
const localISO = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const todayISO = () => localISO(new Date());
const addDaysISO = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return localISO(d); };
const mondayOf = (iso: string) => { const d = new Date(iso + "T00:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return localISO(d); };
const daysUntil = (iso: string) => Math.round((new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 86400000);
const fmtDue = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "2-digit", month: "short" });
const isDone = (name: string) => /done|complete/i.test(name);
const TRACK_COLOR: Record<string, string> = { picture: "#38bdf8", audio: "#2dd4bf", data: "#f59e0b" };

function seedBoard(): Column[] {
  return [
    { id: uid("co"), name: "To do", cards: [
      mkCard("Confirm delivery specs", "#f59e0b", [
        mkCheck("Resolution & codec"), mkCheck("Frame rate"), mkCheck("Audio config (5.1 / Atmos?)"), mkCheck("IMF or ProRes deliverable"),
      ]),
      mkCard("Book grade & online suites", "#38bdf8"),
      mkCard("Lock VFX vendor + shot count", "#a78bfa"),
    ]},
    { id: uid("co"), name: "Doing", cards: [
      mkCard("Camera & workflow test", "#22d3ee", [mkCheck("Shoot test", true), mkCheck("Run through DIT"), mkCheck("Grade check")]),
      mkCard("Offline edit", "#a78bfa"),
    ]},
    { id: uid("co"), name: "Blocked", cards: [] },
    { id: uid("co"), name: "Done", cards: [
      mkCard("Kick-off / scope locked", "#34d399"),
    ]},
  ];
}

function loadBoard(key: string): Column[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return seedBoard();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return seedBoard();
    return arr
      .filter((c) => c && typeof c.name === "string" && Array.isArray(c.cards))
      .map((c) => ({
        id: typeof c.id === "string" ? c.id : uid("co"),
        name: c.name,
        cards: (c.cards as unknown[]).filter((k): k is Card => !!k && typeof (k as Card).title === "string").map((k) => ({
          id: typeof k.id === "string" ? k.id : uid("cd"),
          title: k.title,
          notes: typeof k.notes === "string" ? k.notes : "",
          color: typeof k.color === "string" ? k.color : PALETTE[0],
          checks: Array.isArray(k.checks) ? k.checks.filter((x: unknown): x is Check => !!x && typeof (x as Check).text === "string").map((x: Check) => ({ id: typeof x.id === "string" ? x.id : uid("ch"), text: x.text, done: !!x.done })) : [],
          due: typeof k.due === "string" ? k.due : undefined,
        })),
      }));
  } catch { return seedBoard(); }
}

export function KanbanBoard({ projectName, projectId }: { projectName?: string; projectId?: string }) {
  const key = KEY_BOARD + (projectId ? `-${projectId}` : "");
  const [cols, setCols] = useState<Column[]>(() => loadBoard(key));
  const [editing, setEditing] = useState<{ colId: string; cardId: string } | null>(null);
  const [adding, setAddingCol] = useState<string | null>(null); // column id with an open quick-add
  const [addText, setAddText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const drag = useRef<{ ids: string[] } | null>(null);
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(cols)); } catch { /* ignore */ } }, [cols, key]);
  // Esc clears a multi-selection.
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedIds([]); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.length]);

  const totals = useMemo(() => {
    const cards = cols.reduce((n, c) => n + c.cards.length, 0);
    const done = cols.find((c) => isDone(c.name))?.cards.length ?? 0;
    const overdue = cols.reduce((n, c) => (isDone(c.name) ? n : n + c.cards.filter((k) => k.due && daysUntil(k.due) < 0).length), 0);
    return { cards, done, overdue };
  }, [cols]);

  // ---- card mutations ----
  const patchCard = (colId: string, cardId: string, p: Partial<Card>) =>
    setCols((cs) => cs.map((c) => (c.id === colId ? { ...c, cards: c.cards.map((k) => (k.id === cardId ? { ...k, ...p } : k)) } : c)));
  const addCard = (colId: string, title: string) => {
    const t = title.trim(); if (!t) return;
    const card = mkCard(t, PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    setCols((cs) => cs.map((c) => (c.id === colId ? { ...c, cards: [...c.cards, card] } : c)));
  };
  const removeCard = (colId: string, cardId: string) =>
    setCols((cs) => cs.map((c) => (c.id === colId ? { ...c, cards: c.cards.filter((k) => k.id !== cardId) } : c)));

  const toggleSelect = (cardId: string) =>
    setSelectedIds((ids) => (ids.includes(cardId) ? ids.filter((x) => x !== cardId) : [...ids, cardId]));

  // Move a set of cards (gathered from wherever they live, in board order) into
  // toCol at the drop point. Works for one card or a whole multi-selection.
  const moveSelection = (ids: string[], toCol: string, beforeCardId: string | null) => {
    const idset = new Set(ids);
    setCols((cs) => {
      const moved: Card[] = [];
      const without = cs.map((c) => ({
        ...c,
        cards: c.cards.filter((k) => { if (idset.has(k.id)) { moved.push(k); return false; } return true; }),
      }));
      if (!moved.length) return cs;
      return without.map((c) => {
        if (c.id !== toCol) return c;
        const cards = c.cards.slice();
        // drop position — ignore a beforeCardId that's itself being moved
        const at = beforeCardId && !idset.has(beforeCardId) ? cards.findIndex((k) => k.id === beforeCardId) : -1;
        cards.splice(at < 0 ? cards.length : at, 0, ...moved);
        return { ...c, cards };
      });
    });
  };

  // ---- column mutations ----
  const renameCol = (colId: string, name: string) => setCols((cs) => cs.map((c) => (c.id === colId ? { ...c, name } : c)));
  const addColumn = () => setCols((cs) => [...cs, { id: uid("co"), name: "New column", cards: [] }]);
  const removeColumn = (colId: string) => {
    const col = cols.find((c) => c.id === colId);
    if (col && col.cards.length && !window.confirm(`Delete "${col.name}" and its ${col.cards.length} card(s)?`)) return;
    setCols((cs) => cs.filter((c) => c.id !== colId));
  };
  const resetBoard = () => { if (window.confirm("Reset the board to the starter template?")) setCols(seedBoard()); };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(cols, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(projectName || "board").trim().replace(/\s+/g, "-").toLowerCase()}-board.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ---- opt-in imports (read other tools' per-project state; never modify them) ----
  const sfx = projectId ? `-${projectId}` : "";
  // Add cards to the first column, skipping any whose title is already on the board.
  const importCards = (incoming: Card[], source: string) => {
    const have = new Set(cols.flatMap((c) => c.cards.map((k) => k.title.toLowerCase().trim())));
    const fresh = incoming.filter((c) => !have.has(c.title.toLowerCase().trim()));
    if (!fresh.length) { toast(`Nothing new from ${source}`, { description: "Those items are already on the board." }); return; }
    setCols((cs) => (cs.length ? cs.map((c, i) => (i === 0 ? { ...c, cards: [...c.cards, ...fresh] } : c)) : cs));
    toast.success(`Added ${fresh.length} card${fresh.length === 1 ? "" : "s"} from ${source}`);
  };

  const importFromSchedule = () => {
    let bars: { name?: string; color?: string; start?: number; dur?: number }[] = [];
    try { const r = JSON.parse(localStorage.getItem("postsup-gantt-v1" + sfx) || "[]"); if (Array.isArray(r)) bars = r; } catch { /* ignore */ }
    if (!bars.length) { toast("No schedule yet", { description: "Build a Post Schedule first, then import." }); return; }
    const rawStart = localStorage.getItem("postsup-gantt-start" + sfx);
    const anchor = mondayOf(rawStart && /^\d{4}-\d{2}-\d{2}$/.test(rawStart) ? rawStart : todayISO());
    const cards: Card[] = bars
      .filter((b) => b && typeof b.name === "string" && Number.isFinite(b.start) && Number.isFinite(b.dur))
      .map((b) => {
        const isMs = b.dur === 0;
        const off = isMs ? Math.round((b.start as number) * 7) : Math.round(((b.start as number) + (b.dur as number)) * 7) - 1;
        return { id: uid("cd"), title: b.name as string, notes: "", color: typeof b.color === "string" ? b.color : PALETTE[0], checks: [], due: addDaysISO(anchor, Math.max(0, off)) };
      });
    importCards(cards, "the schedule");
  };

  const importFromWorkflow = () => {
    const cards: Card[] = STAGES.map((s) => ({ id: uid("cd"), title: s.label, notes: s.summary, color: TRACK_COLOR[s.track] ?? PALETTE[0], checks: [] }));
    importCards(cards, "the workflow");
  };

  const importFromDeliverables = () => {
    let cfg: { strategy?: MasteringStrategy; nits?: MasterNits; custom?: CustomConfig } = {};
    try { cfg = JSON.parse(localStorage.getItem(`postsup-mastering-config-${projectId}`) || "{}"); } catch { /* ignore */ }
    const strategy = cfg.strategy ?? "hdr-first";
    const nits = cfg.nits ?? 1000;
    const custom = cfg.custom ?? { hero: "streaming-hdr" as const, deliverables: ["hdr", "sdr", "theatrical", "archive", "proxies"] as const };
    let labels: string[] = [];
    try {
      const graph = strategy === "custom" ? buildCustomGraph(custom as CustomConfig, "2.0", nits) : buildMasterGraph(strategy, "2.0", nits);
      labels = [...new Set(graph.nodes.filter((n) => n.type === "deliverable").map((n) => n.label))];
    } catch { toast.error("Couldn't read your Mastering setup."); return; }
    if (!labels.length) { toast("No deliverables found", { description: "Pick a strategy in Mastering first." }); return; }
    const existing = cols.flatMap((c) => c.cards).find((k) => k.title.toLowerCase() === "deliverables");
    if (existing) {
      const have = new Set(existing.checks.map((c) => c.text.toLowerCase()));
      const add = labels.filter((l) => !have.has(l.toLowerCase()));
      if (!add.length) { toast("Deliverables already up to date"); return; }
      setCols((cs) => cs.map((c) => ({ ...c, cards: c.cards.map((k) => (k.id === existing.id ? { ...k, checks: [...k.checks, ...add.map((l) => mkCheck(l))] } : k)) })));
      toast.success(`Added ${add.length} deliverable${add.length === 1 ? "" : "s"}`, { description: "To your Deliverables card." });
    } else {
      const card: Card = { id: uid("cd"), title: "Deliverables", notes: "From Mastering", color: "#f472b6", checks: labels.map((l) => mkCheck(l)) };
      setCols((cs) => (cs.length ? cs.map((c, i) => (i === 0 ? { ...c, cards: [...c.cards, card] } : c)) : cs));
      toast.success("Added a Deliverables card", { description: `${labels.length} item${labels.length === 1 ? "" : "s"} from Mastering.` });
    }
  };

  // ---- drag handlers ----
  const onDragStart = (e: React.DragEvent, cardId: string) => {
    // Dragging a selected card moves the whole selection; otherwise just this card.
    const ids = selectedIds.includes(cardId) && selectedIds.length > 1 ? selectedIds : [cardId];
    drag.current = { ids };
    setDraggingIds(ids);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cardId);
  };
  const onDragEnd = () => { drag.current = null; setDraggingIds([]); setOverCol(null); };
  const allowDrop = (e: React.DragEvent) => e.preventDefault();
  const dropOnCard = (e: React.DragEvent, colId: string, beforeCardId: string) => {
    e.preventDefault(); e.stopPropagation();
    const d = drag.current; if (d) { moveSelection(d.ids, colId, beforeCardId); setSelectedIds([]); }
    onDragEnd();
  };
  const dropOnCol = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const d = drag.current; if (d) { moveSelection(d.ids, colId, null); setSelectedIds([]); }
    onDragEnd();
  };

  const editCard = editing ? cols.find((c) => c.id === editing.colId)?.cards.find((k) => k.id === editing.cardId) ?? null : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <SquareKanban className="size-4 text-guide-target" strokeWidth={1.6} />
          <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Task Board</span>
          {projectName?.trim() && <span className="font-mono text-[11px] text-suite-text-dim truncate max-w-[18ch]">· {projectName.trim()}</span>}
          <span className="font-mono text-[10px] text-suite-text-dim tabular">{totals.done}/{totals.cards} done</span>
          {totals.overdue > 0 && <span className="font-mono text-[10px] text-destructive tabular">· {totals.overdue} overdue</span>}
          {selectedIds.length > 0 ? (
            <button onClick={() => setSelectedIds([])} className="font-mono text-[10px] text-guide-target hover:underline">{selectedIds.length} selected · drag any to move all · clear</button>
          ) : (
            <span className="font-mono text-[10px] text-suite-text-dim hidden xl:inline">— shift-click to multi-select · drag to move · click to edit</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <button onClick={() => setShowImport((s) => !s)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors">
              Import <ChevronDown className="size-3" strokeWidth={2} />
            </button>
            {showImport && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowImport(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-1 flex flex-col">
                  <div className="px-2 pt-1 pb-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-suite-text-dim">Pull from another tool</div>
                  <ImportItem icon={CalendarRange} title="From schedule" desc="Phases → cards with due dates" onClick={() => { setShowImport(false); importFromSchedule(); }} />
                  <ImportItem icon={WorkflowIcon} title="From workflow" desc="Pipeline stages → cards" onClick={() => { setShowImport(false); importFromWorkflow(); }} />
                  <ImportItem icon={Film} title="From deliverables" desc="Mastering → a checklist" onClick={() => { setShowImport(false); importFromDeliverables(); }} />
                </div>
              </>
            )}
          </div>
          <button onClick={addColumn} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            <Plus className="size-3" strokeWidth={2} /> Column
          </button>
          <button onClick={exportJSON} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            <Download className="size-3" strokeWidth={1.6} /> Export
          </button>
          <button onClick={resetBoard} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-5 py-4">
        <div className="flex gap-3 h-full items-start" onClick={(e) => { if (e.target === e.currentTarget) setSelectedIds([]); }}>
          {cols.map((col) => (
            <div
              key={col.id}
              onDragOver={(e) => { allowDrop(e); setOverCol(col.id); }}
              onDragLeave={() => setOverCol((o) => (o === col.id ? null : o))}
              onDrop={(e) => dropOnCol(e, col.id)}
              className={cn("shrink-0 w-64 max-h-full flex flex-col rounded-md border bg-suite-panel/40", overCol === col.id ? "border-guide-target/50" : "border-suite-border")}
            >
              {/* Column header */}
              <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-2 border-b border-suite-border">
                <input
                  value={col.name}
                  onChange={(e) => renameCol(col.id, e.target.value)}
                  className="min-w-0 flex-1 bg-transparent font-mono text-[11px] tracking-[0.1em] uppercase text-suite-text font-semibold focus:outline-none focus:text-guide-target"
                />
                <span className="font-mono text-[9px] text-suite-text-dim tabular">{col.cards.length}</span>
                <button onClick={() => removeColumn(col.id)} title="Delete column" className="text-suite-text-dim hover:text-destructive shrink-0">
                  <X className="size-3" strokeWidth={2} />
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
                {col.cards.map((card) => {
                  const done = card.checks.filter((c) => c.done).length;
                  const colDone = isDone(col.name);
                  const du = card.due ? daysUntil(card.due) : null;
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, card.id)}
                      onDragEnd={onDragEnd}
                      onDragOver={allowDrop}
                      onDrop={(e) => dropOnCard(e, col.id, card.id)}
                      onClick={(e) => {
                        if (e.shiftKey || e.metaKey || e.ctrlKey) { e.stopPropagation(); toggleSelect(card.id); }
                        else { setSelectedIds([]); setEditing({ colId: col.id, cardId: card.id }); }
                      }}
                      className={cn(
                        "group/card rounded-sm border bg-suite-panel px-2.5 py-2 cursor-pointer transition-colors",
                        selectedIds.includes(card.id) ? "border-guide-target ring-1 ring-guide-target/60" : "border-suite-border hover:border-suite-border-strong",
                        draggingIds.includes(card.id) && "opacity-40",
                      )}
                      style={{ borderLeft: `3px solid ${card.color}` }}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="min-w-0 flex-1 font-mono text-[11.5px] text-suite-text leading-snug">{card.title}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeCard(col.id, card.id); }}
                          title="Delete card"
                          className="shrink-0 opacity-0 group-hover/card:opacity-100 text-suite-text-dim hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="size-3" strokeWidth={1.6} />
                        </button>
                      </div>
                      {(card.notes || card.checks.length > 0 || card.due) && (
                        <div className="mt-1.5 flex items-center gap-2.5 font-mono text-[9px] text-suite-text-dim">
                          {card.checks.length > 0 && (
                            <span className={cn("inline-flex items-center gap-1", done === card.checks.length && "text-status-ok")}>
                              <ListChecks className="size-2.5" strokeWidth={1.8} /> {done}/{card.checks.length}
                            </span>
                          )}
                          {card.due && (
                            <span className={cn("inline-flex items-center gap-1 shrink-0", colDone ? "text-suite-text-dim" : du! < 0 ? "text-destructive" : du! <= 3 ? "text-status-warn" : "text-suite-text-dim")}>
                              <CalendarClock className="size-2.5" strokeWidth={1.8} /> {fmtDue(card.due)}{!colDone && du! < 0 ? " · late" : ""}
                            </span>
                          )}
                          {card.notes && <span className="truncate">{card.notes}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Quick add */}
                {adding === col.id ? (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      autoFocus
                      value={addText}
                      onChange={(e) => setAddText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCard(col.id, addText); setAddText(""); }
                        if (e.key === "Escape") { setAddingCol(null); setAddText(""); }
                      }}
                      placeholder="Card title…  (Enter to add)"
                      rows={2}
                      className="w-full bg-suite-bg border border-suite-border rounded-sm px-2 py-1.5 text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target resize-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { addCard(col.id, addText); setAddText(""); }} className="px-2 py-1 text-[9px] uppercase tracking-[0.1em] font-mono rounded-sm border border-guide-target/50 text-guide-target bg-guide-target/10 hover:bg-guide-target/20">Add</button>
                      <button onClick={() => { setAddingCol(null); setAddText(""); }} className="px-2 py-1 text-[9px] uppercase tracking-[0.1em] font-mono rounded-sm border border-suite-border text-suite-text-dim hover:text-suite-text">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAddingCol(col.id); setAddText(""); }}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded-sm text-suite-text-dim hover:text-suite-text hover:bg-suite-panel-elevated font-mono text-[10px]"
                  >
                    <Plus className="size-3" strokeWidth={2} /> Add card
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add column */}
          <button onClick={addColumn} className="shrink-0 w-44 h-10 grid place-items-center rounded-md border border-dashed border-suite-border text-suite-text-dim hover:text-suite-text hover:border-suite-border-strong font-mono text-[10px] uppercase tracking-[0.12em]">
            <span className="inline-flex items-center gap-1.5"><Plus className="size-3.5" strokeWidth={2} /> Column</span>
          </button>
        </div>
      </div>

      {editCard && editing && (
        <CardEditor
          card={editCard}
          onClose={() => setEditing(null)}
          onChange={(p) => patchCard(editing.colId, editing.cardId, p)}
          onDelete={() => { removeCard(editing.colId, editing.cardId); setEditing(null); }}
        />
      )}
    </div>
  );
}

// ---- card editor (notes + checklist) ----
function ImportItem({ icon: Icon, title, desc, onClick }: { icon: typeof CalendarRange; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-start gap-2 px-2 py-1.5 rounded text-left hover:bg-suite-panel-elevated">
      <Icon className="size-3.5 mt-0.5 shrink-0 text-guide-target" strokeWidth={1.6} />
      <span className="min-w-0">
        <span className="block font-mono text-[11px] text-suite-text">{title}</span>
        <span className="block font-mono text-[9px] text-suite-text-dim">{desc}</span>
      </span>
    </button>
  );
}

function CardEditor({ card, onClose, onChange, onDelete }: {
  card: Card; onClose: () => void; onChange: (p: Partial<Card>) => void; onDelete: () => void;
}) {
  const [newCheck, setNewCheck] = useState("");
  const done = card.checks.filter((c) => c.done).length;

  const setChecks = (checks: Check[]) => onChange({ checks });
  const toggle = (id: string) => setChecks(card.checks.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));
  const editCheck = (id: string, text: string) => setChecks(card.checks.map((c) => (c.id === id ? { ...c, text } : c)));
  const removeCheck = (id: string) => setChecks(card.checks.filter((c) => c.id !== id));
  const addCheck = () => { const t = newCheck.trim(); if (!t) return; setChecks([...card.checks, mkCheck(t)]); setNewCheck(""); };

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md max-h-[88vh] flex flex-col rounded-lg border border-suite-border-strong bg-suite-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-suite-border">
          <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-suite-text-dim">Card</span>
          <button onClick={onClose} className="text-suite-text-muted hover:text-suite-text"><X className="size-4" strokeWidth={2} /></button>
        </div>
        <div className="overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {/* Title */}
          <textarea
            value={card.title}
            onChange={(e) => onChange({ title: e.target.value })}
            rows={2}
            className="w-full bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1.5 text-[13px] font-mono text-suite-text font-semibold focus:outline-none focus:border-guide-target resize-none"
          />
          {/* Colour */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim mr-1">Colour</span>
            {PALETTE.map((c) => (
              <button key={c} onClick={() => onChange({ color: c })} className={cn("size-4 rounded-full border", card.color === c ? "ring-2 ring-white/70" : "border-black/30")} style={{ backgroundColor: c }} />
            ))}
          </div>
          {/* Notes */}
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">Notes</span>
            <textarea
              value={card.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={3}
              placeholder="Anything worth remembering…"
              className="w-full bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1.5 text-[12px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target resize-y"
            />
          </label>
          {/* Due date */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">Due</span>
            <input
              type="date"
              value={card.due || ""}
              onChange={(e) => onChange({ due: e.target.value || undefined })}
              className="bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]"
            />
            {card.due && <button onClick={() => onChange({ due: undefined })} className="font-mono text-[9px] uppercase tracking-[0.1em] text-suite-text-dim hover:text-suite-text">Clear</button>}
          </div>
          {/* Checklist */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">Checklist</span>
              {card.checks.length > 0 && <span className={cn("font-mono text-[9px] tabular", done === card.checks.length ? "text-status-ok" : "text-suite-text-dim")}>{done}/{card.checks.length}</span>}
            </div>
            {card.checks.map((c) => (
              <div key={c.id} className="flex items-center gap-2 group/chk">
                <button onClick={() => toggle(c.id)} className={cn("shrink-0", c.done ? "text-status-ok" : "text-suite-text-dim hover:text-suite-text")}>
                  {c.done ? <CheckSquare className="size-3.5" strokeWidth={1.8} /> : <Square className="size-3.5" strokeWidth={1.8} />}
                </button>
                <input
                  value={c.text}
                  onChange={(e) => editCheck(c.id, e.target.value)}
                  className={cn("min-w-0 flex-1 bg-transparent border-0 border-b border-transparent focus:border-suite-border px-0.5 text-[11.5px] font-mono focus:outline-none", c.done ? "text-suite-text-dim line-through" : "text-suite-text")}
                />
                <button onClick={() => removeCheck(c.id)} className="shrink-0 opacity-0 group-hover/chk:opacity-100 text-suite-text-dim hover:text-destructive"><Trash2 className="size-3" strokeWidth={1.6} /></button>
              </div>
            ))}
            <div className="flex items-center gap-1.5 mt-0.5">
              <input
                value={newCheck}
                onChange={(e) => setNewCheck(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCheck(); } }}
                placeholder="Add a to-do item…"
                className="flex-1 bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
              />
              <button onClick={addCheck} className="shrink-0 px-2 py-1 rounded-sm border border-suite-border text-suite-text-dim hover:text-suite-text"><Plus className="size-3.5" strokeWidth={2} /></button>
            </div>
          </div>
        </div>
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-suite-border">
          <button onClick={onDelete} className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-suite-text-dim hover:text-destructive">
            <Trash2 className="size-3" strokeWidth={1.6} /> Delete card
          </button>
          <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] rounded-sm border border-guide-target/50 text-guide-target bg-guide-target/10 hover:bg-guide-target/20">
            <Check className="size-3" strokeWidth={2} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}
