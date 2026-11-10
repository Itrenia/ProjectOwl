"use client";

import { useState, useCallback, useEffect } from "react";
import Portal from "@/components/Portal";

interface CalculatorKeypadProps {
  open: boolean;
  initialValue?: number;
  onConfirm: (value: number) => void;
  title?: string;
  /** What's being entered. Percentages read as "12%", money as "$12". */
  unit?: "$" | "%";
}

/**
 * Calculator keypad component for numeric input with addition support.
 * The expression is committed by the check key, by tapping outside, or by
 * Enter/Escape on desktop.
 * Provides a mobile-friendly, touch-safe interface for entering amounts.
 */
export default function CalculatorKeypad({
  open,
  initialValue = 0,
  onConfirm,
  title = "Enter amount",
  unit = "$",
}: CalculatorKeypadProps) {
  const [expression, setExpression] = useState<string>("");

  // Initialize expression when component opens with initial value
  useEffect(() => {
    if (open) {
      setExpression(initialValue > 0 ? initialValue.toFixed(2) : "");
    }
  }, [open, initialValue]);

  const evaluateExpression = useCallback((expr: string): number => {
    const cleaned = expr.replace(/\s/g, '');
    if (!cleaned || cleaned === '+' || cleaned === '.') return 0;

    const parts = cleaned.split('+').filter(p => p !== '');
    const sum = parts.reduce((acc, part) => {
      const num = parseFloat(part);
      return acc + (isNaN(num) ? 0 : num);
    }, 0);

    return Math.round(sum * 100) / 100; // Round to 2 decimal places
  }, []);

  const handleKeyPress = useCallback((key: string) => {
    setExpression((prev) => {
      const newExpr = prev + key;

      // Validate: prevent multiple decimals in a single number
      if (key === '.') {
        const parts = prev.split('+');
        const lastPart = parts[parts.length - 1];
        if (lastPart.includes('.')) {
          return prev; // Don't add another decimal
        }
      }

      // Validate: prevent starting with + or having consecutive +
      if (key === '+') {
        if (prev === '' || prev.endsWith('+')) {
          return prev;
        }
      }

      return newExpr;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setExpression((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setExpression("");
  }, []);

  const handleClose = useCallback(() => {
    const result = evaluateExpression(expression);
    onConfirm(result);
  }, [expression, evaluateExpression, onConfirm]);

  // Handle keyboard input for desktop testing
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === '.') {
        handleKeyPress('.');
      } else if (e.key === '+') {
        handleKeyPress('+');
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Enter') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyPress, handleBackspace, handleClose]);

  if (!open) return null;

  // Display expression or calculated result preview
  const displayValue = expression || "0";

  return (
    <Portal>
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-surface-raised rounded-t-3xl shadow-xl w-full max-w-md overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab handle, matching BottomSheet */}
        <div className="flex justify-center pt-2.5 pb-1">
          <span
            aria-hidden
            className="block rounded-full"
            style={{ width: 36, height: 5, background: "var(--color-hairline)" }}
          />
        </div>

        {/* Header — the check key below is the commit affordance. */}
        <div className="px-5 pb-3">
          <h3 className="text-headline font-semibold text-ink">{title}</h3>
        </div>

        {/* Display */}
        <div className="px-5 py-5" style={{ background: "var(--color-canvas)" }}>
          <div className="text-right">
            <div
              className="text-display font-bold text-ink tabular"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {unit === "$" ? `$${displayValue}` : `${displayValue}%`}
            </div>
            {expression.includes('+') && (
              <div className="text-subhead text-ink-muted mt-1 tabular">
                {unit === "$"
                  ? `= $${evaluateExpression(expression).toFixed(2)}`
                  : `= ${evaluateExpression(expression).toFixed(2)}%`}
              </div>
            )}
          </div>
        </div>

        {/* Keypad */}
        <div
          className="px-4 pt-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-4 gap-3 max-w-xs mx-auto">
            {/* Row 1 */}
            <button
              onClick={() => handleKeyPress('7')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="7"
            >
              7
            </button>
            <button
              onClick={() => handleKeyPress('8')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="8"
            >
              8
            </button>
            <button
              onClick={() => handleKeyPress('9')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="9"
            >
              9
            </button>
            <button
              onClick={handleClear}
              className="h-16 w-16 bg-[var(--danger)] hover:bg-negative active:bg-negative-soft active:scale-95 rounded-2xl text-2xl font-semibold text-white transition-all touch-manipulation"
              aria-label="Clear"
            >
              C
            </button>

            {/* Row 2 */}
            <button
              onClick={() => handleKeyPress('4')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="4"
            >
              4
            </button>
            <button
              onClick={() => handleKeyPress('5')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="5"
            >
              5
            </button>
            <button
              onClick={() => handleKeyPress('6')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="6"
            >
              6
            </button>
            <button
              onClick={handleBackspace}
              className="h-16 w-16 bg-canvas hover:bg-hairline active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="Backspace"
            >
              ⌫
            </button>

            {/* Row 3 */}
            <button
              onClick={() => handleKeyPress('1')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="1"
            >
              1
            </button>
            <button
              onClick={() => handleKeyPress('2')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="2"
            >
              2
            </button>
            <button
              onClick={() => handleKeyPress('3')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="3"
            >
              3
            </button>
            <button
              onClick={() => handleKeyPress('+')}
              className="h-16 w-16 bg-[var(--primary)] hover:bg-[var(--primary-hover)] active:bg-blueberry-900 active:scale-95 rounded-2xl text-2xl font-semibold text-white transition-all touch-manipulation"
              aria-label="Plus"
            >
              +
            </button>

            {/* Row 4 */}
            <button
              onClick={() => handleKeyPress('0')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="0"
            >
              0
            </button>
            <button
              onClick={() => handleKeyPress('.')}
              className="h-16 w-16 bg-canvas hover:bg-canvas active:bg-hairline active:scale-95 rounded-2xl text-2xl font-semibold text-ink transition-all touch-manipulation"
              aria-label="Decimal point"
            >
              .
            </button>
            {/* Commits the expression and closes the keypad. */}
            <button
              onClick={handleClose}
              className="col-span-2 h-16 flex items-center justify-center bg-positive hover:bg-positive active:brightness-90 active:scale-95 rounded-2xl text-white transition-all touch-manipulation"
              aria-label="Done"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M4.5 12.5l5 5 10-11" />
              </svg>
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="px-4 py-3 bg-canvas text-center">
          <p className="text-xs text-ink-muted">
            Tap the check or outside the keypad to save
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
    </Portal>
  );
}