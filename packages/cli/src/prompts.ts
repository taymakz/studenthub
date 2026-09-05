/**
 * Shared interactive prompts for @workspace/cli.
 *
 * Same UX as the shadcn CLI (`_ignore/ui/packages/shadcn`, commands/add.ts):
 * multiselect with "Space to select. A to toggle all. Enter to submit."
 *
 * Persian safety: the `prompts` package renders RTL text as-is. We never
 * transform answers — labels and values pass through byte-identical.
 */
import prompts from "prompts";

export interface Choice {
  /** Display label (Persian-safe, shown as-is). */
  title: string;
  value: string;
  selected?: boolean;
  /** Optional right-aligned hint, e.g. course count. */
  hint?: string;
}

function onCancel() {
  // Ctrl+C / Esc: exit cleanly instead of continuing with undefined answers.
  process.exit(1);
}

/**
 * Checkbox list: arrows to move, Space to toggle, A to toggle all,
 * Enter to submit. Returns the selected values (never undefined).
 */
export async function multiselect(
  message: string,
  choices: Choice[]
): Promise<string[]> {
  const { selected } = await prompts(
    {
      type: "multiselect",
      name: "selected",
      message,
      hint: "Space to select. A to toggle all. Enter to submit.",
      instructions: false,
      choices: choices.map((c) => ({
        title: c.hint ? `${c.title} (${c.hint})` : c.title,
        value: c.value,
        selected: c.selected ?? false,
      })),
    },
    { onCancel }
  );
  return (selected ?? []) as string[];
}

/** Single-choice list. Returns the chosen value. */
export async function selectOne(
  message: string,
  choices: Array<{ title: string; value: string }>
): Promise<string> {
  const { value } = await prompts(
    {
      type: "select",
      name: "value",
      message,
      instructions: false,
      choices,
    },
    { onCancel }
  );
  if (value == null) onCancel();
  return value as string;
}

/** Free text input. Returns the typed string (Persian untouched). */
export async function textInput(
  message: string,
  initial?: string
): Promise<string> {
  const { value } = await prompts(
    { type: "text", name: "value", message, initial },
    { onCancel }
  );
  if (value == null) onCancel();
  return String(value ?? "");
}

/** Yes/no confirm. */
export async function confirm(
  message: string,
  initial = true
): Promise<boolean> {
  const { value } = await prompts(
    { type: "confirm", name: "value", message, initial },
    { onCancel }
  );
  return Boolean(value);
}
