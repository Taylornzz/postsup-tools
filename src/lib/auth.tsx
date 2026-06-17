import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase, supabaseEnabled } from "./supabase";
import { clearFiles } from "./fileStore";

/** Wipe all locally-cached project data (localStorage app keys + attachment blobs) so a
 *  signed-out or switched account leaves nothing readable on a shared device. The cloud
 *  copy is untouched — this only clears the on-device cache. */
export function clearLocalAppData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("kaos") || k.startsWith("postsup"))) keys.push(k);
    }
    keys.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  } catch { /* ignore */ }
  clearFiles().catch(() => {});
}

type AuthValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirm: boolean }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseEnabled);

  const prevUserId = useRef<string | null>(null);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { prevUserId.current = data.session?.user?.id ?? null; setUser(data.session?.user ?? null); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const nextId = session?.user?.id ?? null;
      // Clear the on-device cache on sign-out, or when the account switches to a different
      // user — otherwise the previous user's confidential planning data stays readable here.
      if (event === "SIGNED_OUT" || (nextId && prevUserId.current && nextId !== prevUserId.current)) {
        clearLocalAppData();
      }
      prevUserId.current = nextId;
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    user,
    loading,
    signIn: async (email, password) => {
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error?.message ?? null };
    },
    signUp: async (email, password) => {
      const { data, error } = await supabase!.auth.signUp({ email: email.trim(), password });
      // If a user exists but there's no session, email confirmation is required.
      return { error: error?.message ?? null, needsConfirm: !!data.user && !data.session };
    },
    signOut: async () => { await supabase!.auth.signOut(); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
