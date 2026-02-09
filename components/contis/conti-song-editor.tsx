"use client"

import { useState, useTransition, useEffect } from "react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KeyTempoEditor } from "./key-tempo-editor"
import { SectionOrderEditor } from "./section-order-editor"
import { LyricsEditor } from "./lyrics-editor"
import { SectionLyricsMapper } from "./section-lyrics-mapper"
import { updateContiSong, saveContiSongAsPreset } from "@/lib/actions/conti-songs"
import { getPresetsForSong } from "@/lib/actions/song-presets"
import type { ContiSongWithSong, SongPreset } from "@/lib/types"

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
  const [showPresetSave, setShowPresetSave] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [presets, setPresets] = useState<SongPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      getPresetsForSong(contiSong.songId).then(result => {
        if (result.success && result.data) {
          setPresets(result.data)
        }
      })
    }
  }, [open, contiSong.songId])

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
              initialKeys={overrides.keys}
              initialTempos={overrides.tempos}
              onSave={(data) => updateContiSong(id, data)}
            />
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">섹션 순서</h3>
            <SectionOrderEditor
              initialSectionOrder={overrides.sectionOrder}
              onSave={(data) => updateContiSong(id, data)}
            />
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">가사 페이지</h3>
            <LyricsEditor
              initialLyrics={overrides.lyrics}
              onSave={(data) => updateContiSong(id, data)}
            />
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">섹션-가사 매핑</h3>
            <SectionLyricsMapper
              sectionOrder={overrides.sectionOrder}
              lyrics={overrides.lyrics}
              initialMap={overrides.sectionLyricsMap}
              onSave={(data) => updateContiSong(id, data)}
            />
          </div>

          <Separator />

          <div>
            <h3 className="mb-3 text-sm font-medium">프리셋 관리</h3>
            {!showPresetSave ? (
              <Button variant="outline" size="sm" onClick={() => setShowPresetSave(true)}>
                프리셋으로 저장
              </Button>
            ) : (
              <div className="space-y-3">
                {presets.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">기존 프리셋 업데이트</label>
                    <select
                      className="rounded border px-2 py-1 text-sm"
                      value={selectedPresetId ?? ""}
                      onChange={(e) => {
                        const val = e.target.value || null
                        setSelectedPresetId(val)
                        if (val) {
                          const preset = presets.find(p => p.id === val)
                          if (preset) setPresetName(preset.name)
                        } else {
                          setPresetName("")
                        }
                      }}
                    >
                      <option value="">새 프리셋 만들기</option>
                      {presets.map(p => (
                        <option key={p.id} value={p.id}>{p.name}{p.isDefault ? " (기본)" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Input
                  placeholder="프리셋 이름"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={!presetName.trim() || isPending}
                    onClick={() => {
                      startTransition(async () => {
                        const result = await saveContiSongAsPreset(
                          contiSong.id,
                          presetName.trim(),
                          selectedPresetId ?? undefined
                        )
                        if (result.success) {
                          toast.success(selectedPresetId ? "프리셋이 업데이트되었습니다" : "새 프리셋이 저장되었습니다")
                          setShowPresetSave(false)
                          setPresetName("")
                          setSelectedPresetId(null)
                          const refreshed = await getPresetsForSong(contiSong.songId)
                          if (refreshed.success && refreshed.data) setPresets(refreshed.data)
                        } else {
                          toast.error(result.error ?? "프리셋 저장 중 오류가 발생했습니다")
                        }
                      })
                    }}
                  >
                    {isPending ? "저장 중..." : (selectedPresetId ? "프리셋 업데이트" : "프리셋 저장")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setShowPresetSave(false); setPresetName(""); setSelectedPresetId(null) }}>
                    취소
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
