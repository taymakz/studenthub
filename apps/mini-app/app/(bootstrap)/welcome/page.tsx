"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "motion/react"

import { DEBUG, INTRO_STORAGE_KEY } from "@/constants"
import { cn } from "@workspace/ui/lib/utils"

import { WelcomeSlide } from "./_components/welcome-slide"
import { OpenSourceSlide } from "./_components/open-source-slide"
import { CourseListSlide } from "./_components/course-list-slide"
import { NotesListSlide } from "./_components/notes-list-slide"
import { ConflictWarningSlide } from "./_components/conflict-warning-slide"
import { SmartNotificationsSlide } from "./_components/smart-notifications-slide"
import { SmartScheduleSlide } from "./_components/smart-schedule-slide"
import { MoreFeaturesSlide } from "./_components/more-features-slide"
import { ThemeSettingsSlide } from "./_components/theme-settings-slide"

const slides = [
  <WelcomeSlide key="welcome" />,
  <OpenSourceSlide key="opensource" />,
  <CourseListSlide key="courses" />,
  <NotesListSlide key="notes" />,
  <ConflictWarningSlide key="conflicts" />,
  <SmartNotificationsSlide key="notifications" />,
  <SmartScheduleSlide key="schedule" />,
  <MoreFeaturesSlide key="more" />,
  <ThemeSettingsSlide key="theme" />,
]

/**
 * Intro slider - the rewrite of the old Swiper introduce flow: full-height
 * slides, clickable dots, single CTA that flips the intro flag (localStorage +
 * Telegram cloudStorage, best effort) then hands back to the root gate.
 */
export default function WelcomePage() {
  const router = useRouter()
  const [[index, direction], setState] = React.useState<[number, number]>([
    0, 0,
  ])
  const [finishing, setFinishing] = React.useState(false)
  const isLast = index === slides.length - 1

  const paginate = React.useCallback((delta: number) => {
    setState(([current]) => [
      Math.min(Math.max(current + delta, 0), slides.length - 1),
      delta,
    ])
  }, [])

  // RTL swipe + fade (multi-step pattern): forward (dir=1) — next slide
  // enters from the LEFT edge while the current one slides off to the RIGHT;
  // going back is the exact mirror. Opacity crossfades at the edges.
  // custom={direction} on both AnimatePresence and the child keeps the
  // exiting slide using the latest direction (its props are stale mid-exit).
  const variants = {
    enter: (dir: number) => ({
      transform: `translateX(${-110 * dir}%)`,
      opacity: 0,
    }),
    center: { transform: "translateX(0%)", opacity: 1 },
    exit: (dir: number) => ({
      transform: `translateX(${110 * dir}%)`,
      opacity: 0,
    }),
  }

  const finish = async () => {
    setFinishing(true)
    const flag = JSON.stringify(true)
    try {
      localStorage.setItem(INTRO_STORAGE_KEY, flag)
    } catch {
      /* storage blocked - gate re-shows next launch */
    }
    try {
      const { cloudStorage } = await import("@tma.js/sdk-react")
      await cloudStorage.setItem(INTRO_STORAGE_KEY, flag)
    } catch {
      /* cloudStorage unavailable outside Telegram */
    }

    if (DEBUG) {
      // Walkthrough keeps going through the setup wizard every time.
      router.replace("/setup")
      return
    }
    // Real flow: the gate routes to /setup or /dashboard by profile state.
    router.replace("/")
  }

  return (
    <div className="max-w-screen-xs mx-auto flex h-dvh w-full flex-col overflow-hidden safe-top-padding">
      {/* Slides viewport */}
      <main className="relative min-h-0 flex-1">
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={index}
            className="absolute inset-0 px-6 will-change-transform"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          >
            {slides[index]}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Pagination dots — visual 6px, hit target ≥44px on mobile */}
      <div className="max-w-screen-xs mx-auto flex w-full items-center justify-center pb-4">
        {slides.map((_, i) => (
          <button
            key={i}
            aria-label={`اسلاید ${i + 1}`}
            onClick={() => setState([i, i > index ? 1 : -1])}
            className="flex min-h-11 touch-manipulation items-center justify-center px-0.5"
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 rounded-full transition-all duration-200",
                i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          </button>
        ))}
      </div>

      {/* CTA — min 44px hit target, keeps label during loading */}
      <footer className="max-w-screen-xs mx-auto w-full px-6 safe-bottom-padding">
        <div className="pb-6">
          <button
            onClick={() => (isLast ? finish() : paginate(1))}
            disabled={finishing}
            aria-busy={finishing}
            className="flex min-h-11 w-full touch-manipulation items-center justify-center rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-md transition-opacity active:opacity-80 disabled:opacity-60"
          >
            {finishing ? "در حال بارگذاری…" : isLast ? "شروع" : "ادامه"}
          </button>
        </div>
      </footer>
    </div>
  )
}
