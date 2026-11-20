"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import UserPicker from "@/components/UserPicker";
import ErrorDialog from "@/components/ErrorDialog";
import PullToRefresh from "@/components/PullToRefresh";
import { getSessionUser } from "@/lib/session";

/**
 * Drag-to-reorder hook with iOS-style physics
 */
function useDragReorder(items: any[], onReorder: (newOrder: any[]) => void) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [liveOrder, setLiveOrder] = useState<any[]>(items);
  const [dragOffset, setDragOffset] = useState(0); // How far the dragged item has moved
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const itemHeight = 74; // Height of each group row (including gap)

  // Update live order when items change
  useEffect(() => {
    if (!isDragging.current) {
      setLiveOrder(items);
    }
  }, [items]);

  const startDrag = useCallback((clientY: number, index: number) => {
    startY.current = clientY;
    setDragOffset(0);

    // Start long press timer
    longPressTimer.current = setTimeout(() => {
      isDragging.current = true;
      setDraggingIndex(index);
      // Provide haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 200);
  }, []);

  const moveDrag = useCallback((clientY: number) => {
    if (!isDragging.current || draggingIndex === null) return;

    const deltaY = clientY - startY.current;
    setDragOffset(deltaY);

    // Calculate new position with item-based snapping
    const newIndex = Math.round(deltaY / itemHeight) + draggingIndex;
    const clampedIndex = Math.max(0, Math.min(items.length - 1, newIndex));

    // Real-time reordering - bump items aside as we drag
    if (clampedIndex !== draggingIndex) {
      const newOrder = [...liveOrder];
      const [draggedItem] = newOrder.splice(draggingIndex, 1);
      newOrder.splice(clampedIndex, 0, draggedItem);
      setLiveOrder(newOrder);
      setDraggingIndex(clampedIndex);
    }
  }, [draggingIndex, liveOrder, items.length, itemHeight]);

  const endDrag = useCallback(async () => {
    // Clear long press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isDragging.current) {
      // Save the final order
      await onReorder(liveOrder);

      // Provide haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 50, 50]);
      }
    }

    // Reset drag state
    isDragging.current = false;
    setDraggingIndex(null);
    setDragOffset(0);
  }, [liveOrder, onReorder]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    startDrag(e.touches[0].clientY, index);
  }, [startDrag]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    moveDrag(e.touches[0].clientY);
  }, [moveDrag]);

  const handleTouchEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, index: number) => {
    e.preventDefault();
    startDrag(e.clientY, index);
  }, [startDrag]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    moveDrag(e.clientY);
  }, [moveDrag]);

  const handleMouseUp = useCallback(() => {
    endDrag();
  }, [endDrag]);

  return {
    draggingIndex,
    liveOrder,
    dragOffset,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  };
}

/**
 * Groups tab — overall balance, list of your groups (settled ones hidden
 * behind a toggle), and a create-group form with a member picker.
 */
