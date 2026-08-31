import { CalendarHeart } from "lucide-react"

import { SlideShell } from "./slide-shell"

export function SmartScheduleSlide() {
  return (
    <SlideShell
      visual={<CalendarHeart className="size-44 text-primary" />}
      title="برنامه هوشمند"
      description="امکان مشاهده برنامه هفتگی و امتحانی شما بر اساس دروس انتخابی"
    />
  )
}
