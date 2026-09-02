"use client"

import { useEffect, useRef, useState } from "react"

import { passedUnits as calcPassedUnits, totalRequiredUnits, uniqueTerms, type ChartCourseItem } from "@/lib/chart"
import { useProfileStore } from "@/stores/profile-store"
import { useProfileChart } from "./../use-profile-chart"

export function useGraduateSelection() {
  const { pool } = useProfileChart()
  const passedList = useProfileStore((s) => s.passed)
  const passedNames = passedList.map((p) => p.courseName)
  const storeHydrated = useProfileStore((s) => s.hydrated)
  const store = useProfileStore.getState

  const [selected, setSelected] = useState<string[]>([])
  const hydratedRef = useRef(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedRef = useRef(selected)

  useEffect(() => { selectedRef.current = selected }, [selected])
  useEffect(() => {
    if (!hydratedRef.current && storeHydrated) hydratedRef.current = true
    if (hydratedRef.current) setSelected(passedNames)
  }, [storeHydrated, passedNames])
  const toggle = (name: string) => {
    const cur = selectedRef.current
    const next = cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]
    setSelected(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => store().setPassed(next), 1200)
  }
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])
  const flush = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    store().setPassed(selectedRef.current)
  }
  const passed = calcPassedUnits(pool, selected)
  return { selected, toggle, flush, passed }
}
