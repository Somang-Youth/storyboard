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
import { createSong } from "@/lib/actions/songs"
import { getPresetsForSong } from "@/lib/actions/song-presets"
import type { Song, SongPreset, ContiSongOverrides } from "@/lib/types"

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
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [presets, setPresets] = useState<SongPreset[]>([])
  const [showPresetStep, setShowPresetStep] = useState(false)

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
        resetState()
      } else {
        toast.error(result.error ?? "곡 추가 중 오류가 발생했습니다")
      }
    })
  }

  function handleSongClick(song: Song) {
    startTransition(async () => {
      const result = await getPresetsForSong(song.id)
      if (result.success && result.data && result.data.length > 0) {
        // Check for default preset
        const defaultPreset = result.data.find(p => p.isDefault)
        if (defaultPreset) {
          // Auto-apply default preset
          const overrides: Partial<ContiSongOverrides> = {
            keys: defaultPreset.keys ? JSON.parse(defaultPreset.keys) : [],
            tempos: defaultPreset.tempos ? JSON.parse(defaultPreset.tempos) : [],
            sectionOrder: defaultPreset.sectionOrder ? JSON.parse(defaultPreset.sectionOrder) : [],
            lyrics: defaultPreset.lyrics ? JSON.parse(defaultPreset.lyrics) : [],
            sectionLyricsMap: defaultPreset.sectionLyricsMap ? JSON.parse(defaultPreset.sectionLyricsMap) : {},
            notes: defaultPreset.notes,
          }
          const addResult = await addSongToConti(contiId, song.id, overrides)
          if (addResult.success) {
            toast.success(`"${defaultPreset.name}" 프리셋이 적용되었습니다`)
            onOpenChange(false)
            resetState()
          } else {
            toast.error(addResult.error ?? "곡 추가 중 오류가 발생했습니다")
          }
        } else {
          // No default -- show preset picker (existing behavior)
          setSelectedSong(song)
          setPresets(result.data)
          setShowPresetStep(true)
        }
      } else {
        // No presets -- add directly (existing behavior)
        handleSelect(song.id)
      }
    })
  }

  function handlePresetSelect(preset: SongPreset | null) {
    if (!selectedSong) return
    startTransition(async () => {
      let overrides: Partial<ContiSongOverrides> | undefined
      if (preset) {
        overrides = {
          keys: preset.keys ? JSON.parse(preset.keys) : [],
          tempos: preset.tempos ? JSON.parse(preset.tempos) : [],
          sectionOrder: preset.sectionOrder ? JSON.parse(preset.sectionOrder) : [],
          lyrics: preset.lyrics ? JSON.parse(preset.lyrics) : [],
          sectionLyricsMap: preset.sectionLyricsMap ? JSON.parse(preset.sectionLyricsMap) : {},
          notes: preset.notes,
        }
      }
      const result = await addSongToConti(contiId, selectedSong.id, overrides)
      if (result.success) {
        toast.success("곡이 추가되었습니다")
        onOpenChange(false)
        resetState()
      } else {
        toast.error(result.error ?? "곡 추가 중 오류가 발생했습니다")
      }
    })
  }

  function resetState() {
    setSearch("")
    setSelectedSong(null)
    setPresets([])
    setShowPresetStep(false)
  }

  function handleCreateAndAdd(songName: string) {
    startTransition(async () => {
      const formData = new FormData()
      formData.set("name", songName)
      const createResult = await createSong(formData)

      if (!createResult.success || !createResult.data) {
        toast.error(createResult.error ?? "곡 생성 중 오류가 발생했습니다")
        return
      }

      const addResult = await addSongToConti(contiId, createResult.data.id)
      if (addResult.success) {
        toast.success(`"${songName}" 곡이 생성되고 추가되었습니다`)
        onOpenChange(false)
        resetState()
      } else {
        toast.error(addResult.error ?? "곡 추가 중 오류가 발생했습니다")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>곡 추가</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="곡 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="max-h-80 overflow-y-auto">
          {showPresetStep ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-base font-medium mb-3">
                프리셋 선택: {selectedSong?.name}
              </p>
              <button
                type="button"
                className="hover:bg-muted flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-base transition-colors disabled:opacity-50"
                onClick={() => handlePresetSelect(null)}
                disabled={isPending}
              >
                <span className="text-muted-foreground">프리셋 없이 추가</span>
              </button>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="hover:bg-muted flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-base transition-colors disabled:opacity-50"
                  onClick={() => handlePresetSelect(preset)}
                  disabled={isPending}
                >
                  <span className="truncate font-medium">{preset.name}</span>
                  {preset.isDefault && (
                    <span className="text-sm text-muted-foreground">기본</span>
                  )}
                </button>
              ))}
              <button
                type="button"
                className="text-muted-foreground hover:bg-muted mt-1 rounded-lg px-4 py-3 text-left text-sm transition-colors"
                onClick={() => setShowPresetStep(false)}
                disabled={isPending}
              >
                ← 돌아가기
              </button>
            </div>
          ) : (
            <>
              {availableSongs.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-base">
                  이미 모든 곡이 추가되었습니다
                </p>
              ) : filteredSongs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <p className="text-muted-foreground text-center text-base">
                    검색 결과가 없습니다
                  </p>
                  {search.trim() && (
                    <button
                      type="button"
                      className="text-primary hover:bg-muted rounded-lg px-4 py-3 text-base font-medium transition-colors disabled:opacity-50"
                      onClick={() => handleCreateAndAdd(search.trim())}
                      disabled={isPending}
                    >
                      {isPending ? "생성 중..." : `새 곡 만들기: "${search.trim()}"`}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {filteredSongs.map((song) => (
                    <button
                      key={song.id}
                      type="button"
                      className="hover:bg-muted flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-base transition-colors disabled:opacity-50"
                      onClick={() => handleSongClick(song)}
                      disabled={isPending}
                    >
                      <span className="truncate font-medium">{song.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