export default function GroupsPage() {
  const [user, setUser] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [orderedGroups, setOrderedGroups] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  // Create-group form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMembers, setNewMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  const loadData = useCallback((currentUser: any) => {
    setError(null);

    const groupsPromise = fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setGroups(json.data);
          setOrderedGroups(json.data);
        }
        else setError(json.error || "Failed to load groups");
      })
      .catch(() => setError("Failed to connect to the server"))
      .finally(() => setLoading(false));

    const balancePromise = fetch(`/api/balances?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setBalance(json.data);
      })
      .catch(() => {});

    return Promise.all([groupsPromise, balancePromise]);
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

  const createGroup = async () => {
    if (!newName.trim() || !user) return;
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          memberIds: newMembers,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowCreate(false);
        setNewName("");
        setNewMembers([]);
        setLoading(true);
        loadData(user);
      } else {
        setDialogError({ title: "Create failed", message: json.error || "Failed to create group" });
      }
    } catch {
      setDialogError({ title: "Create failed", message: "Failed to connect to the server" });
    } finally {
      setCreating(false);
    }
  };

  const handleReorder = async (newOrder: any[]) => {
    setIsReordering(true);
    try {
      const res = await fetch("/api/groups/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupIds: newOrder.map((g) => g.id),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setOrderedGroups(newOrder);
        // Update the main groups state too
        setGroups(newOrder);
      }
    } catch {
      setError("Failed to save new order");
    } finally {
      setIsReordering(false);
    }
  };

  const { draggingIndex, liveOrder, dragOffset, handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp } = useDragReorder(orderedGroups, handleReorder);

  // Add global mouse event listeners for drag operations
  useEffect(() => {
    if (draggingIndex !== null) {
      const handleGlobalMouseMove = () => {
        // Mouse move tracking is handled by document-level listeners
        // Just exist for cleanup reference
      };

      const handleGlobalMouseUp = () => {
        if (handleMouseUp) {
          handleMouseUp();
        }
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [draggingIndex, handleMouseMove, handleMouseUp]);

  // Update activeGroups to use live order during drag
  const activeGroups = liveOrder.filter((g) => !g.isSettled);
  const settledGroups = liveOrder.filter((g) => g.isSettled);

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
      {/* The full balance card lives on Home; repeating it here pushed the
          groups themselves below the fold. One line carries the same net. */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-title1 font-bold text-ink">Your groups</h1>
          {/* Scoped to browsing: the all-groups net says nothing about the
              group being created, so it hides while the form is open (#63). */}
          {balance && !showCreate && (
            <p className="text-subhead text-ink-muted mt-0.5">
              Net across all groups{" "}
              <span
                className="font-bold tabular"
                style={{
                  color:
                    Math.abs(balance.netBalance) < 0.005
                      ? "var(--color-ink-muted)"
                      : balance.netBalance > 0
                      ? "var(--color-positive)"
                      : "var(--color-negative)",
                }}
              >
                {balance.netBalance >= 0 ? "+" : "\u2212"}$
                {Math.abs(balance.netBalance).toFixed(2)}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="pressable shrink-0 flex items-center gap-1.5 px-4 rounded-full text-callout font-semibold text-white"
          style={{ minHeight: 44, background: "var(--color-blueberry-600)" }}
        >
          {showCreate ? (
            "Cancel"
          ) : (
            <>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M12 5.5v13M5.5 12h13" />
              </svg>
              New group
            </>
          )}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 bg-negative-tint border border-negative-soft rounded-xl text-sm text-negative">
          ⚠ {error}
        </div>
      )}

      {/* Create group form */}
      {showCreate && (
        <div
          className="mb-4 rounded-xl p-4 space-y-3 border border-hairline backdrop-blur-sm"
          style={{
            background: 'var(--color-surface)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)'
          }}
        >
          <div>
            <label className="text-xs font-medium text-ink-muted mb-1 block">Group name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Roommates, Japan Trip"
              className="w-full px-3 py-2 text-sm border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-ink-muted mb-1 block">
              Participants (you&apos;re always included)
            </label>
            <UserPicker
              selectedUserIds={newMembers}
              onChange={setNewMembers}
              excludeUserId={user.id}
              label=""
            />
          </div>
          <button
            onClick={createGroup}
            disabled={creating || !newName.trim()}
            className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[var(--primary)] rounded-lg hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create group"}
          </button>
        </div>
      )}

      {/* Group list */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-6 h-6 border-4 border-[var(--border)] border-t-[var(--primary)] rounded-full" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-ink-muted text-center py-8">
          No groups yet — create one to start splitting!
        </p>
      ) : (
        <>
          {/* Rows share one card with hairline dividers rather than sitting
              as separate cards — a list of three identical cards reads as
              three unrelated things. Container keeps overflow visible so a
              dragged row can float above its neighbours. */}
          <div className="flex items-center justify-between mb-2.5 px-0.5">
            <h2 className="text-callout font-bold text-ink">
              Active <span className="text-ink-muted">&middot; {activeGroups.length}</span>
            </h2>
          </div>

          {activeGroups.length === 0 ? (
            <div className="card-lift px-5 py-8 text-center">
              <p className="text-subhead text-ink-muted">
                Every group is settled. Nothing to chase.
              </p>
            </div>
          ) : (
            <div className="card-lift" style={{ position: "relative" }}>
              {activeGroups.map((g, index) => (
                <GroupRow
                  key={g.id}
                  group={g}
                  index={index}
                  first={index === 0}
                  isDragging={draggingIndex === index}
                  dragOffset={draggingIndex === index ? dragOffset : 0}
                  onTouchStart={(e) => handleTouchStart(e, index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={(e) => handleMouseDown(e, index)}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                />
              ))}
            </div>
          )}

          {/* Settled groups: a closed drawer rather than a toggle button, so
              the count is visible without opening it. */}
          {settledGroups.length > 0 && (
            <div className="card-lift mt-4" style={{ overflow: "hidden" }}>
              <button
                onClick={() => setShowSettled(!showSettled)}
                aria-expanded={showSettled}
                className="pressable w-full flex items-center gap-2 px-5 text-left"
                style={{ minHeight: 60 }}
              >
                <span className="text-callout font-semibold text-ink">
                  Settled groups
                </span>
                <span className="text-callout text-ink-muted tabular">
                  {settledGroups.length}
                </span>
                <span className="flex-1" />
                <svg
                  width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="var(--color-ink-muted)" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{
                    transform: showSettled ? "rotate(180deg)" : "none",
                    transition: "transform 180ms ease-out",
                  }}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {showSettled &&
                settledGroups.map((g, i) => (
                  <GroupRow key={g.id} group={g} first={false} />
                ))}
            </div>
          )}
        </>
      )}

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title || "Error"}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
    </PullToRefresh>
  );
}

/** One tappable group row: colored circle, name, your net position. */
/** Rounded-square tile with the group's initial — distinct from the circular
 *  member avatars beside it, so a group never reads as a person. */
function GroupTile({ group, size = 52 }: { group: any; size?: number }) {
  return (
    <span
      className="shrink-0 grid place-items-center text-white font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        fontSize: size * 0.42,
        background: group.color || "var(--color-blueberry-600)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
      }}
      aria-hidden
    >
      {group.name.charAt(0).toUpperCase()}
    </span>
  );
}

function GroupRow({
  group,
  index,
  first = false,
  isDragging = false,
  dragOffset = 0,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: {
  group: any;
  index?: number;
  first?: boolean;
  isDragging?: boolean;
  dragOffset?: number;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseMove?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
}) {
  const net = group.yourNet ?? 0;
  const settled = Math.abs(net) < 0.005;
  const members: any[] = group.members ?? [];

  const inner = (
    <>
      <GroupTile group={group} />
      <span className="flex-1 min-w-0">
        <span className="block text-callout font-bold text-ink truncate">
          {group.name}
        </span>
        <span className="flex items-center gap-2 mt-1">
          {/* Overlapping stack: who's in the group, readable before the name
              of a single member matters. */}
          <span className="flex -space-x-2">
            {members.slice(0, 4).map((m: any) => (
              <span
                key={m.id}
                className="rounded-full"
                style={{ boxShadow: "0 0 0 2px var(--color-surface)" }}
              >
                <UserAvatar name={m.name} size="sm" />
              </span>
            ))}
          </span>
          <span className="text-footnote text-ink-muted">
            {members.length} member{members.length === 1 ? "" : "s"}
          </span>
        </span>
      </span>

      <span className="text-right shrink-0">
        {settled ? (
          <span className="block text-subhead text-ink-muted">Settled</span>
        ) : (
          <>
            <span
              className="block text-callout font-bold tabular"
              style={{
                color: net > 0 ? "var(--color-positive)" : "var(--color-negative)",
              }}
            >
              {net > 0 ? "+" : "\u2212"}${Math.abs(net).toFixed(2)}
            </span>
            <span className="block text-footnote text-ink-muted">
              {net > 0 ? "you get back" : "you owe"}
            </span>
          </>
        )}
      </span>

      <svg
        width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="var(--color-ink-muted)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0 -ml-1" aria-hidden
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </>
  );

  // Mid-drag it can't be a Link — a tap-and-hold that moved would navigate on
  // release. It also floats above its neighbours, so it carries its own
  // surface and shadow instead of inheriting the list card's.
  if (isDragging) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-[18px] relative z-50 cursor-grabbing"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-hairline)",
          boxShadow: "0 10px 24px rgba(22,37,92,0.18)",
          transform: `translateY(${dragOffset}px) scale(1.03)`,
          transition: "transform 0.1s ease-out",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/groups/${group.id}`}
      className="pressable flex items-center gap-3 px-4 py-3.5"
      style={
        first ? undefined : { borderTop: "1px solid var(--color-hairline)" }
      }
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {inner}
    </Link>
  );
}
