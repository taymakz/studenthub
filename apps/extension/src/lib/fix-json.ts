/**
 * Improved successor of the legacy admin `fixJson`/`formatJson`.
 *
 * Fixes accepted (all best-effort, never throws):
 *   - // and slash-star comments
 *   - trailing commas in objects/arrays
 *   - unquoted object keys          {course_name: ...}
 *   - single-quoted string values   {'value'}
 *   - True/False/None literals      -> true/false/null
 *   - Persian/Arabic-Indic digits   ۱۴۰۴ -> 1404 (bare numbers AND
 *     digit-only strings like "۳" become real numbers)
 *   - a single object is wrapped into an array
 *   - strings are whitespace-collapsed + trimmed
 *   - empty strings in known nullable offering fields become null
 *   - offering-like objects get canonical key order (stable PR diffs)
 *
 * Returns a result object instead of silently returning "" on failure.
 */

const NULLABLE_OFFERING_FIELDS = new Set([
  "courseType",
  "presentationType",
  "minCapacity",
  "maxCapacity",
  "currentEnrollment",
  "classSchedule",
  "examSchedule",
  "professor",
  "location",
]);

const OFFERING_KEY_ORDER = [
  "index",
  "courseCode",
  "courseName",
  "courseType",
  "theoreticalUnits",
  "practicalUnits",
  "classCode",
  "degree",
  "presentationType",
  "minCapacity",
  "maxCapacity",
  "currentEnrollment",
  "classSchedule",
  "examSchedule",
  "professor",
  "location",
] as const;

function toEnglishDigits(text: string): string {
  return text.replace(/[۰-۹٠-٩]/g, (ch) => {
    const persian = "۰۱۲۳۴۵۶۷۸۹".indexOf(ch);
    if (persian !== -1) return String(persian);
    return String("٠١٢٣٤٥٦٧٨٩".indexOf(ch));
  });
}

function looksLikeOffering(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "index" in value &&
    "courseName" in value
  );
}

function orderKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderKeys);
  if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};

    if (looksLikeOffering(obj)) {
      for (const key of OFFERING_KEY_ORDER) {
        if (key in obj) out[key] = orderKeys(obj[key]);
      }
      for (const [key, val] of Object.entries(obj)) {
        if (!(key in out)) out[key] = orderKeys(val);
      }
      return out;
    }

    for (const [key, val] of Object.entries(obj)) out[key] = orderKeys(val);
    return out;
  }
  return value;
}

function cleanStrings(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) return value.map((v) => cleanStrings(v));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, cleanStrings(v, k)]),
    );
  }
  if (typeof value === "string") {
    const trimmed = value
      .replace(/[\u200c\u200d\u200e\u200f\u00a0\u2060\ufeff]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (trimmed === "") {
      return parentKey && NULLABLE_OFFERING_FIELDS.has(parentKey)
        ? null
        : trimmed;
    }
    // Digit-only strings become real numbers (units, capacities, years).
    if (/^[۰-۹٠-٩\d]+$/.test(trimmed)) return Number(toEnglishDigits(trimmed));
    return trimmed;
  }
  return value;
}

export interface FixJsonResult {
  ok: boolean;
  json: string;
  error?: string;
}

export function fixJson(input: string): FixJsonResult {
  if (!input.trim()) return { ok: true, json: "" };

  try {
    let text = input;

    text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
    text = text.replace(/,\s*([[\]}])/g, "$1");
    text = text.replace(/([{,]\s*)(\w+)(\s*):/g, '$1"$2"$3:');
    text = text.replace(/:\s*'([^']*)'/g, ': "$1"');
    text = text.replace(/\b(True|False|None|NULL)\b/g, (m) =>
      m === "True" ? "true" : m === "False" ? "false" : "null",
    );
    text = toEnglishDigits(text);

    const trimmed = text.trim();
    if (trimmed.startsWith("{") && !trimmed.endsWith("}")) {
      text = `${trimmed}}`;
    }
    if (text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      text = `[${text.trim()}]`;
    }

    const parsed: unknown = JSON.parse(text);
    const cleaned = cleanStrings(parsed);
    const ordered = orderKeys(cleaned);

    return { ok: true, json: `${JSON.stringify(ordered, null, 2)}\n` };
  } catch (error) {
    return {
      ok: false,
      json: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
