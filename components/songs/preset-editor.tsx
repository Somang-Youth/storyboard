"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
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
import { SheetMusicSelector } from "@/components/shared/sheet-music-selector"
import { SheetMusicGallery } from "./sheet-music-gallery"
import { PresetPdfEditor } from "./preset-pdf-editor"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import type {
  PresetPdfMetadata,
  SongPresetWithSheetMusic,
  SheetMusicFile,
} from "@/lib/types"

interface PresetEditorProps {
  songId: string
  preset?: SongPresetWithSheetMusic
  sheetMusic: SheetMusicFile[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PresetEditor({ songId, preset, sheetMusic, open, onOpenChange }: PresetEditorProps) {
  const [name, setName] = useState("")
  const [keys, setKeys] = useState<string[]>([])
  const [tempos, setTempos] = useState<number[]>([])
  const [sectionOrder, setSectionOrder] = useState<string[]>([])
  const [lyrics, setLyrics] = useState<string[]>([])
  const [sectionLyricsMap, setSectionLyricsMap] = useState<Record<number, number[]>>({})
  const [notes, setNotes] = useState<string | null>(null)
  const [isDefault, setIsDefault] = useState(false)
  const [youtubeReference, setYoutubeReference] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [sheetMusicFileIds, setSheetMusicFileIds] = useState<string[]>([])
  const [pdfMetadata, setPdfMetadata] = useState<PresetPdfMetadata | null>(null)
  const [pdfEditorOpen, setPdfEditorOpen] = useState(false)
  const [editorKey, setEditorKey] = useState(0)

  const previewSheetMusic = useMemo(() => {
    if (sheetMusicFileIds.length === 0) {
      return sheetMusic
    }
    const selected = new Set(sheetMusicFileIds)
    return sheetMusic.filter((file) => selected.has(file.id))
  }, [sheetMusic, sheetMusicFileIds])

  // Unsaved changes tracking
  const { isDirty, markDirty: _markDirty, reset: resetDirty } = useUnsavedChanges(preset)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const dirtyAllowedRef = useRef(false)
  const markDirty = useCallback(() => {
    if (dirtyAllowedRef.current) _markDirty()
  }, [_markDirty])

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
        setYoutubeReference(preset.youtubeReference)
        setSheetMusicFileIds(preset.sheetMusicFileIds ?? [])
        setPdfMetadata(parseJsonField<PresetPdfMetadata | null>(preset.pdfMetadata, null))
      } else {
        setName("")
        setKeys([])
        setTempos([])
        setSectionOrder([])
        setLyrics([])
        setSectionLyricsMap({})
        setNotes(null)
        setIsDefault(false)
        setYoutubeReference(null)
        setSheetMusicFileIds([])
        setPdfMetadata(null)
      }
      dirtyAllowedRef.current = false
      resetDirty()
      setEditorKey(k => k + 1)
    }
  }, [preset, open, resetDirty])

  // Enable dirty tracking after all effects (including Strict Mode double-invocations)
  // have settled. setTimeout(0) fires in the next macrotask, guaranteeing all
  // synchronous effect chains are complete.
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => { dirtyAllowedRef.current = true }, 0)
      return () => { clearTimeout(timer); dirtyAllowedRef.current = false }
    }
  }, [open, editorKey])

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
        youtubeReference,
        sheetMusicFileIds,
        pdfMetadata,
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
            key={editorKey}
            keys={keys}
            tempos={tempos}
            sectionOrder={sectionOrder}
            lyrics={lyrics}
            sectionLyricsMap={sectionLyricsMap}
            notes={notes}
            sheetMusicFiles={sheetMusic}
            onKeysTemposChange={handleKeysTemposChange}
            onSectionOrderChange={handleSectionOrderChange}
            onLyricsChange={handleLyricsChange}
            onSectionLyricsMapChange={handleSectionLyricsMapChange}
            onNotesChange={handleNotesChange}
          />

          {sheetMusic.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-base font-medium">악보 선택</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPdfEditorOpen(true)}
                >
                  PDF 편집
                </Button>
              </div>
              <SheetMusicSelector
                songId={songId}
                selectedFileIds={sheetMusicFileIds}
                onSelectionChange={(ids) => { setSheetMusicFileIds(ids); markDirty() }}
                availableFiles={sheetMusic}
              />
            </div>
          )}

          {sheetMusic.length > 0 && (
            <div className="space-y-3">
              <label className="text-base font-medium">악보 미리보기</label>
              <p className="text-sm text-muted-foreground">
                선택된 악보를 바로 확인할 수 있습니다. 선택이 없으면 전체 악보를 표시합니다.
              </p>
              <SheetMusicGallery files={previewSheetMusic} />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="preset-youtube-ref" className="text-base font-medium">YouTube 레퍼런스</label>
            <div className="flex items-center gap-2">
              <Input
                id="preset-youtube-ref"
                value={youtubeReference ?? ""}
                onChange={(e) => { setYoutubeReference(e.target.value || null); markDirty() }}
                placeholder="YouTube 영상 ID (예: dQw4w9WgXcQ)"
              />
              {youtubeReference && (
                <a
                  href={`https://www.youtube.com/watch?v=${youtubeReference}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded bg-red-500/10 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/20 transition-colors"
                >
                  열기
                </a>
              )}
            </div>
          </div>

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

      <Dialog open={pdfEditorOpen} onOpenChange={setPdfEditorOpen}>
        <DialogContent className="!w-screen !h-[100dvh] !max-w-none sm:!max-w-none rounded-none overflow-x-hidden overflow-y-auto p-3 sm:p-4 flex flex-col">
          <div className="min-h-0 flex-1">
            <PresetPdfEditor
              songName={name.trim() || "제목 없음"}
              sheetMusic={previewSheetMusic}
              sectionOrder={sectionOrder}
              tempos={tempos}
              initialMetadata={pdfMetadata}
              onSave={(metadata) => {
                setPdfMetadata(metadata)
                markDirty()
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

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
