"use client"

import { Textarea } from "@/components/ui/textarea"
import { KeyTempoEditor } from "@/components/contis/key-tempo-editor"
import { SectionOrderEditor } from "@/components/contis/section-order-editor"
import { LyricsEditor } from "@/components/contis/lyrics-editor"
import { SectionLyricsMapper } from "@/components/contis/section-lyrics-mapper"
import type { SheetMusicFile } from "@/lib/types"

interface OverrideEditorFieldsProps {
  keys: string[]
  tempos: number[]
  sectionOrder: string[]
  lyrics: string[]
  sectionLyricsMap: Record<number, number[]>
  notes: string | null
  sheetMusicFiles?: SheetMusicFile[]
  onKeysTemposChange: (data: { keys: string[]; tempos: number[] }) => void
  onSectionOrderChange: (data: { sectionOrder: string[] }) => void
  onLyricsChange: (data: { lyrics: string[] }) => void
  onSectionLyricsMapChange: (data: { sectionLyricsMap: Record<number, number[]> }) => void
  onNotesChange: (notes: string | null) => void
}

export function OverrideEditorFields({
  keys,
  tempos,
  sectionOrder,
  lyrics,
  sectionLyricsMap,
  notes,
  sheetMusicFiles,
  onKeysTemposChange,
  onSectionOrderChange,
  onLyricsChange,
  onSectionLyricsMapChange,
  onNotesChange,
}: OverrideEditorFieldsProps) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-4 text-base font-medium">조성 및 템포</h3>
        <KeyTempoEditor
          initialKeys={keys}
          initialTempos={tempos}
          onChange={onKeysTemposChange}
        />
      </div>

      <div className="border-t my-8" />

      <div>
        <h3 className="mb-4 text-base font-medium">섹션 순서</h3>
        <SectionOrderEditor
          initialSectionOrder={sectionOrder}
          onChange={onSectionOrderChange}
        />
      </div>

      <div className="border-t my-8" />

      <div>
        <LyricsEditor
          initialLyrics={lyrics}
          onChange={onLyricsChange}
          sheetMusicFiles={sheetMusicFiles}
        />
      </div>

      <div className="border-t my-8" />

      <div>
        <h3 className="mb-4 text-base font-medium">섹션-가사 매핑</h3>
        <SectionLyricsMapper
          sectionOrder={sectionOrder}
          lyrics={lyrics}
          initialMap={sectionLyricsMap}
          onChange={onSectionLyricsMapChange}
        />
      </div>

      <div className="border-t my-8" />

      <div>
        <label className="mb-4 block text-base font-medium">메모</label>
        <Textarea
          value={notes || ""}
          onChange={(e) => onNotesChange(e.target.value || null)}
          placeholder="추가 정보를 입력하세요..."
          rows={3}
        />
      </div>
    </div>
  )
}
