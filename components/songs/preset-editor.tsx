"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Drawer } from "@/components/ui/drawer"
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
import { OverrideEditorFields } from "@/components/shared/override-editor-fields"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { createSongPreset, updateSongPreset } from "@/lib/actions/song-presets"
import type { SongPreset } from "@/lib/types"

interface PresetEditorProps {
  songId: string
  preset?: SongPreset
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PresetEditor({ songId, preset, open, onOpenChange }: PresetEditorProps) {
  const [name, setName] = useState("")
  const [keys, setKeys] = useState<string[]>([])
  const [tempos, setTempos] = useState<number[]>([])
  const [sectionOrder, setSectionOrder] = useState<string[]>([])
  const [lyrics, setLyrics] = useState<string[]>([])
  const [sectionLyricsMap, setSectionLyricsMap] = useState<Record<number, number[]>>({})
  const [notes, setNotes] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)
  const [isPending, setIsPending] = useState(false)

  // Unsaved changes tracking
  const { isDirty, markDirty, reset: resetDirty } = useUnsavedChanges(preset)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  const parseJsonField = <T,>(field: string | null, fallback: T): T => {
    if (!field) return fallback
    try {
      return JSON.parse(field) as T
    } catch {
      return fallback
    }
  }

  // Initialize form when preset changes or drawer opens
  useEffect(() => {
    if (open) {
      if (preset) {
        setName(preset.name)
        setKeys(parseJsonField<string[]>(preset.keys, []))
        setTempos(parseJsonField<number[]>(preset.tempos, []))
        setSectionOrder(parseJsonField<string[]>(preset.sectionOrder, []))
        setLyrics(parseJsonField<string[]>(preset.lyrics, []))
        setSectionLyricsMap(parseJsonField<Record<number, number[]>>(preset.sectionLyricsMap, {}))
        setNotes(preset.notes)
        setIsDefault(preset.isDefault)
      } else {
        setName("")
        setKeys([])
        setTempos([])
        setSectionOrder([])
        setLyrics([])
        setSectionLyricsMap({})
        setNotes(null)
        setIsDefault(false)
      }
      resetDirty()
    }
  }, [preset, open, resetDirty])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("프리셋 이름을 입력해주세요")
      return
    }

    setIsPending(true)
    try {
      const data = {
        name: name.trim(),
        keys,
        tempos,
        sectionOrder,
        lyrics,
        sectionLyricsMap,
        notes: notes?.trim() || null,
        isDefault,
      }

      const result = preset
        ? await updateSongPreset(preset.id, data)
        : await createSongPreset(songId, data)

      if (result.success) {
        toast.success(preset ? "프리셋이 수정되었습니다" : "프리셋이 생성되었습니다")
        resetDirty()
        onOpenChange(false)
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  // Close with unsaved changes check
  const handleClose = () => {
    if (isDirty) {
      setShowUnsavedDialog(true)
    } else {
      onOpenChange(false)
    }
  }

  // onChange handlers that update state AND mark dirty
  const handleKeysTemposChange = (data: { keys: string[]; tempos: number[] }) => {
    setKeys(data.keys)
    setTempos(data.tempos)
    markDirty()
  }

  const handleSectionOrderChange = (data: { sectionOrder: string[] }) => {
    setSectionOrder(data.sectionOrder)
    markDirty()
  }

  const handleLyricsChange = (data: { lyrics: string[] }) => {
    setLyrics(data.lyrics)
    markDirty()
  }

  const handleSectionLyricsMapChange = (data: { sectionLyricsMap: Record<number, number[]> }) => {
    setSectionLyricsMap(data.sectionLyricsMap)
    markDirty()
  }

  const handleNotesChange = (newNotes: string | null) => {
    setNotes(newNotes)
    markDirty()
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={() => onOpenChange(false)}
        onBeforeClose={() => {
          if (isDirty) {
            setShowUnsavedDialog(true)
            return false
          }
          return true
        }}
        title={preset ? "프리셋 편집" : "프리셋 추가"}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isPending}>
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        }
      >
        <div className="space-y-8">
          <div className="space-y-3">
            <label htmlFor="preset-name" className="text-base font-medium">
              프리셋 이름 <span className="text-destructive">*</span>
            </label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty() }}
              placeholder="예: 주일 예배"
              required
            />
          </div>

          <OverrideEditorFields
            keys={keys}
            tempos={tempos}
            sectionOrder={sectionOrder}
            lyrics={lyrics}
            sectionLyricsMap={sectionLyricsMap}
            notes={notes}
            onKeysTemposChange={handleKeysTemposChange}
            onSectionOrderChange={handleSectionOrderChange}
            onLyricsChange={handleLyricsChange}
            onSectionLyricsMapChange={handleSectionLyricsMapChange}
            onNotesChange={handleNotesChange}
          />

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="preset-default"
              checked={isDefault}
              onChange={(e) => { setIsDefault(e.target.checked); markDirty() }}
              className="size-5 cursor-pointer rounded"
            />
            <label htmlFor="preset-default" className="text-base cursor-pointer">
              기본 프리셋으로 설정
            </label>
          </div>
        </div>
      </Drawer>

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 변경사항</AlertDialogTitle>
            <AlertDialogDescription>
              저장하지 않은 변경사항이 있습니다. 저장하지 않고 닫으시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
              계속 편집
            </AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => {
              setShowUnsavedDialog(false)
              resetDirty()
              onOpenChange(false)
            }}>
              저장하지 않고 닫기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
