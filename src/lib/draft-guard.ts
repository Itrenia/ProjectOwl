"use client";

/**
 * "You have unsaved progress" guard for the add-expense wizard.
 *
 * The wizard lives on /transactions/new, which PageSlider keeps mounted as
 * one of four tabs — so navigating away doesn't unmount it, it just discards
 * the draft. Silently binning a half-assigned receipt is the kind of thing
 * people only notice after it's gone, so leaving has to ask first.
 *
 * A module-level store rather than context: the parties involved (the wizard
 * inside the slider, the nav island, the slider itself, and the dialog host)
 * sit in different branches of the tree, and threading a provider through all
 * of them to hold one boolean would be more plumbing than the problem needs.
 */

type Listener = (blocked: boolean) => void;

let dirty = false;
let pendingNavigation: (() => void) | null = null;
let listeners: Listener[] = [];

const notify = () => {
  const blocked = pendingNavigation !== null;
  listeners.forEach((l) => l(blocked));
};

/** Mark whether abandoning the current route would lose real work. */
export function setDraftDirty(next: boolean): void {
  dirty = next;
}

/**
 * Is there work that leaving would throw away?
 *
 * For exits that can't be expressed as a navigation the guard could hold —
 * signing out tears down the session itself, so there's nothing to resume if
 * the user says no. Those callers ask first and word their own prompt around
 * the answer, rather than routing through guardedNavigate.
 */
export function isDraftDirty(): boolean {
  return dirty;
}

/** Subscribe to "a navigation is waiting on the user's answer". */
export function subscribeDraftGuard(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

/**
 * Navigate, unless there's a draft worth warning about.
 *
 * Callers hand over the navigation itself rather than a destination, so the
 * guard stays agnostic about how they'd move (push, replace, back).
 */
export function guardedNavigate(go: () => void): void {
  if (!dirty) {
    go();
    return;
  }
  pendingNavigation = go;
  notify();
}

/** User chose to leave: drop the draft and run the held navigation. */
export function confirmLeave(): void {
  const go = pendingNavigation;
  pendingNavigation = null;
  dirty = false;
  notify();
  go?.();
}

/** User chose to stay: forget the held navigation, keep the draft. */
export function cancelLeave(): void {
  pendingNavigation = null;
  notify();
}
