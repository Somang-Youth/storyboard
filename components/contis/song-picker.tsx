"use client"

import { useState, useMemo, useTransition } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { addSongToConti } from "@/lib/actions/conti-songs"
import type { Song } from "@/lib/types"

interface SongPickerProps {
  contiId: string
  existingSongIds: string[]
  songs: Song[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SongPicker({
  contiId,
  existingSongIds,
  songs,
  open,
  onOpenChange,
}: SongPickerProps) {
  const [search, setSearch] = useState("")
  const [isPending, startTransition] = useTransition()

  const availableSongs = useMemo(() => {
    const existingSet = new Set(existingSongIds)
    return songs.filter((song) => !existingSet.has(song.id))
  }, [songs, existingSongIds])

  const filteredSongs = useMemo(() => {
    if (!search.trim()) return availableSongs
    const query = search.toLowerCase()
    return availableSongs.filter((song) =>
      song.name.toLowerCase().includes(query)
    )
  }, [availableSongs, search])

  function handleSelect(songId: string) {
    startTransition(async () => {
      const result = await addSongToConti(contiId, songId)
      if (result.success) {
        toast.success("곡이 추가되었습니다")
        onOpenChange(false)
        setSearch("")
      } else {
        toast.error(result.error ?? "곡 추가 중 오류가 발생했습니다")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>곡 추가</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="곡 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-64 overflow-y-auto">
          {availableSongs.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              이미 모든 곡이 추가되었습니다
            </p>
          ) : filteredSongs.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              검색 결과가 없습니다
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredSongs.map((song) => (
                <button
                  key={song.id}
                  type="button"
                  className="hover:bg-muted flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
                  onClick={() => handleSelect(song.id)}
                  disabled={isPending}
                >
                  <span className="truncate font-medium">{song.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
