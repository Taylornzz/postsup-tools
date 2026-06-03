import { useMemo, useRef, useState } from "react";
import { BookText, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GLOSSARY,
  GLOSSARY_CATEGORIES,
  GLOSSARY_CAT_COLOR,
  type GlossaryCategory,
  type GlossaryEntry,
} from "@/lib/glossary";

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");

/** Relevance rank for a search needle — lower is better.
 *  exact term → starts-with → exact aka → aka starts-with → term contains → aka contains → definition. */
function rank(e: GlossaryEntry, n: string): number {
  const t = e.term.toLowerCase();
  if (t === n) return 0;
  if (t.startsWith(n)) return 1;
  const aka = (e.aka || []).map((a) => a.toLowerCase());
  if (aka.some((a) => a === n)) return 2;
  if (aka.some((a) => a.startsWith(n))) return 3;
  if (t.includes(n)) return 4;
  if (aka.some((a) => a.includes(n))) return 5;
  return 6;
}

export function Glossary() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<GlossaryCategory | "All">("All");
  const scrollRef = useRef<HTMLDivElement>(null);

  const needle = q.trim().toLowerCase();
  const searching = needle.length > 0;

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of GLOSSARY) m[e.category] = (m[e.category] || 0) + 1;
    return m;
  }, []);

  const filtered = useMemo(() => {
    return GLOSSARY.filter((e) => {
      if (cat !== "All" && e.category !== cat) return false;
      if (!needle) return true;
      if (e.term.toLowerCase().includes(needle)) return true;
      if (e.aka?.some((a) => a.toLowerCase().includes(needle))) return true;
      if (e.definition.toLowerCase().includes(needle)) return true;
      return false;
    });
  }, [needle, cat]);

  // when searching: relevance-ranked flat list
  const ranked = useMemo(() => {
    if (!searching) return [];
    return [...filtered].sort((a, b) => {
      const ra = rank(a, needle);
      const rb = rank(b, needle);
      if (ra !== rb) return ra - rb;
      if (a.term.length !== b.term.length) return a.term.length - b.term.length;
      return a.term.localeCompare(b.term);
    });
  }, [searching, filtered, needle]);

  // when browsing: grouped A–Z
  const groups = useMemo(() => {
    const g: Record<string, GlossaryEntry[]> = {};
    if (searching) return g;
    for (const e of filtered) {
      const c = (e.term[0] || "#").toUpperCase();
      const letter = /[A-Z]/.test(c) ? c : "#";
      (g[letter] ||= []).push(e);
    }
    return g;
  }, [filtered, searching]);
  const letters = Object.keys(groups).sort();

  function jump(letter: string) {
    document.getElementById(`gloss-letter-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function goTerm(term: string) {
    setQ(term);
    setCat("All");
    scrollRef.current?.scrollTo({ top: 0 });
  }

  const renderEntry = (e: GlossaryEntry) => (
    <article key={e.term} id={`gloss-${slug(e.term)}`} className="py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="font-mono text-[16px] text-suite-text font-bold tracking-tight leading-snug">{e.term}</h4>
        <button
          onClick={() => setCat(e.category)}
          title={`Filter to ${e.category}`}
          className="shrink-0 font-mono text-[8.5px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full border hover:opacity-80"
          style={{ color: GLOSSARY_CAT_COLOR[e.category], borderColor: GLOSSARY_CAT_COLOR[e.category] + "66" }}
        >
          {e.category}
        </button>
      </div>
      {e.aka?.length ? <p className="font-mono text-[10px] text-suite-text-dim mt-0.5">also: {e.aka.join(" · ")}</p> : null}
      <p className="font-mono text-[11.5px] leading-relaxed text-suite-text-muted mt-1">{e.definition}</p>
      {e.seeAlso?.length ? (
        <p className="font-mono text-[10px] text-suite-text-dim mt-1">
          See also:{" "}
          {e.seeAlso.map((s, i) => (
            <span key={s}>
              <button onClick={() => goTerm(s)} className="text-guide-target/80 hover:text-guide-target underline-offset-2 hover:underline">
                {s}
              </button>
              {i < e.seeAlso!.length - 1 ? ", " : ""}
            </span>
          ))}
        </p>
      ) : null}
    </article>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <BookText className="size-4 text-guide-target" strokeWidth={1.6} />
            <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Glossary</span>
            <span className="font-mono text-[10px] text-suite-text-dim tabular">{filtered.length}/{GLOSSARY.length}</span>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-suite-text-dim" strokeWidth={1.6} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search terms, abbreviations, definitions…"
              className="w-full bg-suite-panel-elevated border border-suite-border rounded-sm pl-7 pr-7 py-1.5 text-[12px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-suite-text-dim hover:text-suite-text">
                <X className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Chip label="All" count={GLOSSARY.length} active={cat === "All"} onClick={() => setCat("All")} color="#cbd5e1" />
          {GLOSSARY_CATEGORIES.map((c) => (
            <Chip key={c} label={c} count={counts[c] || 0} active={cat === c} onClick={() => setCat(c)} color={GLOSSARY_CAT_COLOR[c]} />
          ))}
        </div>
      </div>

      {/* Body + A–Z rail */}
      <div className="flex-1 min-h-0 flex">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <div className="h-full grid place-items-center text-suite-text-dim font-mono text-sm">No matches{q ? ` for “${q}”` : ""}.</div>
          ) : searching ? (
            <div className="max-w-3xl mx-auto flex flex-col divide-y divide-suite-border/50">
              {ranked.map(renderEntry)}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto flex flex-col gap-6">
              {letters.map((letter) => (
                <section key={letter} id={`gloss-letter-${letter}`}>
                  <h3 className="sticky top-0 z-10 bg-suite-canvas/95 backdrop-blur py-1 mb-1 font-mono text-[11px] tracking-[0.25em] text-suite-text-dim border-b border-suite-border">
                    {letter}
                  </h3>
                  <div className="flex flex-col divide-y divide-suite-border/50">
                    {groups[letter].map(renderEntry)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>

        {!searching && (
          <div className="hidden md:flex shrink-0 flex-col items-center justify-center gap-px px-1 border-l border-suite-border bg-suite-panel/40">
            {ALPHA.map((L) => {
              const has = !!groups[L];
              return (
                <button
                  key={L}
                  disabled={!has}
                  onClick={() => jump(L)}
                  className={cn(
                    "font-mono text-[9px] leading-none px-1 py-0.5 rounded transition-colors",
                    has ? "text-suite-text-muted hover:text-guide-target" : "text-suite-text-dim/30 cursor-default",
                  )}
                >
                  {L}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, count, active, onClick, color }: { label: string; count: number; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-mono text-[9.5px] tracking-[0.04em] transition-colors",
        active ? "text-suite-bg border-transparent" : "text-suite-text-muted hover:text-suite-text border-suite-border bg-suite-bg",
      )}
      style={active ? { backgroundColor: color } : undefined}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: active ? "currentColor" : color }} />
      {label}
      <span className={active ? "opacity-70" : "text-suite-text-dim"}>{count}</span>
    </button>
  );
}
