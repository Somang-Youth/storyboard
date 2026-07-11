"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Drawer } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
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
import { SheetMusicSelector } from "@/components/shared/sheet-music-selector"
import { SheetMusicPreviewPane } from "@/components/shared/sheet-music-preview"
import { OverrideEditorFields } from "@/components/shared/override-editor-fields"
import { PresetPdfEditor } from "@/components/songs/preset-pdf-editor"
import { cn } from "@/lib/utils"
import { normalizeYouTubeReference } from "@/lib/utils/youtube"
import {
  shiftSectionLyricsMapForRemoval,
  mergeSectionLyricsMapPages,
} from "@/components/contis/section-lyrics-map-utils"
import {
  areArrangementDraftsEqual,
  cloneDraft,
} from "./dirty-state"
import {
  getSheetMusicSelectionSaveError,
  shouldConfirmLyricsSaveScope,
  shouldShowYouTubeReferenceField,
} from "./save-rules"
import type {
  ArrangementDraft,
  ArrangementEditorProps,
  ArrangementEditorSaveOptions,
} from "./types"

function prepareDraftForSave(draft: ArrangementDraft): ArrangementDraft | null {
  const draftToSave = cloneDraft(draft)
  draftToSave.name = draftToSave.name.trim()

  const youtubeInput = draftToSave.youtubeReference?.trim()
  if (youtubeInput) {
    const normalized = normalizeYouTubeReference(youtubeInput)
    if (!normalized) {
      toast.error("올바른 YouTube 링크 또는 영상 ID를 입력해주세요")
      return null
    }
    draftToSave.youtubeReference = normalized.videoId
  } else {
    draftToSave.youtubeReference = null
    draftToSave.youtubeTitle = null
  }

  return draftToSave
}

