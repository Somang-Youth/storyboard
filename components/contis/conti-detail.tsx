"use client"

import { useState, useTransition, useOptimistic } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { ContiSongItem } from "@/components/contis/conti-song-item"
import { ContiSongEditor } from "./conti-song-editor"
import { SongPicker } from "@/components/contis/song-picker"
import {
  removeSongFromConti,
  reorderContiSongs,
} from "@/lib/actions/conti-songs"
import type { ContiWithSongs, Song, ContiSongWithSong } from "@/lib/types"

interface ContiDetailProps {
  conti: ContiWithSongs
  allSongs: Song[]
}

export function ContiDetail({ conti, allSongs }: ContiDetailProps) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [optimisticSongs, setOptimisticSongs] = useOptimistic<ContiSongWithSong[]>(conti.songs)

  const existingSongIds = optimisticSongs.map((cs) => cs.songId)

  function handleMoveUp(index: number) {
    if (index === 0) return
    const reordered = [...optimisticSongs]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]

    startTransition(async () => {
      setOptimisticSongs(reordered)
      const orderedIds = reordered.map((s) => s.id)
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

    startTransition(async () => {
      setOptimisticSongs(reordered)
      const orderedIds = reordered.map((s) => s.id)
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
    <div className="flex flex-col gap-4">
      {conti.description && (
        <p className="text-muted-foreground text-sm">{conti.description}</p>
      )}

      {optimisticSongs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 text-center">
          <p className="text-muted-foreground text-sm">
            이 콘티에 곡이 없습니다. 곡을 추가해주세요.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {optimisticSongs.map((contiSong, index) => (
            <>
              <ContiSongItem
                key={contiSong.id}
                contiSong={contiSong}
                index={index}
                total={optimisticSongs.length}
                onMoveUp={() => handleMoveUp(index)}
                onMoveDown={() => handleMoveDown(index)}
                onRemove={() => handleRemove(contiSong.id)}
                onEdit={() => handleEdit(contiSong.id)}
              />
              {editingId === contiSong.id && (
                <ContiSongEditor
                  contiSong={contiSong}
                  open={true}
                  onOpenChange={(open) => { if (!open) setEditingId(null) }}
                />
              )}
            </>
          ))}
        </div>
      )}

      <Button
        variant="outline"
        onClick={() => setPickerOpen(true)}
        disabled={isPending}
        className="self-start"
      >
        <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
        곡 추가
      </Button>

      <SongPicker
        contiId={conti.id}
        existingSongIds={existingSongIds}
        songs={allSongs}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  )
}
