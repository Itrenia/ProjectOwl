"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSpring, animated } from "@react-spring/web";
import { guardedNavigate, subscribeDraftGuard } from "@/lib/draft-guard";
import HomePage from "@/app/page";
import GroupsPage from "@/app/groups/page";
import NewTransactionPage from "@/app/transactions/new/page";
import ActivityPage from "@/app/activity/page";

/** Movement before we decide whether this is a page swipe or a scroll. */
const AXIS_SLOP = 8;
/** Fraction of the screen that commits to the next page on release. */
const COMMIT_RATIO = 0.22;
/** A flick this fast commits regardless of distance (px per ms). */
const COMMIT_VELOCITY = 0.35;
/** How much the track resists being dragged past the first/last page. */
const EDGE_RESISTANCE = 0.35;

/**
 * iOS-style paged container: the four main tabs live side by side and the
 * track follows your thumb between them.
 *
 * Gestures are handled with native listeners rather than a library because two
 * things need precise control:
 *
 *   Axis locking. Every page is its own `overflow-y: auto` scroller, so a
 *   touch starting anywhere in the content is a candidate for vertical
 *   scrolling. The first few pixels decide: more vertical than horizontal and
 *   we bow out entirely and let the page scroll; more horizontal and we claim
 *   the gesture and call preventDefault for the rest of it. Listeners are
 *   registered non-passive, which is the only way that preventDefault counts.
 *
 *   A single continuous movement. On release the track animates straight to
 *   the destination and the route is pushed underneath it. Snapping home first
 *   and letting the pathname change animate the rest reads as two movements
 *   for one gesture.
 */
export default function PageSlider() {
  const pathname = usePathname();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const pageWidth = useRef(0);

  const pages = ["/", "/groups", "/transactions/new", "/activity"];

  const getPageComponent = (path: string) => {
    switch (path) {
      case "/": return <HomePage />;
      case "/groups": return <GroupsPage />;
      case "/transactions/new": return <NewTransactionPage />;
      case "/activity": return <ActivityPage />;
      default: return null;
    }
  };

  const [{ x }, api] = useSpring(() => ({
    x: 0,
    config: { tension: 300, friction: 30 },
  }));

  // Index tracks the URL, so a nav tap and a swipe end in the same place.
  useEffect(() => {
    const index = pages.findIndex((path) =>
      path === "/transactions/new" ? pathname === "/transactions/new" : pathname === path
    );
    if (index !== -1 && index !== currentPageIndex) setCurrentPageIndex(index);
  }, [pathname]);

  const settle = useCallback(
    (index: number, immediate = false) => {
      api.start({ x: -index * pageWidth.current, immediate });
    },
    [api]
  );

  useEffect(() => {
    if (containerRef.current) pageWidth.current = containerRef.current.offsetWidth;
    settle(currentPageIndex);
  }, [currentPageIndex, settle]);

  useEffect(() => {
    const onResize = () => {
      if (!containerRef.current) return;
      pageWidth.current = containerRef.current.offsetWidth;
      settle(currentPageIndex, true);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [currentPageIndex, settle]);

  // If the draft guard holds a navigation, the track is already sitting on the
  // destination. Bring it home so the page behind the prompt matches the URL.
  useEffect(
    () =>
      subscribeDraftGuard((blocked) => {
        if (blocked) settle(currentPageIndex);
      }),
    [currentPageIndex, settle]
  );

  // ── The gesture ────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let tracking = false;
    let decided = false;
    let horizontal = false;

    const base = () => -currentPageIndex * pageWidth.current;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      startX = lastX = t.clientX;
      startY = t.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      tracking = true;
      decided = false;
      horizontal = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return;
        decided = true;
        horizontal = Math.abs(dx) > Math.abs(dy);
        // Vertical intent: hand the gesture back so the page scrolls normally.
        if (!horizontal) {
          tracking = false;
          return;
        }
      }

      // Ours now — stop the browser scrolling underneath the drag.
      if (e.cancelable) e.preventDefault();

      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = (t.clientX - lastX) / dt;
      lastX = t.clientX;
      lastT = e.timeStamp;

      // Rubber-band past the first and last page instead of tearing free.
      let next = base() + dx;
      const min = -(pages.length - 1) * pageWidth.current;
      if (next > 0) next = dx * EDGE_RESISTANCE;
      else if (next < min) next = min + (next - min) * EDGE_RESISTANCE;

      api.set({ x: next });
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking || !horizontal) {
        tracking = false;
        return;
      }
      tracking = false;

      const dx = (e.changedTouches[0]?.clientX ?? lastX) - startX;
      const far = Math.abs(dx) > pageWidth.current * COMMIT_RATIO;
      const fast = Math.abs(velocity) > COMMIT_VELOCITY;

      // Negative dx = dragged left = moving forward through the pages.
      let target = currentPageIndex;
      if (far || fast) target += dx < 0 ? 1 : -1;
      target = Math.max(0, Math.min(pages.length - 1, target));

      if (target === currentPageIndex) {
        settle(currentPageIndex);
        return;
      }

      // Animate to the destination, then move the URL under it. The pathname
      // effect will set the same x, so nothing jumps.
      settle(target);
      guardedNavigate(() => router.push(pages[target]));
    };

    // Non-passive: preventDefault is a no-op on a passive listener, and
    // without it the page scrolls while the track is being dragged.
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [currentPageIndex, api, router, settle]);

  return (
    <div
      ref={containerRef}
      className="page-slider-container"
      style={{
        overflow: "hidden",
        position: "relative",
        width: "100%",
        height: "100vh",
        // Let the browser own vertical panning; horizontal is ours to claim.
        touchAction: "pan-y",
      }}
    >
      <animated.div
        className="page-slider-track"
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          transform: x.to((v) => `translateX(${v}px)`),
        }}
      >
        {pages.map((path) => (
          <div
            key={path}
            className="page-slide"
            style={{
              flex: "0 0 100%",
              width: "100%",
              height: "100%",
              position: "relative",
              paddingTop: "calc(var(--top-clearance) + var(--offline-banner-h))",
              paddingBottom: "var(--nav-clearance)",
              overflowY: "auto",
            }}
          >
            {getPageComponent(path)}
          </div>
        ))}
      </animated.div>
    </div>
  );
}
