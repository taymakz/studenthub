"use client"

import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"
import { toastManager } from "@workspace/ui/components/toast"

import { deleteVote, type Offering } from "@/lib/api"
import {
  useOwnVote,
  useProfessorCourses,
  useProfessorSlug,
  useProfessorVotes,
} from "./professor/use-professor-drawer"
import {
  ProfessorLoading,
  ProfessorMainContent,
} from "./professor/professor-main-panel"
import {
  DeleteDrawer,
  EditDrawer,
  VoteDrawer,
} from "./professor/professor-drawers"
import type { ProfessorFieldsHandle } from "./professor/professor-fields"

export type { ProfessorFieldsHandle }

export function ProfessorDrawer({
  open,
  onOpenChange,
  professorName,
  uni,
  major,
  currentCourseIndex,
  onCourseSelected,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  professorName: string
  uni: string
  major: string
  currentCourseIndex?: string | null
  onCourseSelected?: (offering: Offering) => void
}) {
  const qc = useQueryClient()
  const [voteOpen, setVoteOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const voteFieldsRef = useRef<ProfessorFieldsHandle>(null)
  const editFieldsRef = useRef<ProfessorFieldsHandle>(null)

  const { slugQuery, slug } = useProfessorSlug(uni, major, professorName, open)
  const votesQuery = useProfessorVotes(uni, major, slug, open)
  const ownQuery = useOwnVote(slug, open)
  const own = ownQuery.data as Record<string, unknown> | null
  const hasVoted = !!own
  const otherCourses = useProfessorCourses(professorName, currentCourseIndex)

  const total = votesQuery.data?.total ?? 0
  const averages = votesQuery.data?.averages ?? null
  const isInitialLoading =
    slugQuery.isLoading || (!!slug && (votesQuery.isLoading || ownQuery.isLoading))

  const handleDelete = async () => {
    if (!slug) return
    try {
      setIsDeleting(true)
      await deleteVote(slug)
      toastManager.add({
        type: "success",
        title: "رأی شما با موفقیت حذف شد",
        data: { variant: "x" },
      })
      ownQuery.refetch()
      votesQuery.refetch()
      qc.invalidateQueries({ queryKey: ["professor-votes", uni, major, slug] })
      setDeleteOpen(false)
    } catch {
      toastManager.add({
        type: "error",
        title: "خطا در حذف رأی",
        data: { variant: "x" },
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleVoteSuccess = () => {
    setVoteOpen(false)
    ownQuery.refetch()
    votesQuery.refetch()
    if (slug) qc.invalidateQueries({ queryKey: ["my-vote", slug] })
  }

  const handleEditSuccess = () => {
    setEditOpen(false)
    ownQuery.refetch()
    votesQuery.refetch()
    if (slug) qc.invalidateQueries({ queryKey: ["my-vote", slug] })
  }

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup variant="inset" showBar>
          <DrawerHeader>
            <DrawerTitle>{professorName}</DrawerTitle>
            <DrawerDescription>
              {isInitialLoading ? "در حال بارگذاری…" : `${total} نظر`}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerPanel className="space-y-4 p-4">
            {isInitialLoading ? (
              <ProfessorLoading />
            ) : (
              <ProfessorMainContent
                uni={uni}
                major={major}
                professorName={professorName}
                total={total}
                averages={averages}
                hasVoted={hasVoted}
                otherCourses={otherCourses}
                onVote={() => setVoteOpen(true)}
                onEdit={() => setEditOpen(true)}
                onDelete={() => setDeleteOpen(true)}
                onOpenChange={onOpenChange}
                onCourseSelected={onCourseSelected}
              />
            )}
          </DrawerPanel>
        </DrawerPopup>
      </Drawer>

      <VoteDrawer
        open={voteOpen}
        onOpenChange={setVoteOpen}
        professorName={professorName}
        slug={slug}
        uni={uni}
        major={major}
        fieldsRef={voteFieldsRef}
        onSuccess={handleVoteSuccess}
        onLoadingChange={() => {}}
      />

      <EditDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        professorName={professorName}
        slug={slug}
        uni={uni}
        major={major}
        own={own}
        fieldsRef={editFieldsRef}
        onSuccess={handleEditSuccess}
        onLoadingChange={() => {}}
      />

      <DeleteDrawer
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        professorName={professorName}
        isDeleting={isDeleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </>
  )
}
