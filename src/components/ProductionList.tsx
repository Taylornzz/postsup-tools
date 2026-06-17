import { Boxes, ChevronRight, Link2, Link2Off, Lightbulb } from "lucide-react";
import { CATEGORIES } from "@/lib/deliverablesList";
import { groupStatus, type ArtifactGroup, type GroupTone, type LinkSuggestion } from "@/lib/deliverablesRollup";

const TONE_CLASS: Record<GroupTone, string> = {
  fail: "border-destructive/50 text-destructive bg-destructive/10",
  pending: "border-suite-border text-suite-text-dim",
  partial: "border-status-warn/40 text-status-warn bg-status-warn/10",
  done: "border-emerald-400/40 text-emerald-400 bg-emerald-400/10",
  neutral: "border-suite-border text-suite-text-dim",
};

/** The "make-once" view: unique artifacts rolled up across all recipients, identical ones
 *  collapsed (spec-aware), each showing who needs it. Read-only — a lens over the
 *  per-recipient lists, not a change to them. See docs/deliverables-artifact-model.md. */

export function ProductionList({ groups, suggestions = [], onLink, onUnlink }: {
  groups: ArtifactGroup[];
  suggestions?: LinkSuggestion[];
  onLink?: (specKey: string) => void;
  onUnlink?: (artifactId: string) => void;
}) {
  const inScope = groups.filter((g) => g.inScope);
  if (inScope.length === 0) return null;
  const shared = inScope.filter((g) => g.consumers.length > 1).length;

  return (
    <details className="rounded-md border border-suite-border bg-suite-panel/50 group">
      <summary className="cursor-pointer list-none flex items-center gap-2 px-3.5 py-2.5 font-mono text-[11px] tracking-[0.14em] uppercase text-suite-text font-semibold hover:text-guide-target select-none">
        <Boxes className="size-3.5 text-guide-target" strokeWidth={1.7} />
        Combined deliverables list
        <span className="font-normal tracking-normal normal-case text-[10px] text-suite-text-dim">· {inScope.length} to make{shared ? ` · ${shared} shared` : ""}{suggestions.length ? ` · ${suggestions.length} to link` : ""}</span>
        <ChevronRight className="ml-auto size-3.5 transition-transform group-open:rotate-90 text-suite-text-dim" strokeWidth={2} />
      </summary>
      <div className="px-3.5 pb-3 flex flex-col gap-2.5">
        <p className="font-mono text-[9.5px] text-suite-text-dim leading-relaxed">
          What you actually produce — identical artifacts collapsed (same content + spec), each tagged with who needs it. Naming &amp; timing stay per-recipient.
        </p>

        {/* Link suggestions — identical items across recipients that aren't yet linked as one make. */}
        {onLink && suggestions.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-sm border border-guide-target/30 bg-guide-target/5 px-2.5 py-2">
            <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-guide-target">
              <Lightbulb className="size-3" strokeWidth={1.8} /> Suggested links
            </div>
            {suggestions.map((s) => (
              <div key={s.specKey} className="flex items-baseline gap-2 flex-wrap">
                <span className="font-mono text-[10.5px] text-suite-text">{s.label}</span>
                {s.spec && <span className="font-mono text-[9px] text-suite-text-muted">{s.spec}</span>}
                <span className="font-mono text-[9px] text-suite-text-dim">→ {s.recipientNames.join(" · ")}</span>
                <button onClick={() => onLink(s.specKey)} title="Link as one make-once artifact (you can unlink later)"
                  className="ml-auto inline-flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border border-guide-target/50 text-guide-target hover:bg-guide-target/15">
                  <Link2 className="size-2.5" strokeWidth={2} /> Link ×{s.recipientNames.length}
                </button>
              </div>
            ))}
          </div>
        )}
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
              {catGroups.map((g) => {
                const st = groupStatus(g);
                return (
                <div key={g.key} className="rounded-sm border border-suite-border bg-suite-bg/40 px-2.5 py-1.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-[11px] text-suite-text">{g.label}</span>
                    {g.spec && <span className="font-mono text-[9.5px] text-suite-text-muted">{g.spec}</span>}
                    {g.consumers.length > 1 && (
                      <span className="font-mono text-[8.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full border border-guide-target/50 text-guide-target">shared ×{g.consumers.length}</span>
                    )}
                    {g.linked && (
                      <span title="Linked as one make-once artifact" className="inline-flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border border-emerald-400/40 text-emerald-400">
                        <Link2 className="size-2.5" strokeWidth={2} /> linked
                      </span>
                    )}
                    {g.linked && onUnlink && g.artifactId && (
                      <button onClick={() => onUnlink(g.artifactId!)} title="Unlink — go back to inferred grouping"
                        className="text-suite-text-dim hover:text-destructive"><Link2Off className="size-3" strokeWidth={1.8} /></button>
                    )}
                    <span className={`ml-auto font-mono text-[8.5px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full border ${TONE_CLASS[st.tone]}`}>{st.label}</span>
                  </div>
                  <div className="font-mono text-[9.5px] text-suite-text-dim mt-0.5">
                    → {g.consumers.map((c) => `${c.recipientName}${c.version > 1 ? ` v${c.version}` : ""}`).join(" · ")}
                  </div>
                </div>
              ); })}
            </div>
          );
        })}
      </div>
    </details>
  );
}
