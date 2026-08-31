"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, Settings, Wrench } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { Switch } from "@workspace/ui/components/switch"
import { StatusButton } from "@workspace/ui/components/status-button"

import { PageHeader } from "@/components/page-header"
import { apiClient } from "@/lib/api/client"
import { useAuth } from "@/hooks/use-auth"

interface AppSettings {
  maintenanceMode: "on" | "off"
  maintenanceReason: string | null
}

export default function AdminSettingsPage() {
  const { user: me } = useAuth()
  if (me && me.role !== "SUPERADMIN") {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="تنظیمات برنامه" />
        <div className="p-6 text-center text-sm text-muted-foreground">
          فقط سوپرادمین به این بخش دسترسی دارد
        </div>
      </div>
    )
  }
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await apiClient.get<AppSettings>("/admin/settings")
      return res.data
    },
  })

  const [maintenanceMode, setMaintenanceMode] = React.useState(false)
  const [maintenanceReason, setMaintenanceReason] = React.useState("")

  // Sync from server data
  React.useEffect(() => {
    if (data) {
      setMaintenanceMode(data.maintenanceMode === "on")
      setMaintenanceReason(data.maintenanceReason ?? "")
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.put("/admin/settings", {
        maintenanceMode: maintenanceMode ? "on" : "off",
        maintenanceReason: maintenanceReason.trim() || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="تنظیمات برنامه" />
        <div className="p-6">
          <div className="h-32 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="تنظیمات برنامه">
        <Settings className="size-5 text-muted-foreground" />
      </PageHeader>

      <div className="space-y-6 p-4 lg:p-6">
        {/* Maintenance Mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="size-5 text-muted-foreground" />
              حالت تعمیر و نگهداری
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label
                  htmlFor="maintenance-mode"
                  className="text-sm font-medium"
                >
                  حالت تعمیر و نگهداری
                </Label>
                <p className="text-xs text-muted-foreground">
                  当 فعال باشد، کاربران پیام تعمیر را می‌بینند و نمی‌توانند از
                  برنامه استفاده کنند.
                </p>
              </div>
              <Switch
                id="maintenance-mode"
                checked={maintenanceMode}
                onCheckedChange={setMaintenanceMode}
              />
            </div>

            {maintenanceMode && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4" />
                  حالت تعمیر فعال است — کاربران به برنامه دسترسی ندارند.
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="maintenance-reason"
                className="text-sm font-medium"
              >
                دلیل تعمیر
              </Label>
              <Input
                id="maintenance-reason"
                placeholder="مثلاً: به‌روزرسانی سرور..."
                value={maintenanceReason}
                onChange={(e) => setMaintenanceReason(e.target.value)}
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                این پیام به کاربران نمایش داده می‌شود.
              </p>
            </div>

            <StatusButton
              onClick={() => saveMutation.mutateAsync()}
              successLabel="ذخیره شد"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "در حال ذخیره..." : "ذخیره تنظیمات"}
            </StatusButton>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
