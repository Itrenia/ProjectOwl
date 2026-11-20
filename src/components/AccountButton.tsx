"use client";

import { useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import UserAvatar from "@/components/UserAvatar";
import { isDraftDirty, setDraftDirty } from "@/lib/draft-guard";
import { tapLight } from "@/lib/haptics";
import { signOut, type SessionUser } from "@/lib/session";

/**
 * The profile circle on Home, and everything behind it.
 *
 * Sign out used to be a bare word in the app header, which rendered on every
 * screen — including the composer, whose own header puts Save in that exact
 * corner directly below it. The app's one irreversible global action was also
 * its most casually reachable, and the label never said what it would take
 * with it. The header is gone now; the account lives in one place, on Home,
 * behind the avatar that was already sitting there.
 *
 * Self-contained on purpose: the button, the sheet and the confirm are one
 * unit, so there is exactly one path to signing out and one place that knows
 * what it costs.
 */
export default function AccountButton({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  /**
   * Sign out, asking again first if it would bin unsaved work.
   *
   * Every other exit from the composer routes through `guardedNavigate`, which
   * holds the navigation while DraftLeaveGuard asks. Sign-out can't: it tears
   * down the session, so "stay" isn't a state we could return to afterwards.
   * It asks up front instead, in its own words — the thing being lost is an
   * expense and the reason is the sign-out, and one prompt should say both
   * rather than two prompts each saying half.
   *
   * PageSlider keeps /transactions/new mounted while you're on Home, so a
   * half-entered expense is live even though it isn't on screen. That's
   * exactly the draft nobody would think to protect.
   *
   * An untouched form doesn't ask. Opening the sheet was already deliberate,
   * and nagging when there's nothing to lose is how people learn to tap
   * through prompts without reading them.
   */
  const requestSignOut = () => {
    if (isDraftDirty()) {
      // The sheet closes as the confirm opens: stacking two sheets buries the
      // question under the thing that asked it.
      setOpen(false);
      setConfirming(true);
      return;
    }
    void performSignOut();
  };

  const performSignOut = async () => {
    // The draft dies with the reload either way; clearing the flag stops
    // DraftLeaveGuard firing a second, now-meaningless prompt on the way out.
    setDraftDirty(false);
    setConfirming(false);
    setOpen(false);
    await signOut();
    window.location.href = "/";
  };

  return (
    <>
      <button
        onClick={() => {
          tapLight();
          setOpen(true);
        }}
        aria-label={`Account: ${user.name}`}
        className="pressable-sm grid place-items-center -mr-2"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        <UserAvatar name={user.name} size="md" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} label="Account">
        <div className="flex items-center gap-3 mb-5">
          <UserAvatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink truncate">{user.name}</p>
            {user.email && (
              <p className="text-footnote text-ink-muted truncate">{user.email}</p>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            onClick={() => {
              tapLight();
              requestSignOut();
            }}
            className="pressable-cta w-full rounded-[12px] text-body font-semibold"
            style={{
              minHeight: 50,
              color: "var(--color-negative)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            Sign out
          </button>
          <button
            onClick={() => setOpen(false)}
            className="pressable-cta w-full rounded-[12px] text-body font-medium text-ink"
            style={{
              minHeight: 50,
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            Cancel
          </button>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={confirming}
        title="Sign out and lose this expense?"
        message="You have an expense in progress that hasn't been saved. Signing out closes the app and discards the amount, items and split you've entered."
        confirmLabel="Sign out and discard"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={() => void performSignOut()}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
