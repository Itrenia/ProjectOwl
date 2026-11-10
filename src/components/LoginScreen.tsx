"use client";

import { useState, useEffect } from "react";
import UserAvatar from "@/components/UserAvatar";
import { authMode } from "@/lib/auth/mode";

/**
 * Signed-out screen. Mode-aware:
 * - mock (local dev): pick a seeded user (or create one) — sets the dev
 *   session cookie via POST /api/auth/session.
 * - supabase (staging/prod): "Continue with Google" via Supabase OAuth.
 */
export default function LoginScreen({ onSignedIn }: { onSignedIn: () => void }) {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4">
      <div className="text-5xl mb-4">🦉</div>
      <h1 className="text-2xl font-bold text-ink mb-2">ProjectOwl</h1>

      {authMode() === "supabase" ? (
        <GoogleLogin />
      ) : (
        <MockUserPicker onSignedIn={onSignedIn} />
      )}
    </main>
  );
}

function GoogleLogin() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
      const supabase = createSupabaseBrowserClient();
      // Carry the current path through the OAuth round-trip so deep links
      // (e.g. /join/[token] invites) land back where the user started.
      const next = window.location.pathname + window.location.search;
      const redirectTo =
        `${window.location.origin}/auth/callback` +
        (next !== "/" ? `?next=${encodeURIComponent(next)}` : "");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) setError(error.message);
      // On success the browser navigates away to Google — no state to reset.
    } catch {
      setError("Could not start sign-in. Please try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-sm text-ink-muted mb-8">Sign in to split receipts with friends</p>
      <button
        onClick={signIn}
        disabled={busy}
        className="flex items-center gap-3 px-6 py-3 bg-surface-raised border border-[var(--border)] rounded-xl shadow-sm hover:bg-canvas disabled:opacity-50 transition-colors"
      >
        <GoogleIcon />
        <span className="text-sm font-semibold text-ink">
          {busy ? "Redirecting…" : "Continue with Google"}
        </span>
      </button>
      {error && <p className="mt-4 text-sm text-negative">⚠ {error}</p>}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function MockUserPicker({ onSignedIn }: { onSignedIn: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUsers(json.data);
        else setError(json.error || "Failed to load users");
      })
      .catch(() => setError("Failed to connect to the server"));
  }, []);

  const selectUser = async (userId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (json.success) onSignedIn();
      else setError(json.error || "Failed to sign in");
    } catch {
      setError("Failed to connect to the server");
    } finally {
      setBusy(false);
    }
  };

  const createUser = async () => {
    if (!newName.trim() || !newEmail.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), email: newEmail.trim() }),
      });
      const json = await res.json();
      if (json.success) await selectUser(json.data.id);
      else {
        setError(json.error || "Failed to create user");
        setBusy(false);
      }
    } catch {
      setError("Failed to connect to the server");
      setBusy(false);
    }
  };

  return (
    <>
      <p className="text-sm text-ink-muted mb-8">Who are you? (local dev)</p>

      {error && <p className="mb-4 text-sm text-negative">⚠ {error}</p>}

      <div className="space-y-2 w-full max-w-xs">
        {users.map((user: any) => (
          <button
            key={user.id}
            onClick={() => selectUser(user.id)}
            disabled={busy}
            className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-canvas disabled:opacity-50 transition-colors"
          >
            <UserAvatar name={user.name} size="sm" />
            <span className="text-sm font-medium text-ink">{user.name}</span>
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowCreate(!showCreate)}
        className="mt-4 text-sm text-[var(--primary)] font-medium hover:underline"
      >
        {showCreate ? "Cancel" : "+ Create new user"}
      </button>

      {showCreate && (
        <div className="mt-3 w-full max-w-xs space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            aria-label="Name"
            placeholder="e.g. Alex Tan"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            aria-label="Email"
            placeholder="e.g. alex@example.com"
            className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
          <button
            onClick={createUser}
            disabled={busy || !newName.trim() || !newEmail.trim()}
            className="w-full px-4 py-2 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {busy ? "Working..." : "Create & sign in"}
          </button>
        </div>
      )}
    </>
  );
}
