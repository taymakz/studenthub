import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3">
      <p className="text-sm text-muted-foreground">این صفحه پیدا نشد.</p>
      <Link
        href="/"
        className="text-sm underline underline-offset-4 hover:text-foreground"
      >
        بازگشت به پیشخوان
      </Link>
    </div>
  )
}
