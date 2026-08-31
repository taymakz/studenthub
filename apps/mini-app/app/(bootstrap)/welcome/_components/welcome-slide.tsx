import AppLogo from "@/components/app/logo"
import { SlideShell } from "./slide-shell"

export function WelcomeSlide() {
  return (
    <SlideShell
      visual={<AppLogo className="size-40" />}
      title={
        <>
          به اپلیکیشن <span translate="no">دانشجویار</span> خوش آمدید
        </>
      }
      description="برای آشنایی با امکانات بر روی ادامه کلیک کنید"
    />
  )
}
