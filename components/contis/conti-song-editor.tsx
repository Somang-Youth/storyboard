"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Drawer } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { KeyTempoEditor } from "./key-tempo-editor"
import { SectionOrderEditor } from "./section-order-editor"
import { LyricsEditor } from "./lyrics-editor"
import { SectionLyricsMapper } from "./section-lyrics-mapper"
import { updateContiSong, saveContiSongAsPreset } from "@/lib/actions/conti-songs"
import { getPresetsForSong } from "@/lib/actions/song-presets"
import type { ContiSongWithSong, SongPreset, ContiSongOverrides } from "@/lib/types"

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
  const router = useRouter()
  const [showPresetSave, setShowPresetSave] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [presets, setPresets] = useState<SongPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [editorKey, setEditorKey] = useState(0)

  function handleLoadPreset(preset: SongPreset) {
    if (!confirm(`"${preset.name}" 프리셋을 불러오면 현재 설정이 덮어씌워집니다. 계속하시겠습니까?`)) {
      return
    }
    startTransition(async () => {
      const overrides: Partial<ContiSongOverrides> = {
        keys: preset.keys ? JSON.parse(preset.keys) : [],
        tempos: preset.tempos ? JSON.parse(preset.tempos) : [],
        sectionOrder: preset.sectionOrder ? JSON.parse(preset.sectionOrder) : [],
        lyrics: preset.lyrics ? JSON.parse(preset.lyrics) : [],
        sectionLyricsMap: preset.sectionLyricsMap ? JSON.parse(preset.sectionLyricsMap) : {},
        notes: preset.notes,
      }
      const result = await updateContiSong(contiSong.id, overrides)
      if (result.success) {
        toast.success(`"${preset.name}" 프리셋을 불러왔습니다`)
        setEditorKey(k => k + 1)
        router.refresh()
      } else {
        toast.error(result.error ?? "프리셋 불러오기 중 오류가 발생했습니다")
      }
    })
  }

  useEffect(() => {
    if (open) {
      getPresetsForSong(contiSong.songId).then(result => {
        if (result.success && result.data) {
          setPresets(result.data)
        }
      })
    }
  }, [open, contiSong.songId])

  const { id, overrides } = contiSong

  return (
    <Drawer
      open={open}
      onClose={() => onOpenChange(false)}
      title="곡 편집"
      footer={
        <Button className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
          닫기
        </Button>
      }
    >
      <div className="space-y-8">
        <div>
          <h3 className="mb-4 text-base font-medium">프리셋 관리</h3>
          {presets.length > 0 && (
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-1.5 block">프리셋 불러오기</label>
              <div className="flex flex-col gap-1.5">
                {presets.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className="hover:bg-muted flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-base transition-colors disabled:opacity-50"
                    onClick={() => handleLoadPreset(p)}
                    disabled={isPending}
                  >
                    <span className="truncate font-medium">{p.name}</span>
                    {p.isDefault && (
                      <span className="text-sm text-muted-foreground">기본</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!showPresetSave ? (
            <Button variant="outline" size="sm" onClick={() => setShowPresetSave(true)}>
              프리셋으로 저장
            </Button>
          ) : (
            <div className="space-y-4">
              {presets.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm text-muted-foreground">기존 프리셋 업데이트</label>
                  <select
                    className="rounded border px-3 py-1.5 text-base"
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
              <div className="flex gap-3">
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

        <div className="border-t" />

        <div key={editorKey}>
          <div>
            <h3 className="mb-4 text-base font-medium">조성 및 템포</h3>
            <KeyTempoEditor
              initialKeys={overrides.keys}
              initialTempos={overrides.tempos}
              onSave={(data) => updateContiSong(id, data)}
            />
          </div>

          <div className="border-t my-8" />

          <div>
            <h3 className="mb-4 text-base font-medium">섹션 순서</h3>
            <SectionOrderEditor
              initialSectionOrder={overrides.sectionOrder}
              onSave={(data) => updateContiSong(id, data)}
            />
          </div>

          <div className="border-t my-8" />

          <div>
            <h3 className="mb-4 text-base font-medium">가사 페이지</h3>
            <LyricsEditor
              initialLyrics={overrides.lyrics}
              onSave={(data) => updateContiSong(id, data)}
            />
          </div>

          <div className="border-t my-8" />

          <div>
            <h3 className="mb-4 text-base font-medium">섹션-가사 매핑</h3>
            <SectionLyricsMapper
              sectionOrder={overrides.sectionOrder}
              lyrics={overrides.lyrics}
              initialMap={overrides.sectionLyricsMap}
              onSave={(data) => updateContiSong(id, data)}
            />
          </div>
        </div>
      </div>
    </Drawer>
  )
}
