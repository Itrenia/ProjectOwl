"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { deriveScannedAdjustments, ZERO_ADJUSTMENTS } from "@/lib/adjustments";
import { setDraftDirty, guardedNavigate } from "@/lib/draft-guard";
import { MOCK_SCAN_ENABLED } from "@/lib/debug-config";
import { MOCK_RECEIPTS } from "@/lib/test-data/allocation-fixtures";
import { scanReceipt } from "@/lib/scan-receipt";
import CalculatorKeypad from "@/components/CalculatorKeypad";
import ErrorDialog from "@/components/ErrorDialog";
import BottomSheet from "@/components/BottomSheet";
import GroupList, { GroupTile } from "@/components/GroupList";
import ConfirmDialog from "@/components/ConfirmDialog";
import ItemAssigner, { type AssignmentResult } from "@/components/ItemAssigner";
import ScanLoader from "@/components/ScanLoader";
import SlothMark from "@/components/SlothMark";
import UserAvatar from "@/components/UserAvatar";
import PayerSheet, { type PayerMode } from "@/components/compose/PayerSheet";
import SplitSheet, { type SplitMode } from "@/components/compose/SplitSheet";
import ScanConfirmSheet from "@/components/compose/ScanConfirmSheet";
import { tapLight, tapMedium, tapError } from "@/lib/haptics";

type Overlay = null | "payer" | "split" | "assign";

/**
 * Add an expense, on one screen.
 *
 * Replaces the four-step AddTransactionWizard. Group, description and amount sit
 * together; who paid and how it's split open as focused overlays and come
 * straight back. Payments are not creatable here at all — settle-up is the one
 * door into that flow.
 *
 * Overlays rather than routes: /transactions/new is one of four pages mounted
 * simultaneously inside PageSlider, so child routes would break its index maths
 * and let you swipe sideways mid-flow.
 *
 * The receipt scan is not a separate branch — it's a shortcut to a custom
 * split. Scan fills the amount and description, you pick who was there, assign
 * items, and land back on Custom amounts with everyone's share pre-computed and
 * a per-person breakdown to check it against.
 */
