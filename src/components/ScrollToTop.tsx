"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Reset scroll to the top on forward navigations. Next's App Router is supposed
// to do this, but it's unreliable on some mobile browsers (notably Chrome on
// Android). We scroll to top when the pathname changes, EXCEPT:
//   • back/forward (popstate) — let the browser restore the previous position
//   • hash deep-links (#section) — let the anchor scroll win
export function ScrollToTop() {
  const pathname = usePathname();
  const isPop = useRef(false);

  useEffect(() => {
    const onPop = () => {
      isPop.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (isPop.current) {
      isPop.current = false; // restoration handles back/forward
      return;
    }
    if (window.location.hash) return; // respect anchor deep-links
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
