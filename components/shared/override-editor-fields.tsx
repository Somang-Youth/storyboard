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
  onLyricsChange: (data: { lyrics: string[]; swappedPages?: [number, number]; insertedAt?: number }) => void
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
      {/* 조성 / 템포 — 2-column grid */}
      <KeyTempoEditor
        initialKeys={keys}
        initialTempos={tempos}
        onChange={onKeysTemposChange}
        twoColumn
      />

      <div className="border-t my-8" />

      {/* 섹션 순서 — 1 column, heading is inside the component as collapsible trigger */}
      <SectionOrderEditor
        initialSectionOrder={sectionOrder}
        onChange={onSectionOrderChange}
      />

      <div className="border-t my-8" />

      {/* 가사 페이지 / 섹션-가사 매핑 — 2-column grid */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <LyricsEditor
            initialLyrics={lyrics}
            onChange={onLyricsChange}
            sheetMusicFiles={sheetMusicFiles}
          />
        </div>
        <SectionLyricsMapper
          sectionOrder={sectionOrder}
          lyrics={lyrics}
          initialMap={sectionLyricsMap}
          onChange={onSectionLyricsMapChange}
        />
      </div>

      <div className="border-t my-8" />

      {/* 메모 — 1 column */}
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
