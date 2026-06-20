"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

// The caller's own session, mirrored from /api/me. Non-sensitive identity/role
// only; real authorization always remains server-side. This is the client-side
// source of truth for per-user UI once the nav / edit button / comment form are
// decoupled from the server render (so public pages can be cached). Nothing
// consumes it yet — mounting it now is a no-op for rendered output.
export type Session = {
  userId: string;
  displayName: string | null;
  isAdmin: boolean;
  isAuthor: boolean;
};

type SessionState = {
  session: Session | null;
  // true until the first /api/me response resolves — lets consumers show a
  // neutral shell rather than flicker logged-out → logged-in.
  loading: boolean;
};

const SessionContext = createContext<SessionState>({
  session: null,
  loading: true,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({
    session: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const r = await fetch("/api/me", {
          headers: { Accept: "application/json" },
        });
        const data = (r.ok ? await r.json() : { session: null }) as {
          session?: Session | null;
        };
        if (active) setState({ session: data.session ?? null, loading: false });
      } catch {
        if (active) setState({ session: null, loading: false });
      }
    };

    load(); // initial

    // Re-fetch on client auth changes (sign-in / sign-out / token refresh /
    // cross-tab) so the nav, edit button, and reaction/bookmark buttons update
    // without a hard refresh. /api/me is the source of truth (role/displayName
    // aren't in the JWT). INITIAL_SESSION is skipped — the initial load covers it.
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      load();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
  );
}

// Per-user UI reads its own session from here. `loading` is true until the first
// fetch resolves.
export function useSession(): SessionState {
  return useContext(SessionContext);
}
