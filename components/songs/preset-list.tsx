"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { YouTubeReferenceLink } from "@/components/shared/youtube-reference-link"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, Delete01Icon, PencilEdit01Icon, Tick01Icon } from "@hugeicons/core-free-icons"
import { deleteSongPreset, setDefaultPreset } from "@/lib/actions/song-presets"
import { cn } from "@/lib/utils"
import { MashupPresetDialog } from "./mashup-preset-dialog"
import { PresetEditor } from "./preset-editor"
import type { ResolvedSongPresetWithSheetMusic, SheetMusicFile, Song } from "@/lib/types"

interface PresetListProps {
  songId: string
  songName: string
  songLyrics: string[]
  presets: ResolvedSongPresetWithSheetMusic[]
  sheetMusic: SheetMusicFile[]
  allSongs: Song[]
}

export function PresetList({ songId, songName, songLyrics, presets, sheetMusic, allSongs }: PresetListProps) {
  const router = useRouter()
  const [editorOpen, setEditorOpen] = useState(false)
  const [mashupDialogOpen, setMashupDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<
    ResolvedSongPresetWithSheetMusic | undefined
  >()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const compact = editorOpen

  useEffect(() => {
    if (!editingPreset) return

    const refreshedPreset = presets.find((preset) => preset.id === editingPreset.id)
    if (!refreshedPreset) {
      setEditingPreset(undefined)
      setEditorOpen(false)
      return
    }

    if (refreshedPreset !== editingPreset) {
      setEditingPreset(refreshedPreset)
    }
  }, [editingPreset, presets])

  const handleCreateClick = () => {
    setEditingPreset(undefined)
    setEditorOpen(true)
  }

  const handleMashupPresetReady = (
    preset: ResolvedSongPresetWithSheetMusic,
  ) => {
    setEditingPreset(preset)
    setEditorOpen(true)
  }

  const handleEditClick = (preset: ResolvedSongPresetWithSheetMusic) => {
    setEditingPreset(preset)
    setEditorOpen(true)
  }

  const handleDeleteClick = (presetId: string) => {
    setDeletingPresetId(presetId)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingPresetId) return

    setIsPending(true)
    try {
      const result = await deleteSongPreset(deletingPresetId)
      if (result.success) {
        toast.success("프리셋이 삭제되었습니다")
        setDeleteDialogOpen(false)
        setDeletingPresetId(null)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  const handleSetDefault = async (presetId: string) => {
    const result = await setDefaultPreset(songId, presetId)
    if (result.success) {
      toast.success("기본 프리셋이 설정되었습니다")
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  const parseJsonField = <T,>(field: string | null, fallback: T): T => {
    if (!field) return fallback
    try {
      return JSON.parse(field) as T
    } catch {
      return fallback
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleCreateClick}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          프리셋 추가
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMashupDialogOpen(true)}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          매시업 프리셋 추가
        </Button>
      </div>

      {presets.length === 0 ? (
        <p className="text-muted-foreground text-base text-center py-8">
          프리셋이 없습니다
        </p>
      ) : (
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {presets.map((preset) => {
            const keys = parseJsonField<string[]>(preset.keys, [])
            const tempos = parseJsonField<number[]>(preset.tempos, [])
            const isMashup = preset.presetType === "mashup"
            const memberNames = preset.members
              .slice()
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((member) => member.songName)
              .filter((name): name is string => Boolean(name))

            return (
              <div
                key={preset.id}
                className={cn(
                  "ring-foreground/10 rounded-lg bg-muted/30 ring-1 cursor-pointer hover:bg-muted/50 transition-colors",
                  compact ? "p-3" : "p-4",
                )}
                onClick={() => handleEditClick(preset)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <h3 className="truncate font-medium">{preset.name}</h3>
                      {isMashup && (
                        <Badge variant="secondary">매시업</Badge>
                      )}
                      {preset.isDefault && (
                        <Badge variant="secondary">기본</Badge>
                      )}
                    </div>

                    <div
                      className={cn(
                        "text-muted-foreground",
                        compact
                          ? "mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                          : "text-base space-y-1.5",
                      )}
                    >
                      {isMashup && memberNames.length > 0 && (
                        <div className={compact ? "min-w-0 max-w-full truncate" : undefined}>
                          <span className="font-medium">연결:</span>{" "}
                          {memberNames.join(" → ")}
                        </div>
                      )}
                      {keys.length > 0 && (
                        <div className={compact ? "min-w-0 max-w-full truncate" : undefined}>
                          <span className="font-medium">조성:</span>{" "}
                          {keys.join(", ")}
                        </div>
                      )}
                      {tempos.length > 0 && (
                        <div className={compact ? "min-w-0 max-w-full truncate" : undefined}>
                          <span className="font-medium">템포:</span>{" "}
                          {tempos.join(", ")} BPM
                        </div>
                      )}
                      {preset.notes && !compact && (
                        <div>
                          <span className="font-medium">메모:</span>{" "}
                          {preset.notes}
                        </div>
                      )}
                      <YouTubeReferenceLink
                        reference={preset.youtubeReference}
                        title={preset.youtubeTitle}
                        stopPropagation
                        className={cn(
                          "text-primary block truncate underline-offset-4 hover:underline",
                          compact && "min-w-0 max-w-full",
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {!isMashup && !preset.isDefault && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => handleSetDefault(preset.id)}
                        aria-label="기본으로 설정"
                        title="기본으로 설정"
                      >
                        <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} />
                      </Button>
                    )}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleEditClick(preset)}
                      aria-label="편집"
                      className="hidden sm:inline-flex"
                    >
                      <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(preset.id)}
                      aria-label="삭제"
                    >
                      <HugeiconsIcon icon={Delete01Icon} strokeWidth={2} />
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <PresetEditor
        songId={songId}
        songLyrics={songLyrics}
        preset={editingPreset}
        sheetMusic={sheetMusic}
        open={editorOpen}
        onOpenChange={setEditorOpen}
      />

      <MashupPresetDialog
        currentSongId={songId}
        currentSongName={songName}
        allSongs={allSongs}
        open={mashupDialogOpen}
        onOpenChange={setMashupDialogOpen}
        onPresetReady={handleMashupPresetReady}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>프리셋 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 프리셋을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isPending}>
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
