"use client"

import { motion } from "motion/react"

import { InitialLoading } from "@/components/app/initial-loading"
import { useProfileStore } from "@/stores/profile-store"

export function BootstrapErrorView() {
  return (
    <motion.div
      key="bootstrap-error"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-8 text-center"
    >
      <p className="font-medium">خطا در اتصال</p>
      <p className="text-sm text-muted-foreground">
        لطفا لحظاتی دیگر دوباره وارد شوید.
      </p>
      <button
        onClick={() => void useProfileStore.getState().refresh()}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        تلاش مجدد
      </button>
    </motion.div>
  )
}

export function BootstrapSplashView() {
  return (
    <motion.div
      key="bootstrap-splash"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-50"
    >
      <InitialLoading />
    </motion.div>
  )
}
