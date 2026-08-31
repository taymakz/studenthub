import { APP_VERSION, GITHUB_REPO_URL } from "@/constants"

export default function SettingsFooter() {
  return (
    <div className="space-y-1.5 py-6 text-center">
      <p className="font-mono text-xs text-muted-foreground">
        نسخه
        <span className="text-left" dir="ltr">
          {APP_VERSION}
        </span>
      </p>
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground hover:text-primary hover:underline"
      >
        گیت‌هاب پروژه
      </a>
    </div>
  )
}
