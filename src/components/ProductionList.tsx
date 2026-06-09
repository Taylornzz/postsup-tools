import { Boxes, ChevronRight } from "lucide-react";
import { CATEGORIES } from "@/lib/deliverablesList";
import type { ArtifactGroup } from "@/lib/deliverablesRollup";

/** The "make-once" view: unique artifacts rolled up across all recipients, identical ones
 *  collapsed (spec-aware), each showing who needs it. Read-only — a lens over the
 *  per-recipient lists, not a change to them. See docs/deliverables-artifact-model.md. */

export function ProductionList({ groups }: { groups: ArtifactGroup[] }) {
  const inScope = groups.filter((g) => g.inScope);
  if (inScope.length === 0) return null;
  const shared = inScope.filter((g) => g.consumers.length > 1).length;

  return (
    <details className="rounded-md border border-suite-border bg-suite-panel/50 group">
      <summary className="cursor-pointer list-none flex items-center gap-2 px-3.5 py-2.5 font-mono text-[11px] tracking-[0.14em] uppercase text-suite-text font-semibold hover:text-guide-target select-none">
        <Boxes className="size-3.5 text-guide-target" strokeWidth={1.7} />
        Production list
        <span className="font-normal tracking-normal normal-case text-[10px] text-suite-text-dim">· {inScope.length} to make{shared ? ` · ${shared} shared` : ""}</span>
        <ChevronRight className="ml-auto size-3.5 transition-transform group-open:rotate-90 text-suite-text-dim" strokeWidth={2} />
      </summary>
      <div className="px-3.5 pb-3 flex flex-col gap-2.5">
        <p className="font-mono text-[9.5px] text-suite-text-dim leading-relaxed">
          What you actually produce — identical artifacts collapsed (same content + spec), each tagged with who needs it. Naming &amp; timing stay per-recipient.
        </p>
        {CATEGORIES.map((cat) => {
          const catGroups = inScope.filter((g) => g.category === cat.id);
          if (catGroups.length === 0) return null;
          return (
            <div key={cat.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-suite-text-muted">{cat.label}</span>
                <span className="font-mono text-[9px] text-suite-text-dim">· {catGroups.length}</span>
                <div className="flex-1 h-px bg-suite-border/60" />
              </div>
              {catGroups.map((g) => (
                <div key={g.key} className="rounded-sm border border-suite-border bg-suite-bg/40 px-2.5 py-1.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-suite-text">{g.label}</span>
                    {g.spec && <span className="font-mono text-[9.5px] text-suite-text-muted">{g.spec}</span>}
                    {g.consumers.length > 1 && (
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full border border-guide-target/50 text-guide-target">shared ×{g.consumers.length}</span>
                    )}
                  </div>
                  <div className="font-mono text-[9.5px] text-suite-text-dim mt-0.5">→ {g.consumers.map((c) => c.recipientName).join(" · ")}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </details>
  );
}
