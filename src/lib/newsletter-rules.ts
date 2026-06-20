// Pure decision rules for the auto-newsletter — no imports, so they're trivially
// unit-testable. Guards against accidentally emailing the whole list.

// A post "transitions to live" only when it's live now AND wasn't live before.
// This is what stops edits of an already-published post from re-sending.
export function isLiveTransition(nowLive: boolean, wasLive: boolean): boolean {
  return nowLive && !wasLive;
}

// Whether an auto-send should fire for a publish action.
export function autoSendEligible(opts: {
  enabled: boolean; // auto_newsletter_on_publish
  includeAuthors: boolean; // auto_newsletter_include_authors
  liveTransition: boolean;
  isAdmin: boolean;
}): boolean {
  if (!opts.enabled) return false;
  if (!opts.liveTransition) return false;
  // Authors only count when explicitly included; admins always.
  if (!opts.isAdmin && !opts.includeAuthors) return false;
  return true;
}
