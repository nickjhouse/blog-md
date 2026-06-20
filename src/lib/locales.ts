// Curated locale allowlist — the single source of truth shared by the admin
// <select> (IdentitySettingsForm, a client component) and the server-side
// validator/identity resolver. Kept in its own module with NO server imports so
// the client form can import it without pulling DB code into the browser bundle.
// Closed list ⇒ an invalid <html lang> / RSS <language> is impossible.
export const LOCALES = [
  { value: "en", label: "English" },
  { value: "en-US", label: "English (United States)" },
  { value: "en-GB", label: "English (United Kingdom)" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "it", label: "Italian" },
  { value: "nl", label: "Dutch" },
  { value: "sv", label: "Swedish" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
] as const;

const LOCALE_VALUES: readonly string[] = LOCALES.map((l) => l.value);

export function isValidLocale(value: string): boolean {
  return LOCALE_VALUES.includes(value);
}
