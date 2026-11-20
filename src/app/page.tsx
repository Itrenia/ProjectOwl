"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AccountButton from "@/components/AccountButton";
import GroupPickerWheel from "@/components/GroupPickerWheel";
import PullToRefresh from "@/components/PullToRefresh";
import PaidStamp from "@/components/PaidStamp";
import { getSessionUser } from "@/lib/session";
import { isSettled, isNetZeroButOpen } from "@/lib/settled";
import type { BalanceSummary } from "@/lib/actions/balances";

/**
 * Home page — "most down bad" ranking for a selected group,
 * plus the overall (all-groups) balance summary.
 */
export default function HomePage() {
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const loadData = useCallback((currentUser: { id: string }) => {
    setError(null);

    // Overall balance across all groups
    const balancePromise = fetch(`/api/balances?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data);
        else setError(json.error || "Failed to load balance");
      })
      .catch(() => setError("Failed to connect to the server"));

    // Groups for the ranking selector. Each group already carries its
    // memberBalances, so there's no follow-up per-group fetch (that was a
    // request waterfall: the ranking call couldn't start until this one
    // resolved — an extra full round trip on every homepage load).
    const groupsPromise = fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroups(json.data);
          // Only default to the first group on initial load — a refresh
          // shouldn't yank the picker back to index 0 mid-selection.
          setSelectedGroupId((prev) => prev || json.data[0]?.id || "");
        } else {
          setError((prev) => prev || json.error || "Failed to load groups");
        }
      })
      .catch(() => setError((prev) => prev || "Failed to connect to the server"))
      .finally(() => setLoading(false));

    return Promise.all([balancePromise, groupsPromise]);
  }, []);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);
    loadData(currentUser);
  }, [loadData]);

  // Member balances come straight from the groups payload — switching groups
  // in the picker is instant, no fetch.
  const memberBalances =
    groups.find((g) => g.id === selectedGroupId)?.memberBalances ?? null;

  if (loading) {
    return (
      <main className="min-h-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
      </main>
    );
  }

  if (!user) {
    // AppShell renders the login screen before any page mounts signed-out;
    // reaching here means the cache was cleared mid-session — just blank out.
    return null;
  }

  return (
    <PullToRefresh onRefresh={() => loadData(user)}>
    <main className="min-h-full px-4 pt-2 max-w-lg mx-auto">
      {/* Greeting. The avatar was decoration; now it's the way into the
          account, which is the only place Sign out lives since the app
          header was removed. */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-ink-muted">Hello, {user.name}</h1>
        </div>
        <AccountButton user={user} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {/* Net balance sentence */}
      {balance && memberBalances && (
        <div className="mb-6">
          {/* Calculate user's rank in the group */}
          {(() => {
            const sortedByNet = [...memberBalances].sort((a, b) => b.net - a.net);
            const userRank = sortedByNet.findIndex(entry => entry.user.id === user.id) + 1;

            return (
              <>
                {/* Hero number card with animated background */}
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <h2 className="text-caption font-bold text-ink-muted uppercase tracking-wider">
                    Your balance
                  </h2>
                </div>

                <div
                  className="card-lift px-5 py-6 mb-6 relative overflow-hidden"
                  style={
                    balance.netBalance < 0
                      ? { borderColor: "var(--color-negative-soft)" }
                      : undefined
                  }
                >
                  {/* Ambient state: cash rains when you're up, Gandhi falls
                      when you're down. Genuinely square gets the PAID
                      watermark instead of the blank card it used to show. */}
                  {isSettled(balance) ? (
                    <PaidStamp />
                  ) : balance.netBalance > 0 ? (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className={`raining-cash rank-${userRank}`}>
                        {Array.from({ length: Math.min(Math.max(Math.floor(balance.netBalance / 2), 6), 30) }).map((_, i) => (
                          <span key={i}>💵</span>
                        ))}
                      </div>
                    </div>
                  ) : balance.netBalance < 0 ? (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="falling-gandhi">
                        {Array.from({ length: Math.min(Math.max(Math.floor(Math.abs(balance.netBalance) / 2), 6), 30) }).map((_, i) => (
                          <img key={i} src="/gandhi.png" alt="Gandhi" className="gandhi-icon" />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Eyebrow, figure, ratio bar, then the two sides.
                      Left-aligned: a column of left edges is easier to scan
                      than three centred lines of different widths. */}
                  <p className="text-footnote font-bold text-ink-muted uppercase tracking-widest relative z-10">
                    {isSettled(balance)
                      ? "All square"
                      : balance.netBalance >= 0
                      ? "You\u2019re up"
                      : "You\u2019re down"}
                  </p>

                  {/* Full cents at full size. Demoting them made the figure
                      prettier but harder to read at a glance, and this is the
                      number people open the app for. */}
                  <p
                    className="tabular font-bold relative z-10 mt-1"
                    style={{
                      fontSize: "2.9rem",
                      lineHeight: 1.05,
                      letterSpacing: "-1.5px",
                      color:
                        balance.netBalance >= 0
                          ? "var(--color-positive)"
                          : "var(--color-negative)",
                    }}
                  >
                    {balance.netBalance >= 0 ? "+" : "\u2212"}$
                    {Math.abs(balance.netBalance).toFixed(2)}
                  </p>

                  {/* The split as a shape: how much of your position is money
                      coming to you versus money going out. The net figure
                      above can't show that \u2014 $0 net looks identical whether
                      nothing is outstanding or $500 is owed each way. */}
                  {(balance.totalOwed > 0.005 || balance.totalOwe > 0.005) && (
                    <div className="flex gap-1.5 mt-4 relative z-10" aria-hidden>
                      {balance.totalOwed > 0.005 && (
                        <span
                          className="h-1.5 rounded-full"
                          style={{
                            flexGrow: balance.totalOwed,
                            // A $2 side against a $500 one would otherwise
                            // round to nothing and read as "no debt at all".
                            minWidth: 10,
                            background: "var(--color-positive)",
                          }}
                        />
                      )}
                      {balance.totalOwe > 0.005 && (
                        <span
                          className="h-1.5 rounded-full"
                          style={{
                            flexGrow: balance.totalOwe,
                            minWidth: 10,
                            background: "var(--color-negative)",
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Arrows carry the direction, so the labels don't have to
                      work as hard: in to you, out from you. */}
                  <div className="flex items-center justify-between gap-3 mt-3 relative z-10">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <svg
                        width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke="var(--color-positive)" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="shrink-0" aria-hidden
                      >
                        <path d="M17 7 7 17M7 17h7M7 17v-7" />
                      </svg>
                      <span className="text-subhead text-ink-muted truncate">
                        Owed to you
                      </span>
                      <span className="text-subhead font-bold text-ink tabular">
                        ${balance.totalOwed.toFixed(2)}
                      </span>
                    </span>

                    <span className="flex items-center gap-1.5 min-w-0">
                      <svg
                        width="15" height="15" viewBox="0 0 24 24" fill="none"
                        stroke={
                          balance.totalOwe > 0.005
                            ? "var(--color-negative)"
                            : "var(--color-ink-muted)"
                        }
                        strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="shrink-0" aria-hidden
                      >
                        <path d="M7 17 17 7M17 7h-7M17 7v7" />
                      </svg>
                      <span className="text-subhead text-ink-muted truncate">
                        You owe
                      </span>
                      <span className="text-subhead font-bold text-ink tabular">
                        ${balance.totalOwe.toFixed(2)}
                      </span>
                    </span>
                  </div>

                  {/* Net zero with debts open both ways \u2014 the one state where
                      the headline figure lies. The bar above already shows two
                      equal halves; this says what to do about it. */}
                  {isNetZeroButOpen(balance) && (
                    <p className="text-footnote text-ink-muted mt-3 relative z-10">
                      Settle up to clear both sides.
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Most down bad ranking */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <h2 className="text-caption font-bold text-ink-muted uppercase tracking-wider">
            Down bad leaderboard
          </h2>
        </div>

        {groups.length === 0 ? (
          <div className="card-lift px-5 py-8 text-center">
            <p className="text-sm text-ink-muted mb-2">You&apos;re not in any group yet</p>
            <Link href="/groups" className="text-sm font-medium text-[var(--primary)]">
              Create your first group →
            </Link>
          </div>
        ) : (
          <>
            {/* Group scroll wheel picker */}
            <GroupPickerWheel
              groups={groups}
              selectedGroupId={selectedGroupId}
              onGroupChange={(groupId) => setSelectedGroupId(groupId)}
            />

            <DownBadRanking ranking={memberBalances} currentUserId={user.id} />
          </>
        )}
      </div>
    </main>
    </PullToRefresh>
  );
}

/** Get color based on amount type (no intensity gradient) */
function getColorIntensity(isOwed: boolean): { barColor: React.CSSProperties; textColor: React.CSSProperties } {
  // Same colors as BalanceCard: --success and --danger
  if (isOwed) {
    // Green: #3aa542 (same as var(--success))
    return {
      barColor: { backgroundColor: '#3aa542' },
      textColor: { color: '#2a7a32' }, // darker green for text
    };
  } else {
    // Red: #c5423a (same as var(--danger))
    return {
      barColor: { backgroundColor: '#c5423a' },
      textColor: { color: '#a5322a' }, // darker red for text
    };
  }
}

/** Bidirectional ranking chart showing who owes (left) vs who's owed (right) */
function DownBadRanking({
  ranking,
  currentUserId,
}: {
  ranking: any[] | null;
  currentUserId: string;
}) {
  if (ranking === null) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-canvas rounded-xl" />
        ))}
      </div>
    );
  }

  // Sort by net value (most negative first, most positive last)
  const sortedRanking = [...ranking].sort((a, b) => a.net - b.net);

  // Show top 6 (3 most negative, 3 most positive)
  const top = sortedRanking.slice(0, 6);

  // Calculate max absolute value for scaling
  const maxAbs = Math.max(...sortedRanking.map((entry) => Math.abs(entry.net)));

  if (top.length === 0) {
    return (
      <div
        className="border border-hairline rounded-xl px-5 py-6 text-center backdrop-blur-sm"
        style={{
          background: 'var(--color-surface)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)'
        }}
      >
        <p className="text-sm text-ink-muted font-medium">No one is down bad 🎉</p>
        <p className="text-xs text-ink-muted mt-1">Everyone in this group is settled</p>
      </div>
    );
  }

  return (
    <div
      className="border border-hairline rounded-xl p-5 backdrop-blur-sm"
      style={{
        background: 'var(--color-surface)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.02)'
      }}
    >
      <div className="space-y-3">
        {top.map((entry) => {
          const amount = entry.net;
          const absAmount = Math.abs(amount);
          const isOwed = amount > 0;
          const isYou = entry.user.id === currentUserId;

          // Get colors based on type
          const { barColor, textColor } = getColorIntensity(isOwed);

          // Calculate bar width and position
          // Bar grows from center: negative goes left, positive goes right
          // Cap at 40% to ensure bar never reaches the numbers on either side
          const maxBarWidth = 40;
          const barWidth = maxAbs > 0 ? (absAmount / maxAbs) * maxBarWidth : 0;

          return (
            <div key={entry.user.id} className="relative h-8 flex items-center">
              {/* Name on left */}
              <span className={`text-sm font-semibold w-20 truncate z-10 ${isYou ? "text-[var(--primary)]" : "text-ink"}`}>
                {isYou ? "You" : entry.user.name}
              </span>

              {/* Background bar container - centered */}
              <div className="absolute left-20 right-20 h-6 flex items-center">
                {/* Center reference line (subtle) */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-canvas -translate-x-1/2" />

                {/* Bar track with inset shadow */}
                <div className="absolute left-0 right-0 top-1 bottom-1 bg-canvas/50 rounded-sm"
                     style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.08)' }} />

                {/* Colored bar - grows from center with soft shadow */}
                {Math.abs(amount) >= 0.01 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm"
                    style={{
                      ...barColor,
                      left: amount > 0 ? '50%' : `${50 - barWidth}%`,
                      right: amount < 0 ? '50%' : `${50 - barWidth}%`,
                      opacity: 0.7,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                    }}
                  />
                )}
              </div>

              {/* Amount on right */}
              <div className="absolute right-4 text-sm font-bold z-10" style={textColor}>
                ${Math.abs(amount).toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

