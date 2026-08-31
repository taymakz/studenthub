import { nextJsConfig } from "@workspace/eslint-config/next-js"

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    // Verbatim inline copy of telegram-web-app.js - never lint vendor code.
    ignores: ["public/telegram.js", "next-env.d.ts"],
  },
]
