/**
 * Mock authentication mode.
 *
 * Used only as a fallback for previewing the app when the backend is not
 * configured or unreachable. A fake session is persisted in localStorage so
 * refreshes keep you signed in.
 */

export type MockRole = "user" | "guardian";

export type MockSession = {
  mock: true;
  userId: string;
  email: string;
  role: MockRole;
  fullName: string;
  createdAt: number;
};

const KEY = "rakshalink.mock-session";
const listeners = new Set<(s: MockSession | null) => void>();

function emit(s: MockSession | null) {
  listeners.forEach((l) => l(s));
}

export function onMockAuthChange(cb: (s: MockSession | null) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getMockSession(): MockSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockSession;
    return parsed?.mock ? parsed : null;
  } catch {
    return null;
  }
}

export function inferMockRole(email: string): MockRole {
  return /guardian|parent|family/i.test(email) ? "guardian" : "user";
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0] || "Demo User";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 40);
}

/** Sign in with any credential. Role is inferred from the email unless given. */
export function signInMock(email: string, role?: MockRole): MockSession {
  const session: MockSession = {
    mock: true,
    userId: `mock-${btoa(email.toLowerCase()).replace(/[^a-z0-9]/gi, "").slice(0, 24) || "user"}`,
    email: email || "demo@rakshalink.app",
    role: role ?? inferMockRole(email),
    fullName: nameFromEmail(email || "Demo User"),
    createdAt: Date.now(),
  };
  localStorage.setItem(KEY, JSON.stringify(session));
  emit(session);
  return session;
}

export function signOutMock() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  emit(null);
}

/** True when the backend keys are missing/placeholder — mock mode is expected. */
export function isBackendConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  return Boolean(url && key && !url.includes("placeholder") && !key.includes("placeholder"));
}

/** Auth errors that mean "backend unavailable/misconfigured", not "wrong password". */
export function isBackendFailure(message?: string | null): boolean {
  if (!message) return true;
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("invalid api key") ||
    m.includes("missing supabase") ||
    m.includes("not configured") ||
    m.includes("fetch failed") ||
    m.includes("timeout") ||
    m.includes("503") ||
    m.includes("502")
  );
}

export function mockPostAuthPath(session: MockSession): "/app" | "/guardian" {
  return session.role === "guardian" ? "/guardian" : "/app";
}
