import ContentLayout from "@/components/app/content-layout"
import { ProfileHeader } from "@/components/app/profile/profile-header"
import { GraduateProgress } from "@/components/app/profile/graduate-progress"
import { FailedCourses } from "@/components/app/profile/failed-courses"
import { CourseChanges } from "@/components/app/profile/course-changes"
import { NewTermToast } from "@/components/app/profile/new-term-toast"
import { SemesterDrawer } from "@/components/app/semester-drawer"

/**
 * Profile tab = the old "home" page minus the YouTube course banner. Header +
 * graduate progress, failed courses and offering changes. Each widget shows its
 * own same-height skeleton while its data loads (no layout jump); loading is
 * handled by React Query, which caches across the session.
 */
export default function Page() {
  return (
    <>
      <ProfileHeader />
      <NewTermToast />
      <SemesterDrawer />
      <ContentLayout>
        <div className="container mx-auto mt-4 space-y-6 px-4">
          <GraduateProgress />
          <FailedCourses />
          <CourseChanges />
        </div>
      </ContentLayout>
    </>
  )
}
