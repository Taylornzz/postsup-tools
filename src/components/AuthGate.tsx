import { useState, type ReactNode } from "react";
import { Loader2, Mail } from "lucide-react";
import { supabaseEnabled } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { PasswordGate } from "./PasswordGate";

/** Gates the app: real Supabase auth when configured, else the legacy preview password. */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!supabaseEnabled) return <PasswordGate>{children}</PasswordGate>;
  return <AuthInner>{children}</AuthInner>;
}

function AuthInner({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] grid place-items-center bg-suite-bg">
        <Loader2 className="size-5 text-suite-text-dim animate-spin" strokeWidth={1.8} />
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  return <>{children}</>;
}

function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setErr("Enter your email and password."); return; }
    setBusy(true); setErr(null);
    if (mode === "in") {
      const { error } = await signIn(email, password);
      if (error) setErr(error);
    } else {
      const { error, needsConfirm } = await signUp(email, password);
      if (error) setErr(error);
      else if (needsConfirm) setSent(true);
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 text-center">
          <Mail className="size-6 text-guide-target" strokeWidth={1.6} />
          <p className="font-mono text-[12px] text-suite-text leading-relaxed">Check your email to confirm your account, then come back and sign in.</p>
          <button onClick={() => { setSent(false); setMode("in"); }} className="font-mono text-[11px] text-guide-target hover:underline">Back to sign in</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <form onSubmit={submit} className="w-full flex flex-col gap-3">
        <input
          type="email" autoFocus value={email} autoComplete="email"
          onChange={(e) => { setEmail(e.target.value); setErr(null); }}
          placeholder="Email"
          className="w-full bg-suite-panel border border-suite-border rounded-sm px-3 py-2 text-[13px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
        />
        <input
          type="password" value={password} autoComplete={mode === "in" ? "current-password" : "new-password"}
          onChange={(e) => { setPassword(e.target.value); setErr(null); }}
          placeholder="Password"
          className="w-full bg-suite-panel border border-suite-border rounded-sm px-3 py-2 text-[13px] font-mono text-suite-text placeholder:text-suite-text-dim focus:outline-none focus:border-guide-target"
        />
        {err && <p className="font-mono text-[10px] text-destructive leading-relaxed">{err}</p>}
        <button
          type="submit" disabled={busy}
          className="w-full px-3 py-2 text-[11px] tracking-[0.14em] uppercase font-mono border rounded-sm text-guide-target border-guide-target/50 bg-guide-target/10 hover:bg-guide-target/20 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="size-3.5 animate-spin" strokeWidth={2} />}
          {mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(null); }}
        className="mt-3 font-mono text-[10px] text-suite-text-dim hover:text-suite-text"
      >
        {mode === "in" ? "No account? Create one" : "Have an account? Sign in"}
      </button>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-suite-bg px-6">
      <div className="w-full max-w-xs flex flex-col items-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className="size-2 rounded-full bg-guide-source shadow-[0_0_8px_hsl(var(--guide-source))]" />
          <span className="font-mono text-sm tracking-[0.22em] uppercase text-guide-target">KAOS THEORY</span>
        </div>
        <p className="font-mono text-[10px] text-suite-text-dim mb-6">Post-production planning &amp; reference</p>
        {children}
      </div>
    </div>
  );
}
