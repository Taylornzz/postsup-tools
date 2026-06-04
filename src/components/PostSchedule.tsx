import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Plus, Trash2, Wand2, Crosshair, GripVertical, Diamond, ZoomIn, ZoomOut, X, Save, Download, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportSchedule, type ExportFormat } from "@/lib/scheduleExport";

/** Post Schedule — a drag-and-drop weekly Gantt. Each row is a phase bar with a start
 *  (week offset) and a duration (weeks); drag the body to move, drag an edge to resize,
 *  drag the grip to reorder, click to set an exact date, shift-click for multi-select.
 *  Duration 0 = a milestone / keyframe diamond. Wheel zooms; drag the canvas to pan. */

type Bar = { id: string; name: string; color: string; start: number; dur: number };

const ROW_H = 34;
const LABEL_W = 158;
const MONTH_H = 22;
const WEEK_H = 20;
const HEAD_H = MONTH_H + WEEK_H;
const WEEK_W_DEFAULT = 44;
const WEEK_W_MIN = 16;
const WEEK_W_MAX = 130;
const POP_W = 216;

const SEED: Omit<Bar, "id">[] = [
  { name: "Prep", color: "#94a3b8", start: 0, dur: 4 },
  { name: "Camera Test", color: "#a78bfa", start: 0, dur: 1 },
  { name: "Show Look", color: "#facc15", start: 0, dur: 1 },
  { name: "PP", color: "#facc15", start: 4, dur: 0 },
  { name: "Shoot", color: "#38bdf8", start: 4, dur: 5 },
  { name: "Offload / DIT", color: "#22d3ee", start: 4, dur: 6 },
  { name: "Offline", color: "#a78bfa", start: 5, dur: 12 },
  { name: "Lock", color: "#facc15", start: 17, dur: 0 },
  { name: "Conform", color: "#f87171", start: 17, dur: 1 },
  { name: "VFX", color: "#94a3b8", start: 10, dur: 13 },
  { name: "Grade", color: "#f59e0b", start: 17, dur: 3 },
  { name: "Audio Post", color: "#2dd4bf", start: 16, dur: 7 },
  { name: "Online", color: "#e879f9", start: 23, dur: 3 },
  { name: "QC", color: "#fb7185", start: 26, dur: 2 },
  { name: "Delivery", color: "#34d399", start: 28, dur: 2 },
];
const PALETTE = ["#94a3b8", "#38bdf8", "#22d3ee", "#a78bfa", "#facc15", "#f59e0b", "#e879f9", "#f87171", "#34d399", "#fb7185"];

const KEY_BARS = "postsup-gantt-v1";
const KEY_START = "postsup-gantt-start";
const KEY_VERSIONS = "postsup-gantt-versions";

type Version = { id: string; name: string; savedAt: string; startDate: string; bars: Bar[] };
function loadVersions(): Version[] {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY_VERSIONS) || "[]");
    return Array.isArray(arr) ? arr.filter((v) => v && Array.isArray(v.bars)) : [];
  } catch { return []; }
}

const EXPORTS: { fmt: ExportFormat; label: string }[] = [
  { fmt: "pdf", label: "PDF — Gantt chart" },
  { fmt: "png", label: "PNG — Gantt image" },
  { fmt: "ics", label: "Calendar (.ics)" },
  { fmt: "csv", label: "CSV — spreadsheet" },
  { fmt: "json", label: "JSON — backup" },
];

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
  d.setDate(d.getDate() + Math.round(n * 7));
  return d;
}
function addDaysISO(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return localISO(d);
}
function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T00:00:00").getTime();
  const b = new Date(bIso + "T00:00:00").getTime();
  return Math.round((b - a) / 86400000);
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

const seedBars = (): Bar[] => SEED.map((b) => ({ ...b, id: uid() }));

function loadBars(): Bar[] {
  try {
    const raw = localStorage.getItem(KEY_BARS);
    if (raw === null) return seedBars(); // first visit → start pre-filled with the template
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return seedBars();
    return arr.filter((b) => b && typeof b.name === "string" && Number.isFinite(b.start) && Number.isFinite(b.dur));
  } catch {
    return seedBars();
  }
}

