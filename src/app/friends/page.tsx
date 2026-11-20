"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { getSessionUser } from "@/lib/session";

/**
 * Friends page — shows friend list with individual balances.
 */
export default function FriendsPage() {
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setUser(currentUser);

    // We fetch all users except current, with balances computed per friend
    fetch("/api/users")
      .then((r) => r.json())
      .then(async (json) => {
        if (!json.success) {
          setError(json.error || "Failed to load friends");
          return;
        }
        const allUsers = json.data.filter((u: any) => u.id !== currentUser.id);

        // Compute balance for each friend
        const friendsWithBalance = await Promise.all(
          allUsers.map(async (friend: any) => {
            const balanceResp = await fetch(`/api/balances?userId=${currentUser.id}`);
            const balanceJson = await balanceResp.json();
            if (balanceJson.success) {
              const perPerson = balanceJson.data.perPerson || [];
              const match = perPerson.find((p: any) => p.user.id === friend.id);
              return { ...friend, balance: match?.amount ?? 0 };
            }
            return { ...friend, balance: 0 };
          })
        );

        setFriends(friendsWithBalance);
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));
  }, []);

  if (!user) {
    return (
      <main className="min-h-full flex items-center justify-center p-4">
        <p className="text-sm text-ink-muted">Please select a user from the home page first.</p>
      </main>
    );
  }

  return (
    <main className="min-h-full px-4 pt-6 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-ink mb-6">Friends</h1>

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
      ) : (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-8">No friends yet</p>
          ) : (
            friends.map((friend) => {
              const isPositive = friend.balance >= 0;
              return (
                <Link
                  key={friend.id}
                  href={`/transactions?with=${friend.id}`}
                  className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--border)] rounded-xl hover:bg-canvas transition-colors"
                >
                  <UserAvatar name={friend.name} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{friend.name}</p>
                    <p className="text-xs text-ink-muted">{friend.email}</p>
                  </div>
                  <div className="text-right">
                    {friend.balance === 0 ? (
                      <p className="text-xs text-ink-muted">Settled</p>
                    ) : (
                      <>
                        <p className={`text-sm font-semibold ${
                          isPositive ? "text-[var(--success)]" : "text-[var(--danger)]"
                        }`}>
                          {isPositive ? "+" : "-"}${Math.abs(friend.balance).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-ink-muted">
                          {isPositive ? "owes you" : "you owe"}
                        </p>
                      </>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}
