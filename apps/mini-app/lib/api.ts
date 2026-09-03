import { apiClient } from "@/lib/request"

/* ─── /me ────────────────────────────────────────────────────────────────── */

export interface MeUser {
  id: number
  firstName: string
  lastName: string | null
  username: string | null
  photoUrl: string | null
  role: "USER" | "ADMIN" | "SUPERADMIN" | "NOTIFICATIONER"
  isContributor: boolean
  visibleInCourseLists: boolean
  visibleInCourseListsLastUpdated: string | null
}

export interface MeProfile {
  userId: number
  universitySlug: string | null
  majorSlug: string | null
  degree: string | null
  entryYearRange: string | null
  entrySemester: "MEHR" | "BAHMAN" | "SUMMER" | null
  gender: "MALE" | "FEMALE" | null
  termNumber: number | null
  /** نیم‌سال فعلی - university term code like 4051 (1405 مهر). */
  currentSemesterCode: string | null
  isLastTerm: boolean
}

export interface MeResponse {
  /** Maintenance mode active — only maintenanceReason is set, all other fields absent. */
  maintenance?: boolean
  maintenanceReason?: string | null
  /** Banned — only bannedReason is set */
  banned?: boolean
  bannedReason?: string | null
  user: MeUser
  profile: MeProfile | null
  passed: MePassed[]
  failed: MeFailed[]
  noted: MeNoted[]
  term: { termCode: string; label: string } | null
  terms: OfferingTerm[]
  offerings: Offering[]
  changes: {
    scrapedAt: string
    summary: OfferingDiffSummary
    detail: OfferingDiffDetail
  } | null
  chart: MyChart | null
  resolvedYearDir: string | null
}

export function fetchMe() {
  return apiClient.get<MeResponse>("/me")
}

/** True when the wizard's required fields all exist. Mirrors old `isDetailComplete`. */
export function isProfileComplete(profile: MeProfile | null): boolean {
  return Boolean(
    profile?.universitySlug &&
    profile?.majorSlug &&
    profile?.degree &&
    profile?.entryYearRange &&
    profile?.entrySemester
  )
}

export interface UpdateProfileInput {
  universitySlug: string
  majorSlug: string
  degree: string
  entryYearRange: string
  entrySemester: "MEHR" | "BAHMAN" | "SUMMER"
  gender?: "MALE" | "FEMALE"
  termNumber?: number
  currentSemesterCode?: string
  isLastTerm?: boolean
}

export function updateProfile(input: UpdateProfileInput) {
  return apiClient.put<{ profile: MeProfile }>("/me/profile", input)
}

export function patchProfile(input: {
  termNumber?: number
  currentSemesterCode?: string
  isLastTerm?: boolean
}) {
  return apiClient.patch<{ profile: MeProfile }>("/me/profile", input)
}

/* ─── Offering terms (allowed نیم‌سال values for the semester picker) ─── */

export interface OfferingTerm {
  year: number
  semester: "MEHR" | "BAHMAN" | "SUMMER"
  hasPrevious?: boolean
  termCode: string
  label: string
}

export function fetchOfferingTerms(uniSlug: string, majorSlug: string) {
  const qs = new URLSearchParams({ uni: uniSlug, major: majorSlug })
  return apiClient.get<{ terms: OfferingTerm[] }>(
    `/app/offerings/terms?${qs.toString()}`
  )
}

/* ─── /app registry (read-only, tma-authenticated) ──────────────────────── */

export interface RegistryName {
  fa: string
}

export type UniversityType = "azad" | "gov" | "pnu"

export interface UniversityIndexEntry {
  slug: string
  name: RegistryName
  /** Institution type - drives the card logo (@persianlabs mono icon). */
  type: UniversityType
  location: RegistryName
}

export interface MajorDegree {
  slug: string
  name: RegistryName
  termCount: number
  maxTermCount?: number
}

export interface MajorIndexEntry {
  uniSlug: string
  slug: string
  name: RegistryName
  degrees: MajorDegree[]
}

