import { NotifRemove2 } from "reicon-react"
import { SlideShell } from "./slide-shell"

export function ConflictWarningSlide() {
  return (
    <SlideShell
      visual={<NotifRemove2 className="size-44 animate-pulse text-warning" />}
      title="هشدار تداخل"
      description="هشدار در صورت وجود تداخل زمانی بین دروس انتخابی یا ثبت بیش از یک درس عمومی یا عدم رعایت پیش نیاز و همنیاز ها"
    />
  )
}
