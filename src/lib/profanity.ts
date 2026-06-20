import {
  RegExpMatcher,
  TextCensor,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

// Server-side profanity filter. Enforced in the comment server route so it
// can't be bypassed. Uses the `obscenity` dataset (handles leetspeak, spacing,
// repeated chars) plus a DB-backed custom block/allow list managed in the admin
// moderation dashboard.
//
// Known limits: wordlist filters produce false positives (the "Scunthorpe
// problem") and miss creative evasions. Kept conservative; admin hide/block
// covers edge cases.

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const censor = new TextCensor();

export interface ProfanityResult {
  hasMatch: boolean;
  censored: string;
}

export type CustomTerms = { block: string[]; allow: string[] };

// Mask every case-insensitive occurrence of a custom blocked term.
function censorCustom(input: string, term: string): string {
  if (!term) return input;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return input.replace(new RegExp(escaped, "gi"), (m) => "*".repeat(m.length));
}

export function filterProfanity(
  input: string,
  terms: CustomTerms = { block: [], allow: [] },
): ProfanityResult {
  const lowered = input.toLowerCase();
  const allowHit = terms.allow.some((w) => lowered.includes(w.toLowerCase()));

  const matches = matcher.getAllMatches(input);
  const hitBlockTerms = allowHit
    ? []
    : terms.block.filter((w) => w && lowered.includes(w.toLowerCase()));

  if (matches.length === 0 && hitBlockTerms.length === 0) {
    return { hasMatch: false, censored: input };
  }

  let censored = censor.applyTo(input, matches);
  for (const term of hitBlockTerms) {
    censored = censorCustom(censored, term);
  }
  return { hasMatch: true, censored };
}
