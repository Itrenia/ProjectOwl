"use client";

import { useState, useEffect, useCallback } from "react";
import UserAvatar from "@/components/UserAvatar";
import ErrorDialog from "@/components/ErrorDialog";
import SettledOverlay from "@/components/SettledOverlay";
import { getSessionUser } from "@/lib/session";

/**
 * Settle up page — shows personalized "who pays who" view
 * with a toggle for the full optimized settlement plan.
 */
export default function SettleUpPage() {
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);

    fetch(`/api/balances?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data);
        else setError(json.error || "Failed to load balances");
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, []);

  const handleMarkPaid = useCallback(async (fromUserId: string, toUserId: string, amount: number) => {
    setSettling(`${fromUserId}-${toUserId}`);

    try {
      const response = await fetch("/api/settlements/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUserId, toUserId, amount }),
      });

      const json = await response.json();
      if (json.success) {
        // Was this the last outstanding line on either side? If so everything
        // across every group is clear — the rarer, bigger moment.
        const openLines = (balance?.perPerson ?? []).filter(
          (p: any) => Math.abs(p.amount) > 0.005
        ).length;
        if (openLines <= 1) {
          setCelebrating(true);
          setTimeout(() => window.location.reload(), 2200);
        } else {
          setMessage("Marked as paid");
          setTimeout(() => window.location.reload(), 1500);
        }
      } else {
        setDialogError({
          title: "Payment failed",
          message: json.error || "Failed to record payment. Please try again.",
        });
      }
    } catch (err) {
      setDialogError({
        title: "Payment failed",
        message: "Failed to connect to the server.",
      });
    } finally {
      setSettling(null);
    }
  }, [balance]);

  if (!user) {
    return (
      <main className="min-h-full flex items-center justify-center p-4">
        <p className="text-sm text-ink-muted">Please select a user from the home page first.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
      </main>
    );
  }

  if (celebrating) {
    return (
      <SettledOverlay
        title="All square"
        detail="Nothing outstanding with anyone"
      />
    );
  }

  // Compute pay/owe lists
  const youOwe = balance?.perPerson?.filter((p: any) => p.amount < 0) ?? [];
  const owedToYou = balance?.perPerson?.filter((p: any) => p.amount > 0) ?? [];

  return (
    <main className="min-h-full px-4 pt-6 max-w-lg mx-auto content-with-floating-nav">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Settle Up</h1>
          <p className="text-sm text-ink-muted mt-0.5">Who pays who</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {/* Balance summary */}
      {balance && (
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-ink-muted">You get paid</p>
              <p className="text-lg font-bold text-[var(--success)]">
                +${balance.totalOwed.toFixed(2)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-muted">You pay</p>
              <p className="text-lg font-bold text-[var(--danger)]">
                -${balance.totalOwe.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div className="mb-4 px-4 py-2 bg-positive-tint border border-positive-soft rounded-lg text-sm text-positive">
          {message}
        </div>
      )}

      {/* People who owe you */}
      {owedToYou.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
            Owes you
          </h2>
          <div className="space-y-2">
            {owedToYou.map((p: any) => (
              <div
                key={p.user.id}
                className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl"
              >
                <UserAvatar name={p.user.name} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{p.user.name}</p>
                  <p className="text-xs text-[var(--success)]">
                    owes you ${Math.abs(p.amount).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleMarkPaid(p.user.id, user.id, Math.abs(p.amount))}
                  disabled={settling === `${p.user.id}-${user.id}`}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--success)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {settling === `${p.user.id}-${user.id}` ? "..." : "Mark paid"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* People you owe */}
      {youOwe.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">
            You owe
          </h2>
          <div className="space-y-2">
            {youOwe.map((p: any) => (
              <div
                key={p.user.id}
                className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl"
              >
                <UserAvatar name={p.user.name} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-ink">{p.user.name}</p>
                  <p className="text-xs text-[var(--danger)]">
                    you owe ${Math.abs(p.amount).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleMarkPaid(user.id, p.user.id, Math.abs(p.amount))}
                  disabled={settling === `${user.id}-${p.user.id}`}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[var(--danger)] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {settling === `${user.id}-${p.user.id}` ? "..." : "Pay"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All settled */}
      {owedToYou.length === 0 && youOwe.length === 0 && (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm text-ink-muted font-medium">All settled up!</p>
          <p className="text-xs text-ink-muted mt-1">No outstanding balances</p>
        </div>
      )}

      {/* Error dialog (POST action failures) */}
      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
  );
}
