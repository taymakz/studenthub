"use client"

import { Button } from "@workspace/ui/components/button"
import {
  Drawer,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPanel,
  DrawerPopup,
  DrawerTitle,
} from "@workspace/ui/components/drawer"

import { ProfessorFields, type ProfessorFieldsHandle } from "./professor-fields"
import type { RefObject } from "react"

export function VoteDrawer({
  open,
  onOpenChange,
  professorName,
  slug,
  uni,
  major,
  fieldsRef,
  onSuccess,
  onLoadingChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  professorName: string
  slug: string | null
  uni: string
  major: string
  fieldsRef: RefObject<ProfessorFieldsHandle | null>
  onSuccess: () => void
  onLoadingChange: (v: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle className="text-base">رأی دادن به {professorName}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          {slug ? (
            <ProfessorFields
              ref={fieldsRef}
              professorSlug={slug}
              universitySlug={uni}
              majorSlug={major}
              initialVote={null}
              mode="create"
              onSuccess={onSuccess}
              onLoadingChange={onLoadingChange}
            />
          ) : null}
        </DrawerPanel>
        <DrawerFooter>
          <VoteSubmitButton fieldsRef={fieldsRef} />
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  )
}

export function EditDrawer({
  open,
  onOpenChange,
  professorName,
  slug,
  uni,
  major,
  own,
  fieldsRef,
  onSuccess,
  onLoadingChange,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  professorName: string
  slug: string | null
  uni: string
  major: string
  own: Record<string, unknown> | null
  fieldsRef: RefObject<ProfessorFieldsHandle | null>
  onSuccess: () => void
  onLoadingChange: (v: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle className="text-base">ویرایش رأی {professorName}</DrawerTitle>
        </DrawerHeader>
        <DrawerPanel className="p-4">
          {slug && own ? (
            <ProfessorFields
              ref={fieldsRef}
              professorSlug={slug}
              universitySlug={uni}
              majorSlug={major}
              initialVote={own}
              mode="update"
              onSuccess={onSuccess}
              onLoadingChange={onLoadingChange}
            />
          ) : null}
        </DrawerPanel>
        <DrawerFooter>
          <VoteSubmitButton fieldsRef={fieldsRef} />
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  )
}

function VoteSubmitButton({
  fieldsRef,
}: {
  fieldsRef: RefObject<ProfessorFieldsHandle | null>
}) {
  // isSubmitting is tracked via onLoadingChange in parent, but we keep simple
  return (
    <Button className="w-full" onClick={() => fieldsRef.current?.submit()}>
      ثبت رای
    </Button>
  )
}

export function DeleteDrawer({
  open,
  onOpenChange,
  professorName,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  professorName: string
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPopup variant="inset" showBar>
        <DrawerHeader>
          <DrawerTitle>حذف رأی</DrawerTitle>
          <DrawerDescription>
            آیا از حذف رأی خود برای استاد {professorName} اطمینان دارید؟ این عملیات قابل بازگشت نیست.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex gap-2 p-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isDeleting}
          >
            انصراف
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "در حال حذف..." : "حذف رأی"}
          </Button>
        </div>
      </DrawerPopup>
    </Drawer>
  )
}
