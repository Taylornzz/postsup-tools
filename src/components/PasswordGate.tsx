import { useState } from "react";

/** Lightweight private-preview gate. Soft wall only — keeps casual visitors out of the
 *  live URL; it is NOT real security (the password lives in the client bundle).
 *  Stays on continuously until removed; once a visitor enters the password it is
 *  remembered on their device so they are not asked again. */

const PASSWORD = "1234";
const KEY = "postsup-gate-ok";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(() => {
    try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
  });
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);

  if (ok) return <>{children}</>;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (val === PASSWORD) {
      try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
      setOk(true);
    } else {
      setErr(true);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-suite-bg px-6">
      <form onSubmit={submit} className="w-full max-w-xs flex flex-col gap-4 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-2">
            <div className="size-2 rounded-full bg-guide-source shadow-[0_0_8px_hsl(var(--guide-source))]" />
            <span className="font-mono text-sm tracking-[0.22em] uppercase text-guide-target">KAOS THEORY</span>
          </div>
          <span className="font-mono text-[10px] text-suite-text-dim tracking-wide">what you're shooting · who it's for · how it gets there</span>
        </div>
        <p className="font-mono text-[11px] text-suite-text-dim leading-relaxed">Private preview — enter the password to continue.</p>
        <input
          type="password"
          autoFocus
          value={val}
          onChange={(e) => { setVal(e.target.value); setErr(false); }}
          placeholder="Password"
          className="w-full bg-suite-panel border border-suite-border rounded-sm px-3 py-2 text-center text-[14px] font-mono text-suite-text focus:outline-none focus:border-guide-target"
        />
        {err && <p className="font-mono text-[10px] text-destructive">Incorrect password.</p>}
        <button type="submit" className="w-full px-3 py-2 text-[11px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 transition-colors">
          Enter
        </button>
      </form>
    </div>
  );
}
