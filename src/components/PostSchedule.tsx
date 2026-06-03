import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Plus, Trash2, Wand2, Crosshair, GripVertical, Diamond, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

/** Post Schedule — a drag-and-drop weekly Gantt. Each row is a phase bar with a start
 *  (week offset) and a duration (weeks); drag the body to move, drag an edge to resize,
 *  drag the grip to reorder. Duration 0 = a milestone / keyframe diamond (e.g. Lock).
 *  Mouse-wheel zooms the week scale; shift-wheel scrolls sideways. Saves to the browser. */

type Bar = { id: string; name: string; color: string; start: number; dur: number };

const ROW_H = 34;
const LABEL_W = 158;
const MONTH_H = 22;
const WEEK_H = 20;
const HEAD_H = MONTH_H + WEEK_H;
const WEEK_W_DEFAULT = 44;
const WEEK_W_MIN = 16;
const WEEK_W_MAX = 130;

const SEED: Omit<Bar, "id">[] = [
  { name: "Prep", color: "#94a3b8", start: 0, dur: 2 },
  { name: "Shoot", color: "#38bdf8", start: 2, dur: 4 },
  { name: "Offload", color: "#22d3ee", start: 2, dur: 4 },
  { name: "Offline", color: "#a78bfa", start: 6, dur: 6 },
  { name: "Lock", color: "#facc15", start: 12, dur: 0 },
  { name: "Grade", color: "#f59e0b", start: 12, dur: 3 },
  { name: "Online", color: "#e879f9", start: 13, dur: 3 },
  { name: "QC", color: "#f87171", start: 16, dur: 1 },
  { name: "Delivery", color: "#34d399", start: 17, dur: 2 },
];
const PALETTE = ["#94a3b8", "#38bdf8", "#22d3ee", "#a78bfa", "#facc15", "#f59e0b", "#e879f9", "#f87171", "#34d399", "#fb7185"];

const KEY_BARS = "postsup-gantt-v1";
const KEY_START = "postsup-gantt-start";

