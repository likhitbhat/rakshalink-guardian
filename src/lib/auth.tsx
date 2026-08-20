import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  getMockSession,
  onMockAuthChange,
  signOutMock,
  type MockSession,
} from "@/lib/mock-auth";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "user" | "guardian";
  avatar_url: string | null;
  safety_score: number;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isMock: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function mockToSession(m: MockSession): Session {
  const user = {
    id: m.userId,
    email: m.email,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "mock" },
    user_metadata: { full_name: m.fullName },
    created_at: new Date(m.createdAt).toISOString(),
  } as unknown as User;
  return {
    access_token: "mock-access-token",
    refresh_token: "mock-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  } as unknown as Session;
}

function mockToProfile(m: MockSession): Profile {
  return {
    id: m.userId,
    full_name: m.fullName,
    phone: "+910000000000",
    role: m.role,
    avatar_url: null,
    safety_score: 92,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMock, setIsMock] = useState(false);

  const applyMock = (m: MockSession | null) => {
    if (m) {
      setIsMock(true);
      setSession(mockToSession(m));
      setProfile(mockToProfile(m));
    } else {
      setIsMock(false);
      setSession(null);
      setProfile(null);
    }
    setLoading(false);
  };

  const loadProfile = async (uid: string) => {
    try {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      setProfile((data as Profile) ?? null);
    } catch {
      setProfile(null);
    }
  };

  useEffect(() => {
    const offMock = onMockAuthChange((m) => applyMock(m));

    // Mock session wins when present — it only exists if the backend failed.
    const existingMock = getMockSession();
    if (existingMock) {
      applyMock(existingMock);
      return () => {
        offMock();
      };
    }

    let sub: { subscription: { unsubscribe: () => void } } | null = null;
    try {
      const res = supabase.auth.onAuthStateChange((_e, s) => {
        if (getMockSession()) return;
        setSession(s);
        if (s?.user) {
          setTimeout(() => loadProfile(s.user.id), 0);
        } else {
          setProfile(null);
        }
      });
      sub = res.data;
      supabase.auth
        .getSession()
        .then(({ data: { session: s } }) => {
          setSession(s);
          if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
          else setLoading(false);
        })
        .catch(() => setLoading(false));
    } catch {
      setLoading(false);
    }

    return () => {
      offMock();
      sub?.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        isMock,
        refreshProfile: async () => {
          if (isMock) return;
          if (session?.user) await loadProfile(session.user.id);
        },
        signOut: async () => {
          if (isMock) {
            signOutMock();
            return;
          }
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used within AuthProvider");
  return c;
}

