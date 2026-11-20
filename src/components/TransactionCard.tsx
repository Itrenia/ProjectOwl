"use client";

import Link from "next/link";
import UserAvatar from "./UserAvatar";

interface TransactionCardProps {
  id: string;
  title: string;
  totalAmount: number;
  userShare: number;
  paidByUserName: string;
  paidByUserId: string;
  currentUserId: string;
  transactionDate: string;
  /** "expense" (default) or "payment" (direct user→user payment). */
  type?: string;
  /** Payment recipient's name (payments only). */
  recipientName?: string;
  recipientUserId?: string;
}

/**
 * Summary row for a single transaction in list views.
 *
 * The date block is the row's anchor — a small torn-calendar chip that reads
 * as a receipt stub, echoing the item-assignment screen. Amounts are set in
 * tabular figures so a scrolling ledger keeps its decimal column aligned.
 */
export default function TransactionCard({
  id,
  title,
  totalAmount,
  userShare,
  paidByUserName,
  paidByUserId,
  currentUserId,
  transactionDate,
  type,
  recipientName,
  recipientUserId,
}: TransactionCardProps) {
  const youPaid = paidByUserId === currentUserId;
  const date = new Date(transactionDate);
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();

  const rowClass =
    "pressable flex items-center gap-3 px-3.5 py-3 rounded-[14px] bg-surface border border-hairline";
  const rowShadow = {
    boxShadow:
      "0 1px 2px color-mix(in srgb, var(--color-blueberry-900) 5%, transparent)",
  };

  const dateChip = (
    <div
      className="flex flex-col items-center justify-center rounded-[10px] px-2 py-1 shrink-0"
      style={{
        background: "var(--color-blueberry-100)",
        minWidth: 38,
      }}
    >
      <span
        className="text-caption font-semibold leading-none"
        style={{ color: "var(--color-blueberry-600)" }}
      >
        {month}
      </span>
      <span className="text-callout font-bold leading-tight tabular text-ink">
        {day}
      </span>
    </div>
  );

  if (type === "payment") {
    const youReceived = recipientUserId === currentUserId;
    return (
      <Link href={`/transactions/${id}`} className={rowClass} style={rowShadow}>
        {dateChip}
        <span className="text-title2 shrink-0" aria-hidden>
          💸
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-callout font-medium text-ink truncate">
            {youPaid ? "You" : paidByUserName} paid{" "}
            {youReceived ? "you" : recipientName ?? "someone"}
          </p>
          <p className="text-footnote text-ink-muted">Payment</p>
        </div>
        <p
          className="text-callout font-semibold tabular"
          style={{
            color: youReceived
              ? "var(--color-positive)"
              : youPaid
              ? "var(--color-negative)"
              : "var(--color-ink-muted)",
          }}
        >
          ${totalAmount.toFixed(2)}
        </p>
      </Link>
    );
  }

  return (
    <Link href={`/transactions/${id}`} className={rowClass} style={rowShadow}>
      {dateChip}
      <UserAvatar name={paidByUserName} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-callout font-medium text-ink truncate">{title}</p>
        <p className="text-footnote text-ink-muted">
          {youPaid ? "You paid" : `${paidByUserName} paid`} ·{" "}
          <span className="tabular">${totalAmount.toFixed(2)}</span>
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className="text-callout font-semibold tabular"
          style={{
            color: youPaid
              ? "var(--color-positive)"
              : "var(--color-negative)",
          }}
        >
          {youPaid
            ? `+$${(totalAmount - userShare).toFixed(2)}`
            : `$${userShare.toFixed(2)}`}
        </p>
        <p className="text-caption text-ink-muted">
          {youPaid ? "you lent" : "you owe"}
        </p>
      </div>
    </Link>
  );
}