let _seq = 0;
const uid = () => `b${Date.now().toString(36)}${(_seq++).toString(36)}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function localISO(d: Date): string {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
function mondayOf(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return localISO(d);
}
function addWeeks(iso: string, n: number): Date {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n * 7);
  return d;
}
function isoWeekNum(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function loadBars(): Bar[] {
  try {
    const raw = localStorage.getItem(KEY_BARS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((b) => b && typeof b.name === "string" && Number.isFinite(b.start) && Number.isFinite(b.dur));
  } catch {
    return [];
  }
}

export function PostSchedule({ projectName }: { projectName?: string }) {
  const [bars, setBars] = useState<Bar[]>(loadBars);
  const [startDate, setStartDate] = useState<string>(() => localStorage.getItem(KEY_START) || mondayOf(localISO(new Date())));
  const [weekW, setWeekW] = useState<number>(WEEK_W_DEFAULT);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekWRef = useRef(weekW);
  weekWRef.current = weekW;

  useEffect(() => { try { localStorage.setItem(KEY_BARS, JSON.stringify(bars)); } catch { /* ignore */ } }, [bars]);
  useEffect(() => { try { localStorage.setItem(KEY_START, startDate); } catch { /* ignore */ } }, [startDate]);

  const anchor = useMemo(() => mondayOf(startDate || localISO(new Date())), [startDate]);
  const maxEnd = bars.reduce((m, b) => Math.max(m, b.start + Math.max(b.dur, 1)), 0);
  const weeksToShow = Math.min(Math.max(maxEnd + 6, 24), 80);

  const weeks = useMemo(() => {
    const out: { i: number; date: Date; wk: number }[] = [];
    for (let i = 0; i < weeksToShow; i++) {
      const date = addWeeks(anchor, i);
      out.push({ i, date, wk: isoWeekNum(date) });
    }
    return out;
  }, [anchor, weeksToShow]);

  const months = useMemo(() => {
    const out: { label: string; span: number }[] = [];
    for (const w of weeks) {
      const label = w.date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const last = out[out.length - 1];
      if (last && last.label === label) last.span += 1;
      else out.push({ label, span: 1 });
    }
    return out;
  }, [weeks]);

  const todayWeeks = useMemo(() => {
    const ms = new Date(localISO(new Date()) + "T00:00:00").getTime() - new Date(anchor + "T00:00:00").getTime();
    return ms / (7 * 86400000);
  }, [anchor]);
  const todayInRange = todayWeeks >= 0 && todayWeeks <= weeksToShow;

  // ---- bar drag (move / resize) ----
  const drag = useRef<{ id: string; mode: "move" | "l" | "r"; x0: number; s0: number; d0: number } | null>(null);
  const onMove = useCallback((e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    const dw = Math.round((e.clientX - d.x0) / weekWRef.current);
    setBars((bs) => bs.map((b) => {
      if (b.id !== d.id) return b;
      if (d.mode === "move") return { ...b, start: Math.max(0, d.s0 + dw) };
      if (d.mode === "r") return { ...b, dur: Math.max(1, d.d0 + dw) };
      const ns = Math.min(Math.max(0, d.s0 + dw), d.s0 + d.d0 - 1);
      return { ...b, start: ns, dur: d.d0 - (ns - d.s0) };
    }));
  }, []);
  const onUp = useCallback(() => {
    drag.current = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.cursor = "";
  }, [onMove]);
  const onDown = useCallback((e: React.MouseEvent, id: string, mode: "move" | "l" | "r") => {
    e.preventDefault();
    e.stopPropagation();
    const b = bars.find((x) => x.id === id);
    if (!b) return;
    drag.current = { id, mode, x0: e.clientX, s0: b.start, d0: b.dur };
    document.body.style.cursor = mode === "move" ? "grabbing" : "ew-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [bars, onMove, onUp]);

  // ---- row reorder (grip) ----
  const rowDrag = useRef<{ id: string; y0: number; idx0: number } | null>(null);
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const onRowMove = useCallback((e: MouseEvent) => {
    const rd = rowDrag.current;
    if (!rd) return;
    const delta = Math.round((e.clientY - rd.y0) / ROW_H);
    setBars((bs) => {
      const cur = bs.findIndex((b) => b.id === rd.id);
      if (cur < 0) return bs;
      const target = clamp(rd.idx0 + delta, 0, bs.length - 1);
      if (target === cur) return bs;
      const copy = bs.slice();
      const [it] = copy.splice(cur, 1);
      copy.splice(target, 0, it);
      return copy;
    });
  }, []);
  const onRowUp = useCallback(() => {
    rowDrag.current = null;
    setDragRowId(null);
    window.removeEventListener("mousemove", onRowMove);
    window.removeEventListener("mouseup", onRowUp);
    document.body.style.cursor = "";
  }, [onRowMove]);
  const onRowDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const idx0 = bars.findIndex((b) => b.id === id);
    rowDrag.current = { id, y0: e.clientY, idx0 };
    setDragRowId(id);
    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", onRowMove);
    window.addEventListener("mouseup", onRowUp);
  }, [bars, onRowMove, onRowUp]);

  // ---- wheel: zoom (centred on cursor) · shift-wheel: scroll sideways ----
  const pendingZoom = useRef<{ wk: number; offX: number } | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) { el.scrollLeft += e.deltaY; e.preventDefault(); return; }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // trackpad horizontal → native scroll
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const offX = e.clientX - rect.left - LABEL_W;          // px from start of timeline viewport
      const wk = (offX + el.scrollLeft) / weekWRef.current;  // week under cursor
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = clamp(weekWRef.current * factor, WEEK_W_MIN, WEEK_W_MAX);
      if (next === weekWRef.current) return;
      pendingZoom.current = { wk, offX };
      setWeekW(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bars.length]);

  // keep the week under the cursor fixed after a zoom
  useEffect(() => {
    const p = pendingZoom.current;
    const el = scrollRef.current;
    if (p && el) {
      el.scrollLeft = p.wk * weekW - p.offX;
      pendingZoom.current = null;
    }
  }, [weekW]);

  function patch(id: string, p: Partial<Bar>) { setBars((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b))); }
  function remove(id: string) { setBars((bs) => bs.filter((b) => b.id !== id)); }
  const newStart = () => Math.max(0, Math.round(todayInRange ? todayWeeks : 0));
  function addRow() {
    setBars((bs) => [...bs, { id: uid(), name: "New phase", color: PALETTE[bs.length % PALETTE.length], start: newStart(), dur: 2 }]);
  }
  function addMilestone() {
    setBars((bs) => [...bs, { id: uid(), name: "Milestone", color: "#facc15", start: newStart(), dur: 0 }]);
  }
  function seed() {
    if (bars.length && !window.confirm("Replace the schedule with the standard post phases?")) return;
    setBars(SEED.map((b) => ({ ...b, id: uid() })));
  }
  function clearAll() {
    if (bars.length && !window.confirm("Clear all phases?")) return;
    setBars([]);
  }
  function zoom(factor: number) { setWeekW((w) => clamp(w * factor, WEEK_W_MIN, WEEK_W_MAX)); }
  function scrollToToday() {
    if (!scrollRef.current || !todayInRange) return;
    scrollRef.current.scrollTo({ left: Math.max(0, todayWeeks * weekW - 200), behavior: "smooth" });
  }

  const gridBg = `repeating-linear-gradient(to right, transparent, transparent ${weekW - 1}px, rgba(148,163,184,0.10) ${weekW - 1}px, rgba(148,163,184,0.10) ${weekW}px)`;
  const timelineW = weeksToShow * weekW;
  const bodyH = bars.length * ROW_H;

  const btn = "flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm transition-colors";
  const btnGhost = "text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg";

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas select-none">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="size-4 text-guide-target" strokeWidth={1.6} />
          <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Post Schedule</span>
          {projectName?.trim() && <span className="font-mono text-[11px] text-suite-text-dim truncate max-w-[22ch]">· {projectName.trim()}</span>}
          <span className="font-mono text-[10px] text-suite-text-dim hidden xl:inline">— drag to move · edges resize · grip reorders · wheel zooms</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-suite-text-muted">
            Start
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]"
            />
          </label>
          <div className="flex items-center border border-suite-border rounded-sm bg-suite-bg">
            <button type="button" onClick={() => zoom(1 / 1.2)} title="Zoom out" className="px-1.5 py-1.5 text-suite-text-muted hover:text-suite-text"><ZoomOut className="size-3" strokeWidth={1.6} /></button>
            <button type="button" onClick={() => zoom(1.2)} title="Zoom in" className="px-1.5 py-1.5 text-suite-text-muted hover:text-suite-text border-l border-suite-border"><ZoomIn className="size-3" strokeWidth={1.6} /></button>
          </div>
          <button type="button" onClick={scrollToToday} title="Scroll to today" className={cn(btn, btnGhost)}>
            <Crosshair className="size-3" strokeWidth={1.6} /> Today
          </button>
          <button type="button" onClick={addRow} className={cn(btn, btnGhost)}>
            <Plus className="size-3" strokeWidth={2} /> Phase
          </button>
          <button type="button" onClick={addMilestone} title="Add a milestone / keyframe" className={cn(btn, btnGhost)}>
            <Diamond className="size-3" strokeWidth={1.6} /> Keyframe
          </button>
          <button type="button" onClick={seed} className={cn(btn, "text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20")}>
            <Wand2 className="size-3" strokeWidth={1.6} /> Seed
          </button>
          <button type="button" onClick={clearAll} className={cn(btn, btnGhost)}>Clear</button>
        </div>
      </div>

      {/* Gantt */}
      {bars.length === 0 ? (
        <div className="flex-1 grid place-items-center">
          <div className="max-w-md text-center flex flex-col items-center gap-4">
            <CalendarClock className="size-10 text-suite-text-dim" strokeWidth={1.2} />
            <p className="font-mono text-[11px] text-suite-text-dim leading-relaxed">
              Set a project start, then seed the standard post phases — Prep, Shoot, Offload, Offline, Lock, Grade, Online, QC, Delivery — and drag the bars to block out durations in weeks. Add your own phases and keyframes too.
            </p>
            <button type="button" onClick={seed} className={cn(btn, "text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 px-3 py-2 text-[11px]")}>
              <Wand2 className="size-3.5" strokeWidth={1.6} /> Seed standard phases
            </button>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
          <div className="relative" style={{ width: LABEL_W + timelineW }}>
            {/* Month header */}
            <div className="sticky top-0 z-40 flex" style={{ height: MONTH_H }}>
              <div className="sticky left-0 z-50 shrink-0 bg-suite-panel border-r border-b border-suite-border" style={{ width: LABEL_W }} />
              <div className="flex bg-suite-panel border-b border-suite-border">
                {months.map((m, i) => (
                  <div key={i} className="flex items-center px-2 border-r border-suite-border font-mono text-[10px] tracking-[0.1em] uppercase text-suite-text-muted overflow-hidden"
                    style={{ width: m.span * weekW }}>
                    {m.label}
                  </div>
                ))}
              </div>
            </div>
            {/* Week header */}
            <div className="sticky z-40 flex" style={{ top: MONTH_H, height: WEEK_H }}>
              <div className="sticky left-0 z-50 shrink-0 flex items-center px-2 bg-suite-panel border-r border-b border-suite-border font-mono text-[9px] tracking-[0.14em] uppercase text-suite-text-dim" style={{ width: LABEL_W }}>
                Phase
              </div>
              <div className="flex bg-suite-panel border-b border-suite-border">
                {weeks.map((w) => (
                  <div key={w.i} className="flex items-center justify-center border-r border-suite-border/60 font-mono text-[9px] text-suite-text-dim tabular overflow-hidden"
                    style={{ width: weekW }} title={fmtDate(w.date)}>
                    {weekW >= 30 ? `W${w.wk}` : w.wk}
                  </div>
                ))}
              </div>
            </div>

            {/* Today line */}
            {todayInRange && (
              <div className="absolute z-20 pointer-events-none" style={{ left: LABEL_W + todayWeeks * weekW, top: HEAD_H, height: bodyH, width: 0, borderLeft: "1px solid #f87171" }}>
                <span className="absolute -translate-x-1/2 -translate-y-full px-1 rounded-sm bg-[#f87171] text-suite-bg font-mono text-[8px] uppercase tracking-wide">Today</span>
              </div>
            )}

            {/* Rows */}
            {bars.map((b) => {
              const startD = addWeeks(anchor, b.start);
              const endD = addWeeks(anchor, b.start + Math.max(b.dur, 1));
              const isMs = b.dur === 0;
              const left = b.start * weekW;
              const width = Math.max(b.dur, 0) * weekW;
              return (
                <div key={b.id} className={cn("group flex border-b border-suite-border/40", dragRowId === b.id && "opacity-80")} style={{ height: ROW_H }}>
                  {/* Name cell (frozen) */}
                  <div className="sticky left-0 z-30 shrink-0 flex items-center gap-1 px-2 bg-suite-panel border-r border-suite-border" style={{ width: LABEL_W }}>
                    <button type="button" onMouseDown={(e) => onRowDown(e, b.id)} title="Drag to reorder"
                      className="shrink-0 text-suite-text-dim hover:text-suite-text cursor-grab active:cursor-grabbing">
                      <GripVertical className="size-3.5" strokeWidth={1.6} />
                    </button>
                    <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                    <input
                      value={b.name}
                      onChange={(e) => patch(b.id, { name: e.target.value })}
                      className="min-w-0 flex-1 bg-transparent border-0 border-b border-transparent focus:border-suite-border px-0.5 text-[11px] font-mono text-suite-text focus:outline-none"
                    />
                    <button type="button" onClick={() => remove(b.id)} title="Delete row"
                      className="opacity-0 group-hover:opacity-100 text-suite-text-dim hover:text-destructive transition-opacity shrink-0">
                      <Trash2 className="size-3" strokeWidth={1.6} />
                    </button>
                  </div>
                  {/* Timeline cell */}
                  <div className="relative" style={{ width: timelineW, backgroundImage: gridBg }}>
                    {isMs ? (
                      <div
                        onMouseDown={(e) => onDown(e, b.id, "move")}
                        title={`${b.name} — ${fmtDate(startD)} (milestone)`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
                        style={{ left }}
                      >
                        <div className="size-3.5 rotate-45 border" style={{ backgroundColor: b.color, borderColor: "rgba(0,0,0,0.3)" }} />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] text-suite-text-dim">{b.name} <span className="text-suite-text-dim/60">· {fmtDate(startD)}</span></span>
                      </div>
                    ) : (
                      <div className="absolute top-1/2 -translate-y-1/2 h-5 rounded-[3px] flex items-center"
                        style={{ left, width, backgroundColor: b.color }}>
                        <div onMouseDown={(e) => onDown(e, b.id, "l")} className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize" />
                        <div onMouseDown={(e) => onDown(e, b.id, "move")} className="flex-1 h-full cursor-grab active:cursor-grabbing flex items-center justify-center overflow-hidden">
                          {b.dur >= 2 && weekW >= 26 && <span className="font-mono text-[9px] text-black/70 font-semibold tabular">{b.dur}w</span>}
                        </div>
                        <div onMouseDown={(e) => onDown(e, b.id, "r")} className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize" />
                        <span className="absolute left-full ml-1.5 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] text-suite-text-dim">
                          {b.name} <span className="text-suite-text-dim/60">· {fmtDate(startD)}–{fmtDate(endD)}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
