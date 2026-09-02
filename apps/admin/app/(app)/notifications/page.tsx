"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { parseAsString, useQueryState } from "nuqs"
import { Bell, Megaphone, RefreshCw } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { toastManager } from "@workspace/ui/components/toast"
import { apiClient } from "@/lib/api/client"

import { PageHeader } from "@/components/page-header"
import { useAuth } from "@/hooks/use-auth"
import { notificationsService } from "@/services/notifications.service"
import { ChangesTab } from "@/components/notifications/changes-tab"
import { AnnouncementsTab } from "@/components/notifications/announcements-tab"
import {
  useBatchMutations,
  useBatchSender,
} from "@/components/notifications/use-batch-sender"
import {
  useBroadcastHandler,
  useBroadcastState,
} from "@/components/notifications/use-broadcast"

function useBatches(activeTab: "changes" | "announcements") {
  return useQuery({
    queryKey: ["admin", "batches", activeTab],
    queryFn: () =>
      notificationsService.batches(
        activeTab === "changes" ? "COURSE_CHANGES" : "ANNOUNCEMENT"
      ),
  })
}

function useDetectAll(
  courseIncludeGreeting: boolean,
  courseGreetingTemplate: string | null,
  courseIncludeButton: boolean
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      notificationsService.detectAll({
        includeGreeting: courseIncludeGreeting,
        greetingTemplate: courseIncludeGreeting ? courseGreetingTemplate : null,
        includeButton: courseIncludeButton,
      }),
    onSuccess: (data) => {
      toastManager.add({
        title: "بررسی تمام شد",
        description: `${data.created} دسته جدید از ${data.total} ترم`,
        type: "success",
      })
      qc.invalidateQueries({ queryKey: ["admin", "batches"] })
    },
    onError: (e: unknown) =>
      toastManager.add({
        title: "خطا",
        description: e instanceof Error ? e.message : "بررسی ناموفق",
        type: "error",
      }),
  })
}

function useMetaUniversities() {
  return useQuery({
    queryKey: ["admin", "meta", "universities"],
    queryFn: async () => {
      const res = await apiClient.get<{
        universities: Array<{ slug: string; name: { fa: string } }>
      }>("/admin/meta/universities")
      return (res.data as unknown as { universities: unknown[] }).universities ?? res.data
    },
  })
}

function useMetaMajors(filterUni: string[]) {
  return useQuery({
    queryKey: ["admin", "meta", "majors", filterUni],
    queryFn: async () => {
      const ALL = "همه"
      const uniParam = filterUni.includes(ALL) ? "" : filterUni.join(",")
      const qs = uniParam ? `?uni=${uniParam}` : ""
      const res = await apiClient.get<{
        majors: Array<{ slug: string; name: { fa: string }; uniSlug: string }>
      }>(`/admin/meta/majors${qs}`)
      const raw: Array<{
        slug: string
        name: { fa: string }
        uniSlug: string
      }> = (res.data as unknown as { majors: typeof raw }).majors ?? (res.data as unknown as typeof raw) ?? []
      const bySlug = new Map<string, (typeof raw)[number]>()
      for (const m of raw) if (!bySlug.has(m.slug)) bySlug.set(m.slug, m)
      return Array.from(bySlug.values()).sort((a, b) =>
        a.name.fa.localeCompare(b.name.fa, "fa")
      )
    },
  })
}

