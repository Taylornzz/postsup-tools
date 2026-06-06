import { useEffect, useMemo, useRef, useState } from "react";
import {
  SquareKanban, Plus, Trash2, X, Check, Square, CheckSquare, Download, GripVertical, ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Kanban Board — a per-project task board with drag-between columns and a checklist
 *  (the "basic to-do") on every card. State is per-project in localStorage, like the
 *  Post Schedule. Native HTML5 drag-and-drop; export to JSON. */

type Check = { id: string; text: string; done: boolean };
type Card = { id: string; title: string; notes: string; color: string; checks: Check[] };
type Column = { id: string; name: string; cards: Card[] };

const PALETTE = ["#64748b", "#38bdf8", "#22d3ee", "#a78bfa", "#facc15", "#f59e0b", "#e879f9", "#f87171", "#34d399", "#fb7185"];
const KEY_BOARD = "kaos.board.v1";

let _seq = 0;
const uid = (p = "k") => `${p}${Date.now().toString(36)}${(_seq++).toString(36)}`;

const mkCheck = (text: string, done = false): Check => ({ id: uid("ch"), text, done });
const mkCard = (title: string, color = PALETTE[0], checks: Check[] = [], notes = ""): Card => ({ id: uid("cd"), title, notes, color, checks });

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
  const drag = useRef<{ cardId: string; fromCol: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(cols)); } catch { /* ignore */ } }, [cols, key]);

  const totals = useMemo(() => {
    const cards = cols.reduce((n, c) => n + c.cards.length, 0);
    const done = cols.find((c) => /done|complete/i.test(c.name))?.cards.length ?? 0;
    return { cards, done };
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

  const moveCard = (cardId: string, fromCol: string, toCol: string, beforeCardId: string | null) => {
    if (cardId === beforeCardId) return;
    setCols((cs) => {
      let moved: Card | undefined;
      const without = cs.map((c) => {
        if (c.id !== fromCol) return c;
        moved = c.cards.find((k) => k.id === cardId);
        return { ...c, cards: c.cards.filter((k) => k.id !== cardId) };
      });
      if (!moved) return cs;
      return without.map((c) => {
        if (c.id !== toCol) return c;
        const cards = c.cards.slice();
        const at = beforeCardId ? cards.findIndex((k) => k.id === beforeCardId) : -1;
        cards.splice(at < 0 ? cards.length : at, 0, moved!);
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

  // ---- drag handlers ----
  const onDragStart = (e: React.DragEvent, cardId: string, fromCol: string) => {
    drag.current = { cardId, fromCol };
    setDragId(cardId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", cardId);
  };
  const onDragEnd = () => { drag.current = null; setDragId(null); setOverCol(null); };
  const allowDrop = (e: React.DragEvent) => e.preventDefault();
  const dropOnCard = (e: React.DragEvent, colId: string, beforeCardId: string) => {
    e.preventDefault(); e.stopPropagation();
    const d = drag.current; if (d) moveCard(d.cardId, d.fromCol, colId, beforeCardId);
    onDragEnd();
  };
  const dropOnCol = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const d = drag.current; if (d) moveCard(d.cardId, d.fromCol, colId, null);
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
          <span className="font-mono text-[10px] text-suite-text-dim hidden xl:inline">— drag cards between columns · click a card for notes &amp; checklist</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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
        <div className="flex gap-3 h-full items-start">
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
                  return (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={(e) => onDragStart(e, card.id, col.id)}
                      onDragEnd={onDragEnd}
                      onDragOver={allowDrop}
                      onDrop={(e) => dropOnCard(e, col.id, card.id)}
                      onClick={() => setEditing({ colId: col.id, cardId: card.id })}
                      className={cn(
                        "group/card rounded-sm border border-suite-border bg-suite-panel px-2.5 py-2 cursor-pointer hover:border-suite-border-strong transition-colors",
                        dragId === card.id && "opacity-40",
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
                      {(card.notes || card.checks.length > 0) && (
                        <div className="mt-1.5 flex items-center gap-2.5 font-mono text-[9px] text-suite-text-dim">
                          {card.checks.length > 0 && (
                            <span className={cn("inline-flex items-center gap-1", done === card.checks.length && "text-status-ok")}>
                              <ListChecks className="size-2.5" strokeWidth={1.8} /> {done}/{card.checks.length}
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
