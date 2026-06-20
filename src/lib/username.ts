// Usernames: 3–20 chars, letters/digits/hyphens. No underscore or other
// characters, partly so the case-insensitive availability check (PostgREST
// ilike) can't be tripped by SQL LIKE wildcards (% and _).
export const USERNAME_PATTERN = /^[a-zA-Z0-9-]{3,20}$/;

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

export const USERNAME_HINT =
  "3–20 characters: letters, numbers, and hyphens.";
