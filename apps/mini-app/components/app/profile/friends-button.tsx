"use client"

import { useRouter } from "next/navigation"

import { ToolButton } from "./tool-card"
import { FriendsIcon } from "./tool-icons"

/** «دوستای من» tool button — navigates to the friends page. */
export function FriendsButton() {
  const router = useRouter()
  return (
    <ToolButton
      title="دوستای من"
      icon={FriendsIcon}
      onClick={() => router.push("/profile/friends")}
    />
  )
}
