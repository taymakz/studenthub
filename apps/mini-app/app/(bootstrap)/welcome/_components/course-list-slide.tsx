import { Book2 } from "reicon-react"
import { SlideShell } from "./slide-shell"

export function CourseListSlide() {
  return (
    <SlideShell
      visual={<Book2 className="size-44 text-primary" />}
      title="لیست دروس ارائه شده"
      description="مشاهده و تفکیک دروس ارائه‌شده مطابق چارت تحصیلی‌تون، بدون نمایش دروس ورودی‌های دیگه"
    />
  )
}
