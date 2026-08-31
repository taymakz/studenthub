/**
 * Persian-homoglyph-insensitive, multi-word, all-fields search.
 *
 * Semantics: word-level AND, field-level OR — every whitespace-separated
 * word of the query must be found inside at least one single field. This
 * keeps «تهران ملارد» matching دانشگاه آزاد ملارد (ملارد in the name,
 * تهران in the location) while never matching دانشگاه آزاد کرج, whose
 * fields contain neither word together.
 */

/** Normalize: Arabic→Persian homoglyphs, lowercase, trim. */
export function normalizeSearch(value: string): string {
  return value
    .replace(/\u0643/g, "\u06A9") // ك → ک
    .replace(/\u064A/g, "\u06CC") // ي → ی
    .toLowerCase()
    .trim()
}

/**
 * True when EVERY word of the query is contained in at least one individual
 * field. Empty/whitespace query matches everything.
 */
export function matchesQuery(
  query: string,
  fields: Array<string | null | undefined>
): boolean {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const normalized = fields
    .filter((f): f is string => Boolean(f))
    .map(normalizeSearch)
  return words.every((word) => normalized.some((field) => field.includes(word)))
}
