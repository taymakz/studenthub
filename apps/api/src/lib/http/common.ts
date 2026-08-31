import type { Context } from "hono"

/** Uniform envelope for every JSON response. */
export function ok<T>(c: Context, data: T, message = "success") {
  return c.json({ success: true, message, data })
}

export function fail(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 500,
  message: string,
  data?: unknown
) {
  return c.json({ success: false, message, data }, { status })
}

export const badRequest = (c: Context, message: string, data?: unknown) =>
  fail(c, 400, message, data)
export const unauthorized = (c: Context, message = "احراز هویت لازم است") =>
  fail(c, 401, message)
export const forbidden = (c: Context, message = "دسترسی مجاز نیست") =>
  fail(c, 403, message)
export const notFound = (c: Context, message = "پیدا نشد", data?: unknown) =>
  fail(c, 404, message, data)
export const conflict = (c: Context, message: string) => fail(c, 409, message)
export const tooManyRequests = (
  c: Context,
  message = "درخواست بیش از حد مجاز"
) => c.json({ success: false, message }, { status: 429 })
export const internalServerError = (
  c: Context,
  message = "خطای داخلی سرور",
  data?: unknown
) => fail(c, 500, message, data)

/** Page/limit query parsing with sane bounds. */
export function parsePagination(c: Context): {
  page: number
  limit: number
  offset: number
} {
  const page = Math.max(1, Number.parseInt(c.req.query("page") ?? "1", 10) || 1)
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(c.req.query("limit") ?? "25", 10) || 25)
  )
  return { page, limit, offset: (page - 1) * limit }
}
