import {
  Frame, Aperture, HardDrive, Film, Workflow, CalendarClock, BookText, Calculator, Building2, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type HomeTab = "frame" | "optics" | "storage" | "mastering" | "workflow" | "planner" | "glossary" | "tools" | "vendors";

const CARDS: { tab: HomeTab; title: string; desc: string; icon: typeof Frame; color: string }[] = [
  { tab: "frame", title: "Capture & Framing", desc: "Camera, codec, sensor & framing — what you're shooting and how it extracts.", icon: Frame, color: "#22d3ee" },
  { tab: "optics", title: "Optics", desc: "Lens coverage, depth of field & circle of confusion for your sensor.", icon: Aperture, color: "#a78bfa" },
  { tab: "storage", title: "Storage", desc: "Media & data plan — cards, offload, backups and bandwidth per day.", icon: HardDrive, color: "#4ade80" },
  { tab: "mastering", title: "Mastering Workflow", desc: "ACES masters & deliverables — HDR, theatrical, SDR and the derive order.", icon: Film, color: "#fb7185" },
  { tab: "workflow", title: "Workflow", desc: "The whole pipeline as a node graph — plus your own editable build.", icon: Workflow, color: "#2dd4bf" },
  { tab: "planner", title: "Post Schedule", desc: "Plan the post timeline — Gantt + calendar, weeks down to days.", icon: CalendarClock, color: "#38bdf8" },
  { tab: "glossary", title: "Glossary", desc: "Post terms, standards & acronyms — searchable and cross-linked.", icon: BookText, color: "#818cf8" },
  { tab: "tools", title: "Post Tools", desc: "Timecode, frame-rate & aspect calculators, plus an EDL converter.", icon: Calculator, color: "#fbbf24" },
  { tab: "vendors", title: "Vendor Directory", desc: "Verified post vendors — facilities, labs, VFX, audio, software.", icon: Building2, color: "#f59e0b" },
];

const LABELS: Record<HomeTab, string> = {
  frame: "Capture & Framing", optics: "Optics", storage: "Storage", mastering: "Mastering Workflow",
  workflow: "Workflow", planner: "Post Schedule", glossary: "Glossary", tools: "Post Tools", vendors: "Vendor Directory",
};

export function Home({ onNavigate, lastTab }: { onNavigate: (t: HomeTab) => void; lastTab?: HomeTab | null }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-suite-canvas">
      <div className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
        {/* Hero */}
        <div className="mb-10">
          <h1 className="font-mono text-2xl sm:text-3xl tracking-[0.12em] uppercase text-guide-target font-bold">KAOS THEORY</h1>
          <p className="font-mono text-[12px] text-suite-text-dim mt-4 max-w-2xl leading-relaxed">
            Post got complicated. This is the map — plan and reference the whole pipeline, capture to delivery. Pick a tool to start.
          </p>
          {lastTab && (
            <button
              onClick={() => onNavigate(lastTab)}
              className="mt-5 inline-flex items-center gap-2 px-3.5 py-2 text-[11px] tracking-[0.12em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors"
            >
              Continue → {LABELS[lastTab]} <ArrowRight className="size-3.5" strokeWidth={1.8} />
            </button>
          )}
        </div>

        {/* Tool grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CARDS.map((c) => (
            <button
              key={c.tab}
              onClick={() => onNavigate(c.tab)}
              className="group text-left rounded-lg border border-suite-border bg-suite-panel hover:border-suite-border-strong hover:bg-suite-panel-elevated p-4 transition-colors"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <span
                  className="grid place-items-center size-8 rounded-md border shrink-0"
                  style={{ borderColor: c.color + "55", color: c.color, backgroundColor: c.color + "14" }}
                >
                  <c.icon className="size-4" strokeWidth={1.7} />
                </span>
                <span className="font-mono text-[13px] text-suite-text font-semibold group-hover:text-guide-target">{c.title}</span>
              </div>
              <p className="font-mono text-[11px] text-suite-text-muted leading-relaxed">{c.desc}</p>
            </button>
          ))}
        </div>

        <p className="mt-10 font-mono text-[10px] text-suite-text-dim leading-relaxed max-w-2xl">
          Reference only — every figure is a starting point. Verify against source before you rely on it.
        </p>
      </div>
    </div>
  );
}
