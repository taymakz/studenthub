/** App-wide constants (old app: frontend-next/constants/index.ts). */

export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0"

/**
 * Intro flag - same key as the old introduce flow so users who already saw
 * it don't see ours either. Stored in localStorage + Telegram cloudStorage.
 */
export const INTRO_STORAGE_KEY = "completed-introduce-1.0.0-beta.1"

/**
 * DEMO: on every cold start the whole first-run path is walked - intro
 * slider (/welcome) -> setup wizard -> dashboard - no matter which flags or
 * profile are stored. Flip to false for real gating behavior.
 */
export const DEBUG = false

export const GITHUB_REPO_URL = "https://github.com/taymakz/studenthub"
