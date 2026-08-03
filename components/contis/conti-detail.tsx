"use client"

import { useState, useTransition, useOptimistic } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, PlayListIcon } from "@hugeicons/core-free-icons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useOptionalDrawerState } from "@/components/ui/drawer-context"
import { ContiSongSummaryTable } from "@/components/contis/conti-song-summary-table"
import { ContiSongEditor } from "./conti-song-editor"
import { ContiMashupEditor } from "./conti-mashup-editor"
import { SongPicker } from "@/components/contis/song-picker"
import { YouTubeImportDialog } from "@/components/contis/youtube-import-dialog"
import { sanitizeContiDescription } from "@/lib/conti-description"
import {
  removeSongFromConti,
  reorderContiSongs,
} from "@/lib/actions/conti-songs"
import type { ContiWithSongs, Song, ContiSongWithSong } from "@/lib/types"

interface ContiDetailProps {
  conti: ContiWithSongs
  allSongs: Song[]
  variant?: "detail" | "edit"
  showDescription?: boolean
}

export function ContiDetail({
  conti,
  allSongs,
  variant = "detail",
  showDescription,
}: ContiDetailProps) {
  const router = useRouter()
  const { isOpen: drawerOpen } = useOptionalDrawerState()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [youtubeImportOpen, setYoutubeImportOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [optimisticSongs, setOptimisticSongs] = useOptimistic<ContiSongWithSong[]>(conti.songs)

  const existingSongIds = optimisticSongs.map((cs) => cs.songId)
  const description = sanitizeContiDescription(conti.description)
  const shouldShowDescription = showDescription ?? variant === "detail"

  function handleMoveUp(index: number) {
    if (index === 0) return
    const reordered = [...optimisticSongs]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
    const reorderedWithSortOrder = reordered.map((song, sortOrder) => ({
      ...song,
      sortOrder,
    }))

    startTransition(async () => {
      setOptimisticSongs(reorderedWithSortOrder)
      const orderedIds = reorderedWithSortOrder.map((s) => s.id)
      const result = await reorderContiSongs(conti.id, orderedIds)
      if (!result.success) {
        toast.error(result.error ?? "순서 변경 중 오류가 발생했습니다")
      }
      router.refresh()
    })
  }

  function handleMoveDown(index: number) {
    if (index === optimisticSongs.length - 1) return
    const reordered = [...optimisticSongs]
    ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
    const reorderedWithSortOrder = reordered.map((song, sortOrder) => ({
      ...song,
      sortOrder,
    }))

    startTransition(async () => {
      setOptimisticSongs(reorderedWithSortOrder)
      const orderedIds = reorderedWithSortOrder.map((s) => s.id)
      const result = await reorderContiSongs(conti.id, orderedIds)
      if (!result.success) {
        toast.error(result.error ?? "순서 변경 중 오류가 발생했습니다")
      }
      router.refresh()
    })
  }

  function handleRemove(contiSongId: string) {
    const filtered = optimisticSongs.filter((s) => s.id !== contiSongId)

    startTransition(async () => {
      setOptimisticSongs(filtered)
      const result = await removeSongFromConti(contiSongId)
      if (result.success) {
        toast.success("곡이 제거되었습니다")
      } else {
        toast.error(result.error ?? "곡 제거 중 오류가 발생했습니다")
      }
      router.refresh()
    })
  }

  function handleEdit(contiSongId: string) {
    setEditingId(prev => prev === contiSongId ? null : contiSongId)
  }

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4">
        {variant === "edit" && (
          <h2 className="text-xl font-semibold">곡별 준비</h2>
        )}

        {shouldShowDescription && description && (
          <p className="text-muted-foreground text-base">{description}</p>
        )}

        {optimisticSongs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-background/60 px-6 py-12 text-center">
            <p className="text-muted-foreground text-base">
              이 콘티에 곡이 없습니다. 곡을 추가해주세요.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <ContiSongSummaryTable
              songs={optimisticSongs}
              mode="action"
              contiId={conti.id}
              density={drawerOpen ? "compact" : "default"}
              onEdit={handleEdit}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onRemove={setRemovingId}
            />
            {optimisticSongs.map((contiSong) => {
              if (editingId !== contiSong.id) return null

              if (contiSong.mashupGroupId) {
                const group = optimisticSongs
                  .filter((s) => s.mashupGroupId === contiSong.mashupGroupId)
                  .sort((a, b) => (a.mashupPartOrder ?? 0) - (b.mashupPartOrder ?? 0))

                if (group.length === 2) {
                  return (
                    <ContiMashupEditor
                      key={contiSong.id}
                      contiId={conti.id}
                      group={group}
                      open={true}
                      onOpenChange={(open) => {
                        if (!open) setEditingId(null)
                      }}
                    />
                  )
                }
              }

              return (
                <ContiSongEditor
                  key={contiSong.id}
                  contiSong={contiSong}
                  open={true}
                  onOpenChange={(open) => {
                    if (!open) setEditingId(null)
                  }}
                />
              )
            })}
          </div>
        )}

        <AlertDialog
          open={removingId !== null}
          onOpenChange={(open) => {
            if (!open) setRemovingId(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>곡 제거</AlertDialogTitle>
              <AlertDialogDescription>
                이 곡을 콘티에서 제거하시겠습니까?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setRemovingId(null)}>
                취소
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (removingId) {
                    handleRemove(removingId)
                    setRemovingId(null)
                  }
                }}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <Button
            variant="outline"
            onClick={() => setPickerOpen(true)}
            disabled={isPending}
          >
            <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
            곡 추가
          </Button>
          <Button
            variant="outline"
            onClick={() => setYoutubeImportOpen(true)}
            disabled={isPending}
          >
            <HugeiconsIcon icon={PlayListIcon} strokeWidth={2} data-icon="inline-start" />
            YouTube에서 가져오기
          </Button>
        </div>

        <SongPicker
          contiId={conti.id}
          existingSongIds={existingSongIds}
          songs={allSongs}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        />

        <YouTubeImportDialog
          contiId={conti.id}
          contiTitle={conti.title}
          contiDate={conti.date}
          existingSongIds={existingSongIds}
          allSongs={allSongs}
          open={youtubeImportOpen}
          onOpenChange={setYoutubeImportOpen}
        />
      </div>
    </section>
  )
}
