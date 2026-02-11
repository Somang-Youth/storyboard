"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Drawer } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { updateContiSong, saveContiSongAsPreset } from "@/lib/actions/conti-songs"
import { getPresetsForSong } from "@/lib/actions/song-presets"
import type { ContiSongWithSong, SongPreset } from "@/lib/types"
import { SheetMusicSelector } from "@/components/shared/sheet-music-selector"
import { getSheetMusicForSong } from "@/lib/actions/sheet-music"
import { getPresetSheetMusicFileIds } from "@/lib/actions/song-presets"
import type { SheetMusicFile } from "@/lib/types"

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
  const { id, overrides } = contiSong

  // Local state for all override fields (batch save)
  const [keys, setKeys] = useState<string[]>(overrides.keys)
  const [tempos, setTempos] = useState<number[]>(overrides.tempos)
  const [sectionOrder, setSectionOrder] = useState<string[]>(overrides.sectionOrder)
  const [lyrics, setLyrics] = useState<string[]>(overrides.lyrics)
  const [sectionLyricsMap, setSectionLyricsMap] = useState<Record<number, number[]>>(overrides.sectionLyricsMap)
  const [notes, setNotes] = useState<string | null>(overrides.notes)

  // Unsaved changes tracking
  const { isDirty, markDirty, reset: resetDirty } = useUnsavedChanges(overrides)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  // Pending states
  const [isSaving, setIsSaving] = useState(false)
  const [isPresetSaving, setIsPresetSaving] = useState(false)

  // Preset management
  const [showPresetSave, setShowPresetSave] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [presets, setPresets] = useState<SongPreset[]>([])
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [editorKey, setEditorKey] = useState(0)
  const [sheetMusicFileIds, setSheetMusicFileIds] = useState<string[] | null>(null)
  const [songSheetMusic, setSongSheetMusic] = useState<SheetMusicFile[]>([])

  // Initialize state from contiSong when drawer opens
  useEffect(() => {
    if (open) {
      setKeys(overrides.keys)
      setTempos(overrides.tempos)
      setSectionOrder(overrides.sectionOrder)
      setLyrics(overrides.lyrics)
      setSectionLyricsMap(overrides.sectionLyricsMap)
      setNotes(overrides.notes)
      setSheetMusicFileIds(overrides.sheetMusicFileIds)
      resetDirty()
      setEditorKey(k => k + 1)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contiSong.id])

  // Fetch presets when drawer opens
  useEffect(() => {
    if (open) {
      getPresetsForSong(contiSong.songId).then(result => {
        if (result.success && result.data) {
          setPresets(result.data)
        }
      })
    }
  }, [open, contiSong.songId])

  // Fetch sheet music for this song when drawer opens
  useEffect(() => {
    if (open) {
      getSheetMusicForSong(contiSong.songId).then(result => {
        if (result.success && result.data) setSongSheetMusic(result.data)
      })
    }
  }, [open, contiSong.songId])

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

  // Batch save
  const handleSave = async () => {
    setIsSaving(true)
    try {
      const result = await updateContiSong(id, {
        keys, tempos, sectionOrder, lyrics, sectionLyricsMap, notes, sheetMusicFileIds,
      })
      if (result.success) {
        toast.success("곡 설정이 저장되었습니다")
        resetDirty()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    } finally {
      setIsSaving(false)
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

  // Preset load — updates local state only (no server action)
  async function handleLoadPreset(preset: SongPreset) {
    if (!confirm(`"${preset.name}" 프리셋을 불러오면 현재 설정이 덮어씌워집니다. 계속하시겠습니까?`)) {
      return
    }
    setKeys(preset.keys ? JSON.parse(preset.keys) : [])
    setTempos(preset.tempos ? JSON.parse(preset.tempos) : [])
    setSectionOrder(preset.sectionOrder ? JSON.parse(preset.sectionOrder) : [])
    setLyrics(preset.lyrics ? JSON.parse(preset.lyrics) : [])
    setSectionLyricsMap(preset.sectionLyricsMap ? JSON.parse(preset.sectionLyricsMap) : {})
    setNotes(preset.notes)
    // Load preset's sheet music selection
    const fileIds = await getPresetSheetMusicFileIds(preset.id)
    setSheetMusicFileIds(fileIds.length > 0 ? fileIds : null)
    setEditorKey(k => k + 1)
    markDirty()
    toast.success(`"${preset.name}" 프리셋을 불러왔습니다`)
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
        title="곡 편집"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "저장 중..." : "저장"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* 프리셋 관리 / 악보 선택 — 2-column grid */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="mb-3 text-base font-medium">프리셋 관리</h3>
              {presets.length > 0 && (
                <div className="mb-3">
                  <label className="text-sm text-muted-foreground mb-1 block">프리셋 불러오기</label>
                  <div className="flex flex-col gap-1">
                    {presets.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="hover:bg-muted flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-base transition-colors disabled:opacity-50"
                        onClick={() => handleLoadPreset(p)}
                        disabled={isSaving}
                      >
                        <span className="truncate font-medium">{p.name}</span>
                        <span className="flex items-center gap-1.5">
                          {p.youtubeReference && (
                            <a
                              href={`https://www.youtube.com/watch?v=${p.youtubeReference}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-500/20 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              YT
                            </a>
                          )}
                          {p.isDefault && (
                            <span className="text-sm text-muted-foreground">기본</span>
                          )}
                        </span>
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
                <div className="space-y-3">
                  {presets.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <label className="text-sm text-muted-foreground">기존 프리셋 업데이트</label>
                      <select
                        className="rounded border px-2 py-1 text-base"
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
                      disabled={!presetName.trim() || isPresetSaving}
                      onClick={() => {
                        if (isDirty) {
                          toast.error("먼저 저장을 눌러 변경사항을 반영한 후 프리셋으로 저장하세요.")
                          return
                        }
                        setIsPresetSaving(true)
                        saveContiSongAsPreset(
                          contiSong.id,
                          presetName.trim(),
                          selectedPresetId ?? undefined
                        ).then(async (result) => {
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
                        }).finally(() => {
                          setIsPresetSaving(false)
                        })
                      }}
                    >
                      {isPresetSaving ? "저장 중..." : (selectedPresetId ? "프리셋 업데이트" : "프리셋 저장")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setShowPresetSave(false); setPresetName(""); setSelectedPresetId(null) }}>
                      취소
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {songSheetMusic.length > 0 && (
              <div className="space-y-3">
                <label className="text-base font-medium">악보 선택</label>
                <p className="text-sm text-muted-foreground">
                  PDF 내보내기에 포함할 악보를 선택하세요. 선택하지 않으면 모든 악보가 포함됩니다.
                </p>
                <SheetMusicSelector
                  songId={contiSong.songId}
                  selectedFileIds={sheetMusicFileIds ?? []}
                  onSelectionChange={(ids) => { setSheetMusicFileIds(ids.length > 0 ? ids : null); markDirty() }}
                  availableFiles={songSheetMusic}
                />
              </div>
            )}
          </div>

          <div className="border-t" />

          <div key={editorKey}>
            <OverrideEditorFields
              keys={keys}
              tempos={tempos}
              sectionOrder={sectionOrder}
              lyrics={lyrics}
              sectionLyricsMap={sectionLyricsMap}
              notes={notes}
              sheetMusicFiles={
                sheetMusicFileIds
                  ? songSheetMusic.filter(f => sheetMusicFileIds.includes(f.id))
                  : songSheetMusic
              }
              onKeysTemposChange={handleKeysTemposChange}
              onSectionOrderChange={handleSectionOrderChange}
              onLyricsChange={handleLyricsChange}
              onSectionLyricsMapChange={handleSectionLyricsMapChange}
              onNotesChange={handleNotesChange}
            />
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
