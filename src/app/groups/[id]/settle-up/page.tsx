"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import ErrorDialog from "@/components/ErrorDialog";
import SettledOverlay from "@/components/SettledOverlay";
import { PaymentDiagram } from "@/components/PaymentDiagram";
import { getSessionUser } from "@/lib/session";
import { tapLight } from "@/lib/haptics";

/**
 * Group settle-up — the minimum-transfer plan that clears every balance
 * in the group, with Mark-paid buttons on the payments you're part of.
 */
export default function GroupSettleUpPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [plan, setPlan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  const loadData = useCallback((currentUser: any) => {
    fetch(`/api/groups/${groupId}?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroup(json.data);
          setPlan(json.data.transferPlan ?? []);
        } else {
          setError(json.error || "Failed to load group");
        }
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, [groupId]);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);
    loadData(currentUser);
  }, [loadData]);

  const handleMarkPaid = useCallback(
    async (fromUserId: string, toUserId: string, amount: number) => {
      setSettling(`${fromUserId}-${toUserId}`);
      try {
        const response = await fetch("/api/settlements/mark-paid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromUserId, toUserId, amount, groupId }),
        });
        const json = await response.json();
        if (json.success) {
          // If this was the last transfer in the plan, the group is now square
          // — that's the moment worth marking. The reload delay already
          // existed; the stamp just fills a pause that used to show a string.
          const clearsGroup = plan.length <= 1;
          if (clearsGroup) {
            setCelebrating(true);
            setTimeout(() => window.location.reload(), 2200);
          } else {
            setMessage("Marked as paid");
            setTimeout(() => window.location.reload(), 1200);
          }
        } else {
          setDialogError({
            title: "Payment failed",
            message: json.error || "Failed to record payment. Please try again.",
          });
        }
      } catch {
        setDialogError({ title: "Payment failed", message: "Failed to connect to the server." });
      } finally {
        setSettling(null);
      }
    },
    [groupId]
  );

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
        detail={`Nobody owes anybody in ${group?.name ?? "this group"}`}
      />
    );
  }

  return (
    <main className="min-h-full px-4 pt-6 max-w-lg mx-auto content-with-floating-nav">
      <Link
        href={`/groups/${groupId}`}
        className="text-sm text-ink-muted hover:text-ink mb-4 block"
      >
        ← {group?.name ?? "Group"}
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">Settle Up</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          Fewest payments to clear the whole group
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {message && (
        <div className="mb-4 px-4 py-2 bg-positive-tint border border-positive-soft rounded-lg text-sm text-positive">
          {message}
        </div>
      )}

      {plan.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">✅</p>
          <p className="text-sm text-ink-muted font-medium">All settled up!</p>
          <p className="text-xs text-ink-muted mt-1">No outstanding balances in this group</p>
        </div>
      ) : (
        <div className="space-y-2">
          {plan.map((t: any) => {
            const key = `${t.fromUser.id}-${t.toUser.id}`;
            const youPay = t.fromUser.id === user.id;
            const youReceive = t.toUser.id === user.id;
            return (
              <div
                key={key}
                className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl"
              >
                <UserAvatar name={t.fromUser.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{youPay ? "You" : t.fromUser.name}</span>
                    <span className="text-ink-muted"> pays </span>
                    <span className="font-medium">{youReceive ? "you" : t.toUser.name}</span>
                  </p>
                  <p className={`text-xs font-semibold ${
                    youReceive ? "text-[var(--success)]" : youPay ? "text-[var(--danger)]" : "text-ink-muted"
                  }`}>
                    ${t.amount.toFixed(2)}
                  </p>
                </div>
                {youPay && (
                  <Link
                    href={`/payments/new?groupId=${groupId}&toUserId=${t.toUser.id}&amount=${t.amount}`}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 transition-opacity bg-[var(--danger)]"
                  >
                    💸 Pay
                  </Link>
                )}
                {youReceive && (
                  <button
                    onClick={() => handleMarkPaid(t.fromUser.id, t.toUser.id, t.amount)}
                    disabled={settling === key}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity bg-[var(--success)]"
                  >
                    {settling === key ? "..." : "Mark paid"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Free-form payment entry. The rows above cover the plan's transfers
          exactly; this is the way in for everything else — a part payment, a
          repayment that isn't in the simplified plan, or squaring up after the
          group already reads as settled. It lives here rather than on the Add
          tab because paying someone back only means anything next to the
          amounts you owe. */}
      <Link
        href={`/payments/new?groupId=${groupId}`}
        onClick={() => tapLight()}
        className="pressable mt-6 w-full flex items-center gap-3 p-4 rounded-[14px] text-left"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-hairline)",
          boxShadow:
            "0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)",
        }}
      >
        <span
          className="shrink-0 flex items-center justify-center rounded-[10px]"
          style={{
            width: 44,
            height: 44,
            background: "var(--color-surface-raised)",
            color: "var(--color-blueberry-600)",
          }}
        >
          <PaymentDiagram className="w-7 h-7" />
        </span>
        <span className="min-w-0">
          <span className="block text-headline font-semibold text-ink">
            Record a payment
          </span>
          <span className="block text-subhead text-ink-muted mt-0.5">
            Paid someone a different amount, or someone not listed above
          </span>
        </span>
      </Link>

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
  );
}
