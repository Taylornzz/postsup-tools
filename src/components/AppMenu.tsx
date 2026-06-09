import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Menu, X, Info, Building2, MessageSquare, Shield, FileText, LogIn, AlertTriangle, ChevronRight, FolderOpen, Newspaper, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURES } from "@/lib/features";
import { exportProjectPDF, exportProjectJSON } from "@/lib/projectExport";

type Panel = "about" | "help" | "vendors" | "feedback" | "privacy" | "terms";

const MENU: { id: Panel | "news"; label: string; icon: typeof Info; group: 1 | 2 }[] = [
  { id: "about", label: "About", icon: Info, group: 1 },
  { id: "help", label: "Help — how to use", icon: HelpCircle, group: 1 },
  { id: "vendors", label: "Vendor directory", icon: Building2, group: 1 },
  { id: "news", label: "News watches", icon: Newspaper, group: 1 },
  { id: "feedback", label: "Send feedback", icon: MessageSquare, group: 1 },
  { id: "privacy", label: "Privacy", icon: Shield, group: 2 },
  { id: "terms", label: "Terms & disclaimer", icon: FileText, group: 2 },
];

export function AppMenu({ version, onOpenVendors, onOpenNews, onProjects, projectId, projectName }: { version: string; onOpenVendors: () => void; onOpenNews?: () => void; onProjects?: () => void; projectId?: string; projectName?: string }) {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setPanel(null); setOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Login — present but not wired up yet */}
      <button
        type="button"
        onClick={() => toast("Accounts & sign-in are coming soon.", { description: "For now everything saves locally in your browser." })}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors"
      >
        <LogIn className="size-3" strokeWidth={1.6} /> Login
      </button>

      {/* Menu */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          title="Menu"
          className={cn(
            "grid place-items-center size-7 border rounded-sm transition-colors",
            open ? "text-suite-text border-suite-border-strong bg-suite-panel-elevated" : "text-suite-text-muted border-suite-border hover:text-suite-text bg-suite-bg",
          )}
        >
          <Menu className="size-4" strokeWidth={1.8} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full mt-1.5 z-50 w-52 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-1 flex flex-col">
              {onProjects && (
                <>
                  <button onClick={() => { setOpen(false); onProjects(); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded font-mono text-[11px] text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated text-left">
                    <FolderOpen className="size-3.5 shrink-0 text-suite-text-dim" strokeWidth={1.6} /> All projects
                  </button>
                  <button onClick={() => { setOpen(false); exportProjectPDF(projectId, projectName?.trim() || "Untitled project"); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded font-mono text-[11px] text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated text-left">
                    <FileText className="size-3.5 shrink-0 text-suite-text-dim" strokeWidth={1.6} /> Export project — PDF
                  </button>
                  <button onClick={() => { setOpen(false); exportProjectJSON(projectId, projectName?.trim() || "Untitled project"); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded font-mono text-[11px] text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated text-left">
                    <FileText className="size-3.5 shrink-0 text-suite-text-dim" strokeWidth={1.6} /> Export project — JSON backup
                  </button>
                  <div className="my-1 border-t border-suite-border/60" />
                </>
              )}
              {MENU.filter((m) => m.id !== "vendors" || FEATURES.vendors).map((m, i, items) => (
                <div key={m.id}>
                  {i > 0 && items[i - 1].group !== m.group && <div className="my-1 border-t border-suite-border/60" />}
                  <button
                    onClick={() => { setOpen(false); if (m.id === "vendors") onOpenVendors(); else if (m.id === "news") onOpenNews?.(); else setPanel(m.id); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded font-mono text-[11px] text-suite-text-muted hover:text-suite-text hover:bg-suite-panel-elevated text-left"
                  >
                    <m.icon className="size-3.5 shrink-0 text-suite-text-dim" strokeWidth={1.6} /> {m.label}
                  </button>
                </div>
              ))}
              <div className="my-1 border-t border-suite-border/60" />
              <div className="px-2 py-1 font-mono text-[9px] text-suite-text-dim">Kaos Theory · {version}</div>
            </div>
          </>
        )}
      </div>

      {panel && <Modal panel={panel} onClose={() => setPanel(null)} version={version} />}
    </div>
  );
}

function Modal({ panel, onClose, version }: { panel: Panel; onClose: () => void; version: string }) {
  const titles: Record<Panel, string> = {
    about: "About Kaos Theory",
    help: "Help — how to use Kaos Theory",
    vendors: "Vendor directory",
    feedback: "Send feedback",
    privacy: "Privacy",
    terms: "Terms & disclaimer",
  };
  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-lg border border-suite-border-strong bg-suite-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-suite-border">
          <h2 className="font-mono text-xs tracking-[0.18em] uppercase text-suite-text font-semibold">{titles[panel]}</h2>
          <button onClick={onClose} className="text-suite-text-muted hover:text-suite-text"><X className="size-4" strokeWidth={2} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {panel === "about" && <About />}
          {panel === "help" && <Help />}
          {panel === "feedback" && <Feedback />}
          {panel === "privacy" && <Privacy />}
          {panel === "terms" && <Terms />}
        </div>
        <div className="shrink-0 px-5 py-2 border-t border-suite-border font-mono text-[9px] text-suite-text-dim">Kaos Theory · {version}</div>
      </div>
    </div>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[12px] leading-relaxed text-suite-text-muted mb-3">{children}</p>
);
const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-mono text-[10px] tracking-[0.16em] uppercase text-suite-text-dim mt-4 mb-1.5">{children}</h3>
);

function Help() {
  const TABS: [string, string][] = [
    ["Capture", "Pick your camera + recording mode and see the real numbers: codec, data rate, framing/extraction, and the interactive lens view — drag focal length, aperture and distance and watch the 3D frustum, framing box and focus zone update. Save setups to reuse across the app."],
    ["Storage", "Per-camera shoot-day planning: cards/mags, offload at real link speeds (with checksum read-back), proxies, copies, and a combined-rig grand total. Saved Capture setups flow in as a checklist."],
    ["Deliverables", "The heart of delivery. Add recipients three ways — Build with AI (type a platform or paste a spec/email; it fills the spec dropdowns and itemises the punch-list), Build from template (27 platform starters incl. theatrical DCP), or by hand. Each recipient holds its own spec, language/version matrix, documents and deliverables with QC status. The Production list rolls everything up into what you actually make once. ⭐ marks the main deliverable; the Workflow graph shows the derive order and flags fps clashes."],
    ["Mastering", "The grade-once-derive-everything doctrine as an interactive tree: pick a strategy (or custom hero + deliverables) and see the make-order with fresh-pass warnings."],
    ["Workflow", "An editable node-graph of your whole pipeline — seed it from Deliverables/Mastering, then drag, edit and extend."],
    ["Planner", "A post schedule with phases on bars — plan the weeks from wrap to delivery."],
    ["Board", "A kanban task board with checklists and due dates. Drag to move and reorder (amber line shows where it lands), shift-click to multi-select, import cards from Deliverables/Mastering/Planner, export PDF/CSV/JSON or push the whole board to Trello."],
    ["Glossary", "Post terminology, searchable — from ACES to true peak."],
    ["Tools", "Calculators: timecode, frame rate, EDL/sequence converters and more."],
  ];
  return (
    <div>
      <P><span className="text-suite-text">The 30-second tour.</span> Kaos Theory follows a real job's shape: plan the shoot (Capture, Storage), plan the finish (Mastering, Deliverables), then run it (Workflow, Planner, Board). Everything saves per-project in your browser; sign in to sync.</P>
      <H>The tabs</H>
      <ul className="space-y-2 mb-3 list-none">
        {TABS.map(([t, d]) => (
          <li key={t} className="font-mono text-[12px] leading-relaxed text-suite-text-muted flex gap-2">
            <span className="text-guide-target mt-0.5 shrink-0">·</span>
            <span><span className="text-suite-text">{t}.</span> {d}</span>
          </li>
        ))}
      </ul>
      <H>A typical flow</H>
      <P>1) Capture: pick camera/mode, check framing and the lens view. 2) Storage: size the shoot. 3) Deliverables: add your recipients (AI or template), verify each spec against the platform's own doc, star the hero. 4) Mastering: sanity-check the grade order. 5) Push to Board, schedule in Planner, track to delivery. Export anything as you go — each tab has an Export, and the project menu has Export project.</P>
      <H>The AI bits</H>
      <P>Deliverables' Build/Grow with AI reads briefs and documents (PDF, Word, Excel, images — drag &amp; drop) and returns an itemised, deduplicated punch-list; Verify spec web-checks a platform's current delivery spec and shows a field-by-field diff you apply by hand. AI runs on the deployed site, never stores your documents server-side, and everything it produces is a starting point to verify — not gospel.</P>
      <H>Good to know</H>
      <P>Data lives per-project in this browser (localStorage) unless you sign in. The Vendor directory (this menu) answers "who do I use for X" by region. If something looks wrong, the Send feedback panel goes straight to the developer.</P>
    </div>
  );
}

function About() {
  return (
    <div>
      <P><span className="text-suite-text">Post-production got complicated.</span> One job now spans cameras, codecs, colour pipelines, VFX, audio, mastering and a dozen delivery specs — across as many departments. Kaos Theory is the map: a planning and reference companion for the whole pipeline, capture to delivery.</P>
      <H>Who it's for</H>
      <P>Post supervisors, DITs, camera, editorial, online editors &amp; assists, colour, audio — and anyone in the vicinity of post who needs to plan, cost, or simply understand the workflow.</P>
      <H>What it does</H>
      <P>Plan the whole pipeline: camera &amp; codec specs and framing, storage &amp; media planning, and a multicam planner for a full rig's combined data. ACES mastering, plus a deliverables planner that works out the make-order and a variable checklist for every recipient — then fans it out into a workflow chart.</P>
      <P>Editable workflow node-graphs, a post schedule, and a kanban task board with checklists. A verified vendor directory, AI-driven news watches, a post-term glossary, and post calculators (timecode, frame-rate, EDL). Sign in and your projects sync to your account.</P>
      <H>Why it exists</H>
      <P>To turn the chaos of a modern post pipeline into something you can see, plan and hand off — instead of it living only in one person's head.</P>
      <H>Why "Kaos Theory"</H>
      <P>Chaos theory studies systems that look random but actually run on strict, hidden rules. That's modern post exactly — so the name is a working metaphor, not just a vibe:</P>
      <ul className="space-y-2 mb-3 list-none">
        {[
          ["The butterfly effect", "One unapproved frame slip or metadata change in the offline can blow up weeks later — broken VFX plates, drifting audio, a failed conform."],
          ["Deterministic, but unpredictable", "The rules are rigid — codecs, timecode math, media management — yet with hundreds of hands on the same files, no two runs play out the same."],
          ["Strange attractors", "However wild it gets, a job always pulls toward the same fixed points: the delivery date, the budget, the spec. That orbit is the logo."],
          ["Self-similar", "The shape repeats at every scale — a three-act feature mirrors the scene, mirrors a single VFX shot."],
        ].map(([t, d]) => (
          <li key={t} className="font-mono text-[12px] leading-relaxed text-suite-text-muted flex gap-2">
            <span className="text-guide-target mt-0.5 shrink-0">·</span>
            <span><span className="text-suite-text">{t}.</span> {d}</span>
          </li>
        ))}
      </ul>
      <P>The point isn't to kill the chaos — it's to see the system, plan for the butterfly, and ride it to the attractor.</P>
    </div>
  );
}

function Feedback() {
  const [msg, setMsg] = useState("");
  const [role, setRole] = useState("");
  return (
    <div>
      <P>Spotted something wrong, or want a feature? Tell me — especially if a number looks off.</P>
      <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-suite-text-dim mb-1">Your role (optional)</label>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="e.g. Post super, DIT, Colourist…"
        className="w-full mb-3 bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1.5 text-[12px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
      />
      <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-suite-text-dim mb-1">Feedback</label>
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        rows={5}
        placeholder="What's working, what's wrong, what's missing…"
        className="w-full bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1.5 text-[12px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target resize-y"
      />
      <button
        onClick={() => { if (!msg.trim()) { toast.error("Type something first."); return; } setMsg(""); setRole(""); toast.success("Thanks — noted.", { description: "Feedback delivery isn't connected to a backend yet, so nothing was sent. Coming soon." }); }}
        className="mt-3 w-full px-3 py-2 text-[11px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors"
      >
        Send feedback
      </button>
      <p className="mt-2 font-mono text-[9px] text-suite-text-dim leading-relaxed">Heads-up: this form isn't wired to a backend yet, so submissions aren't delivered. It'll connect to email/Supabase soon.</p>
    </div>
  );
}

function Privacy() {
  return (
    <div>
      <P>Kaos Theory runs in your browser.</P>
      <H>What's stored, and where</H>
      <P>Your inputs — camera setups, schedules, custom workflows — are saved <span className="text-suite-text">locally on your device</span> (browser storage), not on our servers. Clearing your browser data removes them. There are no accounts yet, and we don't collect personal information.</P>
      <H>Analytics</H>
      <P>We collect anonymous, aggregate usage stats (page views — no personal data, no selling, no sharing) to see which tools get used. That's it.</P>
      <H>Exports</H>
      <P>Files you export (PDFs, charts, schedules, images) are generated in your browser and saved by you — they don't pass through us.</P>
    </div>
  );
}

function Terms() {
  return (
    <div>
      <div className="flex gap-2 rounded-sm border border-status-warn/40 bg-status-warn/5 px-3 py-2.5 mb-3">
        <AlertTriangle className="size-4 shrink-0 text-status-warn mt-0.5" strokeWidth={1.8} />
        <p className="font-mono text-[12px] leading-relaxed text-suite-text"><span className="font-semibold">Reference only — verify everything.</span></p>
      </div>
      <P>Kaos Theory is a planning and reference aid. The specifications, calculations, camera/codec data, storage and bandwidth estimates, colour-pipeline and mastering guidance, and every other figure it produces are for guidance only and may be incomplete, out of date, or wrong.</P>
      <H>Things change fast — check before you rely on it</H>
      <P>Standards, camera firmware, codec data rates, delivery specs and vendor requirements change constantly. Always confirm critical figures against the manufacturer's documentation, your post house, the platform's current delivery spec, and your own tests before you act on them.</P>
      <H>No liability</H>
      <P>Kaos Theory and its creators accept <span className="text-suite-text">no responsibility or liability</span> for any loss, cost, re-shoot, missed delivery, or damage arising from use of this tool or reliance on its output. You use it entirely at your own risk. Nothing here is professional, legal, or engineering advice.</P>
      <H>The bottom line</H>
      <P>The responsibility for checking and signing off any number is <span className="text-suite-text">yours</span>. By using Kaos Theory you accept these terms.</P>
    </div>
  );
}
