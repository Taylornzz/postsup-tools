import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ProjectManager } from "./ProjectManager";
import Index, { VERSION } from "@/pages/Index";
import { getActiveProjectId, setActiveProjectId as persistActive, getProject, type Project } from "@/lib/projects";
import { syncProjectDown, syncProjectUp } from "@/lib/projectSync";

/** Owns "which project is open". Restores that project's saved capture state into
 *  the URL, then mounts the app keyed by project id so it re-hydrates per project. */
export function ProjectGate() {
  const [activeId, setActiveId] = useState<string | null>(() => getActiveProjectId());
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!activeId) { setProject(null); setLoading(false); return; }
    setLoading(true);
    (async () => {
      // Pull a newer cloud snapshot into local storage BEFORE the keyed Index mounts, so the
      // tools hydrate from it (no-op when not signed in / nothing newer). Best-effort.
      try { await syncProjectDown(activeId); } catch { /* offline — fall back to local */ }
      const p = await getProject(activeId);
      if (cancelled) return;
      if (p) {
        const q = (p.data && typeof p.data.url === "string" ? p.data.url : "").replace(/^\?/, "");
        // Restore this project's state into the URL *before* the keyed Index mounts.
        window.history.replaceState({}, "", window.location.pathname + (q ? "?" + q : ""));
      } else {
        persistActive(null);
      }
      setProject(p);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeId]);

  const open = (id: string) => { persistActive(id); setActiveId(id); };
  const close = () => {
    const leaving = activeId;
    persistActive(null); setActiveId(null);
    // Push the latest local state up on the way out (best-effort; no-op when not signed in).
    if (leaving) syncProjectUp(leaving, Date.now()).catch(() => {});
  };

  if (loading) {
    return <div className="h-dvh w-full bg-suite-bg grid place-items-center"><Loader2 className="size-5 text-suite-text-dim animate-spin" strokeWidth={1.8} /></div>;
  }
  if (!project) return <ProjectManager onOpen={open} version={VERSION} />;
  return <Index key={project.id} project={project} onSwitchProject={close} />;
}
