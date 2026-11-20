"use client";

import { useEffect, useState } from "react";
import SlothCalculating from "./SlothCalculating";
import Portal from "@/components/Portal";

/**
 * Full-screen takeover while ItreAI reads a receipt.
 *
 * The sloth works a calculator while it waits — same character as the button
 * that started the scan, which the owl that used to be here wasn't.
 *
 * The status line steps through what is genuinely happening rather than
 * showing a progress bar: Gemini doesn't stream, so there is no real
 * completion figure to report and any percentage would be invented. The
 * copy advances on a timer and parks on the last line until the request
 * actually returns — it never claims to be finished.
 */
const STAGES = [
  "Reading your receipt…",
  "Finding the items…",
  "Adding everything up…",
];

export default function ScanLoader({
  done = false,
  onCancel,
}: {
  done?: boolean;
  /** When set, a Cancel control renders — a scan must never be a dead end
      the user is committed to until the request resolves (#69). */
  onCancel?: () => void;
}) {
  const [stage, setStage] = useState(0);


  useEffect(() => {
    if (done) return;
    // Park on the final stage rather than looping — cycling forever would
    // suggest the work restarted.
    if (stage >= STAGES.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), 2600);
    return () => clearTimeout(t);
  }, [stage, done]);

  return (
    <Portal>
    <div
      className="fixed inset-0 z-[55] flex flex-col items-center justify-center gap-8 px-8"
      style={{
        background:
          "linear-gradient(160deg, var(--color-blueberry-600) 0%, var(--color-blueberry-900) 100%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="status"
      aria-live="polite"
    >
      {/* The sloth carries the whole illustration now — the ghosted receipt
          that used to sit behind the owl collided with the calculator. */}
      <div className="text-white">
        <SlothCalculating size={196} />
      </div>

      <div className="text-center">
        <p className="text-title2 font-bold text-white">
          {done ? "Got it" : "ItreAI"}
        </p>
        <p
          key={stage}
          className="text-body mt-1.5 animate-fade-in"
          style={{ color: "rgba(255,255,255,0.8)" }}
        >
          {done ? "Here's what was on the receipt" : STAGES[stage]}
        </p>
      </div>

      {onCancel && !done && (
        <button
          onClick={onCancel}
          className="pressable px-6 py-2.5 rounded-full text-callout font-semibold text-white"
          style={{
            border: "1px solid rgba(255,255,255,0.4)",
            minHeight: 44,
          }}
        >
          Cancel
        </button>
      )}
    </div>
    </Portal>
  );
}
