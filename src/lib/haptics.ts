type HapticPattern = "tap" | "fab" | "refresh";

const PATTERNS: Record<HapticPattern, number | number[]> = {
  tap: 8,
  fab: 12,
  refresh: 15,
};

export function haptic(pattern: HapticPattern): void {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[pattern]);
  } catch {
    // Silently ignore — some browsers throw on user-gesture requirements.
  }
}
