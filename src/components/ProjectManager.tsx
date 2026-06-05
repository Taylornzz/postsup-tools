import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, MoreVertical, Pencil, Copy, Trash2, X, LogIn, LogOut, Loader2, FolderOpen, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabaseEnabled } from "@/lib/supabase";
import {
  Project, PROJECT_COLORS, listProjects, createProject, updateProject, deleteProject, duplicateProject,
} from "@/lib/projects";

type ModalState = { mode: "new" | "rename"; id?: string; name: string; color: string } | null;

const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

export function ProjectManager({ onOpen, version }: { onOpen: (id: string) => void; version: string }) {
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const refresh = async () => setProjects(await listProjects());
  useEffect(() => { listProjects().then((p) => { setProjects(p); setLoading(false); }); }, []);

  const save = async () => {
    if (!modal) return;
    const name = modal.name.trim();
    if (!name) { toast.error("Give the project a name."); return; }
    setBusy(true);
    try {
      if (modal.mode === "new") {
        const p = await createProject(name, modal.color);
        setModal(null);
        onOpen(p.id);
      } else if (modal.id) {
        await updateProject(modal.id, { name, color: modal.color });
        setModal(null);
        await refresh();
      }
    } catch (e) {
      toast.error("Couldn't save — " + (e instanceof Error ? e.message : "try again"));
    } finally { setBusy(false); }
  };

  return (
    <div className="h-dvh w-full bg-suite-bg text-suite-text flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-12 shrink-0 flex items-center justify-between px-5 border-b border-suite-border bg-suite-panel">
        <div className="flex items-center gap-3">
          <div className="size-2 rounded-full bg-guide-source shadow-[0_0_8px_hsl(var(--guide-source))]" />
          <h1 className="font-mono text-xs tracking-[0.22em] uppercase text-guide-target">KAOS THEORY</h1>
          <span className="font-mono text-[10px] text-suite-text-dim">{version}</span>
        </div>
        {supabaseEnabled && user ? (
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-[10px] text-suite-text-dim hidden sm:inline max-w-[200px] truncate">{user.email}</span>
            <button onClick={() => signOut()} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors">
              <LogOut className="size-3" strokeWidth={1.6} /> Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => toast("Sign-in isn't configured here.", { description: "Projects save locally in this browser." })}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] tracking-[0.14em] uppercase font-mono border rounded-sm text-suite-text-muted border-suite-border hover:text-suite-text hover:border-suite-border-strong bg-suite-bg transition-colors"
          >
            <LogIn className="size-3" strokeWidth={1.6} /> Login
          </button>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-mono text-lg tracking-[0.12em] uppercase text-suite-text font-bold">Projects</h2>
            <span className="font-mono text-[10px] text-suite-text-dim flex items-center gap-1.5"><Cloud className="size-3" strokeWidth={1.6} /> {supabaseEnabled ? "Synced to your account" : "Local · cloud sync soon"}</span>
          </div>
          <p className="font-mono text-[11px] text-suite-text-dim mb-6">Each project holds one production's setup. Open one to work on it.</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* New project tile */}
            <button
              onClick={() => setModal({ mode: "new", name: "", color: PROJECT_COLORS[0] })}
              className="group flex flex-col items-center justify-center gap-2 h-[124px] rounded-lg border border-dashed border-suite-border hover:border-guide-target/60 bg-suite-panel/40 hover:bg-suite-panel transition-colors"
            >
              <Plus className="size-6 text-suite-text-dim group-hover:text-guide-target" strokeWidth={1.6} />
              <span className="font-mono text-[11px] text-suite-text-muted group-hover:text-suite-text">New project</span>
            </button>

            {projects.map((p) => (
              <div
                key={p.id}
                onClick={() => onOpen(p.id)}
                className="group relative h-[124px] rounded-lg border border-suite-border hover:border-suite-border-strong bg-suite-panel overflow-hidden cursor-pointer transition-colors"
              >
                <div className="h-16 relative" style={{ background: `linear-gradient(135deg, ${p.color}cc, ${p.color}55)` }}>
                  <FolderOpen className="absolute bottom-1.5 left-2 size-4 text-black/40" strokeWidth={1.8} />
                </div>
                <div className="p-2.5">
                  <div className="font-mono text-[12px] text-suite-text font-semibold truncate">{p.name}</div>
                  <div className="font-mono text-[9px] text-suite-text-dim mt-0.5">Edited {fmtDate(p.updatedAt)}</div>
                </div>

                {/* actions */}
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === p.id ? null : p.id); }}
                  className="absolute top-1.5 right-1.5 grid place-items-center size-6 rounded bg-black/30 text-white/80 hover:bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="size-3.5" strokeWidth={2} />
                </button>
                {menuFor === p.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMenuFor(null); }} />
                    <div className="absolute top-8 right-1.5 z-50 w-32 rounded-md border border-suite-border-strong bg-suite-panel shadow-xl p-1 flex flex-col" onClick={(e) => e.stopPropagation()}>
                      <MenuItem icon={Pencil} label="Rename" onClick={() => { setMenuFor(null); setModal({ mode: "rename", id: p.id, name: p.name, color: p.color }); }} />
                      <MenuItem icon={Copy} label="Duplicate" onClick={async () => { setMenuFor(null); await duplicateProject(p.id); refresh(); }} />
                      <MenuItem icon={Trash2} label="Delete" danger onClick={async () => { setMenuFor(null); if (window.confirm(`Delete “${p.name}”? This can't be undone.`)) { await deleteProject(p.id); refresh(); } }} />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {loading && (
            <p className="mt-6 font-mono text-[11px] text-suite-text-dim flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" strokeWidth={2} /> Loading projects…</p>
          )}
          {!loading && projects.length === 0 && (
            <p className="mt-6 font-mono text-[11px] text-suite-text-dim">No projects yet — hit <span className="text-suite-text">New project</span> to start.</p>
          )}
        </div>
      </div>

      {/* New / rename modal */}
      {modal && (
        <div className="fixed inset-0 z-[200] grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm rounded-lg border border-suite-border-strong bg-suite-panel shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-suite-border">
              <h3 className="font-mono text-xs tracking-[0.18em] uppercase text-suite-text font-semibold">{modal.mode === "new" ? "New project" : "Rename project"}</h3>
              <button onClick={() => setModal(null)} className="text-suite-text-muted hover:text-suite-text"><X className="size-4" strokeWidth={2} /></button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-suite-text-dim">Name</span>
                <input
                  autoFocus value={modal.name}
                  onChange={(e) => setModal({ ...modal, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                  placeholder="e.g. Feature — Working Title"
                  className="bg-suite-bg border border-suite-border rounded-sm px-2.5 py-1.5 text-[13px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
                />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-suite-text-dim">Colour</span>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map((c) => (
                    <button key={c} onClick={() => setModal({ ...modal, color: c })}
                      className={cn("size-7 rounded-md border-2 transition-transform", modal.color === c ? "scale-110" : "border-transparent hover:scale-105")}
                      style={{ backgroundColor: c, borderColor: modal.color === c ? "#fff" : "transparent" }} />
                  ))}
                </div>
              </div>
              <button onClick={save} disabled={busy} className="mt-1 w-full px-3 py-2 text-[11px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {busy && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
                {modal.mode === "new" ? "Create & open" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 px-2 py-1.5 rounded font-mono text-[11px] text-left hover:bg-suite-panel-elevated", danger ? "text-destructive" : "text-suite-text-muted hover:text-suite-text")}>
      <Icon className="size-3.5 shrink-0" strokeWidth={1.6} /> {label}
    </button>
  );
}
