import { describe, it, expect } from "vitest"
import { validateRegistry } from "../src/validate"

describe("validateRegistry", () => {
  it("validates the current registry tree", () => {
    const result = validateRegistry()
    expect(result.filesChecked).toBeGreaterThan(0)
    if (!result.ok) {
      console.error("Validation problems:", result.problems)
    }
    expect(result.ok).toBe(true)
  })
})