export function ArrangementEditor({
  mode,
  title,
  songId,
  songName,
  open,
  initialDraft,
  availableSheetMusic,
  sheetMusicPreviewItem,
  sheetMusicLoading = false,
  sheetMusicWorkspacePreview = false,
  showDisplayTitleField = false,
  showDefaultPresetField = true,
  presetType,
  hasExistingPreset = false,
  presetOptions = [],
  sheetMusicManagementSlot,
  savingLabel = "저장",
  onOpenChange,
  onSave,
  onLoadPreset,
  onSaveAsPreset,
  onRefreshPresetOptions,
}: ArrangementEditorProps) {
  const [draft, setDraft] = useState<ArrangementDraft>(() => cloneDraft(initialDraft))
  const [initialDirtyDraft, setInitialDirtyDraft] = useState<ArrangementDraft>(() => cloneDraft(initialDraft))
  const [isSaving, setIsSaving] = useState(false)
  const [isPresetSaving, setIsPresetSaving] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [selectedPresetId, setSelectedPresetId] = useState("")
  const [pdfEditorOpen, setPdfEditorOpen] = useState(false)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showLyricsScopeDialog, setShowLyricsScopeDialog] = useState(false)
  const [pendingSaveDraft, setPendingSaveDraft] = useState<ArrangementDraft | null>(null)
  const [presetOnlyLyrics, setPresetOnlyLyrics] = useState(false)
  const [editorKey, setEditorKey] = useState(0)
  const wasOpenRef = useRef(false)

  const allSheetMusicIds = useMemo(
    () => availableSheetMusic.map((file) => file.id),
    [availableSheetMusic],
  )
  const isDirty = useMemo(
    () => !areArrangementDraftsEqual(initialDirtyDraft, draft, allSheetMusicIds),
    [allSheetMusicIds, draft, initialDirtyDraft],
  )

  const selectorFileIds = draft.sheetMusicFileIds ?? allSheetMusicIds

  const selectedSheetMusic = useMemo(() => {
    if (draft.sheetMusicFileIds === null) {
      return availableSheetMusic
    }

    const selectedIds = new Set(draft.sheetMusicFileIds)
    return availableSheetMusic.filter((file) => selectedIds.has(file.id))
  }, [availableSheetMusic, draft.sheetMusicFileIds])

  const showYouTubeReferenceField = shouldShowYouTubeReferenceField(mode)
  const hasSheetMusicWorkspace = availableSheetMusic.length > 0 || Boolean(sheetMusicManagementSlot)
  const hasDrawerPreview = sheetMusicWorkspacePreview && hasSheetMusicWorkspace

  function pruneUnavailableSheetMusicIds(draftToPrune: ArrangementDraft): ArrangementDraft {
    if (draftToPrune.sheetMusicFileIds === null || allSheetMusicIds.length === 0) {
      return draftToPrune
    }

    const availableIds = new Set(allSheetMusicIds)
    const sheetMusicFileIds = draftToPrune.sheetMusicFileIds.filter((id) =>
      availableIds.has(id),
    )

    if (sheetMusicFileIds.length === draftToPrune.sheetMusicFileIds.length) {
      return draftToPrune
    }

    return { ...draftToPrune, sheetMusicFileIds }
  }

  useLayoutEffect(() => {
    if (open && !wasOpenRef.current) {
      const nextDraft = cloneDraft(initialDraft)
      setDraft(nextDraft)
      setInitialDirtyDraft(cloneDraft(nextDraft))
      setPresetName("")
      setSelectedPresetId("")
      setPdfEditorOpen(false)
      setShowUnsavedDialog(false)
      setShowLyricsScopeDialog(false)
      setPendingSaveDraft(null)
      setPresetOnlyLyrics(false)
      setEditorKey((key) => key + 1)
    }

    wasOpenRef.current = open
  }, [open, initialDraft])

  function updateDraft(patch: Partial<ArrangementDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function handleClose() {
    if (isDirty) {
      setShowUnsavedDialog(true)
      return
    }

    onOpenChange(false)
  }

  async function performSave(
    draftToSave: ArrangementDraft,
    options?: ArrangementEditorSaveOptions,
  ) {
    setIsSaving(true)
    try {
      const result = await onSave(draftToSave, options)
      if (result.success) {
        toast.success(mode === "preset" ? "프리셋이 저장되었습니다" : "곡 설정이 저장되었습니다")
        const savedDraft = cloneDraft(draftToSave)
        setDraft(savedDraft)
        setInitialDirtyDraft(cloneDraft(savedDraft))
        setShowLyricsScopeDialog(false)
        setPendingSaveDraft(null)
        setPresetOnlyLyrics(false)
        onOpenChange(false)
      } else {
        toast.error(result.error ?? "저장 중 오류가 발생했습니다")
      }
    } catch {
      toast.error("저장 중 오류가 발생했습니다")
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSave() {
    if (mode === "preset" && !draft.name.trim()) {
      toast.error("프리셋 이름을 입력해주세요")
      return
    }

    const prunedDraft = pruneUnavailableSheetMusicIds(draft)
    const selectionError = getSheetMusicSelectionSaveError(
      prunedDraft.sheetMusicFileIds,
      allSheetMusicIds.length,
    )
    if (selectionError) {
      toast.error(selectionError)
      return
    }

    const draftToSave = prepareDraftForSave(prunedDraft)
    if (!draftToSave) return

    if (shouldConfirmLyricsSaveScope({
      mode,
      presetType,
      hasExistingPreset,
      initialLyrics: initialDirtyDraft.lyrics,
      draftLyrics: draftToSave.lyrics,
    })) {
      setPendingSaveDraft(draftToSave)
      setPresetOnlyLyrics(false)
      setShowLyricsScopeDialog(true)
      return
    }

    await performSave(draftToSave)
  }

  async function handleConfirmLyricsScopeSave() {
    if (!pendingSaveDraft) return

    await performSave(pendingSaveDraft, {
      lyricsSaveScope: presetOnlyLyrics ? "preset" : "song",
    })
  }

  async function handleLoadPreset(presetId: string) {
    const preset = presetOptions.find((option) => option.id === presetId)
    if (!onLoadPreset) return
    if (!preset) return
    if (!confirm(`"${preset.name}" 프리셋을 불러오면 현재 설정이 덮어씌워집니다. 계속하시겠습니까?`)) {
      return
    }

    try {
      const loadedDraft = cloneDraft(await onLoadPreset(preset))
      setDraft(loadedDraft)
      setEditorKey((key) => key + 1)
      toast.success(`"${preset.name}" 프리셋을 불러왔습니다`)
    } catch {
      toast.error("프리셋을 불러올 수 없습니다")
    }
  }

  async function handleSaveAsPreset() {
    const trimmedName = presetName.trim()
    if (!trimmedName) {
      toast.error("프리셋 이름을 입력해주세요")
      return
    }
    if (!onSaveAsPreset) return

    const prunedDraft = pruneUnavailableSheetMusicIds(draft)
    const selectionError = getSheetMusicSelectionSaveError(
      prunedDraft.sheetMusicFileIds,
      allSheetMusicIds.length,
    )
    if (selectionError) {
      toast.error(selectionError)
      return
    }

    const draftToSave = prepareDraftForSave(prunedDraft)
    if (!draftToSave) return

    setIsPresetSaving(true)
    try {
      const result = await onSaveAsPreset(draftToSave, trimmedName, selectedPresetId || undefined)
      if (result.success) {
        toast.success(selectedPresetId ? "프리셋이 업데이트되었습니다" : "새 프리셋이 저장되었습니다")
        const savedDraft = cloneDraft(draftToSave)
        setDraft(savedDraft)
        setInitialDirtyDraft(cloneDraft(savedDraft))
        setPresetName("")
        setSelectedPresetId("")
        await onRefreshPresetOptions?.()
      } else {
        toast.error(result.error ?? "프리셋 저장 중 오류가 발생했습니다")
      }
    } catch {
      toast.error("프리셋 저장 중 오류가 발생했습니다")
    } finally {
      setIsPresetSaving(false)
    }
  }

  function handleLyricsChange(data: {
    lyrics: string[]
    swappedPages?: [number, number]
    insertedAt?: number
    mergedAt?: number
    removedAt?: number
  }) {
    setDraft((current) => {
      let sectionLyricsMap = current.sectionLyricsMap

      if (data.swappedPages) {
        const [a, b] = data.swappedPages
        const nextMap: Record<number, number[]> = {}

        for (const [key, indices] of Object.entries(sectionLyricsMap)) {
          const filtered = indices.filter((index) => index !== a && index !== b)
          if (filtered.length > 0) {
            nextMap[Number(key)] = filtered
          }
        }

        sectionLyricsMap = nextMap
      }

      if (data.insertedAt !== undefined) {
        const insertIndex = data.insertedAt
        const nextMap: Record<number, number[]> = {}

        for (const [key, indices] of Object.entries(sectionLyricsMap)) {
          nextMap[Number(key)] = indices.map((index) =>
            index >= insertIndex ? index + 1 : index,
          )
        }

        sectionLyricsMap = nextMap
      }

      if (data.removedAt !== undefined) {
        sectionLyricsMap = shiftSectionLyricsMapForRemoval(sectionLyricsMap, data.removedAt)
      }

      if (data.mergedAt !== undefined) {
        sectionLyricsMap = mergeSectionLyricsMapPages(sectionLyricsMap, data.mergedAt)
      }

      return {
        ...current,
        lyrics: data.lyrics,
        sectionLyricsMap,
      }
    })

    if (data.swappedPages) {
      const [a, b] = data.swappedPages
      toast.warning(`페이지 ${a + 1}, ${b + 1}의 섹션-가사 매핑이 해제되었습니다`)
    }

    if (data.insertedAt !== undefined) {
      toast.info(`페이지 ${data.insertedAt + 1} 위치에 빈 페이지가 삽입되어 매핑이 조정되었습니다`)
    }

    if (data.mergedAt !== undefined) {
      toast.info(`페이지 ${data.mergedAt + 1}, ${data.mergedAt + 2}가 하나로 합쳐졌습니다`)
    }
  }

  function renderSheetMusicWorkspace() {
    if (!hasSheetMusicWorkspace) return null

    return (
      <section data-slot="sheet-music-workspace" className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-medium">악보</h3>
          <p className="text-sm text-muted-foreground">
            PDF 내보내기에 포함할 악보를 선택하세요.
          </p>
        </div>

        <SheetMusicPreviewPane
          item={sheetMusicPreviewItem ?? null}
          loading={sheetMusicLoading}
          imageClassName="max-h-[70vh]"
        />

        {sheetMusicManagementSlot}

        {availableSheetMusic.length > 0 && (
          <SheetMusicSelector
            songId={songId}
            selectedFileIds={selectorFileIds}
            onSelectionChange={(ids) => updateDraft({ sheetMusicFileIds: ids })}
            availableFiles={availableSheetMusic}
          />
        )}
      </section>
    )
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
        title={title}
        size={hasDrawerPreview ? "wide" : "default"}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleClose}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "저장 중..." : savingLabel}
            </Button>
          </div>
        }
      >
        <div
          className={cn(
            "min-h-full",
            hasDrawerPreview &&
              "md:grid md:grid-cols-[minmax(320px,0.9fr)_minmax(360px,1fr)] md:gap-8",
          )}
        >
          <div
            className={cn(
              "min-w-0 space-y-8",
              hasDrawerPreview && "md:col-start-2 md:row-start-1",
            )}
          >
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">곡</p>
                <h3 className="text-xl font-semibold">{songName}</h3>
              </div>

              {mode === "preset" && (
                <div className="space-y-3">
                  <label htmlFor="arrangement-preset-name" className="text-base font-medium">
                    프리셋 이름 <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="arrangement-preset-name"
                    value={draft.name}
                    onChange={(event) => updateDraft({ name: event.target.value })}
                    placeholder="예: 주일 예배"
                    required
                  />
                </div>
              )}

              {mode === "preset" && showDisplayTitleField && (
                <div className="space-y-3">
                  <label htmlFor="arrangement-display-title" className="text-base font-medium">
                    표시 제목
                  </label>
                  <Input
                    id="arrangement-display-title"
                    value={draft.displayTitle ?? ""}
                    onChange={(event) => updateDraft({ displayTitle: event.target.value })}
                    placeholder="비워두면 첫 곡 제목 사용"
                  />
                </div>
              )}
            </div>

            {mode === "conti-song" && presetOptions.length > 0 && onLoadPreset && (
              <div className="space-y-3">
                <h3 className="text-base font-medium">프리셋 불러오기</h3>
                <div className="flex flex-col gap-1">
                  {presetOptions.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="hover:bg-muted flex min-w-0 items-center justify-between rounded-lg px-3 py-2 text-left text-base transition-colors disabled:opacity-50"
                      onClick={() => handleLoadPreset(preset.id)}
                      disabled={isSaving}
                    >
                      <span className="truncate font-medium">{preset.name}</span>
                      {preset.isDefault && (
                        <span className="text-sm text-muted-foreground">기본</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showYouTubeReferenceField && (
              <div className="space-y-2">
                <label htmlFor="arrangement-youtube-ref" className="text-base font-medium">
                  YouTube 레퍼런스
                </label>
                <Input
                  id="arrangement-youtube-ref"
                  value={draft.youtubeReference ?? ""}
                  onChange={(event) => updateDraft({
                    youtubeReference: event.target.value || null,
                    youtubeTitle: null,
                  })}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
            )}

            <OverrideEditorFields
              key={editorKey}
              songName={songName}
              keys={draft.keys}
              tempos={draft.tempos}
              sectionOrder={draft.sectionOrder}
              lyrics={draft.lyrics}
              sectionLyricsMap={draft.sectionLyricsMap}
              notes={draft.notes}
              sheetMusicFiles={selectedSheetMusic}
              onKeysTemposChange={(data) => updateDraft(data)}
              onSectionOrderChange={(data) => updateDraft(data)}
              onLyricsChange={handleLyricsChange}
              onSectionLyricsMapChange={(data) => updateDraft(data)}
              onNotesChange={(notes) => updateDraft({ notes })}
            />

            {mode === "preset" && showDefaultPresetField && (
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="arrangement-preset-default"
                  checked={draft.isDefault}
                  onChange={(event) => updateDraft({ isDefault: event.target.checked })}
                  className="size-5 cursor-pointer rounded"
                />
                <label htmlFor="arrangement-preset-default" className="text-base cursor-pointer">
                  기본 프리셋으로 설정
                </label>
              </div>
            )}

            {mode === "conti-song" && onSaveAsPreset && (
              <div className="space-y-3 border-t pt-8">
                <h3 className="text-base font-medium">프리셋으로 저장</h3>
                {presetOptions.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label htmlFor="arrangement-save-preset-select" className="text-sm text-muted-foreground">
                      기존 프리셋 업데이트
                    </label>
                    <select
                      id="arrangement-save-preset-select"
                      className="h-9 rounded-md border border-border bg-background px-3 text-base"
                      value={selectedPresetId}
                      onChange={(event) => {
                        const nextPresetId = event.target.value
                        setSelectedPresetId(nextPresetId)
                        const preset = presetOptions.find((option) => option.id === nextPresetId)
                        setPresetName(preset?.name ?? "")
                      }}
                    >
                      <option value="">새 프리셋 만들기</option>
                      {presetOptions.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}{preset.isDefault ? " (기본)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex-1 space-y-1">
                    <label htmlFor="arrangement-save-preset-name" className="text-sm text-muted-foreground">
                      프리셋 이름
                    </label>
                    <Input
                      id="arrangement-save-preset-name"
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      placeholder="프리셋 이름"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleSaveAsPreset}
                    disabled={isPresetSaving}
                    className="sm:mt-6 sm:w-32"
                  >
                    {isPresetSaving ? "저장 중..." : selectedPresetId ? "업데이트" : "저장"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {hasSheetMusicWorkspace && (
            <div
              className={cn(
                "min-w-0 border-t pt-8",
                hasDrawerPreview &&
                  "md:sticky md:top-0 md:col-start-1 md:row-start-1 md:max-h-[calc(100vh-10rem)] md:overflow-y-auto md:border-t-0 md:pt-0",
              )}
            >
              {renderSheetMusicWorkspace()}
            </div>
          )}
        </div>
      </Drawer>

      {mode === "preset" && (
        <Dialog open={pdfEditorOpen} onOpenChange={setPdfEditorOpen}>
          <DialogContent
            overlayClassName="z-[70]"
            className="z-[70] !w-screen !h-[100dvh] !max-w-none sm:!max-w-none rounded-none overflow-x-hidden overflow-y-auto p-3 sm:p-4 flex flex-col"
          >
            <div className="min-h-0 flex-1">
              <PresetPdfEditor
                songName={draft.name.trim() || songName}
                sheetMusic={selectedSheetMusic}
                sectionOrder={draft.sectionOrder}
                tempos={draft.tempos}
                initialMetadata={draft.pdfMetadata}
                onSave={(metadata) => updateDraft({ pdfMetadata: metadata })}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent
          overlayClassName="z-[70]"
          className="z-[70]"
          size="sm"
        >
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
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const nextDraft = cloneDraft(initialDraft)
                setDraft(nextDraft)
                setInitialDirtyDraft(cloneDraft(nextDraft))
                setShowUnsavedDialog(false)
                onOpenChange(false)
              }}
            >
              저장하지 않고 닫기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showLyricsScopeDialog} onOpenChange={setShowLyricsScopeDialog}>
        <AlertDialogContent
          overlayClassName="z-[70]"
          className="z-[70]"
          size="sm"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>가사 저장 범위</AlertDialogTitle>
            <AlertDialogDescription>
              가사 변경은 곡 가사로 저장되어 이 곡의 다른 단일 프리셋에도 반영됩니다.
              매시업 프리셋은 기존 저장된 가사를 유지합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-base">
            <input
              type="checkbox"
              checked={presetOnlyLyrics}
              onChange={(event) => setPresetOnlyLyrics(event.target.checked)}
              className="size-5 cursor-pointer rounded"
            />
            <span>이 프리셋에만 적용</span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowLyricsScopeDialog(false)
                setPendingSaveDraft(null)
                setPresetOnlyLyrics(false)
              }}
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLyricsScopeSave} disabled={isSaving}>
              {isSaving ? "저장 중..." : "저장"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
