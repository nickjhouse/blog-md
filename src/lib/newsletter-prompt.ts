// Client-side suppression state for the newsletter capture prompt. There's no
// reliable server signal for "is this visitor subscribed" (the signup form is
// fire-and-forget), so we track intent in localStorage:
//   - subscribed: set when the visitor subscribes anywhere (footer OR the card)
//                 → the card never shows again.
//   - dismissedAt: set when the visitor closes the card → suppressed until
//                  dismissedAt + redisplayDays (0 redisplayDays = never re-show).
// All reads/writes are guarded — a disabled/throwing localStorage just means the
// card shows (fail-open), which is harmless.

const KEY = "nl_prompt";

type PromptState = {
  subscribed?: boolean;
  dismissedAt?: number; // epoch ms
};

function read(): PromptState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PromptState) : {};
  } catch {
    return {};
  }
}

function write(state: PromptState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore (private mode / storage disabled)
  }
}

// Subscribed anywhere — silence the card permanently.
export function markSubscribed(): void {
  write({ ...read(), subscribed: true });
}

// Card closed — start the re-show timer.
export function markDismissed(): void {
  write({ ...read(), dismissedAt: Date.now() });
}

// Whether the card should stay hidden right now.
export function shouldSuppress(redisplayDays: number): boolean {
  const { subscribed, dismissedAt } = read();
  if (subscribed) return true;
  if (!dismissedAt) return false;
  // Dismissed at least once: never re-show when redisplayDays is 0, otherwise
  // suppress until the window elapses.
  if (redisplayDays <= 0) return true;
  const elapsedMs = Date.now() - dismissedAt;
  return elapsedMs < redisplayDays * 24 * 60 * 60 * 1000;
}
