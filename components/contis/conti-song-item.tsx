"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Delete01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons"
import type { ContiSongWithSong } from "@/lib/types"

interface ContiSongItemProps {
  contiSong: ContiSongWithSong
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onEdit: () => void
}

export function ContiSongItem({
  contiSong,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onRemove,
  onEdit,
}: ContiSongItemProps) {
  const { song, overrides } = contiSong

  const sectionSummary =
    overrides.sectionOrder.length > 0
      ? overrides.sectionOrder.join(" → ")
      : null

  return (
    <div className="ring-foreground/10 bg-card flex items-center gap-4 rounded-xl p-4 ring-1 cursor-pointer hover:bg-muted/50 transition-colors" onClick={onEdit}>
      <div className="text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-sm font-medium">
        {index + 1}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-3">
          <span className="truncate text-base font-medium">{song.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overrides.keys.length > 0 &&
            overrides.keys.map((key) => (
              <Badge key={key} variant="secondary">
                {key}
              </Badge>
            ))}
          {overrides.tempos.length > 0 &&
            overrides.tempos.map((tempo, i) => (
              <Badge key={i} variant="outline">
                {tempo} BPM
              </Badge>
            ))}
          {sectionSummary && (
            <span className="text-muted-foreground text-sm">
              {sectionSummary}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="편집"
        >
          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMoveUp}
          disabled={index === 0}
          aria-label="위로 이동"
        >
          <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onMoveDown}
          disabled={index === total - 1}
          aria-label="아래로 이동"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label="삭제" />
            }
          >
            <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>곡 제거</AlertDialogTitle>
              <AlertDialogDescription>
                이 곡을 콘티에서 제거하시겠습니까?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={onRemove}>
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
