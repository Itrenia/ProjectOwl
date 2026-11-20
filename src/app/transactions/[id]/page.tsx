"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import UserAvatar from "@/components/UserAvatar";
import ConfirmDialog from "@/components/ConfirmDialog";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";

/**
 * Transaction detail page — itemized breakdown, per-person totals,
 * paid-by badge, settle-up action, edit/delete.
 */
export default function TransactionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [tx, setTx] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);

    fetch(`/api/transactions?id=${params.id}&userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          // getTransaction singular returns data directly
          setTx(json.data);
        } else if (json.data) {
          setTx(json.data);
        } else {
          setError(json.error || "Failed to load transaction");
        }
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDelete = useCallback(async () => {
    try {
      const response = await fetch(`/api/transactions?id=${params.id}`, {
        method: "DELETE",
      });
      const json = await response.json();
      if (json.success) {
        // Land somewhere that still exists: the group ledger the expense
        // belongs to, or home for non-group transactions. replace() so Back
        // never returns to the deleted record's now-404 detail route.
        router.replace(tx?.groupId ? `/groups/${tx.groupId}` : "/");
        return;
      }
      setDialogError({
        title: "Delete failed",
        message: json.error || "Failed to delete transaction.",
      });
    } catch (err) {
      setDialogError({
        title: "Delete failed",
        message: "Failed to connect to the server.",
      });
    }
    setShowDeleteDialog(false);
  }, [params.id, router, tx]);

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
      </main>
    );
  }

  if (!tx) {
    return (
      <main className="min-h-full flex items-center justify-center p-4">
        <p className="text-sm text-negative">{error || "Transaction not found"}</p>
        {error && (
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-4 py-2 text-sm font-medium text-[var(--primary)] border border-[var(--primary)] rounded-lg hover:bg-blueberry-100"
          >
            Try again
          </button>
        )}
      </main>
    );
  }

  const payers: { user?: { id: string; name: string }; amountPaid: number }[] =
    tx.payers ?? [];
  const splitAcrossPayers = payers.length > 1;
  // Both sides guarded: an unresolved payer row leaves p.user undefined, and
  // user is null until the session loads — `undefined === undefined` would
  // otherwise report you as a payer and hide both call-to-actions.
  const isPayer = splitAcrossPayers
    ? payers.some((p) => !!p.user?.id && !!user?.id && p.user.id === user.id)
    : !!user?.id && user.id === tx.paidByUserId;
  const isPayment = tx.type === "payment";
  // "Pay back" shortcut: you owe a share of this expense to whoever paid it.
  // Offered only when ONE person paid. With several contributors the share is
  // owed to each of them in proportion to what they put in, so prefilling a
  // single payment for the whole share would send far too much to one of them.
  // Settle-up works off net balances and gets it right, so point there.
  const youOwe = !isPayer && !isPayment && tx.userShare > 0 && !splitAcrossPayers;
  const owesAcrossPayers =
    !isPayer && !isPayment && tx.userShare > 0 && splitAcrossPayers;

  return (
    <main className="min-h-full px-4 pt-6 max-w-lg mx-auto animate-slide-in-right content-with-floating-nav">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-ink-muted hover:text-ink mb-4 block"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-ink">
          {isPayment && <span className="mr-1.5">💸</span>}
          {tx.title}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-ink-muted">
            {new Date(tx.transactionDate).toLocaleDateString("en-US", {
              weekday: "short", month: "short", day: "numeric", year: "numeric",
            })}
          </span>
          <span className="text-xs text-ink-muted">·</span>
          <span className="text-xs text-ink-muted">
            {isPayment
              ? `${isPayer ? "You" : tx.paidByUser?.name ?? "Someone"} paid ${
                  tx.participants?.[0]?.user.id === user?.id
                    ? "you"
                    : tx.participants?.[0]?.user.name ?? "someone"
                } $${tx.totalAmount.toFixed(2)}`
              : isPayer ? "You paid" : `${tx.paidByUser?.name ?? "Someone"} paid`}
          </span>
        </div>
      </div>

      {/* Itemized breakdown (with scan assignments if available) */}
      {tx.items && tx.items.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-4 backdrop-blur-sm"
             style={{
               background: 'var(--color-surface)',
               border: '1px solid var(--color-hairline)',
               boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
             }}>
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-canvas/80">
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Items</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {tx.items.map((item: any, i: number) => {
              // Find assignments for this item
              const itemAssignments = (tx.itemAssignments ?? []).filter(
                (a: any) => a.itemId === item.id
              );
              return (
                <div key={i} className="px-4 py-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-ink font-medium">
                      {item.name}
                      {item.quantity > 1 && (
                        <span className="text-ink-muted"> ×{item.quantity}</span>
                      )}
                    </span>
                    <span className="font-mono text-ink">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                  {/* Show item assignments */}
                  {itemAssignments.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      {itemAssignments.map((a: any) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 text-[11px] text-ink-muted bg-canvas px-2 py-0.5 rounded-full"
                        >
                          <UserAvatar name={a.userName} size="sm" />
                          {a.userName.split(" ")[0]}
                          <span className="font-mono text-ink-muted">
                            ${a.shareAmount.toFixed(2)}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-person totals */}
      {tx.participants && tx.participants.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-4 backdrop-blur-sm"
             style={{
               background: 'var(--color-surface)',
               border: '1px solid var(--color-hairline)',
               boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
             }}>
          <div className="px-4 py-2.5 border-b border-[var(--border)] bg-canvas/80">
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Split</h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {tx.participants.map((p: any) => (
              <div key={p.user.id} className="px-4 py-2.5 flex items-center justify-between backdrop-blur-sm" style={{ background: 'var(--color-surface)' }}>
                <div className="flex items-center gap-2">
                  <UserAvatar name={p.user.name} size="sm" />
                  <span className="text-sm text-ink">
                    {p.user.name}
                    {p.user.id === tx.paidByUserId && (
                      <span className="ml-1.5 text-[10px] text-[var(--primary)] bg-blueberry-100 px-1.5 py-0.5 rounded-full font-medium">
                        paid
                      </span>
                    )}
                  </span>
                </div>
                <span className="text-sm font-mono font-medium text-ink">
                  ${p.shareAmount.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-[var(--border)] flex justify-between backdrop-blur-sm" style={{ background: 'var(--color-surface)' }}>
            <span className="text-sm font-semibold text-ink">Total</span>
            <span className="text-sm font-mono font-bold text-ink">${tx.totalAmount.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2">
        {youOwe && tx.groupId && (
          <a
            href={`/payments/new?groupId=${tx.groupId}&toUserId=${tx.paidByUserId}&amount=${tx.userShare}`}
            className="block w-full px-4 py-2.5 text-center text-sm font-semibold text-white rounded-xl backdrop-blur-sm pressable"
            style={{
              background: 'var(--color-blueberry-600)',
              border: '1px solid var(--color-blueberry-700)',
              boxShadow: '0 2px 6px color-mix(in srgb, var(--color-blueberry-900) 22%, transparent), 0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            💸 Pay {tx.paidByUser?.name ?? "them"} back ${tx.userShare.toFixed(2)}
          </a>
        )}

        {/* Several people paid, so this share is owed to more than one of them. */}
        {owesAcrossPayers && tx.groupId && (
          <a
            href={`/groups/${tx.groupId}/settle-up`}
            className="block w-full px-4 py-3 text-center rounded-xl pressable"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            <span className="block text-callout font-semibold text-ink">
              Settle up
            </span>
            <span className="block text-footnote text-ink-muted mt-0.5">
              {payers.length} people paid for this — settle up works out who you
              owe and how much
            </span>
          </a>
        )}
        <button
          onClick={() => setShowDeleteDialog(true)}
          className="w-full px-4 py-2.5 text-sm font-medium text-[var(--danger)] rounded-xl backdrop-blur-sm pressable"
          style={{
            border: '1px solid rgba(197,66,58,0.3)',
            background: 'linear-gradient(135deg, rgba(197,66,58,0.08) 0%, rgba(197,66,58,0.04) 100%)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
          }}
        >
          Delete transaction
        </button>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete transaction?"
        message={`Are you sure you want to delete "${tx.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteDialog(false)}
      />

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
