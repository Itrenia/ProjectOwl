"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TransactionCard from "@/components/TransactionCard";
import SwipeableRow from "@/components/SwipeableRow";
import PaidStamp from "@/components/PaidStamp";
import UserAvatar from "@/components/UserAvatar";
import UserPicker from "@/components/UserPicker";
import ErrorDialog from "@/components/ErrorDialog";
import { getSessionUser } from "@/lib/session";
import { authMode } from "@/lib/auth/mode";
import { tapHeavy, tapError, tapLight } from "@/lib/haptics";
import { consumeBackNavigation } from "@/lib/nav-direction";

/**
 * Group detail page — members / balances / settle-up actions, pairwise
 * "who owes you" lines, and the group's transaction ledger.
 */
export default function GroupDetailPage() {
  const params = useParams();
  const groupId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [group, setGroup] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showMembers, setShowMembers] = useState(false);
  const [showBalances, setShowBalances] = useState(false);

  // Entering via back-navigation (e.g. from the add-expense wizard) should
  // slide in from the left, mirroring the forward slide-in-from-right.
  // Applied imperatively (not via a className string) because Next's
  // back/forward cache can reactivate this component without remounting it,
  // which would skip a plain useState lazy initializer.
  const mainRef = useRef<HTMLElement>(null);
  const hasPlayedEntrance = useRef(false);

  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const playSlideIn = (direction: "left" | "right") => {
      el.classList.remove("animate-slide-in-left", "animate-slide-in-right");
      void el.offsetWidth; // force reflow so the animation replays
      el.classList.add(direction === "left" ? "animate-slide-in-left" : "animate-slide-in-right");
    };

    if (!hasPlayedEntrance.current) {
      hasPlayedEntrance.current = true;
      playSlideIn(consumeBackNavigation() ? "left" : "right");
    }

    // Catches the case where this page was reactivated from cache rather
    // than remounted: the popstate that brought us back fires while this
    // listener is live, and forces a fresh slide-left regardless.
    const handlePopState = () => playSlideIn("left");
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [loading, group]);

  const loadData = useCallback((currentUser: any) => {
    fetch(`/api/groups/${groupId}?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setGroup(json.data);
        else setError(json.error || "Failed to load group");
      })
      .catch(() => setError("Failed to connect to the server"));

    fetch(`/api/transactions?userId=${currentUser.id}&groupId=${groupId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setTransactions(json.data);
        else setError((prev) => prev || json.error || "Failed to load transactions");
      })
      .catch(() => setError((prev) => prev || "Failed to connect to the server"))
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

  /** Swipe-to-reveal delete. The row goes immediately, then loadData resyncs —
   *  deleting a transaction moves this group's nets and transfer plan, so the
   *  balances above the ledger can't just be spliced locally. */
  const handleDelete = useCallback(
    async (id: string) => {
      const previous = transactions;
      setTransactions((rows) => rows.filter((t) => t.id !== id));
      tapHeavy();
      try {
        const res = await fetch(`/api/transactions?id=${id}`, { method: "DELETE" });
        const json = await res.json();
        if (!json.success) {
          setTransactions(previous);
          tapError();
          setError(json.error || "Failed to delete transaction.");
          return;
        }
        if (user) loadData(user);
      } catch {
        setTransactions(previous);
        tapError();
        setError("Failed to connect to the server.");
      }
    },
    [transactions, user, loadData]
  );

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-sm text-ink-muted">Please select a user from the home page first.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
      </main>
    );
  }

  if (!group) {
    return (
      <main className="min-h-dvh flex flex-col items-center justify-center p-4 gap-3">
        <p className="text-sm text-ink-muted">{error || "Group not found"}</p>
        <Link href="/groups" className="text-sm font-medium text-[var(--primary)]">
          ← Back to groups
        </Link>
      </main>
    );
  }

  return (
    <main
      ref={mainRef}
      className="min-h-dvh px-4 pt-6 max-w-lg mx-auto animate-slide-in-right content-with-floating-nav"
    >
      <Link href="/groups" className="text-sm text-ink-muted hover:text-ink mb-4 block">
        ← Groups
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-full shrink-0"
          style={{ backgroundColor: group.color || "#9ca3af" }}
        />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink truncate">{group.name}</h1>
          <p className="text-xs text-ink-muted">
            {group.members.length} member{group.members.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {/* Action chips */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowMembers(true)}
          className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] rounded-lg backdrop-blur-sm pressable"
          style={{
            border: '1px solid var(--color-blueberry-700)',
            background: 'var(--color-blueberry-100)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
          }}
        >
          members
        </button>
        <button
          onClick={() => setShowBalances(true)}
          className="px-3 py-1.5 text-xs font-semibold text-[var(--primary)] rounded-lg backdrop-blur-sm pressable"
          style={{
            border: '1px solid var(--color-blueberry-700)',
            background: 'var(--color-blueberry-100)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
          }}
        >
          balances
        </button>
        <Link
          href={`/groups/${groupId}/settle-up`}
          className="px-3 py-1.5 text-xs font-semibold text-white rounded-lg backdrop-blur-sm pressable"
          style={{
            background: 'var(--color-blueberry-600)',
            border: '1px solid var(--color-blueberry-700)',
            boxShadow: '0 2px 6px color-mix(in srgb, var(--color-blueberry-900) 22%, transparent), 0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          settle up
        </Link>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {/* Pairwise summary vs. you */}
      {group.yourPairwise?.length > 0 && (
        <div className="mb-4 space-y-0.5">
          {group.yourPairwise.map((p: any) => (
            <p key={p.user.id} className="text-sm">
              {p.amount > 0 ? (
                <>
                  <span className="font-medium text-ink">{p.user.name}</span>
                  <span className="text-ink-muted"> owes you </span>
                  <span className="font-semibold text-[var(--success)]">
                    ${p.amount.toFixed(2)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-ink-muted">You owe </span>
                  <span className="font-medium text-ink">{p.user.name}</span>{" "}
                  <span className="font-semibold text-[var(--danger)]">
                    ${Math.abs(p.amount).toFixed(2)}
                  </span>
                </>
              )}
            </p>
          ))}
        </div>
      )}

      {/* Group is square — the resting watermark. Only once the group has
          actually seen activity, so an empty new group isn't stamped PAID. */}
      {transactions.length > 0 && !group.yourPairwise?.length && (
        <div
          className="relative rounded-[14px] mb-4 overflow-hidden"
          style={{
            height: 96,
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
          }}
        >
          <PaidStamp />
        </div>
      )}

      {/* Transactions */}
      <div className="space-y-2">
        {transactions.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-8">
            No transactions in this group yet
          </p>
        ) : (
          transactions.map((tx: any) => (
            <SwipeableRow key={tx.id} onDelete={() => handleDelete(tx.id)}>
              <TransactionCard
                id={tx.id}
                title={tx.title}
                totalAmount={tx.totalAmount}
                userShare={tx.userShare}
                paidByUserName={tx.paidByUser?.name ?? "Unknown"}
                paidByUserId={tx.paidByUserId}
                currentUserId={user.id}
                transactionDate={tx.transactionDate}
                type={tx.type}
                recipientName={tx.participants?.[0]?.user?.name}
                recipientUserId={tx.participants?.[0]?.user?.id}
              />
            </SwipeableRow>
          ))
        )}
      </div>

      {/* Floating add button — goes straight to a new expense for this group.
          It used to open a two-item menu (expense / payment); paying someone
          back now lives on the settle-up page, where the amounts you owe are
          on screen next to it. */}
      <Link
        href={`/transactions/new?groupId=${groupId}`}
        onClick={() => tapLight()}
        aria-label="Add an expense to this group"
        className="pressable fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full flex items-center justify-center text-3xl font-light text-white"
        style={{
          background: "var(--color-blueberry-600)",
          border: "1px solid var(--color-blueberry-700)",
          boxShadow:
            "0 8px 24px color-mix(in srgb, var(--color-blueberry-900) 24%, transparent), 0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 8%, transparent)",
        }}
      >
        +
      </Link>

      {/* Members sheet */}
      {showMembers && (
        <MembersSheet
          group={group}
          currentUser={user}
          onClose={() => setShowMembers(false)}
          onMembersChanged={() => loadData(user)}
        />
      )}

      {/* Balances sheet */}
      {showBalances && (
        <BalancesSheet
          group={group}
          currentUserId={user.id}
          onClose={() => setShowBalances(false)}
        />
      )}
    </main>
  );
}

/** Full-screen sheet header used by both modals. */
/**
 * Header for the full-screen group sheets.
 *
 * Was a solid Blueberry bar with a ✕ — a band of saturated colour across the
 * top of an otherwise cream app, and the only place in it that looked like
 * that. Now it matches the compose screen: canvas ground, hairline underneath,
 * a text Done, and the title centred between two equal-width sides so it
 * doesn't drift as the action label changes.
 */
function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-3 shrink-0"
      style={{
        background: "var(--color-canvas)",
        borderBottom: "1px solid var(--color-hairline)",
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
      }}
    >
      <span className="w-14" aria-hidden />
      <h2 className="flex-1 text-center text-callout font-bold text-ink">{title}</h2>
      <button
        onClick={onClose}
        className="pressable w-14 text-right text-callout font-semibold"
        style={{ color: "var(--color-blueberry-600)", minHeight: 44 }}
      >
        Done
      </button>
    </div>
  );
}