export default function NotificationsPage() {
  const { user } = useAuth() as unknown as { user: { role: string } | null }
  const isNotificationer = user?.role === "NOTIFICATIONER"

  const [tab, setTab] = useQueryState("tab", parseAsString.withDefault("changes"))
  const activeTab = (
    tab === "announcements" || (tab as string) === "همگانی"
      ? "announcements"
      : "changes"
  ) as "changes" | "announcements"

  const { data: batches = [], refetch: refetchBatches, isLoading: batchesLoading } =
    useBatches(activeTab)

  const [courseIncludeGreeting, setCourseIncludeGreeting] = React.useState(true)
  const [courseGreetingTemplate, setCourseGreetingTemplate] =
    React.useState("سلام {name} عزیز")
  const [courseIncludeButton, setCourseIncludeButton] = React.useState(true)

  const detectAllMut = useDetectAll(
    courseIncludeGreeting,
    courseGreetingTemplate,
    courseIncludeButton
  )

  const { sendingIds, handleSend, handleStop } = useBatchSender()
  const { deleteMut, dismissMut } = useBatchMutations()

  const broadcast = useBroadcastState()
  const handleBroadcast = useBroadcastHandler(broadcast, () => setTab("announcements"))

  const { data: uniList = [] } = useMetaUniversities()
  const { data: majorList = [] } = useMetaMajors(broadcast.filterUni)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader title="اعلان‌ها">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => refetchBatches()}
        >
          <RefreshCw className="size-3.5" /> بروزرسانی
        </Button>
      </PageHeader>

      <div className="space-y-6 p-4 lg:p-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setTab(v as string)}
          className="w-full"
        >
          <TabsList>
            <TabsTrigger value="changes" className="gap-1.5">
              <Bell className="size-3.5" /> تغییرات دروس
            </TabsTrigger>
            <TabsTrigger
              value="announcements"
              className="gap-1.5"
              disabled={isNotificationer}
            >
              <Megaphone className="size-3.5" /> همگانی{" "}
              {isNotificationer && "(غیر مجاز)"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="changes" className="mt-6">
            <ChangesTab
              batches={batches}
              batchesLoading={batchesLoading}
              detectPending={detectAllMut.isPending}
              onDetect={() => detectAllMut.mutate()}
              courseIncludeGreeting={courseIncludeGreeting}
              setCourseIncludeGreeting={setCourseIncludeGreeting}
              courseGreetingTemplate={courseGreetingTemplate}
              setCourseGreetingTemplate={setCourseGreetingTemplate}
              courseIncludeButton={courseIncludeButton}
              setCourseIncludeButton={setCourseIncludeButton}
              sendingIds={sendingIds}
              onSendNext={handleSend}
              onDelete={(id) => deleteMut.mutate(id)}
              onDismiss={(id) => dismissMut.mutate(id)}
              onStop={handleStop}
            />
          </TabsContent>

          <TabsContent value="announcements" className="mt-6">
            <AnnouncementsTab
              isNotificationer={isNotificationer}
              batches={batches}
              sendingIds={sendingIds}
              onSendNext={handleSend}
              onDelete={(id) => deleteMut.mutate(id)}
              onDismiss={(id) => dismissMut.mutate(id)}
              onStop={handleStop}
              composer={broadcast.composer}
              setComposer={broadcast.setComposer}
              filterUni={broadcast.filterUni}
              setFilterUni={broadcast.setFilterUni}
              filterMajor={broadcast.filterMajor}
              setFilterMajor={broadcast.setFilterMajor}
              filterGender={broadcast.filterGender}
              setFilterGender={broadcast.setFilterGender}
              filterEntrySemester={broadcast.filterEntrySemester}
              setFilterEntrySemester={broadcast.setFilterEntrySemester}
              filterEntryYears={broadcast.filterEntryYears}
              setFilterEntryYears={broadcast.setFilterEntryYears}
              yearOptions={broadcast.yearOptions}
              uniList={uniList as Array<{ slug: string; name: { fa: string } }>}
              majorList={majorList as Array<{ slug: string; name: { fa: string } }>}
              broadcastIncludeGreeting={broadcast.broadcastIncludeGreeting}
              setBroadcastIncludeGreeting={broadcast.setBroadcastIncludeGreeting}
              broadcastGreetingTemplate={broadcast.broadcastGreetingTemplate}
              setBroadcastGreetingTemplate={broadcast.setBroadcastGreetingTemplate}
              broadcastIncludeButton={broadcast.broadcastIncludeButton}
              setBroadcastIncludeButton={broadcast.setBroadcastIncludeButton}
              broadcastSending={broadcast.broadcastSending}
              onBroadcast={handleBroadcast}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
