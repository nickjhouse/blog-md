// Sanitize a post-auth `next` redirect target. Only same-origin relative paths
// are allowed: anything that doesn't start with a single "/" (absolute URLs like
// "https://evil.com", protocol-relative "//evil.com", or empty/missing) falls
// back to "/". Prevents open-redirect off the site after login/confirm.
// Pure + dependency-free so both server routes and client components can use it.
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
