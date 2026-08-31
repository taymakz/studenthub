import Link from "next/link"

/**
 * Shared placeholder for the not-yet-ported feature pages. Each keeps its
 * route alive so the dashboard grid links work.
 */
export default function FeatureStub({
  title,
  note = "این بخش در نسخه بعدی اضافه می‌شود.",
}: {
  title: string
  note?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 safe-top-padding text-center">
      <p className="text-lg font-bold">{title}</p>
      <p className="text-sm text-muted-foreground">{note}</p>
      <Link
        href="/dashboard"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        بازگشت به داشبورد
      </Link>
    </div>
  )
}
