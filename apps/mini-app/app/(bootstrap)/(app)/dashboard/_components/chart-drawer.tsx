"use client"

import * as React from "react"

import {
  Drawer,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer"

import { ChartDrawerTrigger } from "./chart-drawer-trigger"
import {
  ChartAvailableAction,
  ChartError,
  ChartLoading,
  ChartUnavailable,
} from "./chart-drawer-panel"
import {
  useChartDrawerHandlers,
  useChartProfile,
  useChartRequest,
  useChartStatus,
} from "./use-chart-drawer"

function ChartDrawerContent({
  profile,
  status,
  requestChart,
  onGetFile,
}: {
  profile: ReturnType<typeof useChartProfile>["profile"]
  status: ReturnType<typeof useChartStatus>
  requestChart: ReturnType<typeof useChartRequest>
  onGetFile: () => void
}) {
  if (status.isLoading) return <ChartLoading />
  if (status.isUnavailable) return <ChartUnavailable />
  return (
    <ChartAvailableAction
      disabled={requestChart.isPending || !profile}
      pending={requestChart.isPending}
      onClick={onGetFile}
    />
  )
}

export default function ChartDrawer() {
  const [open, setOpen] = React.useState(false)
  const { profile } = useChartProfile()
  const status = useChartStatus(profile)
  const requestChart = useChartRequest(() => setOpen(false))
  const { handleGetFile } = useChartDrawerHandlers(
    status.isUnavailable,
    () => requestChart.mutate()
  )

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger
        render={
          <ChartDrawerTrigger
            isLoading={status.isLoading}
            isUnavailable={status.isUnavailable}
          />
        }
      />
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>دریافت چارت درسی</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          <ChartDrawerContent
            profile={profile}
            status={status}
            requestChart={requestChart}
            onGetFile={handleGetFile}
          />
          {requestChart.isError && <ChartError error={requestChart.error} />}
        </DrawerPanel>
      </DrawerPopup>
    </Drawer>
  )
}
