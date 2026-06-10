import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Search, X, ExternalLink, AlertTriangle, BadgeCheck, Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  VENDORS, VENDOR_TYPES, VENDOR_REGIONS, VENDOR_TYPE_COLOR, VENDOR_REGION_LABEL,
  VENDOR_SCENARIOS, VENDORS_VERIFIED, VENDORS_REVERIFY_BY,
  type Vendor, type VendorType, type VendorRegion,
} from "@/lib/vendors";
import { askVendorAdvisor, type AdvisorMessage } from "@/lib/vendorAdvisor";

const domainOf = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

/** Relevance rank for a search needle — lower is better. */
function rank(v: Vendor, n: string): number {
  const name = v.name.toLowerCase();
  if (name === n) return 0;
  if (name.startsWith(n)) return 1;
  if (name.includes(n)) return 2;
  if (v.types.some((t) => t.toLowerCase().includes(n))) return 3;
  if ((v.city || "").toLowerCase().includes(n)) return 4;
  if (v.blurb.toLowerCase().includes(n)) return 5;
  return 6;
}

export function Vendors() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState<VendorRegion | "All">("All");
  const [type, setType] = useState<VendorType | "All">("All");
  const scrollRef = useRef<HTMLDivElement>(null);

  const needle = q.trim().toLowerCase();
  const searching = needle.length > 0;

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of VENDORS) for (const t of v.types) m[t] = (m[t] || 0) + 1;
    return m;
  }, []);
  const regionCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of VENDORS) m[v.region] = (m[v.region] || 0) + 1;
    return m;
  }, []);

  const filtered = useMemo(() => {
    return VENDORS.filter((v) => {
      if (region !== "All" && v.region !== region) return false;
      if (type !== "All" && !v.types.includes(type)) return false;
      if (!needle) return true;
      return (
        v.name.toLowerCase().includes(needle) ||
        v.types.some((t) => t.toLowerCase().includes(needle)) ||
        v.blurb.toLowerCase().includes(needle) ||
        (v.city || "").toLowerCase().includes(needle) ||
        VENDOR_REGION_LABEL[v.region].toLowerCase().includes(needle)
      );
    });
  }, [needle, region, type]);

  const ranked = useMemo(() => {
    if (!searching) return [];
    return [...filtered].sort((a, b) => {
      const ra = rank(a, needle), rb = rank(b, needle);
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [searching, filtered, needle]);

  const groups = useMemo(() => {
    if (searching) return [];
    return VENDOR_REGIONS.map((r) => ({
      region: r,
      items: filtered.filter((v) => v.region === r).sort((a, b) => a.types[0].localeCompare(b.types[0]) || a.name.localeCompare(b.name)),
    })).filter((g) => g.items.length > 0);
  }, [filtered, searching]);

  const card = (v: Vendor) => (
    <a
      key={`${v.name}-${v.region}`}
      href={v.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2.5 py-2.5 hover:bg-suite-panel-elevated/40 -mx-2 px-2 rounded-sm transition-colors"
    >
      <span className="mt-1 size-2 rounded-full shrink-0" style={{ backgroundColor: VENDOR_TYPE_COLOR[v.types[0]] }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-mono text-[13px] text-suite-text font-semibold group-hover:text-guide-target">{v.name}</span>
          {v.types.map((t) => (
            <span key={t} className="font-mono text-[8.5px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded-full border"
              style={{ color: VENDOR_TYPE_COLOR[t], borderColor: VENDOR_TYPE_COLOR[t] + "66" }}>
              {t}
            </span>
          ))}
          <span className="font-mono text-[9.5px] text-suite-text-dim">{VENDOR_REGION_LABEL[v.region]}{v.city ? ` · ${v.city}` : ""}</span>
        </div>
        <p className="font-mono text-[11px] text-suite-text-muted leading-relaxed mt-0.5">{v.blurb}</p>
        <span className="font-mono text-[10px] text-suite-text-dim group-hover:text-guide-target/80 inline-flex items-center gap-1 mt-0.5">
          {domainOf(v.url)} <ExternalLink className="size-2.5" strokeWidth={1.8} />
        </span>
      </div>
    </a>
  );

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-suite-canvas">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-suite-border bg-suite-panel px-5 py-3 flex flex-col gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Building2 className="size-4 text-guide-target" strokeWidth={1.6} />
            <span className="font-mono text-xs tracking-[0.14em] uppercase text-suite-text font-semibold">Vendor Directory</span>
            <span className="font-mono text-[10px] text-suite-text-dim tabular">{filtered.length}/{VENDORS.length}</span>
            <span title={`Every listing web-verified as currently operating; recently-failed companies (Technicolor/MPC, Milk VFX, Jellyfish, Pixomondo, Éclair…) removed. Next re-verification due ${VENDORS_REVERIFY_BY}.`}
              className="inline-flex items-center gap-1 font-mono text-[8.5px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full border border-emerald-400/40 text-emerald-400">
              <BadgeCheck className="size-3" strokeWidth={1.8} /> Verified {VENDORS_VERIFIED}
            </span>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-suite-text-dim" strokeWidth={1.6} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search vendors, cities, what they do…"
              className="w-full bg-suite-panel-elevated border border-suite-border rounded-sm pl-7 pr-7 py-1.5 text-[12px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-suite-text-dim hover:text-suite-text">
                <X className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
        {/* Region filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-suite-text-dim w-12 shrink-0">Region</span>
          <Chip label="All" count={VENDORS.length} active={region === "All"} onClick={() => setRegion("All")} color="#cbd5e1" />
          {VENDOR_REGIONS.map((r) => (
            <Chip key={r} label={VENDOR_REGION_LABEL[r]} count={regionCounts[r] || 0} active={region === r} onClick={() => setRegion(r)} color="#cbd5e1" />
          ))}
        </div>
        {/* Type filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-suite-text-dim w-12 shrink-0">Type</span>
          <Chip label="All" count={VENDORS.length} active={type === "All"} onClick={() => setType("All")} color="#cbd5e1" />
          {VENDOR_TYPES.map((t) => (
            <Chip key={t} label={t} count={typeCounts[t] || 0} active={type === t} onClick={() => setType(t)} color={VENDOR_TYPE_COLOR[t]} />
          ))}
        </div>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
        <div className="max-w-3xl mx-auto">
          {/* "Who do I use for…" — an AI advisor grounded in this verified directory */}
          <AdvisorChat />

          <div className="flex gap-2 rounded-sm border border-suite-border bg-suite-bg/60 px-3 py-2 mb-4">
            <AlertTriangle className="size-3.5 shrink-0 text-status-warn mt-0.5" strokeWidth={1.8} />
            <p className="font-mono text-[10px] leading-relaxed text-suite-text-dim">Every listing was web-verified as operating in {VENDORS_VERIFIED}, and recently-failed companies were removed — but the industry shifts fast. Confirm current services, locations and contacts before you rely on any listing.</p>
          </div>

          {filtered.length === 0 ? (
            <div className="h-40 grid place-items-center text-suite-text-dim font-mono text-sm">No matches{q ? ` for “${q}”` : ""}.</div>
          ) : searching ? (
            <div className="flex flex-col divide-y divide-suite-border/40">{ranked.map(card)}</div>
          ) : (
            <div className="flex flex-col gap-6">
              {groups.map((g) => (
                <section key={g.region}>
                  <h3 className="sticky top-0 z-10 bg-suite-canvas/95 backdrop-blur py-1 mb-1 font-mono text-[11px] tracking-[0.2em] uppercase text-suite-text-dim border-b border-suite-border flex items-center justify-between">
                    <span>{VENDOR_REGION_LABEL[g.region]}</span>
                    <span className="text-suite-text-dim/70 tabular">{g.items.length}</span>
                  </h3>
                  <div className="flex flex-col divide-y divide-suite-border/40">{g.items.map(card)}</div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Chat with the directory: "I'm in Auckland and need to master a DCP — who do I use?"
 *  Answers come from the AI grounded ONLY in the verified vendor list; the curated
 *  scenario answers double as starter chips and as offline fallbacks. */
function AdvisorChat() {
  const [msgs, setMsgs] = useState<AdvisorMessage[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy]);

  const CHIP_LABELS = ["35mm dev + scan", "Auckland DCP, international release", "KDMs / distribution", "Film restoration"];

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setQ("");
    const history = msgs;
    setMsgs((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const answer = await askVendorAdvisor(text, history);
      setMsgs((m) => [...m, { role: "assistant", text: answer }]);
    } catch (e) {
      // Offline / unconfigured fallback: if it's one of the curated questions, answer from
      // the verified playbook; otherwise surface the error in-channel.
      const curated = VENDOR_SCENARIOS.find((s) => s.q === text);
      if (curated) {
        setMsgs((m) => [...m, { role: "assistant", text: `${curated.a}\n\n(Curated offline answer — the live AI advisor runs on the deployed site.)` }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", text: `Couldn’t reach the advisor: ${e instanceof Error ? e.message : "request failed"}` }]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-guide-target/30 bg-guide-target/5 mb-3">
      <div className="flex items-center gap-2 px-3.5 pt-2.5 pb-1.5">
        <Sparkles className="size-3.5 text-guide-target" strokeWidth={1.7} />
        <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-suite-text font-semibold">Who do I use for…</span>
        <span className="font-mono text-[10px] text-suite-text-dim">· ask the verified directory anything</span>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} className="ml-auto font-mono text-[9px] uppercase tracking-[0.12em] text-suite-text-dim hover:text-suite-text">Clear</button>
        )}
      </div>

      {/* conversation */}
      {msgs.length > 0 && (
        <div ref={scrollRef} className="max-h-72 overflow-y-auto px-3.5 py-1 flex flex-col gap-2">
          {msgs.map((m, i) => (
            <div key={i} className={cn(
              "rounded-sm border px-3 py-2 max-w-[92%] whitespace-pre-wrap font-mono text-[11px] leading-relaxed",
              m.role === "user"
                ? "self-end border-guide-target/40 bg-guide-target/10 text-suite-text"
                : "self-start border-suite-border bg-suite-bg/60 text-suite-text-muted",
            )}>
              {m.text}
            </div>
          ))}
          {busy && (
            <div className="self-start rounded-sm border border-suite-border bg-suite-bg/60 px-3 py-2 font-mono text-[11px] text-suite-text-dim">
              <span className="inline-flex items-center gap-1.5"><Sparkles className="size-3 animate-pulse text-guide-target" strokeWidth={2} /> checking the directory…</span>
            </div>
          )}
        </div>
      )}

      {/* starter chips */}
      {msgs.length === 0 && (
        <div className="px-3.5 pb-1.5 flex flex-wrap gap-1.5">
          {VENDOR_SCENARIOS.map((s, i) => (
            <button key={s.q} onClick={() => ask(s.q)} title={s.q}
              className="px-2 py-1 rounded-full border border-suite-border bg-suite-bg font-mono text-[9.5px] text-suite-text-muted hover:text-guide-target hover:border-guide-target/50 transition-colors">
              {CHIP_LABELS[i] || s.q}
            </button>
          ))}
        </div>
      )}

      {/* input */}
      <div className="px-3.5 pb-3 pt-1 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(q); }}
          placeholder="e.g. I'm in Bangkok and need a Dolby Atmos mix stage — who do I use?"
          disabled={busy}
          className="flex-1 bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1.5 text-[11px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target disabled:opacity-60"
        />
        <button onClick={() => ask(q)} disabled={busy || !q.trim()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-guide-source/50 bg-guide-source/10 text-guide-source font-mono text-[10px] uppercase tracking-[0.12em] hover:bg-guide-source/20 disabled:opacity-50 transition-colors">
          <Send className="size-3" strokeWidth={2} /> Ask
        </button>
      </div>
      <p className="px-3.5 pb-2.5 -mt-1 font-mono text-[8.5px] text-suite-text-dim">
        Answers only recommend vendors from this verified list ({VENDORS_VERIFIED}) — still confirm current services with the vendor.
      </p>
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