export function PostSchedule({ projectName }: { projectName?: string }) {
  const [bars, setBars] = useState<Bar[]>(loadBars);
  const [startDate, setStartDate] = useState<string>(() => localStorage.getItem(KEY_START) || mondayOf(localISO(new Date())));
  const [weekW, setWeekW] = useState<number>(WEEK_W_DEFAULT);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null); // which bar's date editor is open (plain click only)
  const [versions, setVersions] = useState<Version[]>(loadVersions);
  const [verName, setVerName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekWRef = useRef(weekW);
  weekWRef.current = weekW;
  const selRef = useRef(selectedIds);
  selRef.current = selectedIds;

  useEffect(() => { try { localStorage.setItem(KEY_BARS, JSON.stringify(bars)); } catch { /* ignore */ } }, [bars]);
  useEffect(() => { try { localStorage.setItem(KEY_START, startDate); } catch { /* ignore */ } }, [startDate]);
  useEffect(() => { try { localStorage.setItem(KEY_VERSIONS, JSON.stringify(versions)); } catch { /* ignore */ } }, [versions]);

  const anchor = useMemo(() => mondayOf(startDate || localISO(new Date())), [startDate]);
  const maxEnd = bars.reduce((m, b) => Math.max(m, b.start + Math.max(b.dur, 1)), 0);
  const weeksToShow = Math.min(Math.max(Math.ceil(maxEnd) + 6, 24), 80);

  const weeks = useMemo(() => {
    const out: { i: number; date: Date; wk: number }[] = [];
    for (let i = 0; i < weeksToShow; i++) out.push({ i, date: addWeeks(anchor, i), wk: isoWeekNum(addWeeks(anchor, i)) });
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

  // ---- bar drag (move group / resize) + click-to-select ----
  const drag = useRef<{ mode: "move" | "l" | "r"; clickedId: string; shift: boolean; x0: number; y0: number; items: { id: string; s0: number; d0: number }[]; minS0: number } | null>(null);
  const onMove = useCallback((e: MouseEvent) => {
    const d = drag.current;
    if (!d) return;
    const dw = Math.round((e.clientX - d.x0) / weekWRef.current);
    if (d.mode === "move") {
      const dwc = d.minS0 + dw < 0 ? -d.minS0 : dw;
      setBars((bs) => bs.map((b) => {
        const it = d.items.find((x) => x.id === b.id);
        return it ? { ...b, start: it.s0 + dwc } : b;
      }));
    } else {
      const it = d.items[0];
      setBars((bs) => bs.map((b) => {
        if (b.id !== it.id) return b;
        if (d.mode === "r") return { ...b, dur: Math.max(1, it.d0 + dw) };
        const ns = Math.min(Math.max(0, it.s0 + dw), it.s0 + it.d0 - 1);
        return { ...b, start: ns, dur: it.d0 - (ns - it.s0) };
      }));
    }
  }, []);
  const onUp = useCallback((e: MouseEvent) => {
    const d = drag.current;
    if (d && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) {
      // a click, not a drag → selection
      if (d.shift) {
        setSelectedIds((ids) => (ids.includes(d.clickedId) ? ids.filter((x) => x !== d.clickedId) : [...ids, d.clickedId]));
        setEditId(null); // building a multi-selection — don't pop the date editor
      } else {
        setSelectedIds([d.clickedId]);
        setEditId(d.clickedId); // plain click opens the date editor
      }
    }
    drag.current = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    document.body.style.cursor = "";
  }, [onMove]);
  const onDown = useCallback((e: React.MouseEvent, id: string, mode: "move" | "l" | "r") => {
    e.preventDefault();
    e.stopPropagation();
    const sel = selRef.current;
    let groupIds: string[];
    if (mode === "move") groupIds = sel.includes(id) && sel.length > 1 ? sel : [id];
    else groupIds = [id];
    const items = groupIds.map((gid) => { const bb = bars.find((x) => x.id === gid)!; return { id: gid, s0: bb.start, d0: bb.dur }; });
    const minS0 = Math.min(...items.map((i) => i.s0));
    drag.current = { mode, clickedId: id, shift: e.shiftKey, x0: e.clientX, y0: e.clientY, items, minS0 };
    document.body.style.cursor = mode === "move" ? "grabbing" : "ew-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [bars, onMove, onUp]);

  // ---- pan (drag empty canvas) ----
  const pan = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const onPanMove = useCallback((e: MouseEvent) => {
    const p = pan.current, el = scrollRef.current;
    if (!p || !el) return;
    el.scrollLeft = p.sl - (e.clientX - p.x);
    el.scrollTop = p.st - (e.clientY - p.y);
  }, []);
  const onPanUp = useCallback(() => {
    pan.current = null;
    window.removeEventListener("mousemove", onPanMove);
    window.removeEventListener("mouseup", onPanUp);
    document.body.style.cursor = "";
  }, [onPanMove]);
  const startPan = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest("input, button, [data-no-pan]")) return; // don't pan from controls / name column / popover
    const el = scrollRef.current;
    if (!el) return;
    setSelectedIds([]); setEditId(null); // clicking empty canvas clears selection
    pan.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop };
    document.body.style.cursor = "grabbing";
    window.addEventListener("mousemove", onPanMove);
    window.addEventListener("mouseup", onPanUp);
  }, [onPanMove, onPanUp]);

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

  // ---- wheel: zoom the schedule (centred on cursor) · shift-wheel scrolls sideways ----
  const pendingZoom = useRef<{ wk: number; offX: number } | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.shiftKey) { el.scrollLeft += e.deltaY; e.preventDefault(); return; }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // trackpad horizontal → native scroll
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const offX = e.clientX - rect.left - LABEL_W;
      const wk = (offX + el.scrollLeft) / weekWRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const next = clamp(weekWRef.current * factor, WEEK_W_MIN, WEEK_W_MAX);
      if (next === weekWRef.current) return;
      pendingZoom.current = { wk, offX };
      setWeekW(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bars.length]);

  useEffect(() => {
    const p = pendingZoom.current;
    const el = scrollRef.current;
    if (p && el) { el.scrollLeft = p.wk * weekW - p.offX; pendingZoom.current = null; }
  }, [weekW]);

  useEffect(() => {
    if (selectedIds.length === 0 && !editId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSelectedIds([]); setEditId(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.length, editId]);

  function patch(id: string, p: Partial<Bar>) { setBars((bs) => bs.map((b) => (b.id === id ? { ...b, ...p } : b))); }
  function remove(id: string) { setBars((bs) => bs.filter((b) => b.id !== id)); setSelectedIds((ids) => ids.filter((x) => x !== id)); setEditId((e) => (e === id ? null : e)); }
  const newStart = () => Math.max(0, Math.round(todayInRange ? todayWeeks : 0));
  function addRow() {
    const b = { id: uid(), name: "New phase", color: PALETTE[bars.length % PALETTE.length], start: newStart(), dur: 2 };
    setBars((bs) => [...bs, b]); setSelectedIds([b.id]); setEditId(b.id);
  }
  function addMilestone() {
    const b = { id: uid(), name: "Milestone", color: "#facc15", start: newStart(), dur: 0 };
    setBars((bs) => [...bs, b]); setSelectedIds([b.id]); setEditId(b.id);
  }
  function applyTemplate() {
    if (bars.length && !window.confirm("Replace the schedule with the standard post template (starting from the current week)?")) return;
    const base = Math.max(0, Math.round(todayInRange ? todayWeeks : 0));
    setBars(SEED.map((b) => ({ ...b, id: uid(), start: b.start + base }))); setSelectedIds([]); setEditId(null);
  }
  function clearAll() {
    if (bars.length && !window.confirm("Clear all phases?")) return;
    setBars([]); setSelectedIds([]); setEditId(null);
  }
  function saveVersion() {
    const name = verName.trim() || `${projectName?.trim() ? projectName.trim() + " " : ""}v${versions.length + 1} · ${new Date().toLocaleDateString()}`;
    setVersions((vs) => [{ id: uid(), name, savedAt: new Date().toISOString(), startDate, bars: bars.map((b) => ({ ...b })) }, ...vs]);
    setVerName("");
  }
  function loadVersion(v: Version) {
    setBars(v.bars.map((b) => ({ ...b }))); setStartDate(v.startDate);
    setSelectedIds([]); setEditId(null); setShowSave(false);
  }
  function deleteVersion(id: string) { setVersions((vs) => vs.filter((v) => v.id !== id)); }
  function doExport(fmt: ExportFormat) {
    exportSchedule(fmt, { startDate, anchor, bars, weeksToShow, title: projectName?.trim() || "", todayWeeks });
    setShowExport(false);
  }
  function zoom(factor: number) { setWeekW((w) => clamp(w * factor, WEEK_W_MIN, WEEK_W_MAX)); }
  function scrollToToday() {
    if (!scrollRef.current || !todayInRange) return;
    scrollRef.current.scrollTo({ left: Math.max(0, todayWeeks * weekW - 200), behavior: "smooth" });
  }

  const gridBg = `repeating-linear-gradient(to right, transparent, transparent ${weekW - 1}px, rgba(148,163,184,0.10) ${weekW - 1}px, rgba(148,163,184,0.10) ${weekW}px)`;
  const timelineW = weeksToShow * weekW;
  const bodyH = bars.length * ROW_H;

  const selected = editId ? bars.find((b) => b.id === editId) || null : null;
  const selIdx = selected ? bars.findIndex((b) => b.id === selected.id) : -1;

  const btn = "flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm transition-colors";
  const btnGhost = "text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg";

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-suite-canvas select-none">
      {/* Toolbar (always in frame) */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarClock className="size-4 text-guide-target" strokeWidth={1.6} />
          <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Post Schedule</span>
          {projectName?.trim() && <span className="font-mono text-[11px] text-suite-text-dim truncate max-w-[18ch]">· {projectName.trim()}</span>}
          <span className="font-mono text-[10px] text-suite-text-dim hidden xl:inline">— drag bar to move · edges resize · grip reorders · click sets a date · shift-click multi-select · wheel zooms · drag canvas to pan</span>
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
          <button type="button" onClick={applyTemplate} title="Lay down the standard post phases, starting from the current week" className={cn(btn, "text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20")}>
            <Wand2 className="size-3" strokeWidth={1.6} /> Template
          </button>

          {/* Save / versions */}
          <div className="relative">
            <button type="button" onClick={() => { setShowSave((s) => !s); setShowExport(false); }} className={cn(btn, btnGhost)}>
              <Save className="size-3" strokeWidth={1.6} /> Save
            </button>
            {showSave && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSave(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={verName}
                      onChange={(e) => setVerName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveVersion(); }}
                      placeholder="Version name (optional)"
                      className="flex-1 min-w-0 bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
                    />
                    <button type="button" onClick={saveVersion} disabled={bars.length === 0}
                      className="shrink-0 px-2 py-1 text-[10px] uppercase tracking-[0.1em] font-mono rounded-sm border border-guide-target/50 text-guide-target bg-guide-target/10 hover:bg-guide-target/20 disabled:opacity-40">
                      Save
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-1 -mx-1 px-1">
                    {versions.length === 0 ? (
                      <p className="font-mono text-[10px] text-suite-text-dim py-1">No saved versions yet. Save a snapshot you can restore anytime.</p>
                    ) : versions.map((v) => (
                      <div key={v.id} className="group/v flex items-center gap-2 rounded-sm hover:bg-suite-panel-elevated px-1.5 py-1">
                        <button type="button" onClick={() => loadVersion(v)} title="Load this version" className="flex-1 min-w-0 text-left flex items-center gap-2">
                          <FolderOpen className="size-3 shrink-0 text-suite-text-dim group-hover/v:text-guide-target" strokeWidth={1.6} />
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[11px] text-suite-text">{v.name}</span>
                            <span className="block font-mono text-[9px] text-suite-text-dim">{new Date(v.savedAt).toLocaleString()} · {v.bars.length} rows</span>
                          </span>
                        </button>
                        <button type="button" onClick={() => deleteVersion(v.id)} title="Delete" className="shrink-0 text-suite-text-dim hover:text-destructive opacity-0 group-hover/v:opacity-100">
                          <Trash2 className="size-3" strokeWidth={1.6} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Export */}
          <div className="relative">
            <button type="button" onClick={() => { setShowExport((s) => !s); setShowSave(false); }} className={cn(btn, btnGhost)}>
              <Download className="size-3" strokeWidth={1.6} /> Export
            </button>
            {showExport && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExport(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-1 flex flex-col">
                  {EXPORTS.map((x) => (
                    <button key={x.fmt} type="button" onClick={() => doExport(x.fmt)} disabled={bars.length === 0}
                      className="text-left px-2.5 py-1.5 text-[11px] font-mono text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated rounded-sm disabled:opacity-40">
                      {x.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button type="button" onClick={clearAll} className={cn(btn, btnGhost)}>Clear</button>
        </div>
      </div>

      {/* Gantt */}
      {bars.length === 0 ? (
        <div className="flex-1 grid place-items-center">
          <div className="max-w-md text-center flex flex-col items-center gap-4">
            <CalendarClock className="size-10 text-suite-text-dim" strokeWidth={1.2} />
            <p className="font-mono text-[11px] text-suite-text-dim leading-relaxed">
              Set a project start, then drop the standard post template — Prep, Camera Test, Show Look, PP, Shoot, Offload/DIT, Offline, Lock, Conform, VFX, Grade, Audio Post, Online, QC, Delivery (laid down from the current week) — and drag the bars to block out durations in weeks. Add your own phases and keyframes too.
            </p>
            <button type="button" onClick={applyTemplate} className={cn(btn, "text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 px-3 py-2 text-[11px]")}>
              <Wand2 className="size-3.5" strokeWidth={1.6} /> Use standard template
            </button>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 min-h-0 min-w-0 overflow-auto cursor-grab active:cursor-grabbing" onMouseDown={startPan}>
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
              const isSel = selectedIds.includes(b.id);
              return (
                <div key={b.id} className={cn("group flex border-b border-suite-border/40", dragRowId === b.id && "opacity-80")} style={{ height: ROW_H }}>
                  {/* Name cell (frozen) */}
                  <div data-no-pan className={cn("sticky left-0 z-30 shrink-0 flex items-center gap-1 px-2 border-r border-suite-border", isSel ? "bg-suite-panel-elevated" : "bg-suite-panel")} style={{ width: LABEL_W }}>
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
                  {/* Timeline cell — empty space pans the canvas (handled at container level) */}
                  <div className="relative" style={{ width: timelineW, backgroundImage: gridBg }}>
                    {isMs ? (
                      <div
                        onMouseDown={(e) => onDown(e, b.id, "move")}
                        title={`${b.name} — ${fmtDate(startD)} (milestone) · click to set a date`}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing"
                        style={{ left }}
                      >
                        <div className={cn("size-3.5 rotate-45 border", isSel && "ring-2 ring-white/70")} style={{ backgroundColor: b.color, borderColor: "rgba(0,0,0,0.3)" }} />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] text-suite-text-dim">{b.name} <span className="text-suite-text-dim/60">· {fmtDate(startD)}</span></span>
                      </div>
                    ) : (
                      <div className={cn("absolute top-1/2 -translate-y-1/2 h-5 rounded-[3px] flex items-center", isSel && "ring-2 ring-white/70")}
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

            {/* Date editor popover (single selection) */}
            {selected && (
              <div
                data-no-pan
                className="absolute z-50 w-[216px] rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-3 flex flex-col gap-2"
                style={{ left: clamp(LABEL_W + selected.start * weekW - 8, LABEL_W + 4, Math.max(LABEL_W + 4, LABEL_W + timelineW - POP_W)), top: HEAD_H + selIdx * ROW_H + ROW_H + 6 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-suite-text-muted">
                    <span className="size-2 rounded-full" style={{ backgroundColor: selected.color }} />
                    {selected.dur === 0 ? "Keyframe" : "Phase"}
                  </span>
                  <button type="button" onClick={() => setEditId(null)} className="text-suite-text-dim hover:text-suite-text"><X className="size-3.5" strokeWidth={2} /></button>
                </div>
                <input
                  value={selected.name}
                  onChange={(e) => patch(selected.id, { name: e.target.value })}
                  className="w-full bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target"
                />
                <label className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">{selected.dur === 0 ? "Date" : "Start date"}</span>
                  <input
                    type="date"
                    value={addDaysISO(anchor, Math.round(selected.start * 7))}
                    onChange={(e) => { if (e.target.value) patch(selected.id, { start: Math.max(0, daysBetween(anchor, e.target.value) / 7) }); }}
                    className="w-full bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]"
                  />
                </label>
                {selected.dur > 0 && (
                  <label className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-dim">Duration</span>
                    <span className="flex items-center gap-1">
                      <input
                        type="number" min={1} max={104}
                        value={selected.dur}
                        onChange={(e) => patch(selected.id, { dur: clamp(parseInt(e.target.value || "1", 10) || 1, 1, 104) })}
                        className="w-16 bg-suite-bg border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target"
                      />
                      <span className="font-mono text-[10px] text-suite-text-dim">weeks</span>
                    </span>
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => patch(selected.id, selected.dur === 0 ? { dur: 2 } : { dur: 0 })}
                  className="self-start font-mono text-[9px] uppercase tracking-[0.1em] text-guide-target/80 hover:text-guide-target"
                >
                  {selected.dur === 0 ? "→ make phase" : "→ make keyframe"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