/** Group Balances — each member's net position ("gets back" / "owes"). */
function BalancesSheet({
  group,
  currentUserId,
  onClose,
}: {
  group: any;
  currentUserId: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[55] flex flex-col md:max-w-lg md:mx-auto"
      style={{ background: "var(--color-canvas)" }}
    >
      <SheetHeader title="Balances" onClose={onClose} />
      <div
        className="flex-1 overflow-y-auto px-4 pt-5"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-caption font-bold text-ink-muted uppercase tracking-wider">
            Where everyone stands
          </h3>
        </div>

        <div className="card-lift" style={{ overflow: "hidden" }}>
          {group.memberBalances.map((b: any, i: number) => {
            const isYou = b.user.id === currentUserId;
            const settled = Math.abs(b.net) < 0.005;
            return (
              <div
                key={b.user.id}
                className="flex items-center gap-3 px-4"
                style={{
                  minHeight: 66,
                  borderTop: i === 0 ? undefined : "1px solid var(--color-hairline)",
                }}
              >
                <UserAvatar name={b.user.name} size="md" />
                <span className="flex-1 min-w-0 text-callout font-semibold text-ink truncate">
                  {isYou ? "You" : b.user.name}
                </span>
                {settled ? (
                  <span className="text-subhead text-ink-muted">Settled</span>
                ) : (
                  /* Amount on top, what it means underneath — the number is
                     what's being compared down the column, so it leads. */
                  <span className="text-right shrink-0">
                    <span
                      className="block text-callout font-bold tabular"
                      style={{
                        color:
                          b.net > 0
                            ? "var(--color-positive)"
                            : "var(--color-negative)",
                      }}
                    >
                      ${Math.abs(b.net).toFixed(2)}
                    </span>
                    <span className="block text-footnote text-ink-muted">
                      {b.net > 0 ? "gets back" : "owes"}
                    </span>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Member list + add-by-email + shareable invite link. */
function MembersSheet({
  group,
  currentUser,
  onClose,
  onMembersChanged,
}: {
  group: any;
  currentUser: any;
  onClose: () => void;
  onMembersChanged: () => void;
}) {
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addedName, setAddedName] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  // Mock mode only: quick-add picker over all seeded users, for easy local
  // testing. GET /api/users is open in mock mode but signed-in-gated (and
  // enumerable-by-design) in supabase mode, so this never renders there.
  const isMock = authMode() === "mock";
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [toAdd, setToAdd] = useState<string[]>([]);

  useEffect(() => {
    if (!isMock) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAllUsers(json.data);
      })
      .catch(console.error);
  }, [isMock]);

  const memberIds = new Set(group.members.map((m: any) => m.id));
  const addable = allUsers.filter((u) => !memberIds.has(u.id));

  const quickAdd = async () => {
    if (toAdd.length === 0) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: toAdd }),
      });
      const json = await res.json();
      if (json.success) {
        setToAdd([]);
        onMembersChanged();
      } else {
        setDialogError({ title: "Add failed", message: json.error || "Failed to add members" });
      }
    } catch {
      setDialogError({ title: "Add failed", message: "Failed to connect to the server" });
    } finally {
      setAdding(false);
    }
  };

  const addByEmail = async () => {
    if (!email.trim()) return;
    setAdding(true);
    setAddedName(null);
    try {
      const res = await fetch(`/api/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setEmail("");
        const before = new Set(group.members.map((m: any) => m.id));
        const added = json.data.find((m: any) => !before.has(m.id));
        setAddedName(added?.name ?? "Member");
        onMembersChanged();
      } else {
        setDialogError({ title: "Add failed", message: json.error || "Failed to add member" });
      }
    } catch {
      setDialogError({ title: "Add failed", message: "Failed to connect to the server" });
    } finally {
      setAdding(false);
    }
  };

  const copyInviteLink = async () => {
    setInviteBusy(true);
    try {
      const res = await fetch(`/api/groups/${group.id}/invites`, { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        setDialogError({ title: "Invite failed", message: json.error || "Failed to create invite link" });
        return;
      }
      const url = `${window.location.origin}${json.data.path}`;
      try {
        await navigator.clipboard.writeText(url);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      } catch {
        // Clipboard blocked (e.g. non-HTTPS) — show the link so it can be copied manually.
        setDialogError({ title: "Invite link", message: url });
      }
    } catch {
      setDialogError({ title: "Invite failed", message: "Failed to connect to the server" });
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[55] flex flex-col md:max-w-lg md:mx-auto"
      style={{ background: "var(--color-canvas)" }}
    >
      <SheetHeader title="Members" onClose={onClose} />

      <div
        className="flex-1 overflow-y-auto px-4 pt-5"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Who's in ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-caption font-bold text-ink-muted uppercase tracking-wider">
            In this group
          </h3>
          <span className="text-caption font-bold text-ink-muted tabular">
            {group.members.length}
          </span>
        </div>

        <div className="card-lift mb-7" style={{ overflow: "hidden" }}>
          {group.members.map((m: any, i: number) => (
            <div
              key={m.id}
              className="flex items-center gap-3 px-4"
              style={{
                minHeight: 62,
                borderTop: i === 0 ? undefined : "1px solid var(--color-hairline)",
              }}
            >
              <UserAvatar name={m.name} size="md" />
              <span className="flex-1 min-w-0 text-callout font-semibold text-ink truncate">
                {m.id === currentUser.id ? "You" : m.name}
              </span>
              {m.id === group.createdByUserId && (
                /* A chip rather than grey caps floating at the edge — it's a
                   fact about the person, so it sits with them. */
                <span
                  className="shrink-0 text-caption font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                  style={{
                    color: "var(--color-blueberry-600)",
                    background: "var(--color-blueberry-100)",
                  }}
                >
                  Creator
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Add someone ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h3 className="text-caption font-bold text-ink-muted uppercase tracking-wider">
            Add someone
          </h3>
        </div>

        <div className="card-lift px-4 py-4 mb-4">
          <label className="block">
            <span className="block text-subhead font-bold text-ink mb-1.5">
              By email
            </span>
            <div className="flex gap-2">
              <input
                type="email"
                inputMode="email"
                autoCapitalize="none"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setAddedName(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && addByEmail()}
                placeholder="e.g. friend@example.com"
                className="flex-1 min-w-0 px-3.5 rounded-[12px] text-callout text-ink focus:outline-none focus:ring-2 focus:ring-blueberry-500"
                style={{
                  minHeight: 48,
                  background: "var(--color-surface-raised)",
                  border: "1px solid var(--color-hairline)",
                }}
              />
              <button
                onClick={addByEmail}
                disabled={adding || !email.trim()}
                className="pressable shrink-0 px-5 rounded-[12px] text-callout font-semibold text-white disabled:opacity-35"
                style={{ minHeight: 48, background: "var(--color-blueberry-600)" }}
              >
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </label>

          {addedName && (
            <p
              className="flex items-center gap-1.5 mt-2.5 text-subhead font-medium"
              style={{ color: "var(--color-positive)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l5 5 9-10" />
              </svg>
              {addedName} is in the group
            </p>
          )}

          <div
            className="mt-4 pt-4"
            style={{ borderTop: "1px solid var(--color-hairline)" }}
          >
            <p className="text-footnote text-ink-muted mb-2.5">
              No email, or they haven&apos;t signed up yet? Send them a link
              instead — it works for 7 days.
            </p>
            <button
              onClick={copyInviteLink}
              disabled={inviteBusy}
              className="pressable w-full flex items-center justify-center gap-2 rounded-[12px] text-callout font-semibold disabled:opacity-50"
              style={{
                minHeight: 48,
                color: "var(--color-blueberry-600)",
                background: "var(--color-blueberry-100)",
              }}
            >
              {inviteCopied ? (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12.5l5 5 9-10" />
                  </svg>
                  Link copied
                </>
              ) : inviteBusy ? (
                "Creating link…"
              ) : (
                <>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M10 13.5a4 4 0 0 0 5.7.3l2.6-2.6a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
                    <path d="M14 10.5a4 4 0 0 0-5.7-.3l-2.6 2.6a4 4 0 0 0 5.66 5.66l1.5-1.5" />
                  </svg>
                  Copy invite link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Mock mode: pick any seeded user directly (local testing shortcut) */}
        {isMock && (
          <div
            className="rounded-[18px] px-4 py-4"
            style={{
              background: "var(--color-warning-tint)",
              border: "1px dashed var(--color-warning)",
            }}
          >
            <p className="text-caption font-bold uppercase tracking-wider mb-2.5" style={{ color: "var(--color-warning)" }}>
              Quick add · local dev only
            </p>
            {addable.length === 0 ? (
              <p className="text-subhead text-ink-muted">
                Everyone is already in this group.
              </p>
            ) : (
              <>
                <UserPicker
                  selectedUserIds={toAdd}
                  onChange={setToAdd}
                  users={addable}
                  label=""
                />
                <button
                  onClick={quickAdd}
                  disabled={adding || toAdd.length === 0}
                  className="pressable w-full mt-3 rounded-[12px] text-callout font-semibold text-white disabled:opacity-35"
                  style={{ minHeight: 48, background: "var(--color-blueberry-600)" }}
                >
                  {adding
                    ? "Adding…"
                    : `Add ${toAdd.length || ""} member${toAdd.length === 1 ? "" : "s"}`}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </div>
  );
}
