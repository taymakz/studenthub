import { Notebook2 } from "reicon-react"
import { SlideShell } from "./slide-shell"

export function NotesListSlide() {
  return (
    <SlideShell
      visual={<Notebook2 className="size-44 text-primary" />}
      title="لیست یادداشت"
      description="امکان اضافه کردن دروس مورد نظر در لیست یادداشت برای تجربه بهتر زمان انتخاب واحد"
    />
  )
}
