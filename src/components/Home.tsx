import { ArrowRight } from "lucide-react";
import { FEATURES } from "@/lib/features";

export type HomeTab = "frame" | "storage" | "mastering" | "workflow" | "planner" | "board" | "deliverables" | "glossary" | "tools" | "vendors";

const LABELS: Record<HomeTab, string> = {
  frame: "Capture", storage: "Storage", mastering: "Mastering Workflow",
  workflow: "Workflow", planner: "Post Schedule", board: "Task Board", deliverables: "Deliverables", glossary: "Glossary", tools: "Post Tools", vendors: "Vendor Directory",
};

export function Home({ onNavigate, lastTab }: { onNavigate: (t: HomeTab) => void; lastTab?: HomeTab | null }) {
  // Resume the last tab, unless it's been hidden behind a feature flag.
  const resumeTab = lastTab && LABELS[lastTab] && (lastTab !== "vendors" || FEATURES.vendors) ? lastTab : null;
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-suite-canvas">
      <div className="min-h-full flex flex-col items-center justify-center text-center px-6 py-16">
        <h1 className="font-mono text-3xl sm:text-4xl tracking-[0.18em] uppercase text-guide-target font-bold">KAOS THEORY</h1>
        <p className="font-mono text-[12px] sm:text-[13px] text-suite-text-dim mt-5 max-w-md leading-relaxed">
          Post got complicated. This is the map — plan and reference the whole pipeline, capture to delivery. Pick a tool from the menu above to start.
        </p>
        {resumeTab && (
          <button
            onClick={() => onNavigate(resumeTab)}
            className="mt-7 inline-flex items-center gap-2 px-4 py-2.5 text-[11px] tracking-[0.12em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors"
          >
            Continue → {LABELS[resumeTab]} <ArrowRight className="size-3.5" strokeWidth={1.8} />
          </button>
        )}
        <p className="mt-12 font-mono text-[10px] text-suite-text-dim/80 max-w-sm leading-relaxed">
          Reference only — every figure is a starting point. Verify against source before you rely on it.
        </p>
      </div>
    </div>
  );
}
