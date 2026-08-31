import { PhoneVibrate } from "reicon-react"
import { SlideShell } from "./slide-shell"

export function SmartNotificationsSlide() {
  return (
    <SlideShell
      visual={<PhoneVibrate className="size-44 text-primary" />}
      title="اطلاع‌رسانی هوشمند"
      description="با هر تغییر در جزئیات دروس یادداشت‌شده و سایر دروس، فوراً به شما اطلاع داده می‌شود"
    />
  )
}
