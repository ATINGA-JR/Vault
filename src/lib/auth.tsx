import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { initStore, clearStore } from "./store";
import { initVault, clearVault } from "./vault";

interface AuthState {
  session: Session | null;
  user: User | null;
  username: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  username: null,
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUsername(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();
    if (data?.username) setUsername(data.username);
  }

  async function onSignIn(newSession: Session) {
    setSession(newSession);
    fetchUsername(newSession.user.id);
    // Load all module data and vault in parallel
    await Promise.all([
      initStore(newSession.user.id),
      initVault(newSession.user.id),
    ]);
  }

  function onSignOut() {
    setSession(null);
    setUsername(null);
    clearStore();
    clearVault();
  }

  useEffect(() => {
    // Hydrate immediately from cached session (avoids flash on reload)
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        await onSignIn(data.session);
      }
      setLoading(false);
    });

    // Keep in sync across tabs and token refreshes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession) {
        await onSignIn(newSession);
      } else {
        onSignOut();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, username, loading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
