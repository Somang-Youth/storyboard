"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { Delete01Icon } from "@hugeicons/core-free-icons"
import { deleteConti } from "@/lib/actions/contis"

export function ContiDeleteButton({ contiId, iconOnly }: { contiId: string; iconOnly?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteConti(contiId)
      if (result.success) {
        toast.success("콘티가 삭제되었습니다")
        router.push("/contis")
      } else {
        toast.error(result.error ?? "삭제 중 오류가 발생했습니다")
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="destructive" size={iconOnly ? "icon" : undefined} disabled={isPending} />
        }
      >
        <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} data-icon={iconOnly ? undefined : "inline-start"} />
        {!iconOnly && "삭제"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>콘티 삭제</AlertDialogTitle>
          <AlertDialogDescription>
            이 콘티를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete}>
            삭제
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
