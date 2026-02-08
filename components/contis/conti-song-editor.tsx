"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { KeyTempoEditor } from "./key-tempo-editor"
import { SectionOrderEditor } from "./section-order-editor"
import { LyricsEditor } from "./lyrics-editor"
import { SectionLyricsMapper } from "./section-lyrics-mapper"
import type { ContiSongWithSong } from "@/lib/types"

interface ContiSongEditorProps {
  contiSong: ContiSongWithSong
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ContiSongEditor({
  contiSong,
  open,
  onOpenChange,
}: ContiSongEditorProps) {
  if (!open) return null

  const { id, overrides } = contiSong

  return (
    <div className="mt-2">
      <Card>
        <CardHeader>
          <CardTitle>곡 편집</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-3 text-sm font-medium">조성 및 템포</h3>
            <KeyTempoEditor
              contiSongId={id}
              initialKeys={overrides.keys}
              initialTempos={overrides.tempos}
            />
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">섹션 순서</h3>
            <SectionOrderEditor
              contiSongId={id}
              initialSectionOrder={overrides.sectionOrder}
            />
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">가사 페이지</h3>
            <LyricsEditor
              contiSongId={id}
              initialLyrics={overrides.lyrics}
            />
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">섹션-가사 매핑</h3>
            <SectionLyricsMapper
              contiSongId={id}
              sectionOrder={overrides.sectionOrder}
              lyrics={overrides.lyrics}
              initialMap={overrides.sectionLyricsMap}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
