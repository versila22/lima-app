import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function getInitialIsMobile(): boolean {
  if (typeof window === "undefined") {
    // SSR / pre-hydration: mobile-first default so the sidebar stays hidden.
    return true;
  }
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = React.useState<boolean>(getInitialIsMobile);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    // Re-sync once mounted in case innerWidth changed between mount and effect.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