export default function ExpenseComposer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryGroupId = searchParams.get("groupId") || "";

  const [user, setUser] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);

  // Compose fields
  const [groupId, setGroupId] = useState(queryGroupId);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  // userId → amount contributed. One entry is the ordinary case; several means
  // the bill went across multiple cards.
  const [payers, setPayers] = useState<Record<string, number>>({});
  const [payerMode, setPayerMode] = useState<PayerMode>("single");

  // Split
  const [participants, setParticipants] = useState<string[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [splitValues, setSplitValues] = useState<Record<string, number>>({});

  // Scan. `assignment` is held independently of splitMode so toggling the
  // segmented control can never discard a pass-the-phone session.
  const [scanItems, setScanItems] = useState<any[]>([]);
  // The raw extraction payload — tax/service/discount are read off it below.
  const [scanResult, setScanResult] = useState<any>(null);
  const [assignment, setAssignment] = useState<AssignmentResult | null>(null);
  const [scanning, setScanning] = useState(false);

  // UI
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [keypad, setKeypad] = useState<null | { target: "total" | string }>(null);
  const [saving, setSaving] = useState(false);
  // Confirm which group the receipt belongs to before opening the camera.
  const [confirmingScan, setConfirmingScan] = useState(false);
  // A group change that would destroy scanned work, held for confirmation.
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pickingGroup, setPickingGroup] = useState(false);
  const [dialogError, setDialogError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    const currentUser = getSessionUser();
    if (!currentUser) return;
    setUser(currentUser);
    // Default: you paid the whole thing. The amount is reconciled to the bill
    // total whenever it changes (see the effect below).
    setPayers({ [currentUser.id]: 0 });

    fetch(`/api/groups?userId=${currentUser.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return;
        setGroups(json.data);
        if (!queryGroupId && json.data[0]) setGroupId(json.data[0].id);
      })
      .catch(() => setGroups([]));
  }, [queryGroupId]);

  const group = useMemo(
    () => groups.find((g: any) => g.id === groupId),
    [groups, groupId]
  );
  const members = useMemo(() => group?.members ?? [], [group]);

  // Changing group invalidates people chosen from the previous one.
  useEffect(() => {
    setParticipants([]);
    setSplitValues({});
    setAssignment(null);
    setScanItems([]);
    setSplitMode("equal");
  }, [groupId]);

  /**
   * Change group, asking first when it would throw work away.
   *
   * Changing groupId resets participants, the scan and the item assignment —
   * people chosen from one group aren't members of another, so the split can't
   * survive the move. That's correct but destructive, and after a
   * pass-the-phone session it's minutes of work. Silent is the wrong shape for
   * it; the reset itself stays exactly as it was.
   */
  const requestGroupChange = (nextId: string) => {
    if (nextId === groupId) return;
    const hasWork = scanItems.length > 0 || assignment !== null;
    if (hasWork) {
      setPendingGroupId(nextId);
      return;
    }
    setGroupId(nextId);
  };

  // A lone payer always covers the whole bill, so their contribution tracks the
  // total automatically. With several payers the amounts are set by hand and
  // are left alone — reconciliation is surfaced in PayerSheet instead.
  useEffect(() => {
    setPayers((prev) => {
      const ids = Object.keys(prev);
      if (ids.length !== 1) return prev;
      if (prev[ids[0]] === amount) return prev;
      return { [ids[0]]: amount };
    });
  }, [amount]);

  /** Even split with the rounding remainder on the last participant —
   *  same rule the API's split-sum check expects. */
  const evenShares = useCallback(
    (ids: string[], total: number) => {
      const each = Math.round((total / ids.length) * 100) / 100;
      const out: Record<string, number> = {};
      ids.forEach((id) => (out[id] = each));
      const diff = Math.round((total - each * ids.length) * 100) / 100;
      if (ids.length > 0 && Math.abs(diff) > 0.001) {
        const last = ids[ids.length - 1];
        out[last] = Math.round((out[last] + diff) * 100) / 100;
      }
      return out;
    },
    []
  );

  /** Resolved shares for saving and for display. */
  const shares = useMemo(() => {
    if (participants.length === 0) return {};
    if (splitMode === "equal") return evenShares(participants, amount);
    return splitValues;
  }, [participants, splitMode, splitValues, amount, evenShares]);

  const payerIds = useMemo(() => Object.keys(payers), [payers]);
  /** Primary payer — biggest contributor, for the ledger card and activity feed. */
  const primaryPayer = useMemo(
    () =>
      payerIds.length === 0
        ? ""
        : payerIds.reduce((a, b) => ((payers[a] ?? 0) >= (payers[b] ?? 0) ? a : b)),
    [payerIds, payers]
  );

  const payerLabel = useMemo(() => {
    if (payerIds.length === 0) return "someone";
    const name = (id: string) =>
      id === user?.id ? "you" : members.find((m: any) => m.id === id)?.name ?? "someone";
    if (payerIds.length === 1) return name(payerIds[0]);
    const others = payerIds.length - 1;
    return `${name(primaryPayer)} +${others}`;
  }, [payerIds, primaryPayer, members, user]);

  // Tax / service charge / discount as read off the receipt.
  const scannedAdjustments = useMemo(
    () => (scanResult ? deriveScannedAdjustments(scanResult) : ZERO_ADJUSTMENTS),
    [scanResult]
  );

  const splitLabel =
    participants.length === 0
      ? "split with…"
      : splitMode === "equal"
      ? "split equally"
      : assignment
      ? "split by item"
      : "custom amounts";

  const totalAllocated = participants.reduce(
    (s, id) => s + (shares[id] ?? 0),
    0
  );
  const canSave =
    !!groupId &&
    description.trim().length > 0 &&
    amount > 0 &&
    participants.length > 0 &&
    Math.abs(totalAllocated - amount) < 0.01 &&
    payerIds.length > 0 &&
    Math.abs(payerIds.reduce((t, id) => t + (payers[id] ?? 0), 0) - amount) < 0.01;

  /**
   * Tell the nav whether leaving would throw work away.
   *
   * PageSlider keeps /transactions/new mounted as one of four tabs, so
   * swiping to another tab doesn't unmount this — it just abandons the draft
   * silently. A half-assigned receipt is exactly the thing people only notice
   * is gone afterwards, so leaving has to ask first.
   *
   * "Progress" means anything beyond the blank form: a description typed, an
   * amount entered, people chosen, or a receipt scanned. An untouched form is
   * free to leave and shouldn't nag.
   */
  const onComposerRoute = pathname === "/transactions/new";
  const hasProgress =
    onComposerRoute &&
    (description.trim().length > 0 ||
      amount > 0 ||
      participants.length > 0 ||
      scanItems.length > 0);

  useEffect(() => {
    setDraftDirty(hasProgress);
    return () => setDraftDirty(false);
  }, [hasProgress]);

  /**
   * Discard the draft and leave.
   *
   * Routed through guardedNavigate so it goes through the same confirmation
   * every other exit does — and clears the draft flag first, since choosing
   * Cancel IS the answer to "are you sure".
   */
  const handleCancel = () => {
    setDraftDirty(false);
    guardedNavigate(() => router.push("/"));
  };

  // ── Scan ──────────────────────────────────────────────────────────
  const applyScan = (data: any) => {
    setScanResult(data);
    setAmount(data.total_price || 0);
    setScanItems(data.menu ?? []);
    if (data.merchant && !description) setDescription(data.merchant);
    setAssignment(null);
    setSplitMode("custom");
    // Straight into "who was there" — the item assignment needs people first.
    setOverlay("split");
  };

  const handleScan = async (file: File) => {
    setScanning(true);
    try {
      const outcome = await scanReceipt(file);
      if (outcome.ok) {
        applyScan(outcome.data);
      } else {
        tapError();
        setDialogError({
          title: outcome.failure.title,
          message: outcome.failure.message,
        });
      }
    } finally {
      // scanReceipt() reports failures rather than throwing, but keep this in
      // `finally` regardless: anything that escapes must still clear the
      // loader, or the user is stuck on a spinner with no way back.
      setScanning(false);
    }
  };

  /** Test mode: skip the LLM and load a canned receipt. */
  const handleMockScan = () => {
    setScanning(true);
    setTimeout(() => {
      applyScan(MOCK_RECEIPTS[0].data);
      setScanning(false);
    }, 1400);
  };

  // ── Save ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    tapMedium();
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: description.trim(),
          totalAmount: amount,
          paidByUserId: primaryPayer,
          // Only sent when the bill genuinely went across several cards; a
          // single payer is implied by paidByUserId, as it always was.
          payers:
            payerIds.length > 1
              ? payerIds.map((id) => ({ userId: id, amountPaid: payers[id] ?? 0 }))
              : undefined,
          groupId,
          transactionDate: date,
          participants: participants.map((id) => ({
            userId: id,
            shareAmount: shares[id] ?? 0,
          })),
          items:
            scanItems.length > 0
              ? scanItems.map((it: any) => ({
                  name: it.nm || "Item",
                  quantity: it.cnt || 1,
                  price: it.price || 0,
                }))
              : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        window.location.href = "/activity";
        return;
      }
      tapError();
      setDialogError({
        title: "Couldn't save",
        message: json.error || "Something went wrong saving this expense.",
      });
    } catch {
      tapError();
      setDialogError({
        title: "Couldn't reach the server",
        message: "Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-4">
        <p className="text-body text-ink-muted">Sign in to add an expense.</p>
      </main>
    );
  }

  if (scanning) return <ScanLoader />;

  // ── Overlays ──────────────────────────────────────────────────────
  if (overlay === "payer") {
    return (
      <>
        <PayerSheet
          members={members}
          currentUserId={user.id}
          amount={amount}
          payers={payers}
          onPayersChange={setPayers}
          mode={payerMode}
          onModeChange={setPayerMode}
          onEditAmount={(userId) => setKeypad({ target: `payer:${userId}` })}
          onClose={() => setOverlay(null)}
        />
        {keypad?.target.startsWith("payer:") && (
          <CalculatorKeypad
            open
            initialValue={payers[keypad.target.slice(6)] ?? 0}
            title={`${
              members.find((m: any) => m.id === keypad.target.slice(6))?.name ??
              "Payer"
            } paid`}
            onConfirm={(v) => {
              setPayers((prev) => ({ ...prev, [keypad.target.slice(6)]: v }));
              setKeypad(null);
            }}
          />
        )}
      </>
    );
  }

  if (overlay === "assign") {
    return (
      <ItemAssigner
        items={scanItems.map((it: any, i: number) => ({
          id: i,
          nm: it.nm || "Item",
          price: it.price || 0,
          cnt: it.cnt || 1,
        }))}
        participants={participants.map((id) => ({
          id,
          name: members.find((m: any) => m.id === id)?.name ?? "",
        }))}
        initialUnitState={assignment?.unitState}
        initialEditedItems={assignment?.items}
        // Tax / service / discount read off the receipt: seeds the adjustment
        // rows and is what the allocation screen's "Reset to scan" restores.
        scannedAdjustments={scannedAdjustments}
        scannedTotal={scanResult?.total_price}
        initialAdjustments={assignment?.adjustments}
        initialTotal={assignment?.total}
        onConfirm={(result) => {
          setAssignment(result);
          setSplitValues(result.totals);
          setSplitMode("custom");
          // result.total is the reconciled receipt total — items PLUS tax and
          // discount. Summing item prices here instead would leave the amount
          // short by the adjustment while the shares already included it, so
          // the split could never reconcile and Save would never enable.
          setAmount(result.total);
          setScanItems(result.items);
          setOverlay("split");
        }}
        // Step back to picking people, keeping the draft.
        onBack={() => setOverlay("split")}
        // Abandon the allocation entirely.
        onCancel={() => setOverlay(null)}
      />
    );
  }

  if (overlay === "split") {
    const needsAssignment = scanItems.length > 0 && !assignment;
    return (
      <>
        <SplitSheet
          members={members}
          currentUserId={user.id}
          amount={amount}
          participants={participants}
          onParticipantsChange={(ids) => {
            setParticipants(ids);
            if (splitMode === "custom" && !assignment) {
              setSplitValues(ids.length ? evenShares(ids, amount) : {});
            }
          }}
          mode={splitMode}
          onModeChange={(m) => {
            setSplitMode(m);
            // Returning to custom restores the receipt amounts if there are
            // any; otherwise seed from an even split so the fields aren't 0.
            if (m === "custom") {
              setSplitValues(
                assignment
                  ? assignment.totals
                  : participants.length
                  ? evenShares(participants, amount)
                  : {}
              );
            }
          }}
          values={splitMode === "custom" ? splitValues : shares}
          onValuesChange={setSplitValues}
          assignment={assignment}
          needsAssignment={needsAssignment}
          onAssignItems={() => setOverlay("assign")}
          onEditItems={() => setOverlay("assign")}
          onEditAmount={(userId) => setKeypad({ target: userId })}
          onClose={() => setOverlay(null)}
        />
        {keypad &&
          keypad.target !== "total" &&
          !keypad.target.startsWith("payer:") && (
          <CalculatorKeypad
            open
            initialValue={splitValues[keypad.target] ?? 0}
            title={`${
              members.find((m: any) => m.id === keypad.target)?.name ?? "Share"
            }'s share`}
            onConfirm={(v) => {
              setSplitValues((prev) => ({ ...prev, [keypad.target]: v }));
              setKeypad(null);
            }}
          />
        )}
      </>
    );
  }

  // ── Compose ───────────────────────────────────────────────────────
  return (
    <main className="min-h-dvh px-4 max-w-lg mx-auto content-with-floating-nav">
      {/* Header. Title centred between two actions of unequal weight —
          Cancel is plain text, Save is the filled pill. */}
      <div
        className="flex items-center gap-2 py-3 mb-5"
        style={{ borderBottom: "1px solid var(--color-hairline)" }}
      >
        <button
          onClick={handleCancel}
          className="pressable text-callout font-medium -ml-2 px-2"
          style={{ color: "var(--color-ink-muted)", minHeight: 44, minWidth: 76 }}
        >
          Cancel
        </button>
        <h1 className="flex-1 text-center text-callout font-bold text-ink">
          New expense
        </h1>
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="pressable px-5 rounded-full text-callout font-semibold text-white disabled:opacity-35"
          style={{ minHeight: 42, minWidth: 76, background: "var(--color-blueberry-600)" }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Amount leads: it's the one field you always fill, and the only one
          worth a whole card. */}
      <button
        onClick={() => {
          tapLight();
          setKeypad({ target: "total" });
        }}
        className="card-lift pressable w-full px-5 py-6 text-center mb-6"
        aria-label="Set the amount"
      >
        <span className="block text-footnote font-bold text-ink-muted uppercase tracking-widest">
          Amount
        </span>
        <span className="flex items-baseline justify-center gap-1.5 mt-2">
          <span
            className="text-title1 font-bold"
            style={{ color: amount > 0 ? "var(--color-ink-muted)" : "var(--color-blueberry-300)" }}
          >
            $
          </span>
          <span
            className="font-bold tabular"
            style={{
              fontSize: "3rem",
              lineHeight: 1,
              letterSpacing: "-1.5px",
              color: amount > 0 ? "var(--color-ink)" : "var(--color-blueberry-300)",
            }}
          >
            {amount > 0 ? amount.toFixed(2) : "0.00"}
          </span>
        </span>
        <span className="block text-subhead text-ink-muted mt-2.5">
          {participants.length === 0
            ? "Tap to enter the total"
            : `Split between ${participants.length} ${
                participants.length === 1 ? "person" : "people"
              }`}
        </span>
      </button>

      {/* Description */}
      <label className="block mb-4">
        <span className="block text-subhead font-bold text-ink mb-1.5">
          What was it for?
        </span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Ramen in Shinjuku"
          className="w-full px-4 rounded-[14px] text-callout text-ink focus:outline-none focus:ring-2 focus:ring-blueberry-500"
          style={{
            minHeight: 54,
            background: "var(--color-surface)",
            border: "1px solid var(--color-hairline)",
          }}
        />
      </label>

      {/* Group and date share a row — both are short, and neither deserves a
          full line of its own. Date moved off the keypad to sit here, where
          it's visible without opening anything. */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="block min-w-0">
          <span className="block text-subhead font-bold text-ink mb-1.5">Group</span>
          {/* A sheet rather than a native select, matching the picker on Home
              — the OS wheel can't show each group's colour, and on a
              half-width field it truncates the name to almost nothing. */}
          <button
            type="button"
            onClick={() => {
              tapLight();
              setPickingGroup(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={pickingGroup}
            className="pressable w-full flex items-center gap-2 px-3 rounded-[14px] text-left"
            style={{
              minHeight: 54,
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            {group ? (
              <GroupTile group={group} size={26} />
            ) : (
              <span
                className="w-6 h-6 shrink-0"
                style={{ borderRadius: 8, background: "var(--color-blueberry-300)" }}
                aria-hidden
              />
            )}
            <span className="flex-1 min-w-0 text-callout font-medium text-ink truncate">
              {group?.name ?? "No groups yet"}
            </span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-ink-muted)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0" aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        <label className="block min-w-0">
          <span className="block text-subhead font-bold text-ink mb-1.5">Date</span>
          <div
            className="flex items-center gap-2 px-3 rounded-[14px]"
            style={{
              minHeight: 54,
              background: "var(--color-surface)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            <svg
              width="19" height="19" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-blueberry-600)" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round"
              className="shrink-0" aria-hidden
            >
              <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
              <path d="M3.5 9.5h17M8 3.5V6M16 3.5V6" />
            </svg>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-callout font-medium text-ink focus:outline-none"
              style={{ minHeight: 44 }}
            />
          </div>
        </label>
      </div>

      {/* Reads as a sentence rather than a settings list — the two variable
          parts are the tappable bits, so the line says what it is and what
          you can change in the same breath. */}
      <div className="flex items-center flex-wrap gap-x-1.5 gap-y-1 mt-5 text-callout text-ink-muted">
        <span>Paid by</span>
        <button
          onClick={() => {
            tapLight();
            setOverlay("payer");
          }}
          className="pressable-sm inline-flex items-center gap-1.5 px-2 rounded-[8px] font-semibold"
          style={{
            minHeight: 44,
            color: "var(--color-blueberry-600)",
            background: "var(--color-blueberry-100)",
          }}
        >
          {primaryPayer && (
            <UserAvatar
              name={
                members.find((m: any) => m.id === primaryPayer)?.name ??
                user.name
              }
              size="sm"
            />
          )}
          {payerLabel}
        </button>
        <span>and</span>
        <button
          onClick={() => {
            tapLight();
            setOverlay("split");
          }}
          className="pressable-sm inline-flex items-center px-2 rounded-[8px] font-semibold"
          style={{
            minHeight: 44,
            color: "var(--color-blueberry-600)",
            background: "var(--color-blueberry-100)",
          }}
        >
          {splitLabel}
        </button>
      </div>

      {participants.length > 0 && (
        <p className="text-footnote text-ink-muted mt-2">
          {participants.length}{" "}
          {participants.length === 1 ? "person" : "people"}
          {splitMode === "equal" && amount > 0
            ? ` · $${(amount / participants.length).toFixed(2)} each`
            : ""}
        </p>
      )}

      {/* ItreAI — floating, above the nav island. */}
      <button
        onClick={() => {
          tapLight();
          setConfirmingScan(true);
        }}
        className="pressable fixed right-5 z-30 flex items-center gap-2 pl-3 pr-4 rounded-full text-white shadow-lg"
        style={{
          bottom: "calc(var(--nav-clearance) + 0.5rem)",
          minHeight: 56,
          background:
            "linear-gradient(135deg, var(--color-blueberry-600) 0%, var(--color-blueberry-700) 100%)",
          boxShadow:
            "0 6px 20px color-mix(in srgb, var(--color-blueberry-900) 30%, transparent)",
        }}
        aria-label="Scan a receipt with ItreAI"
      >
        <SlothMark size={34} />
        <span className="text-callout font-semibold">ItreAI</span>
      </button>

      <BottomSheet
        open={pickingGroup}
        onClose={() => setPickingGroup(false)}
        label="Choose a group"
      >
        <h3 className="text-title2 font-bold text-ink mb-4">Group</h3>
        <GroupList
          groups={groups}
          selectedGroupId={groupId}
          onSelect={(id) => {
            // Goes through the guard, so switching after a scan still asks
            // before it throws the receipt away.
            requestGroupChange(id);
            setPickingGroup(false);
          }}
        />
      </BottomSheet>

      <ScanConfirmSheet
        open={confirmingScan}
        groups={groups}
        selectedGroupId={groupId}
        onGroupChange={requestGroupChange}
        onClose={() => setConfirmingScan(false)}
        onConfirm={() => {
          setConfirmingScan(false);
          if (MOCK_SCAN_ENABLED) {
            handleMockScan();
            return;
          }
          // The sheet's exit animation and the file picker both want the main
          // thread; let the sheet finish before the camera takes over.
          setTimeout(() => document.getElementById("itreai-file")?.click(), 220);
        }}
      />

      <input
        id="itreai-file"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleScan(file);
          e.target.value = "";
        }}
      />

      {/* Amount keypad — the only place the date is editable. */}
      {keypad?.target === "total" && (
        <CalculatorKeypad
          open
          initialValue={amount}
          title="Amount"
          onConfirm={(v) => {
            setAmount(v);
            // Keep an even split in step with the new total.
            if (splitMode === "equal" && participants.length) {
              setSplitValues(evenShares(participants, v));
            }
            setKeypad(null);
          }}
        />
      )}

      {/* Destructive variant, so it can't be dismissed by a stray swipe or a
          backdrop tap — losing a receipt to a mis-flick is the thing this
          exists to prevent. */}
      <ConfirmDialog
        open={pendingGroupId !== null}
        variant="danger"
        title="Clear the scanned receipt?"
        message={`Moving this to ${
          groups.find((g: any) => g.id === pendingGroupId)?.name ?? "another group"
        } clears the scanned items and everything assigned so far — the people you picked aren't in that group. You'd need to scan and assign it again.`}
        confirmLabel="Change group"
        cancelLabel="Keep this receipt"
        onConfirm={() => {
          if (pendingGroupId) setGroupId(pendingGroupId);
          setPendingGroupId(null);
        }}
        onCancel={() => setPendingGroupId(null)}
      />

      <ErrorDialog
        open={!!dialogError}
        title={dialogError?.title}
        message={dialogError?.message || ""}
        onDismiss={() => setDialogError(null)}
      />
    </main>
  );
}
