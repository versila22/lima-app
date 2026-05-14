import { useEffect, useRef } from "react";

interface UseSwipeNavigationOptions {
  threshold?: number;
  velocityThreshold?: number;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  enabled?: boolean;
}

/**
 * Attaches pointer listeners to `ref` to detect horizontal swipes.
 * Vertical-dominant gestures are ignored so scroll keeps working.
 */
export function useSwipeNavigation<T extends HTMLElement>(
  ref: React.RefObject<T>,
  {
    threshold = 80,
    velocityThreshold = 0.3,
    onSwipeLeft,
    onSwipeRight,
    enabled = true,
  }: UseSwipeNavigationOptions,
): void {
  const stateRef = useRef<{
    startX: number;
    startY: number;
    startT: number;
    locked: "horizontal" | "vertical" | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      stateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startT: e.timeStamp,
        locked: null,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      const s = stateRef.current;
      if (!s) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (s.locked === null && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        s.locked = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      }
      if (s.locked === "horizontal") {
        // Prevent the browser from scrolling the page horizontally.
        e.preventDefault();
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const s = stateRef.current;
      stateRef.current = null;
      if (!s || s.locked !== "horizontal") return;
      const dx = e.clientX - s.startX;
      const dt = e.timeStamp - s.startT;
      const velocity = Math.abs(dx) / Math.max(dt, 1);
      if (Math.abs(dx) > threshold && velocity > velocityThreshold) {
        if (dx < 0) onSwipeLeft();
        else onSwipeRight();
      }
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove, { passive: false });
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", () => (stateRef.current = null));
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [ref, threshold, velocityThreshold, onSwipeLeft, onSwipeRight, enabled]);
}
