"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { KeyTempoEditor } from "@/components/contis/key-tempo-editor"
import { SectionOrderEditor } from "@/components/contis/section-order-editor"
import { LyricsEditor } from "@/components/contis/lyrics-editor"
import { SectionLyricsMapper } from "@/components/contis/section-lyrics-mapper"
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

  const parseJsonField = <T,>(field: string | null, fallback: T): T => {
    if (!field) return fallback
    try {
      return JSON.parse(field) as T
    } catch {
      return fallback
    }
  }

  // Initialize form when preset changes or dialog opens
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
        // Reset to empty state for create mode
        setName("")
        setKeys([])
        setTempos([])
        setSectionOrder([])
        setLyrics([])
        setSectionLyricsMap({})
        setNotes(null)
        setIsDefault(false)
      }
    }
  }, [preset, open])

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
        onOpenChange(false)
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  // Local state update handlers (NOT server actions)
  const handleKeyTempoSave = async (data: { keys: string[]; tempos: number[] }) => {
    setKeys(data.keys)
    setTempos(data.tempos)
    return { success: true }
  }

  const handleSectionOrderSave = async (data: { sectionOrder: string[] }) => {
    setSectionOrder(data.sectionOrder)
    return { success: true }
  }

  const handleLyricsSave = async (data: { lyrics: string[] }) => {
    setLyrics(data.lyrics)
    return { success: true }
  }

  const handleSectionLyricsMapSave = async (data: { sectionLyricsMap: Record<number, number[]> }) => {
    setSectionLyricsMap(data.sectionLyricsMap)
    return { success: true }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{preset ? "프리셋 편집" : "프리셋 추가"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-8">
          <div className="space-y-3">
            <label htmlFor="preset-name" className="text-base font-medium">
              프리셋 이름 <span className="text-destructive">*</span>
            </label>
            <Input
              id="preset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 주일 예배"
              required
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">조성 및 템포</h3>
            <KeyTempoEditor
              initialKeys={keys}
              initialTempos={tempos}
              onSave={handleKeyTempoSave}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">섹션 순서</h3>
            <SectionOrderEditor
              initialSectionOrder={sectionOrder}
              onSave={handleSectionOrderSave}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">가사</h3>
            <LyricsEditor
              initialLyrics={lyrics}
              onSave={handleLyricsSave}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-semibold">섹션-가사 매핑</h3>
            <SectionLyricsMapper
              sectionOrder={sectionOrder}
              lyrics={lyrics}
              initialMap={sectionLyricsMap}
              onSave={handleSectionLyricsMapSave}
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="preset-notes" className="text-base font-medium">
              메모
            </label>
            <Textarea
              id="preset-notes"
              value={notes || ""}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="프리셋에 대한 추가 정보를 입력하세요..."
              rows={3}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="preset-default"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="size-5 cursor-pointer rounded"
            />
            <label htmlFor="preset-default" className="text-base cursor-pointer">
              기본 프리셋으로 설정
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-6">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
