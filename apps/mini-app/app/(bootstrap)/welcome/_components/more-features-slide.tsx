import { Feather } from "reicon-react"
import { SlideShell } from "./slide-shell"

export function MoreFeaturesSlide() {
  return (
    <SlideShell
      visual={<Feather className="size-44 text-primary" />}
      title="و امکانات بیشتر"
      description="آرشیو دروس، منابع آموزشی، ارزیابی اساتید، گروه‌ها و کانال‌های مرتبط با رشته"
    />
  )
}
