/**
 * Shared Persian text helpers for @workspace/cli.
 *
 * Rule: NEVER mangle user-facing Persian text (no digit conversion, no
 * trimming inside words). These helpers only unify well-known homoglyphs
 * so matching/parsing works — display strings pass through untouched.
 */

/** Arabic ك/ي/ى -> Persian ک/ی. Safe for display AND matching. */
export function unifyPersian(text: string): string {
  return text
    .replace(/ك/g, "ک")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی");
}

/** Collapse whitespace (incl. ZWNJ-adjacent spacing quirks) for matching. */
export function squeeze(text: string): string {
  return unifyPersian(text).replace(/[\s\u200c\u200d]+/g, " ").trim();
}

/**
 * Canonical spaced weekday form, synced with the extension scrapers and
 * mini-app schedule utils: شنبه، یکشنبه، دوشنبه، سه شنبه، چهارشنبه،
 * پنج شنبه، جمعه.
 */
export function canonicalDay(raw: string): string {
  const stripped = squeeze(raw).replace(/[\s\u200c]/g, "");
  if (stripped === "سهشنبه") return "سه شنبه";
  if (stripped === "پنجشنبه") return "پنج شنبه";
  if (stripped === "یکشنبه") return "یکشنبه";
  if (stripped === "دوشنبه") return "دوشنبه";
  if (stripped === "چهارشنبه") return "چهارشنبه";
  return stripped;
}

/** Canonical `DAY از START تا END` session string (matches registry format). */
export function formatSession(day: string, start: string, end: string): string {
  return `${canonicalDay(day)} از ${start} تا ${end}`;
}
