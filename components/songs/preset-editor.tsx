"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrangementEditor } from "@/components/shared/arrangement-editor"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"
import { createSongPreset, updateSongPreset } from "@/lib/actions/song-presets"
import {
  arrangementDraftToSongPresetData,
  songPresetToDraft,
} from "@/lib/utils/song-preset-draft"
import { buildPresetEditorSheetMusic } from "@/lib/utils/preset-editor-sheet-music"
import type {
  ResolvedSongPresetWithSheetMusic,
  SheetMusicFile,
  SongPresetData,
} from "@/lib/types"
import type { ArrangementEditorSaveOptions } from "@/components/shared/arrangement-editor/types"

interface PresetEditorProps {
  songId: string
  songLyrics: string[]
  preset?: ResolvedSongPresetWithSheetMusic
  sheetMusic: SheetMusicFile[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

function areLyricsEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function omitLyrics(data: SongPresetData): Partial<SongPresetData> {
  const next: Partial<SongPresetData> = { ...data }
  delete next.lyrics
  return next
}

export function PresetEditor({ songId, songLyrics, preset, sheetMusic, open, onOpenChange }: PresetEditorProps) {
  const router = useRouter()
  const initialDraft = preset
    ? songPresetToDraft(preset)
    : { ...songPresetToDraft(undefined), lyrics: songLyrics }
  const editorSheetMusic = buildPresetEditorSheetMusic(preset, sheetMusic)
  const [sheetMusicLoading, setSheetMusicLoading] = useState(false)
  const [sheetMusicPreviewPrepared, setSheetMusicPreviewPrepared] = useState(false)
  const [sheetMusicPreviewItem, setSheetMusicPreviewItem] = useState<SheetMusicPreviewItem | null>(null)
  const openRef = useRef(open)

  useLayoutEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (!open) {
      let cancelled = false

      void Promise.resolve().then(() => {
        if (!cancelled) {
          setSheetMusicLoading(false)
          setSheetMusicPreviewPrepared(false)
          setSheetMusicPreviewItem(null)
        }
      })

      return () => {
        cancelled = true
      }
    }
  }, [open])

  const currentPreviewItem = sheetMusicPreviewPrepared ? sheetMusicPreviewItem : null
  const previewLoading =
    sheetMusicLoading ||
    (open && editorSheetMusic.length > 0 && !currentPreviewItem && !sheetMusicPreviewPrepared)

  function resetSheetMusicPreviewState() {
    setSheetMusicLoading(false)
    setSheetMusicPreviewPrepared(false)
    setSheetMusicPreviewItem(null)
  }

  function handleEditorOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      openRef.current = false
      resetSheetMusicPreviewState()
    }

    onOpenChange(nextOpen)
  }

  function handlePreviewLoadingChange(loading: boolean) {
    if (!openRef.current) {
      return
    }

    setSheetMusicLoading(loading)
    setSheetMusicPreviewPrepared(!loading)
  }

  function handleSheetMusicPreviewChange(item: SheetMusicPreviewItem | null) {
    if (!openRef.current) {
      return
    }

    setSheetMusicPreviewItem(item)
  }

  if (!open) {
    return null
  }

  return (
    <ArrangementEditor
      mode="preset"
      title={preset ? "프리셋 편집" : "프리셋 추가"}
      songId={songId}
      songName={preset?.name ?? "새 프리셋"}
      open={open}
      initialDraft={initialDraft}
      availableSheetMusic={editorSheetMusic}
      sheetMusicPreviewItem={currentPreviewItem}
      sheetMusicLoading={previewLoading}
      sheetMusicWorkspacePreview
      showDisplayTitleField={preset?.presetType === "mashup" || Boolean(initialDraft.displayTitle)}
      showDefaultPresetField={preset?.presetType !== "mashup"}
      presetType={preset?.presetType ?? null}
      hasExistingPreset={Boolean(preset)}
      sheetMusicManagementSlot={
        editorSheetMusic.length > 0 ? (
          <SheetMusicGallery
            files={editorSheetMusic}
            previewMode="controlled"
            onPreviewChange={handleSheetMusicPreviewChange}
            onPreviewLoadingChange={handlePreviewLoadingChange}
          />
        ) : null
      }
      savingLabel="저장"
      onOpenChange={handleEditorOpenChange}
      onSave={async (draft, options?: ArrangementEditorSaveOptions) => {
        const data = arrangementDraftToSongPresetData(draft)
        const payload =
          preset?.presetType === "single" &&
          !options?.lyricsSaveScope &&
          areLyricsEqual(initialDraft.lyrics, draft.lyrics)
            ? omitLyrics(data)
            : data
        const result = preset
          ? await updateSongPreset(preset.id, payload, options)
          : await createSongPreset(songId, data)

        if (result.success) {
          router.refresh()
        }

        return { success: result.success, error: result.error }
      }}
    />
  )
}
