import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2, Wand2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/** A post-production schedule: phase-grouped tasks with owners, due dates and status.
 *  Self-contained — persists to localStorage. Dates can be back-calculated from a
 *  single delivery date using a standard post timeline template. */

type SchedStatus = "todo" | "doing" | "done" | "blocked";
type SchedTask = {
  id: string;
  label: string;
  phase: Phase;
  owner: string;
  due: string; // YYYY-MM-DD or ""
  status: SchedStatus;
};

const PHASES = ["Prep", "Offline", "VFX", "Online", "Grade", "Audio", "QC", "Delivery"] as const;
type Phase = (typeof PHASES)[number];

const PHASE_ACCENT: Record<Phase, string> = {
  Prep: "#94a3b8",
  Offline: "#38bdf8",
  VFX: "#a78bfa",
  Online: "#22d3ee",
  Grade: "#f59e0b",
  Audio: "#34d399",
  QC: "#f87171",
  Delivery: "#e879f9",
};

const STATUS_META: Record<SchedStatus, { label: string; cls: string }> = {
  todo: { label: "To do", cls: "text-suite-text-muted border-suite-border bg-suite-bg" },
  doing: { label: "In progress", cls: "text-guide-target border-guide-target/50 bg-guide-target/10" },
  done: { label: "Done", cls: "text-status-ok border-status-ok/50 bg-status-ok/10" },
  blocked: { label: "Blocked", cls: "text-destructive border-destructive/50 bg-destructive/10" },
};
const STATUS_CYCLE: SchedStatus[] = ["todo", "doing", "done", "blocked"];

const COMMON_OWNERS = [
  "Post Super", "Editor", "1st AE", "VFX Producer", "Online / Finishing",
  "Colourist", "Director", "Supervising Sound Editor", "Re-recording Mixer",
  "QC", "Mastering House", "Data Manager",
];

/** Standard post schedule template — `offset` = days BEFORE the delivery date. */
const TEMPLATE: { label: string; phase: Phase; owner: string; offset: number }[] = [
  { label: "Conform spec + deliverables list locked", phase: "Prep", owner: "Post Super", offset: 56 },
  { label: "Camera + VFX turnover plan agreed", phase: "Prep", owner: "Post Super", offset: 56 },
  { label: "Picture lock / locked cut", phase: "Offline", owner: "Editor", offset: 42 },
  { label: "EDL / AAF turnover to online", phase: "Offline", owner: "Editor", offset: 40 },
  { label: "Final VFX shots due", phase: "VFX", owner: "VFX Producer", offset: 35 },
  { label: "VFX QC + slap-ins complete", phase: "VFX", owner: "VFX Producer", offset: 30 },
  { label: "Spotting session", phase: "Audio", owner: "Supervising Sound Editor", offset: 30 },
  { label: "Conform online master", phase: "Online", owner: "Online / Finishing", offset: 28 },
  { label: "Titles + graphics built", phase: "Online", owner: "Online / Finishing", offset: 26 },
  { label: "Attended grade", phase: "Grade", owner: "Colourist", offset: 24 },
  { label: "HDR pass + SDR trims", phase: "Grade", owner: "Colourist", offset: 20 },
  { label: "DI finals / sign-off", phase: "Grade", owner: "Colourist + Director", offset: 18 },
  { label: "Final mix / printmaster", phase: "Audio", owner: "Re-recording Mixer", offset: 16 },
  { label: "M&E + stems delivered", phase: "Audio", owner: "Re-recording Mixer", offset: 14 },
  { label: "Automated + eyeball QC", phase: "QC", owner: "QC", offset: 10 },
  { label: "QC report signed", phase: "QC", owner: "Post Super", offset: 8 },
  { label: "IMF / ProRes masters delivered", phase: "Delivery", owner: "Mastering House", offset: 3 },
  { label: "DCP + KDMs issued", phase: "Delivery", owner: "Mastering House", offset: 2 },
  { label: "Archive — LTO + cloud (3-2-1)", phase: "Delivery", owner: "Data Manager", offset: 0 },
];

const KEY_TASKS = "postsup-schedule-v1";
const KEY_DD = "postsup-schedule-delivery";

let _seq = 0;
const uid = () => `t${Date.now().toString(36)}${(_seq++).toString(36)}`;

