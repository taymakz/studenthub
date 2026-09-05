/**
 * RTL display fix for bidi-less terminals.
 *
 * Classic Windows conhost and VS Code's xterm.js draw characters strictly
 * left-to-right with no bidirectional algorithm, so Persian runs appear
 * letter-reversed. `toVisual()` pre-reverses each RTL span (mirroring
 * brackets) so it DISPLAYS correctly on those terminals. Terminals with
 * real bidi support (Windows Terminal) must NOT use it.
 *
 * Rules:
 *   - DISPLAY ONLY. Anything written to JSON (`output.ts`) is never
 *     transformed — stored data stays in logical (correct) order.
 *   - `t()` is the single choke point for user-visible strings.
 *   - Preference is asked once, persisted to `output/terminal.json`
 *     (gitignored), overridable via `STUDENTHUB_CLI_RTL=reverse|off`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RTL_CHAR =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u200C\u200D]/;
const LTR_CHAR = /[A-Za-z0-9\u00C0-\u024F]/;

/** Brackets must mirror when their span is reversed (RTL convention). */
const MIRROR: Record<string, string> = {
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "{": "}",
  "}": "{",
  "<": ">",
  ">": "<",
  "«": "»",
  "»": "«",
};

export function hasRtl(text: string): boolean {
  return RTL_CHAR.test(text);
}

/**
 * Convert logical-order text to visual order for bidi-less terminals:
 * reverse each RTL span character-wise (spaces BETWEEN Persian words are
 * part of the span so word order flips too), keep Latin/digits intact,
 * mirror brackets inside RTL spans.
 */
export function toVisual(text: string): string {
  if (!text || !hasRtl(text)) return text;

  const chars = [...text];
  const cls: Array<"rtl" | "ltr" | "neutral"> = chars.map((ch) =>
    RTL_CHAR.test(ch) ? "rtl" : LTR_CHAR.test(ch) ? "ltr" : "neutral"
  );

  // Neutral chars (spaces, punctuation) between two RTL chars belong to the
  // RTL span — otherwise «گروه آموزشی» would keep logical word order and
  // read backwards. Newlines are hard boundaries, never bridged.
  for (let i = 0; i < chars.length; i++) {
    if (cls[i] !== "neutral" || chars[i] === "\n") continue;
    let prev = i - 1;
    while (prev >= 0 && cls[prev] === "neutral") prev--;
    let next = i + 1;
    while (next < chars.length && cls[next] === "neutral") next++;
    if (
      prev >= 0 &&
      next < chars.length &&
      cls[prev] === "rtl" &&
      cls[next] === "rtl"
    ) {
      cls[i] = "rtl";
    }
  }

  const out: string[] = [];
  let i = 0;
  while (i < chars.length) {
    if (cls[i] === "rtl") {
      let j = i;
      while (j < chars.length && cls[j] === "rtl") j++;
      for (const ch of chars.slice(i, j).reverse()) out.push(MIRROR[ch] ?? ch);
      i = j;
    } else {
      out.push(chars[i]!);
      i++;
    }
  }
  return out.join("");
}

// ── preference state ───────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));
const statePath = join(here, "..", "output", "terminal.json");

export interface RtlState {
  decided: boolean;
  reverse: boolean;
}

/** Best guess for terminals the user hasn't decided on yet. */
export function autoDetectReverse(): boolean {
  if (process.env.TERM_PROGRAM === "vscode") return true; // xterm.js: no bidi
  if (process.env.WT_SESSION) return false; // Windows Terminal: real bidi
  if (process.platform === "win32") return true; // classic conhost: no bidi
  return false;
}

export function loadRtlState(): RtlState {
  const env = process.env.STUDENTHUB_CLI_RTL?.toLowerCase();
  if (env === "reverse") return { decided: true, reverse: true };
  if (env === "off") return { decided: true, reverse: false };
  try {
    if (existsSync(statePath)) {
      const s = JSON.parse(readFileSync(statePath, "utf-8")) as {
        reverse?: unknown;
      };
      if (typeof s.reverse === "boolean")
        return { decided: true, reverse: s.reverse };
    }
  } catch {
    // corrupt state file → fall through to undecided
  }
  return { decided: false, reverse: autoDetectReverse() };
}

export function saveRtlState(reverse: boolean): void {
  try {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(
      statePath,
      JSON.stringify({ decided: true, reverse }, null, 2) + "\n",
      "utf-8"
    );
  } catch {
    // read-only fs → preference just won't persist
  }
}

let reverse = false;

export function setRtlReverse(value: boolean): void {
  reverse = value;
}

/** Transform a user-visible string (no-op unless reverse mode is on). */
export function t(text: string | null | undefined): string {
  const s = text ?? "";
  return reverse ? toVisual(s) : s;
}

/**
 * Decide reverse mode once per run:
 *   1. `STUDENTHUB_CLI_RTL=reverse|off` env override,
 *   2. saved answer in `output/terminal.json`,
 *   3. interactive: print a raw sample, ask, persist the answer,
 *   4. non-interactive: auto-detect (vscode/conhost → reverse,
 *      Windows Terminal → off), no prompt, nothing persisted.
 */
export async function ensureRtlDisplay(interactive: boolean): Promise<void> {
  const state = loadRtlState();
  if (!state.decided) {
    if (interactive) {
      // Raw (logical-order) sample — judge it as-is, then we flip if needed.
      console.log("Sample: یکشنبه از 07:30 تا 09:30");
      const { confirm } = await import("./prompts.ts");
      const ok = await confirm("Does Persian display correctly?", false);
      state.reverse = !ok;
      saveRtlState(state.reverse);
    }
    // Non-interactive keeps autoDetectReverse() from loadRtlState().
  }
  setRtlReverse(state.reverse);
}