export function fetchUniversities() {
  return apiClient.get<{ universities: UniversityIndexEntry[] }>(
    "/app/universities"
  )
}

export function fetchMajors(uniSlug: string) {
  return apiClient.get<{ majors: MajorIndexEntry[] }>(
    `/app/majors?uni=${encodeURIComponent(uniSlug)}`
  )
}

/**
 * Year directories from the charts index. Each entry's `yearDir` ("1405" or
 * "[1403-1404]") IS the `entryYearRange` value the profile schema wants, and
 * its `semesters` (BOTH fans out to MEHR+BAHMAN server-side) say which
 * entry-semester files exist.
 */
export interface ChartYearDir {
  dirName: string
  semesters: Array<"MEHR" | "BAHMAN" | "SUMMER">
}

export function fetchChartYearDirs(
  uniSlug: string,
  majorSlug: string,
  degreeSlug: string
) {
  const qs = new URLSearchParams({
    uni: uniSlug,
    major: majorSlug,
    degree: degreeSlug,
  })
  return apiClient.get<{
    charts: Array<{
      uniSlug: string
      majorSlug: string
      degreeSlug: string
      yearDir: string
      semesters: string[]
      path: string
    }>
  }>(`/app/charts?${qs.toString()}`)
}

/* ─── Noted courses (دروس انتخابی/دنبال‌شده) ─────────────────────────────── */