function todayISO(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function minusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() - days);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}
function fmtDue(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function loadTasks(): SchedTask[] {
  try {
    const raw = localStorage.getItem(KEY_TASKS);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((t) => t && typeof t.label === "string" && PHASES.includes(t.phase));
  } catch {
    return [];
  }
}

export function PostSchedule({ projectName }: { projectName?: string }) {
  const [tasks, setTasks] = useState<SchedTask[]>(loadTasks);
  const [deliveryDate, setDeliveryDate] = useState<string>(() => localStorage.getItem(KEY_DD) || "");

  useEffect(() => {
    try { localStorage.setItem(KEY_TASKS, JSON.stringify(tasks)); } catch { /* ignore */ }
  }, [tasks]);
  useEffect(() => {
    try { localStorage.setItem(KEY_DD, deliveryDate); } catch { /* ignore */ }
  }, [deliveryDate]);

  const today = todayISO();

  const grouped = useMemo(() => {
    const by: Record<Phase, SchedTask[]> = { Prep: [], Offline: [], VFX: [], Online: [], Grade: [], Audio: [], QC: [], Delivery: [] };
    for (const t of tasks) by[t.phase].push(t);
    for (const p of PHASES) {
      by[p].sort((a, b) => {
        if (a.due && b.due) return a.due.localeCompare(b.due);
        if (a.due) return -1;
        if (b.due) return 1;
        return 0;
      });
    }
    return by;
  }, [tasks]);

  const doneCount = tasks.filter((t) => t.status === "done").length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const overdue = tasks.filter((t) => t.status !== "done" && t.due && t.due < today).length;

  const nextUp = useMemo(() => {
    return tasks
      .filter((t) => t.status !== "done" && t.due && t.due >= today)
      .sort((a, b) => a.due.localeCompare(b.due))[0];
  }, [tasks, today]);

  function addTask(phase: Phase) {
    setTasks((ts) => [...ts, { id: uid(), label: "", phase, owner: "", due: "", status: "todo" }]);
  }
  function patch(id: string, p: Partial<SchedTask>) {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }
  function remove(id: string) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
  }
  function cycleStatus(id: string) {
    setTasks((ts) => ts.map((t) => {
      if (t.id !== id) return t;
      const i = STATUS_CYCLE.indexOf(t.status);
      return { ...t, status: STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length] };
    }));
  }
  function seedStandard() {
    if (tasks.length && !window.confirm("Replace the current schedule with the standard post template?")) return;
    const seeded: SchedTask[] = TEMPLATE.map((t) => ({
      id: uid(),
      label: t.label,
      phase: t.phase,
      owner: t.owner,
      due: deliveryDate ? minusDays(deliveryDate, t.offset) : "",
      status: "todo",
    }));
    setTasks(seeded);
  }
  function clearAll() {
    if (tasks.length && !window.confirm("Clear all tasks?")) return;
    setTasks([]);
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas select-none">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <CalendarClock className="size-4 text-guide-target" strokeWidth={1.6} />
            <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Post Schedule</span>
            {projectName?.trim() && (
              <span className="font-mono text-[11px] text-suite-text-dim truncate max-w-[28ch]">· {projectName.trim()}</span>
            )}
          </div>
          {tasks.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="h-1.5 w-28 rounded-full bg-suite-bg overflow-hidden border border-suite-border">
                <div className="h-full bg-status-ok transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="font-mono text-[10px] text-suite-text-dim tabular">{doneCount}/{tasks.length} · {pct}%</span>
              {overdue > 0 && (
                <span className="flex items-center gap-1 font-mono text-[10px] text-destructive">
                  <AlertTriangle className="size-3" strokeWidth={2} /> {overdue} overdue
                </span>
              )}
            </div>
          )}
          {nextUp && (
            <span className="font-mono text-[10px] text-suite-text-dim truncate hidden lg:inline">
              Next: <span className="text-suite-text">{nextUp.label || "(untitled)"}</span> · {fmtDue(nextUp.due)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-suite-text-muted">
            Delivery
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="bg-suite-panel-elevated border border-suite-border rounded-sm px-2 py-1 text-[11px] font-mono text-suite-text focus:outline-none focus:border-guide-target [color-scheme:dark]"
            />
          </label>
          <button
            type="button"
            onClick={seedStandard}
            title="Fill with a standard post-production schedule (dates back-calculated from the delivery date)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors"
          >
            <Wand2 className="size-3" strokeWidth={1.6} /> Seed standard
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {tasks.length === 0 ? (
          <div className="h-full min-h-[300px] grid place-items-center">
            <div className="max-w-md text-center flex flex-col items-center gap-4">
              <CalendarClock className="size-10 text-suite-text-dim" strokeWidth={1.2} />
              <div className="space-y-1">
                <p className="font-mono text-sm text-suite-text">No schedule yet</p>
                <p className="font-mono text-[11px] text-suite-text-dim leading-relaxed">
                  Set your delivery date, then seed a standard post timeline — picture lock through VFX, grade, mix, QC and delivery — with every milestone dated back from delivery. Edit anything.
                </p>
              </div>
              <button
                type="button"
                onClick={seedStandard}
                className="flex items-center gap-2 px-3 py-2 text-[11px] tracking-[0.1em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors"
              >
                <Wand2 className="size-3.5" strokeWidth={1.6} /> Seed standard schedule
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col gap-5">
            {PHASES.map((phase) => {
              const rows = grouped[phase];
              if (rows.length === 0) return null;
              const accent = PHASE_ACCENT[phase];
              return (
                <section key={phase} className="rounded-sm border border-suite-border bg-suite-panel overflow-hidden">
                  <header
                    className="flex items-center justify-between px-3 py-2 border-b border-suite-border"
                    style={{ borderLeft: `3px solid ${accent}` }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: accent }} />
                      <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-suite-text">{phase}</span>
                      <span className="font-mono text-[10px] text-suite-text-dim">
                        {rows.filter((r) => r.status === "done").length}/{rows.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addTask(phase)}
                      className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.1em] text-suite-text-muted hover:text-suite-text transition-colors"
                    >
                      <Plus className="size-3" strokeWidth={2} /> Add
                    </button>
                  </header>
                  <div className="divide-y divide-suite-border/60">
                    {rows.map((t) => {
                      const isOverdue = t.status !== "done" && t.due && t.due < today;
                      return (
                        <div
                          key={t.id}
                          className="group grid grid-cols-[112px_1fr_150px_120px_28px] items-center gap-2 px-3 py-1.5 hover:bg-suite-panel-elevated/40"
                        >
                          <button
                            type="button"
                            onClick={() => cycleStatus(t.id)}
                            title="Click to change status"
                            className={cn(
                              "justify-self-start px-2 py-0.5 rounded-full border font-mono text-[9px] tracking-[0.08em] uppercase transition-colors",
                              STATUS_META[t.status].cls,
                            )}
                          >
                            {STATUS_META[t.status].label}
                          </button>
                          <input
                            type="text"
                            value={t.label}
                            onChange={(e) => patch(t.id, { label: e.target.value })}
                            placeholder="Milestone / task…"
                            className={cn(
                              "bg-transparent border-0 border-b border-transparent focus:border-suite-border px-0.5 py-0.5 text-[12px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none min-w-0",
                              t.status === "done" && "line-through text-suite-text-dim",
                            )}
                          />
                          <input
                            type="text"
                            list="postsched-owners"
                            value={t.owner}
                            onChange={(e) => patch(t.id, { owner: e.target.value })}
                            placeholder="Owner"
                            className="bg-transparent border-0 border-b border-transparent focus:border-suite-border px-0.5 py-0.5 text-[11px] font-mono text-suite-text-muted placeholder:text-suite-text-dim focus:outline-none min-w-0"
                          />
                          <input
                            type="date"
                            value={t.due}
                            onChange={(e) => patch(t.id, { due: e.target.value })}
                            className={cn(
                              "bg-transparent border border-transparent hover:border-suite-border focus:border-guide-target rounded-sm px-1 py-0.5 text-[11px] font-mono focus:outline-none [color-scheme:dark]",
                              isOverdue ? "text-destructive" : "text-suite-text-muted",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => remove(t.id)}
                            title="Delete task"
                            className="justify-self-center opacity-0 group-hover:opacity-100 text-suite-text-dim hover:text-destructive transition-opacity"
                          >
                            <Trash2 className="size-3.5" strokeWidth={1.6} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            <p className="font-mono text-[10px] text-suite-text-dim leading-relaxed px-1">
              Saved to this browser. Click a status pill to cycle To do → In progress → Done → Blocked. Set the delivery date and the standard template back-dates every milestone from it.
            </p>
          </div>
        )}
      </div>

      <datalist id="postsched-owners">
        {COMMON_OWNERS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}
