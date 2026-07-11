"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import { SearchIcon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { createMashupPreset, findMashupPresetBySongs } from "@/lib/actions/song-presets"
import type { ResolvedSongPresetWithSheetMusic, Song } from "@/lib/types"
import { buildBlankMashupPresetData } from "@/lib/utils/mashup-presets"
import { cn } from "@/lib/utils"

interface MashupPresetDialogProps {
  currentSongId: string
  currentSongName: string
  allSongs: Song[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onPresetReady: (preset: ResolvedSongPresetWithSheetMusic) => void
}

type CurrentSongPosition = "first" | "second"

export function MashupPresetDialog({
  currentSongId,
  currentSongName,
  allSongs,
  open,
  onOpenChange,
  onPresetReady,
}: MashupPresetDialogProps) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [selectedSongId, setSelectedSongId] = useState("")
  const [position, setPosition] = useState<CurrentSongPosition>("first")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const candidateSongs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return allSongs
      .filter((song) => song.id !== currentSongId)
      .filter((song) => !normalizedQuery || song.name.toLocaleLowerCase().includes(normalizedQuery))
      .sort((left, right) => left.name.localeCompare(right.name, "ko"))
      .slice(0, 20)
  }, [allSongs, currentSongId, query])

  const selectedSong = useMemo(
    () => allSongs.find((song) => song.id === selectedSongId),
    [allSongs, selectedSongId],
  )

  function reset() {
    setQuery("")
    setSelectedSongId("")
    setPosition("first")
    setIsSubmitting(false)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      reset()
    }
    onOpenChange(nextOpen)
  }

  async function handleSubmit() {
    if (!selectedSong) {
      toast.error("연결할 곡을 선택해주세요")
      return
    }

    const orderedSongs =
      position === "first"
        ? [
            { id: currentSongId, name: currentSongName },
            { id: selectedSong.id, name: selectedSong.name },
          ]
        : [
            { id: selectedSong.id, name: selectedSong.name },
            { id: currentSongId, name: currentSongName },
          ]

    setIsSubmitting(true)
    try {
      const existingResult = await findMashupPresetBySongs(orderedSongs[0].id, orderedSongs[1].id)
      if (!existingResult.success) {
        toast.error(existingResult.error)
        return
      }

      if (existingResult.data) {
        toast.info("이미 같은 순서의 매시업 프리셋이 있습니다")
        onPresetReady(existingResult.data)
        handleOpenChange(false)
        return
      }

      const createResult = await createMashupPreset(
        [orderedSongs[0].id, orderedSongs[1].id],
        buildBlankMashupPresetData([orderedSongs[0].name, orderedSongs[1].name]),
      )
      if (!createResult.success || !createResult.data) {
        toast.error(createResult.error ?? "매시업 프리셋을 만들 수 없습니다")
        return
      }

      toast.success("매시업 프리셋이 추가되었습니다")
      router.refresh()
      onPresetReady(createResult.data)
      handleOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>매시업 프리셋 추가</DialogTitle>
          <DialogDescription>
            함께 사용할 곡과 순서를 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="mashup-song-search" className="text-sm font-medium">
              연결할 곡
            </label>
            <div className="relative">
              <HugeiconsIcon
                icon={SearchIcon}
                strokeWidth={2}
                className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              />
              <Input
                id="mashup-song-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="곡 이름 검색"
                className="pl-9"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
              {candidateSongs.length > 0 ? (
                candidateSongs.map((song) => (
                  <button
                    key={song.id}
                    type="button"
                    className={cn(
                      "hover:bg-muted flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm transition-colors",
                      selectedSongId === song.id && "bg-muted",
                    )}
                    onClick={() => setSelectedSongId(song.id)}
                  >
                    <span className="truncate font-medium">{song.name}</span>
                    {selectedSongId === song.id && (
                      <span className="text-muted-foreground shrink-0 text-xs">선택됨</span>
                    )}
                  </button>
                ))
              ) : (
                <p className="text-muted-foreground px-3 py-6 text-center text-sm">
                  검색 결과가 없습니다
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">현재 곡 위치</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={position === "first" ? "default" : "outline"}
                onClick={() => setPosition("first")}
              >
                현재 곡이 앞
              </Button>
              <Button
                type="button"
                variant={position === "second" ? "default" : "outline"}
                onClick={() => setPosition("second")}
              >
                현재 곡이 뒤
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            취소
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting || !selectedSong}>
            {isSubmitting ? "확인 중..." : "추가"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
