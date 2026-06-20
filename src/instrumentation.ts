// Next.js instrumentation. `onRequestError` is the central hook for server-side
// errors (route handlers, RSC, SSR) — it fires for any uncaught server error, so
// we don't have to wrap every route. We forward to the throttled reporter, which
// logs to the Worker console and emails the owner (rate-limited). Best-effort and
// never throws, so reporting can't itself break a request.
export async function onRequestError(
  error: unknown,
  request: { path?: string },
): Promise<void> {
  try {
    const { reportServerError } = await import("@/lib/error-report");
    await reportServerError({ error, route: request?.path ?? null });
  } catch {
    // swallow — instrumentation must never throw
  }
}