export interface MeNoted {
  id: string
  universitySlug: string
  majorSlug: string
  courseIndex: string
  year: string | null
  semester: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

/** Noted courses, optionally filtered to one uni/major/term → less data over the wire. */
export function fetchNoted(params?: {
  uni?: string
  major?: string
  termCode?: string
}) {
  const qs = new URLSearchParams()
  if (params?.uni) qs.set("uni", params.uni)
  if (params?.major) qs.set("major", params.major)
  if (params?.termCode) qs.set("termCode", params.termCode)
  const query = qs.toString()
  return apiClient.get<{ noted: MeNoted[] }>(
    `/me/noted${query ? `?${query}` : ""}`
  )
}

export function addNoted(input: {
  universitySlug: string
  majorSlug: string
  courseIndex: string
  year?: string
  semester?: string
}) {
  return apiClient.post<{ noted: MeNoted }>("/me/noted", input)
}

export function removeNoted(courseIndex: string, termCode?: string) {
  const qs = termCode ? `?termCode=${encodeURIComponent(termCode)}` : ""
  return apiClient.delete<null>(
    `/me/noted/${encodeURIComponent(courseIndex)}${qs}`
  )
}

/* ─── Failed courses (دروس مردود) ───────────────────────────────────────── */

export interface MeFailed {
  id: string
  universitySlug: string
  majorSlug: string
  courseName: string
  year: string | null
  semester: string | null
  createdAt: string
}

export function fetchFailedCourses() {
  return apiClient.get<{ failed: MeFailed[] }>("/me/failed")
}

/** Bulk replace the whole failed list (mini-app sync flow). */
export function replaceFailedCourses(
  items: Array<{
    universitySlug: string
    majorSlug: string
    courseName: string
  }>
) {
  return apiClient.post<{ inserted: number }>("/me/failed", {
    items,
    replace: true,
  })
}

export function removeFailedCourse(name: string) {
  return apiClient.delete<null>(`/me/failed/${encodeURIComponent(name)}`)
}

/* ─── Passed courses (دروس گذرانده‌شده) ─────────────────────────────────── */

export interface MePassed {
  id: string
  universitySlug: string
  majorSlug: string
  courseName: string
  year: string | null
  semester: string | null
  createdAt: string
}

export function fetchPassedCourses() {
  return apiClient.get<{ passed: MePassed[] }>("/me/passed")
}

/** Bulk replace the whole passed list (mini-app sync flow). */
export function replacePassedCourses(
  items: Array<{
    universitySlug: string
    majorSlug: string
    courseName: string
  }>
) {
  return apiClient.post<{ inserted: number }>("/me/passed", {
    items,
    replace: true,
  })
}

export function removePassedCourse(name: string) {
  return apiClient.delete<null>(`/me/passed/${encodeURIComponent(name)}`)
}

/* ─── My graduation chart (app/charts/resolve) ───────────────────────────── */

export interface ChartCourse {
  name: string
  code?: string
  theoreticalUnits: number
  practicalUnits: number
  prerequisites: string[]
  corequisites: string[]
}

export interface MyChart {
  degree: string
  semester: string
  isCompleted?: boolean
  terms: Record<string, ChartCourse[]>
  moaref: ChartCourse[]
  unknown: ChartCourse[]
  electives: Record<
    string,
    { title: string; requiredUnits: number; courses: ChartCourse[] }
  >
}

/** First year of an entry-cohort directory: "[1403-1404]" -> 1403, "1405" -> 1405. */
function entryYearStart(range: string | null): number | null {
  if (!range) return null
  const single = /^(\d{4})$/.exec(range)
  if (single) return Number(single[1])
  const pair = /^\[(\d{4})-(\d{4})\]$/.exec(range)
  if (pair) return Number(pair[1])
  return null
}

/** Resolve the student's own chart by profile slugs. 404 → null (no chart yet). */
export async function fetchMyChart(
  profile: Pick<
    MeProfile,
    | "universitySlug"
    | "majorSlug"
    | "degree"
    | "entryYearRange"
    | "entrySemester"
  >
) {
  const year = entryYearStart(profile.entryYearRange)
  if (
    !profile.universitySlug ||
    !profile.majorSlug ||
    !profile.degree ||
    !profile.entrySemester ||
    year == null
  ) {
    return null
  }
  const qs = new URLSearchParams({
    uni: profile.universitySlug,
    major: profile.majorSlug,
    degree: profile.degree,
    year: String(year),
    semester: profile.entrySemester,
  })
  const res = await apiClient.get<{ chart: MyChart; resolvedYearDir: string }>(
    `/app/charts/resolve?${qs.toString()}`
  )
  return res.data.chart
}

/* ─── Offerings (ارائه‌ها) + diff for the profile course-changes widget ─── */

export interface Offering {
  index: string
  courseCode: string
  courseName: string
  courseType?: string
  theoreticalUnits: number
  practicalUnits: number
  classCode: string
  degree: string
  presentationType?: string
  minCapacity?: number
  maxCapacity?: number
  currentEnrollment?: number
  classSchedule: string | null
  examSchedule: string | null
  // Registry stores professor as a plain string; API normalizes to { fa } but
  // accept both so cached/old payloads still render.
  professor: string | { fa?: string } | null
  location: string | null
}

/** Extract readable professor name regardless of raw shape (string | {fa} | null). */
export function professorName(
  offering: Pick<Offering, "professor">
): string | null {
  const p = offering.professor as unknown
  if (!p) return null
  if (typeof p === "string") return p.trim() || null
  if (
    typeof p === "object" &&
    p !== null &&
    "fa" in (p as Record<string, unknown>)
  ) {
    const fa = (p as { fa?: string }).fa
    return fa?.trim() || null
  }
  return null
}

export interface OfferingChangedField {
  field: string
  label: string
  before: string | null
  after: string | null
}

export interface OfferingUpdated {
  after: Offering
  changes: OfferingChangedField[]
}

export interface OfferingDiffDetail {
  added: Offering[]
  removed: Offering[]
  updated: OfferingUpdated[]
}

export interface OfferingDiffSummary {
  added: number
  removed: number
  changed: number
}

export function fetchOfferings(
  uniSlug: string,
  majorSlug: string,
  termCode: string
) {
  const qs = new URLSearchParams({ uni: uniSlug, major: majorSlug, termCode })
  return apiClient.get<{ offerings: Offering[]; scrapedAt: string }>(
    `/app/offerings?${qs.toString()}`
  )
}

export function fetchOfferingsWithDiff(
  uniSlug: string,
  majorSlug: string,
  termCode: string
) {
  const qs = new URLSearchParams({
    uni: uniSlug,
    major: majorSlug,
    termCode,
    include: "diff",
  })
  return apiClient.get<{
    term: { year: number; semester: string; termCode: string; label: string }
    offerings: Offering[]
    scrapedAt: string
    changes: { summary: OfferingDiffSummary; detail: OfferingDiffDetail }
  }>(`/app/offerings?${qs.toString()}`)
}

/* ─── Professors + votes ─────────────────────────────────────────────────── */

export interface RegistryProfessor {
  slug: string
  name: string
}

export function fetchProfessors(uniSlug: string, majorSlug: string) {
  const qs = new URLSearchParams({ uni: uniSlug, major: majorSlug })
  return apiClient.get<{ professors: RegistryProfessor[] }>(
    `/app/professors?${qs.toString()}`
  )
}

export interface ProfessorVoteAggregate {
  total: number
  averages: {
    examDifficulty: number | null
    teachingQuality: number | null
    mastery: number | null
    leniency: number | null
    questionSimilarity: number | null
  }
  comments: Array<{ firstName: string; comment: string; createdAt: string }>
}

export function fetchProfessorVotes(
  uniSlug: string,
  majorSlug: string,
  professorSlug: string
) {
  return apiClient.get<ProfessorVoteAggregate>(
    `/app/professors/${encodeURIComponent(uniSlug)}/${encodeURIComponent(majorSlug)}/${encodeURIComponent(professorSlug)}/votes`
  )
}

export function fetchVote(professorSlug: string) {
  return apiClient.get<{ vote: { [k: string]: unknown } }>(
    `/me/vote/${encodeURIComponent(professorSlug)}`
  )
}

export interface VoteInput {
  universitySlug: string
  majorSlug: string
  professorSlug: string
  examDifficulty: number
  teachingQuality: number
  mastery: number
  leniency: number
  questionSimilarity: number
  providesSampleQuestions?: boolean
  providesNotes?: boolean
  mandatoryAttendance?: boolean
  comment?: string
}

export function saveVote(input: VoteInput) {
  return apiClient.put<{ vote: { [k: string]: unknown } }>("/me/vote", input)
}

/* ─── Course students (همکلاسی‌ها) ──────────────────────────────── */

export interface CourseStudent {
  firstName: string
  lastName: string | null
  photoUrl: string | null
}

export function fetchCourseStudents(params?: {
  courseIndex?: string
  page?: number
  limit?: number
}) {
  const qs = new URLSearchParams()
  if (params?.courseIndex) qs.set("courseIndex", params.courseIndex)
  if (params?.page) qs.set("page", String(params.page))
  if (params?.limit) qs.set("limit", String(params.limit))
  const q = qs.toString()
  return apiClient.get<{
    students: CourseStudent[]
    page: number
    limit: number
    hasMore: boolean
  }>(`/me/students${q ? `?${q}` : ""}`)
}

export function toggleVisibility() {
  return apiClient.post<{ visible: boolean; lastUpdated: string | null }>(
    "/me/visibility/toggle"
  )
}

export function deleteVote(professorSlug: string) {
  return apiClient.delete<null>(`/me/vote/${encodeURIComponent(professorSlug)}`)
}

export function fetchChartFile(semester?: string) {
  const qs = semester ? `?semester=${encodeURIComponent(semester)}` : ""
  return apiClient.get<{ sent: boolean; cached: boolean }>(
    `/me/chart-file${qs}`
  )
}

/* ─── Friends (دوستان) ─────────────────────────────────────────────── */

export interface FriendCard {
  id: number
  firstName: string
  lastName: string | null
  photoUrl: string | null
  username: string | null
}

export interface FriendItem extends FriendCard {
  friendsSince: string
  profile: string | null
}

export interface FriendRequestItem {
  id: string
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED"
  createdAt: string
  direction: "incoming" | "outgoing"
  user: FriendCard
}

export interface BlockedItem {
  user: FriendCard
  blockedAt: string
}

export interface FriendsSummary {
  friendsCount: number
  incomingPendingCount: number
  outgoingPendingCount: number
  autoDecline: boolean
}

export function fetchFriendsSummary() {
  return apiClient.get<FriendsSummary>("/me/friends/summary")
}

export function fetchFriends(params?: { page?: number; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set("page", String(params.page))
  if (params?.limit) qs.set("limit", String(params.limit))
  const q = qs.toString()
  return apiClient.get<{
    friends: FriendItem[]
    page: number
    limit: number
    hasMore: boolean
  }>(`/me/friends${q ? `?${q}` : ""}`)
}

export function fetchFriendRequests(params?: {
  direction?: "incoming" | "outgoing"
  page?: number
  limit?: number
}) {
  const qs = new URLSearchParams()
  if (params?.direction) qs.set("direction", params.direction)
  if (params?.page) qs.set("page", String(params.page))
  if (params?.limit) qs.set("limit", String(params.limit))
  const q = qs.toString()
  return apiClient.get<{
    requests: FriendRequestItem[]
    page: number
    limit: number
    hasMore: boolean
  }>(`/me/friends/requests${q ? `?${q}` : ""}`)
}

export interface SendRequestResult {
  request?: {
    id: string
    status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELED"
    createdAt: string
    direction: "outgoing"
    user: FriendCard
  }
  befriended?: boolean
}

export function sendFriendRequest(friendId: number) {
  return apiClient.post<SendRequestResult>("/me/friends/requests", {
    friendId,
  })
}

export function acceptFriendRequest(id: string) {
  return apiClient.post<{ befriended: boolean }>(`/me/friends/requests/${id}/accept`)
}

export function declineFriendRequest(id: string) {
  return apiClient.post<null>(`/me/friends/requests/${id}/decline`)
}

export function cancelFriendRequest(id: string) {
  return apiClient.post<null>(`/me/friends/requests/${id}/cancel`)
}

export function unfriend(friendId: number) {
  return apiClient.delete<null>(`/me/friends/${friendId}`)
}

export function blockFriend(friendId: number) {
  return apiClient.post<null>("/me/friends/blocks", { friendId })
}

export function fetchBlocks(params?: { page?: number; limit?: number }) {
  const qs = new URLSearchParams()
  if (params?.page) qs.set("page", String(params.page))
  if (params?.limit) qs.set("limit", String(params.limit))
  const q = qs.toString()
  return apiClient.get<{
    blocked: BlockedItem[]
    page: number
    limit: number
    hasMore: boolean
  }>(`/me/friends/blocks${q ? `?${q}` : ""}`)
}

export function unblockFriend(friendId: number) {
  return apiClient.delete<null>(`/me/friends/blocks/${friendId}`)
}

export function fetchFriendSettings() {
  return apiClient.get<{ autoDecline: boolean }>("/me/friends/settings")
}

export interface FriendDetailData {
  user: FriendCard
  profile: {
    universitySlug: string | null
    majorSlug: string | null
    degree: string | null
    entryYearRange: string | null
    entrySemester: "MEHR" | "BAHMAN" | "SUMMER" | null
    currentSemesterCode: string | null
  } | null
  noted: { courseIndex: string; year: string | null; semester: string | null }[]
  passed: string[]
  failed: string[]
  chart: {
    terms: Record<
      string,
      { name: string; code?: string; theoreticalUnits?: number; practicalUnits?: number }[]
    >
    moaref: { name: string; code?: string; theoreticalUnits?: number; practicalUnits?: number }[]
    unknown: { name: string; code?: string; theoreticalUnits?: number; practicalUnits?: number }[]
  } | null
}

export function fetchFriendDetail(friendId: number) {
  return apiClient.get<FriendDetailData>(`/me/friends/${friendId}/detail`)
}

export function patchFriendSettings(autoDecline: boolean) {
  return apiClient.patch<{ autoDecline: boolean }>("/me/friends/settings", {
    autoDecline,
  })
}

/* ─── Feedback (mini app → admin review queue) ─── */

export type FeedbackKind = "BUG" | "SUGGESTION" | "THANKS" | "SOURCE"

export function submitFeedback(input: { kind: FeedbackKind; message: string }) {
  return apiClient.post<{ feedback: unknown }>("/me/feedback", input)
}
