"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { GitMergeIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { applyMashupToContiSongs } from "@/lib/actions/conti-songs"
import { createMashupPreset, findMashupPresetBySongs } from "@/lib/actions/song-presets"
import type { ContiSongWithSong, ResolvedSongPresetWithSheetMusic } from "@/lib/types"
import { buildBlankMashupPresetData } from "@/lib/utils/mashup-presets"

interface MashupConnectDialogProps {
  contiId: string
  firstSong: ContiSongWithSong
  secondSong: ContiSongWithSong
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PresetCheckState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "found"; preset: ResolvedSongPresetWithSheetMusic }
  | { status: "empty" }

export function MashupConnectDialog({
  contiId,
  firstSong,
  secondSong,
  open,
  onOpenChange,
}: MashupConnectDialogProps) {
  const router = useRouter()
  const [presetState, setPresetState] = useState<PresetCheckState>({ status: "idle" })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setPresetState({ status: "loading" })

    async function checkPreset() {
      const result = await findMashupPresetBySongs(firstSong.songId, secondSong.songId)
      if (cancelled) return

      if (!result.success) {
        setPresetState({
          status: "error",
          message: result.error ?? "매시업 프리셋을 확인할 수 없습니다",
        })
        return
      }

      setPresetState(result.data ? { status: "found", preset: result.data } : { status: "empty" })
    }

    void checkPreset()

    return () => {
      cancelled = true
    }
  }, [firstSong.songId, secondSong.songId, open])

  async function applyPreset(presetId: string) {
    const result = await applyMashupToContiSongs({
      contiId,
      firstContiSongId: firstSong.id,
      secondContiSongId: secondSong.id,
      presetId,
    })

    if (!result.success) {
      toast.error(result.error ?? "매시업 연결 중 오류가 발생했습니다")
      return false
    }

    toast.success("매시업으로 연결했습니다")
    onOpenChange(false)
    router.refresh()
    return true
  }

  async function handleApplyExisting() {
    if (presetState.status !== "found") return

    setIsSubmitting(true)
    try {
      await applyPreset(presetState.preset.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCreateAndApply() {
    setIsSubmitting(true)
    try {
      const createResult = await createMashupPreset(
        [firstSong.songId, secondSong.songId],
        buildBlankMashupPresetData([firstSong.song.name, secondSong.song.name]),
      )

      if (!createResult.success || !createResult.data) {
        toast.error(createResult.error ?? "매시업 프리셋을 만들 수 없습니다")
        return
      }

      await applyPreset(createResult.data.id)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = presetState.status === "found" || presetState.status === "empty"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>매시업 연결</DialogTitle>
          <DialogDescription>
            인접한 두 곡을 하나의 매시업 순서로 묶습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="min-w-0 flex-1 truncate">{firstSong.song.name}</span>
              <HugeiconsIcon icon={GitMergeIcon} strokeWidth={2} className="size-4 text-primary" />
              <span className="min-w-0 flex-1 truncate text-right">{secondSong.song.name}</span>
            </div>
          </div>

          {presetState.status === "loading" && (
            <p className="text-sm text-muted-foreground">매시업 프리셋 확인 중...</p>
          )}

          {presetState.status === "error" && (
            <p className="text-sm text-destructive">{presetState.message}</p>
          )}

          {presetState.status === "found" && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">기존 프리셋</Badge>
                <p className="min-w-0 truncate text-sm font-medium">{presetState.preset.name}</p>
              </div>
              <p className="text-sm text-muted-foreground">
                같은 순서의 매시업 프리셋을 적용합니다.
              </p>
            </div>
          )}

          {presetState.status === "empty" && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">새 프리셋</Badge>
                <p className="min-w-0 truncate text-sm font-medium">
                  {firstSong.song.name} + {secondSong.song.name}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                빈 매시업 프리셋을 만든 뒤 바로 적용합니다.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            onClick={presetState.status === "found" ? handleApplyExisting : handleCreateAndApply}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting
              ? "연결 중..."
              : presetState.status === "found"
                ? "적용"
                : "만들고 연결"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
