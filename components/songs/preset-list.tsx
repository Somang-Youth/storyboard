"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { PresetEditor } from "./preset-editor"
import type { SongPreset } from "@/lib/types"

interface PresetListProps {
  songId: string
  presets: SongPreset[]
}

export function PresetList({ songId, presets }: PresetListProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<SongPreset | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const handleCreateClick = () => {
    setEditingPreset(undefined)
    setEditorOpen(true)
  }

  const handleEditClick = (preset: SongPreset) => {
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
      <div className="flex items-center justify-between">
        <Button size="sm" onClick={handleCreateClick}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} data-icon="inline-start" />
          프리셋 추가
        </Button>
      </div>

      {presets.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">
          프리셋이 없습니다
        </p>
      ) : (
        <div className="space-y-3">
          {presets.map((preset) => {
            const keys = parseJsonField<string[]>(preset.keys, [])
            const tempos = parseJsonField<number[]>(preset.tempos, [])

            return (
              <div
                key={preset.id}
                className="ring-foreground/10 rounded-lg bg-muted/30 p-4 ring-1"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{preset.name}</h3>
                      {preset.isDefault && (
                        <Badge variant="secondary">기본</Badge>
                      )}
                    </div>

                    <div className="text-muted-foreground text-sm space-y-1">
                      {keys.length > 0 && (
                        <div>
                          <span className="font-medium">조성:</span>{" "}
                          {keys.join(", ")}
                        </div>
                      )}
                      {tempos.length > 0 && (
                        <div>
                          <span className="font-medium">템포:</span>{" "}
                          {tempos.join(", ")} BPM
                        </div>
                      )}
                      {preset.notes && (
                        <div>
                          <span className="font-medium">메모:</span>{" "}
                          {preset.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {!preset.isDefault && (
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
        preset={editingPreset}
        open={editorOpen}
        onOpenChange={setEditorOpen}
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
