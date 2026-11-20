"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ReceiptIcon,
  NoteIcon,
  GroupAddedIcon,
  MemberAddedIcon,
  LinkJoinedIcon,
} from "@/components/ActivityIcons";
import PullToRefresh from "@/components/PullToRefresh";
import { getSessionUser } from "@/lib/session";

/**
 * Activity tab — a feed of everything that happened across all groups the
 * user belongs to (transactions, settlements, groups created, members added).
 */
export default function ActivityPage() {
  const [user, setUser] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback((currentUser: { id: string }) => {
    setError(null);
    return fetch(`/api/activities?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setActivities(json.data);
        else setError(json.error || "Failed to load activity");
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));
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

  if (!user) {
    return (
      <main className="min-h-full flex items-center justify-center p-4">
        <p className="text-sm text-ink-muted">Please select a user from the home page first.</p>
      </main>
    );
  }

  return (
    <PullToRefresh onRefresh={() => loadData(user)}>
    <main className="min-h-full px-4 pt-6 max-w-lg mx-auto">
      <h1 className="text-title1 font-bold text-ink mb-5">Activity</h1>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
        </div>
      ) : activities.length === 0 ? (
        <div className="card-lift px-5 py-10 text-center">
          <p className="text-subhead text-ink-muted">
            Nothing yet. Add an expense and it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <div className="card-lift" style={{ overflow: "hidden" }}>
          {activities.map((a, i) => (
            <ActivityRow
              key={a.id}
              activity={a}
              currentUserId={user.id}
              first={i === 0}
            />
          ))}
        </div>
      )}
    </main>
    </PullToRefresh>
  );
}

/** One activity feed entry. */
function ActivityRow({
  activity,
  currentUserId,
  first = false,
}: {
  activity: any;
  currentUserId: string;
  first?: boolean;
}) {
  const a = activity;
  const actor = a.userId === currentUserId ? "You" : a.userName;
  const related =
    a.relatedUserId === currentUserId ? "you" : a.relatedUserName ?? "someone";

  const date = new Date(a.createdAt.replace(" ", "T")).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  let Icon = ReceiptIcon;
  let title: React.ReactNode = actor;

  switch (a.type) {
    case "transaction":
      Icon = ReceiptIcon;
      title = a.transactionTitle || "Expense";
      break;
    case "payment":
    case "settlement":
      Icon = NoteIcon;
      title = `${actor} paid ${related}`;
      break;
    case "group_created":
      Icon = GroupAddedIcon;
      title = `${actor} created this group`;
      break;
    case "member_added":
      Icon = MemberAddedIcon;
      title = `${actor} added ${related}`;
      break;
    case "member_joined":
      Icon = LinkJoinedIcon;
      title = `${actor} joined via invite link`;
      break;
  }

  const isMoney = a.type === "transaction" || a.type === "payment" || a.type === "settlement";

  // Transaction and payment rows deep-link to the transaction, everything
  // else to the group.
  const href =
    (a.type === "transaction" || a.type === "payment") && a.transactionId
      ? `/transactions/${a.transactionId}`
      : `/groups/${a.groupId}`;

  return (
    <Link
      href={href}
      className="pressable flex items-center gap-3 px-4 py-3.5"
      style={first ? undefined : { borderTop: "1px solid var(--color-hairline)" }}
    >
      {/* The disc is filled with the page ground, so it reads as a well
          pressed into the card rather than a second object sitting on it. */}
      <span
        className="shrink-0 grid place-items-center rounded-full"
        style={{
          width: 40,
          height: 40,
          background: "var(--color-canvas)",
          color: "var(--color-ink-muted)",
        }}
      >
        <Icon />
      </span>

      <span className="flex-1 min-w-0">
        <span className="block text-callout font-bold text-ink truncate">
          {title}
        </span>
        <span className="block text-footnote text-ink-muted truncate">
          {actor} &middot; {a.groupName} &middot; {date}
        </span>
      </span>

      {isMoney && a.amount != null && (
        <span className="text-right shrink-0">
          <span className="block text-callout font-bold text-ink tabular">
            ${a.amount.toFixed(2)}
          </span>
        </span>
      )}
    </Link>
  );
}
