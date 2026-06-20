// Fire-and-forget client-side event tracking. Posts to /api/track via
// sendBeacon (survives navigation) and never throws. Privacy-friendly: only
// the event name, current path, and small primitive props are sent.
export function track(
  name: string,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ name, path: window.location.pathname, props });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/track",
        new Blob([body], { type: "application/json" }),
      );
    } else {
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    // ignore — tracking must never break anything
  }
}
