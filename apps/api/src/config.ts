import env from "env-var"

/**
 * Central env parsing. Fails fast at boot for required secrets; dev-friendly
 * fallbacks are explicit so nothing silently misconfigures in production.
 */
const APP_ENV = env.get("APP_ENV").default("development").asString()

export const config = {
  APP_ENV,
  IS_DEV: APP_ENV === "development",
  PORT: env.get("PORT").default("8000").asInt(),

  DATABASE_URL: env.get("DATABASE_URL").required().asString(),

  TELEGRAM_BOT_TOKEN: env.get("TELEGRAM_BOT_TOKEN").default("").asString(),
  /** Public bot username without @ (e.g. my_studenthub_bot) — used for Login Widget. */
  TELEGRAM_BOT_USERNAME: env
    .get("TELEGRAM_BOT_USERNAME")
    .default("")
    .asString(),
  /** Skip real Bot API calls (local dev) - payloads are logged instead. */
  TELEGRAM_DRY: env.get("TELEGRAM_DRY").default("false").asBool(),
  /**
   * Explicit opt-in to hit the real Bot API outside production (local manual
   * testing). Without it, non-production environments (NODE_ENV !=
   * "production") are always dry — dev machines usually share the prod bot
   * token, and test signups must never spam the real admin topics or users.
   */
  TELEGRAM_LIVE: env.get("TELEGRAM_LIVE").default("false").asBool(),
  MAX_UPLOAD_MB: env.get("MAX_UPLOAD_MB").default("45").asInt(),
  /** Open-app inline button under notification messages. */
  TELEGRAM_APP_URL: env.get("TELEGRAM_APP_URL").asString(),

  /**
   * Admin forum group for operational notifications (JOINS / STORAGE / DEFAULT).
   * Supports two formats:
   *  - Separate: TELEGRAM_ADMIN_GROUP_ID=-100123 + TELEGRAM_ADMIN_TOPIC_JOINS=14
   *  - Combined: TELEGRAM_ADMIN_TOPIC_JOINS=-100123_14 (chatId_topicId)
   * If only combined values are set, group id is derived from them. If unset, notifications are dry-logged.
   */
  TELEGRAM_ADMIN_GROUP_ID: env
    .get("TELEGRAM_ADMIN_GROUP_ID")
    .default("")
    .asString(),
  TELEGRAM_ADMIN_TOPIC_JOINS: env
    .get("TELEGRAM_ADMIN_TOPIC_JOINS")
    .default("")
    .asString(),
  TELEGRAM_ADMIN_TOPIC_STORAGE: env
    .get("TELEGRAM_ADMIN_TOPIC_STORAGE")
    .default("")
    .asString(),
  TELEGRAM_ADMIN_TOPIC_DEFAULT: env
    .get("TELEGRAM_ADMIN_TOPIC_DEFAULT")
    .default("")
    .asString(),
  // Back-compat with legacy env names (STORAGE/JOINS) - they already contain "chatId_topic".
  TELEGRAM_SERVICE_TOPICS_STORAGE_ID: env
    .get("TELEGRAM_SERVICE_TOPICS_STORAGE_ID")
    .default("")
    .asString(),
  TELEGRAM_SERVICE_TOPICS_JOINS_ID: env
    .get("TELEGRAM_SERVICE_TOPICS_JOINS_ID")
    .default("")
    .asString(),
  TELEGRAM_SERVICE_TOPICS_DEFAULT_ID: env
    .get("TELEGRAM_SERVICE_TOPICS_DEFAULT_ID")
    .default("")
    .asString(),

  /** Public raw base for registry PDFs — jsDelivr CDN (Iran POP) */
  CHART_PDF_BASE_URL:
    "https://cdn.jsdelivr.net/gh/taymakz/studenthub@main/packages/registry/registry",

  /** HS256 secret for the admin session JWT — enterprise: must be strong. */
  SECRET_KEY: (() => {
    const v = env.get("SECRET_KEY").required().asString()
    if (v.length < 32 || v === "change-me" || v === "change_me") {
      throw new Error(
        "SECRET_KEY must be >=32 chars and not 'change-me' — generate with: openssl rand -base64 48"
      )
    }
    return v
  })(),

  CORS_ALLOWED_ORIGIN: env.get("CORS_ALLOWED_ORIGIN").default("").asString(),

  /**
   * Supabase Storage (S3-compatible) for one-time export images
   * (برنامه هفتگی / برنامه امتحانی). The client uploads via a presigned PUT,
   * POSTs the object key back, the API sends a presigned GET link through the
   * Telegram bot and DELETES the object right after - nothing persists.
   */
  SUPABASE_S3_ENDPOINT: env.get("SUPABASE_S3_ENDPOINT").default("").asString(),
  SUPABASE_S3_BUCKET: env
    .get("SUPABASE_S3_BUCKET")
    .default("one-time")
    .asString(),
  SUPABASE_S3_REGION: env
    .get("SUPABASE_S3_REGION")
    .default("us-east-1")
    .asString(),
  SUPABASE_S3_ACCESS_KEY_ID: env
    .get("SUPABASE_S3_ACCESS_KEY_ID")
    .default("")
    .asString(),
  SUPABASE_S3_SECRET_ACCESS_KEY: env
    .get("SUPABASE_S3_SECRET_ACCESS_KEY")
    .default("")
    .asString(),

  /**
   * Admin dashboard sessions live ONE YEAR: an admin stays logged in unless
   * they do not come back for a full year. The session cookie is owned by
   * the dashboard origin (apps/admin /api/auth/session route); this API is
   * Bearer-token only and sets no cookie. Mini-app requests are STATELESS -
   * every call carries fresh tma initData.
   */
  ADMIN_SESSION_TTL_DAYS: 365,

  OTP_TTL_MINUTES: 5,
} as const
