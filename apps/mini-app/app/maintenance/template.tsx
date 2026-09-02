"use client"
import { m } from "motion/react"

export default function TransitionRoot({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ease: "easeInOut", duration: 0.3 }}
    >
      {children}
    </m.div>
  )
}
