import {
  UniversityAzadMono,
  UniversityPayamnoorMono,
  UniversityTehranMono,
} from "@persianlabs/icons/react"

import type { UniversityType } from "@/lib/api"

/**
 * Institution-type logo map - the mono marks from @persianlabs/icons shown
 * on university cards in the setup wizard. `gov` currently uses the Tehran
 * University mark as the دولتی placeholder.
 */
const TYPE_ICONS: Record<
  UniversityType,
  React.ComponentType<{ className?: string }>
> = {
  azad: UniversityAzadMono,
  gov: UniversityTehranMono,
  pnu: UniversityPayamnoorMono,
}

export function UniversityTypeIcon({
  type,
  className,
}: {
  type: UniversityType
  className?: string
}) {
  const Icon = TYPE_ICONS[type] ?? UniversityAzadMono
  return <Icon className={className} aria-hidden />
}
