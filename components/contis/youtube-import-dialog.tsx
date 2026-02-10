"use client"

import { useState, useMemo, useTransition } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  MusicNote01Icon,
  Cancel01Icon,
  Tick01Icon,
  ArrowLeft01Icon,
} from "@hugeicons/core-free-icons"
import { fetchYouTubePlaylist } from "@/lib/actions/youtube"
import { batchImportSongsToConti } from "@/lib/actions/conti-songs"
import type { Song, YouTubePlaylistItem } from "@/lib/types"

interface YouTubeImportDialogProps {
  contiId: string
  existingSongIds: string[]
  allSongs: Song[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ImportItem {
  id: string
  originalTitle: string
  editedName: string
  matchedSong: Song | null
  isAlreadyInConti: boolean
  excluded: boolean
}

type Step = "url-input" | "review"

export function YouTubeImportDialog({
  contiId,
  existingSongIds,
  allSongs,
  open,
  onOpenChange,
}: YouTubeImportDialogProps) {
  const [step, setStep] = useState<Step>("url-input")
  const [url, setUrl] = useState("")
  const [items, setItems] = useState<ImportItem[]>([])
  const [isPending, startTransition] = useTransition()
  const [searchStates, setSearchStates] = useState<Record<string, string>>({})
  const [dropdownOpen, setDropdownOpen] = useState<Record<string, boolean>>({})

  const existingSongSet = useMemo(
    () => new Set(existingSongIds),
    [existingSongIds]
  )

  function resetState() {
    setStep("url-input")
    setUrl("")
    setItems([])
    setSearchStates({})
    setDropdownOpen({})
  }

  function handleFetchPlaylist() {
    if (!url.trim()) {
      toast.error("YouTube 플레이리스트 URL을 입력해주세요")
      return
    }

    startTransition(async () => {
      const result = await fetchYouTubePlaylist(url.trim())
      if (!result.success || !result.data) {
        toast.error(result.error ?? "플레이리스트를 불러오는 중 오류가 발생했습니다")
        return
      }

      const playlistItems = result.data
      const importItems: ImportItem[] = playlistItems.map((item, index) => ({
        id: `yt-${index}`,
        originalTitle: item.title,
        editedName: item.title,
        matchedSong: null,
        isAlreadyInConti: false,
        excluded: false,
      }))

      setItems(importItems)
      setStep("review")
    })
  }

  function handleEditName(itemId: string, newName: string) {
    setItems((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId ? { ...item, editedName: newName } : item
      )
      // Check for intra-batch duplicates
      return detectDuplicates(updated)
    })
    setSearchStates((prev) => ({ ...prev, [itemId]: newName }))
  }

  function handleMatchSong(itemId: string, song: Song | null) {
    setItems((prev) => {
      const updated = prev.map((item) => {
        if (item.id !== itemId) return item
        const isAlreadyInConti = song ? existingSongSet.has(song.id) : false
        return {
          ...item,
          matchedSong: song,
          isAlreadyInConti,
          excluded: isAlreadyInConti ? true : item.excluded,
        }
      })
      // Check for intra-batch duplicates
      return detectDuplicates(updated)
    })
    setDropdownOpen((prev) => ({ ...prev, [itemId]: false }))
  }

  function detectDuplicates(items: ImportItem[]): ImportItem[] {
    const matchedSongIds = new Map<string, string>() // songId -> first itemId
    const newSongNames = new Map<string, string>() // normalized name -> first itemId

    return items.map((item) => {
      let isDuplicate = false
      let duplicateReason = ""

      if (item.matchedSong) {
        const firstMatch = matchedSongIds.get(item.matchedSong.id)
        if (firstMatch && firstMatch !== item.id) {
          isDuplicate = true
          duplicateReason = "다른 항목과 동일한 곡입니다"
        } else {
          matchedSongIds.set(item.matchedSong.id, item.id)
        }
      } else if (item.editedName.trim()) {
        const normalizedName = item.editedName.trim().toLowerCase()
        const firstMatch = newSongNames.get(normalizedName)
        if (firstMatch && firstMatch !== item.id) {
          isDuplicate = true
          duplicateReason = "같은 이름의 새 곡이 중복됩니다"
        } else {
          newSongNames.set(normalizedName, item.id)
        }
      }

      return {
        ...item,
        excluded: item.isAlreadyInConti || isDuplicate ? true : item.excluded,
        duplicateReason: isDuplicate ? duplicateReason : undefined,
      } as ImportItem & { duplicateReason?: string }
    })
  }

  function toggleExclude(itemId: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId && !item.isAlreadyInConti
          ? { ...item, excluded: !item.excluded }
          : item
      )
    )
  }

  function getMatchingSongs(itemId: string): Song[] {
    const search = searchStates[itemId]?.toLowerCase() || ""
    if (!search.trim()) return []
    return allSongs.filter((song) => song.name.toLowerCase().includes(search))
  }

  function handleImport() {
    const importableItems = items.filter(
      (item) => !item.excluded && !item.isAlreadyInConti
    )

    if (importableItems.length === 0) {
      toast.error("가져올 곡이 없습니다")
      return
    }

    startTransition(async () => {
      const batchItems = importableItems.map((item) => ({
        songId: item.matchedSong?.id ?? null,
        newSongName: item.matchedSong ? null : item.editedName.trim(),
      }))

      const result = await batchImportSongsToConti(contiId, batchItems)
      if (!result.success || !result.data) {
        toast.error(result.error ?? "곡 가져오기 중 오류가 발생했습니다")
        return
      }

      toast.success(
        `${result.data.added}곡이 추가되었습니다 (새 곡 ${result.data.created}개 생성)`
      )
      onOpenChange(false)
      resetState()
    })
  }

  const importStats = useMemo(() => {
    const importable = items.filter(
      (item) => !item.excluded && !item.isAlreadyInConti
    )
    const newSongs = importable.filter((item) => !item.matchedSong).length
    const existingSongs = importable.filter((item) => item.matchedSong).length
    return { total: importable.length, newSongs, existingSongs }
  }, [items])

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetState()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>YouTube 플레이리스트에서 가져오기</DialogTitle>
        </DialogHeader>

        {step === "url-input" ? (
          <div className="flex flex-col gap-4">
            <Input
              placeholder="YouTube 플레이리스트 URL을 붙여넣으세요"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending) {
                  handleFetchPlaylist()
                }
              }}
              disabled={isPending}
            />
            <Button
              onClick={handleFetchPlaylist}
              disabled={!url.trim() || isPending}
            >
              {isPending ? "불러오는 중..." : "불러오기"}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 -mx-4 px-4">
              <div className="flex flex-col gap-3 pb-2">
                {items.map((item, index) => {
                  const matchingSongs = getMatchingSongs(item.id)
                  const showDropdown =
                    dropdownOpen[item.id] && matchingSongs.length > 0
                  const itemWithDuplicate = item as ImportItem & {
                    duplicateReason?: string
                  }

                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-muted-foreground text-sm font-medium shrink-0 w-8 text-right">
                          {index + 1}
                        </span>

                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <div className="relative">
                            <Input
                              value={item.editedName}
                              onChange={(e) =>
                                handleEditName(item.id, e.target.value)
                              }
                              onFocus={() =>
                                setDropdownOpen((prev) => ({
                                  ...prev,
                                  [item.id]: true,
                                }))
                              }
                              onBlur={() => {
                                setTimeout(
                                  () =>
                                    setDropdownOpen((prev) => ({
                                      ...prev,
                                      [item.id]: false,
                                    })),
                                  200
                                )
                              }}
                              disabled={item.isAlreadyInConti}
                              className="pr-8"
                            />
                            <HugeiconsIcon
                              icon={Search01Icon}
                              size={16}
                              strokeWidth={2}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                            />

                            {showDropdown && (
                              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {matchingSongs.map((song) => (
                                  <button
                                    key={song.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left hover:bg-muted transition-colors flex items-center gap-2 text-sm"
                                    onMouseDown={() =>
                                      handleMatchSong(item.id, song)
                                    }
                                  >
                                    <HugeiconsIcon
                                      icon={MusicNote01Icon}
                                      size={16}
                                      strokeWidth={2}
                                      className="text-muted-foreground shrink-0"
                                    />
                                    <span className="truncate">{song.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {item.matchedSong && (
                              <Badge
                                variant="outline"
                                className="gap-1 cursor-pointer hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-colors"
                                onClick={() =>
                                  !item.isAlreadyInConti &&
                                  handleMatchSong(item.id, null)
                                }
                              >
                                <HugeiconsIcon
                                  icon={MusicNote01Icon}
                                  size={14}
                                  strokeWidth={2}
                                />
                                {item.matchedSong.name}
                                {!item.isAlreadyInConti && (
                                  <HugeiconsIcon
                                    icon={Cancel01Icon}
                                    size={14}
                                    strokeWidth={2}
                                  />
                                )}
                              </Badge>
                            )}

                            {item.isAlreadyInConti ? (
                              <Badge variant="secondary" className="text-muted-foreground">
                                이미 추가됨
                              </Badge>
                            ) : itemWithDuplicate.duplicateReason ? (
                              <Badge variant="destructive" className="text-xs">
                                {itemWithDuplicate.duplicateReason}
                              </Badge>
                            ) : item.matchedSong ? (
                              <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                기존 곡
                              </Badge>
                            ) : (
                              <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                                새 곡
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 pt-2">
                        <input
                          type="checkbox"
                          checked={!item.excluded}
                          onChange={() => toggleExclude(item.id)}
                          disabled={item.isAlreadyInConti}
                          className="h-4 w-4 rounded border-gray-300 accent-primary"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 bg-background">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => setStep("url-input")}
                  disabled={isPending}
                  className="sm:w-auto"
                >
                  <HugeiconsIcon
                    icon={ArrowLeft01Icon}
                    size={16}
                    strokeWidth={2}
                  />
                  뒤로
                </Button>
                <div className="flex-1 text-sm text-muted-foreground sm:text-center">
                  {importStats.total > 0 ? (
                    <>
                      {importStats.total}개 곡 가져오기 (새 곡{" "}
                      {importStats.newSongs}개, 기존 곡{" "}
                      {importStats.existingSongs}개)
                    </>
                  ) : (
                    "가져올 곡이 없습니다"
                  )}
                </div>
                <Button
                  onClick={handleImport}
                  disabled={importStats.total === 0 || isPending}
                  className="sm:w-auto"
                >
                  {isPending ? (
                    "가져오는 중..."
                  ) : (
                    <>
                      <HugeiconsIcon
                        icon={Tick01Icon}
                        size={16}
                        strokeWidth={2}
                      />
                      가져오기
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
