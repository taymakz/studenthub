import { apiClient } from "@/lib/api/client"

export type InlineButton = { text: string; url: string }
export type TelegramPayload = {
  chatId?: number
  text: string
  parseMode?: "HTML" | "Markdown" | "MarkdownV2"
  photoUrl?: string | null
  videoUrl?: string | null
  documentUrl?: string | null
  photoFile?: File | null
  videoFile?: File | null
  documentFile?: File | null
  photoFileId?: string | null
  videoFileId?: string | null
  documentFileId?: string | null
  buttons?: InlineButton[][]
  disablePreview?: boolean
  includeGreeting?: boolean
  greetingTemplate?: string | null
  includeButton?: boolean
}

export const telegramService = {
  async sendSingle(payload: TelegramPayload & { chatId: number }) {
    const hasFile = Boolean(
      payload.photoFile || payload.videoFile || payload.documentFile
    )
    if (hasFile) {
      const file =
        payload.photoFile ?? payload.videoFile ?? payload.documentFile
      if (file && file.size > 4 * 1024 * 1024)
        throw new Error("فایل بزرگتر از 4MB است")
      const fd = new FormData()
      fd.set("chatId", String(payload.chatId))
      fd.set("text", payload.text)
      if (payload.parseMode) fd.set("parseMode", payload.parseMode)
      if (payload.photoUrl) fd.set("photoUrl", payload.photoUrl)
      if (payload.videoUrl) fd.set("videoUrl", payload.videoUrl)
      if (payload.documentUrl) fd.set("documentUrl", payload.documentUrl)
      if (payload.photoFileId) fd.set("photoFileId", payload.photoFileId)
      if (payload.videoFileId) fd.set("videoFileId", payload.videoFileId)
      if (payload.documentFileId)
        fd.set("documentFileId", payload.documentFileId)
      if (payload.buttons?.length)
        fd.set("buttons", JSON.stringify(payload.buttons))
      if (payload.disablePreview !== undefined)
        fd.set("disablePreview", String(payload.disablePreview))
      if (payload.includeGreeting !== undefined)
        fd.set("includeGreeting", String(payload.includeGreeting))
      if (payload.greetingTemplate)
        fd.set("greetingTemplate", payload.greetingTemplate)
      if (payload.includeButton !== undefined)
        fd.set("includeButton", String(payload.includeButton))
      if (file) fd.set("file", file, file.name)
      const res = await apiClient.post<{ chatId: number; sent: boolean }>(
        "/admin/messages/single",
        fd
      )
      return res.data
    }
    const body: Record<string, unknown> = {
      chatId: payload.chatId,
      text: payload.text,
      ...(payload.parseMode ? { parseMode: payload.parseMode } : {}),
      ...(payload.photoUrl ? { photoUrl: payload.photoUrl } : {}),
      ...(payload.videoUrl ? { videoUrl: payload.videoUrl } : {}),
      ...(payload.documentUrl ? { documentUrl: payload.documentUrl } : {}),
      ...(payload.photoFileId ? { photoFileId: payload.photoFileId } : {}),
      ...(payload.videoFileId ? { videoFileId: payload.videoFileId } : {}),
      ...(payload.documentFileId
        ? { documentFileId: payload.documentFileId }
        : {}),
      ...(payload.buttons && payload.buttons.length
        ? { buttons: payload.buttons }
        : {}),
      ...(payload.disablePreview !== undefined
        ? { disablePreview: payload.disablePreview }
        : {}),
      ...(payload.includeGreeting !== undefined
        ? { includeGreeting: payload.includeGreeting }
        : {}),
      ...(payload.greetingTemplate
        ? { greetingTemplate: payload.greetingTemplate }
        : {}),
      ...(payload.includeButton !== undefined
        ? { includeButton: payload.includeButton }
        : {}),
    }
    const res = await apiClient.post<{ chatId: number; sent: boolean }>(
      "/admin/messages/single",
      body
    )
    return res.data
  },
  async sendBroadcast(
    payload: Omit<TelegramPayload, "chatId"> & {
      body?: string
      universitySlug?: string | null
      universitySlugs?: string[] | null
      majorSlug?: string | null
      majorSlugs?: string[] | null
      entryYears?: number[] | null
      entrySemester?: "MEHR" | "BAHMAN" | "SUMMER" | null
      entrySemesters?: Array<"MEHR" | "BAHMAN" | "SUMMER"> | null
      gender?: "MALE" | "FEMALE" | null
      genders?: Array<"MALE" | "FEMALE"> | null
      includeGreeting?: boolean | null
      greetingTemplate?: string | null
      includeButton?: boolean | null
    }
  ) {
    const hasFile = Boolean(
      payload.photoFile || payload.videoFile || payload.documentFile
    )
    const text = payload.text ?? payload.body ?? ""
    const uniSlugs =
      (payload as any).universitySlugs ??
      (payload.universitySlug ? [payload.universitySlug] : undefined)
    const majorSlugs =
      (payload as any).majorSlugs ??
      (payload.majorSlug ? [payload.majorSlug] : undefined)
    const genders =
      (payload as any).genders ??
      (payload.gender ? [payload.gender] : undefined)
    const semesters =
      (payload as any).entrySemesters ??
      (payload.entrySemester ? [payload.entrySemester] : undefined)
    if (hasFile) {
      const file =
        payload.photoFile ?? payload.videoFile ?? payload.documentFile
      if (file && file.size > 4 * 1024 * 1024)
        throw new Error("فایل بزرگتر از 4MB است")
      const fd = new FormData()
      fd.set("body", text)
      if (payload.parseMode) fd.set("parseMode", payload.parseMode)
      if (payload.photoUrl) fd.set("photoUrl", payload.photoUrl)
      if (payload.videoUrl) fd.set("videoUrl", payload.videoUrl)
      if (payload.photoFileId) fd.set("photoFileId", payload.photoFileId)
      if (payload.videoFileId) fd.set("videoFileId", payload.videoFileId)
      if (payload.documentFileId)
        fd.set("documentFileId", payload.documentFileId)
      if (payload.documentUrl) fd.set("documentUrl", payload.documentUrl)
      if (payload.buttons?.length)
        fd.set("buttons", JSON.stringify(payload.buttons))
      if (payload.disablePreview !== undefined)
        fd.set("disablePreview", String(payload.disablePreview))
      if (payload.includeGreeting !== undefined)
        fd.set("includeGreeting", String(payload.includeGreeting))
      if (payload.greetingTemplate)
        fd.set("greetingTemplate", payload.greetingTemplate)
      if (payload.includeButton !== undefined)
        fd.set("includeButton", String(payload.includeButton))
      if (uniSlugs) fd.set("universitySlugs", JSON.stringify(uniSlugs))
      else if (payload.universitySlug)
        fd.set("universitySlug", payload.universitySlug)
      if (majorSlugs) fd.set("majorSlugs", JSON.stringify(majorSlugs))
      else if (payload.majorSlug) fd.set("majorSlug", payload.majorSlug)
      if (payload.entryYears)
        fd.set("entryYears", JSON.stringify(payload.entryYears))
      if (semesters) fd.set("entrySemesters", JSON.stringify(semesters))
      else if (payload.entrySemester)
        fd.set("entrySemester", payload.entrySemester)
      if (genders) fd.set("genders", JSON.stringify(genders))
      else if (payload.gender) fd.set("gender", payload.gender)
      if (file) fd.set("file", file, file.name)
      const res = await apiClient.post<{
        batch: { id: string }
        recipients: number
      }>("/admin/notifications/announcements", fd)
      return res.data
    }
    const res = await apiClient.post<{
      batch: { id: string }
      recipients: number
    }>("/admin/notifications/announcements", {
      body: text,
      universitySlug: payload.universitySlug ?? undefined,
      universitySlugs: uniSlugs ?? undefined,
      majorSlug: payload.majorSlug ?? undefined,
      majorSlugs: majorSlugs ?? undefined,
      entryYears: payload.entryYears ?? undefined,
      entrySemester: payload.entrySemester ?? undefined,
      entrySemesters: semesters ?? undefined,
      gender: payload.gender ?? undefined,
      genders: genders ?? undefined,
      includeGreeting: payload.includeGreeting ?? undefined,
      greetingTemplate: payload.greetingTemplate ?? undefined,
      includeButton: payload.includeButton ?? undefined,
      parseMode: payload.parseMode ?? undefined,
      photoUrl: payload.photoUrl ?? undefined,
      videoUrl: payload.videoUrl ?? undefined,
      documentUrl: payload.documentUrl ?? undefined,
      photoFileId: payload.photoFileId ?? undefined,
      videoFileId: payload.videoFileId ?? undefined,
      documentFileId: payload.documentFileId ?? undefined,
      buttons: payload.buttons ?? undefined,
      disablePreview: payload.disablePreview ?? undefined,
    } as any)
    return res.data
  },
}
