"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrangementEditor,
  type ArrangementDraft,
} from "@/components/shared/arrangement-editor"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
import { SheetMusicGallery } from "@/components/songs/sheet-music-gallery"
import { updateMashupContiSongs } from "@/lib/actions/conti-songs"
import { getPresetsForSongWithSheetMusic, updateSongPreset } from "@/lib/actions/song-presets"
import { getMashupDisplayTitle } from "@/lib/utils/mashup-presets"
import { draftToMashupContiSongOverrides } from "@/lib/utils/mashup-conti-overrides"
import { toYouTubeInputValue } from "@/lib/utils/youtube"
import type { ContiSongWithSong, SheetMusicFile } from "@/lib/types"

interface ContiMashupEditorProps {
  contiId: string
  // Both grouped conti songs, sorted by mashupPartOrder (length 2).
  group: ContiSongWithSong[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

function mashupToDraft(primary: ContiSongWithSong, displayTitle: string): ArrangementDraft {
  return {
    name: displayTitle,
    displayTitle: null,
    keys: primary.overrides.keys,
    tempos: primary.overrides.tempos,
    sectionOrder: primary.overrides.sectionOrder,
    lyrics: primary.overrides.lyrics,
    sectionLyricsMap: primary.overrides.sectionLyricsMap,
    notes: primary.overrides.notes,
    sheetMusicFileIds: primary.overrides.sheetMusicFileIds,
    pdfMetadata: null,
    youtubeReference: toYouTubeInputValue(primary.appliedPreset?.youtubeReference),
    youtubeTitle: primary.appliedPreset?.youtubeTitle ?? null,
    isDefault: false,
    appliedPresetId: primary.overrides.presetId,
  }
}

/**
 * Edits a mashup group's shared arrangement from the conti screen.
 *
 * The two grouped conti songs carry an identical arrangement snapshot (copied
 * from the shared mashup preset at connect time). This editor works on that
 * combined arrangement, offers the mashup's combined sheet music for selection,
 * hides the single-song preset picker (which would detach the group), and saves
 * the same overrides back to both rows while keeping the mashup preset applied.
 */
export function ContiMashupEditor({ contiId, group, open, onOpenChange }: ContiMashupEditorProps) {
  const router = useRouter()
  const primary = group[0]
  const presetId = primary.overrides.presetId
  const displayTitle = getMashupDisplayTitle(
    primary.appliedPreset?.displayTitle,
    group.map((entry) => entry.song.name),
  )

  const [availableSheetMusic, setAvailableSheetMusic] = useState<SheetMusicFile[]>([])
  const [sheetMusicLoading, setSheetMusicLoading] = useState(false)
  const [sheetMusicPreviewPrepared, setSheetMusicPreviewPrepared] = useState(false)
  const [sheetMusicPreviewItem, setSheetMusicPreviewItem] = useState<SheetMusicPreviewItem | null>(null)
  const openRef = useRef(open)
  const requestIdRef = useRef(0)

  useLayoutEffect(() => {
    openRef.current = open
  }, [open])

  // Load the mashup preset's combined sheet music (both member songs).
  useEffect(() => {
    if (!open) return
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId

    void (async () => {
      const result = await getPresetsForSongWithSheetMusic(primary.songId)
      if (!openRef.current || requestIdRef.current !== requestId) return
      if (result.success && result.data) {
        const applied = result.data.find((preset) => preset.id === presetId)
        setAvailableSheetMusic(applied?.availableSheetMusic ?? [])
      }
    })()
  }, [open, primary.songId, presetId])

  useEffect(() => {
    if (open) return

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
  }, [open])

  const currentPreviewItem = sheetMusicPreviewPrepared ? sheetMusicPreviewItem : null
  const previewLoading =
    sheetMusicLoading ||
    (open && availableSheetMusic.length > 0 && !currentPreviewItem && !sheetMusicPreviewPrepared)

  function handlePreviewLoadingChange(loading: boolean) {
    if (!openRef.current) return
    setSheetMusicLoading(loading)
    setSheetMusicPreviewPrepared(!loading)
  }

  function handleSheetMusicPreviewChange(item: SheetMusicPreviewItem | null) {
    if (!openRef.current) return
    setSheetMusicPreviewItem(item)
  }

  return (
    <ArrangementEditor
      mode="conti-song"
      title="매시업 편집"
      songId={primary.songId}
      songName={displayTitle}
      open={open}
      initialDraft={mashupToDraft(primary, displayTitle)}
      availableSheetMusic={availableSheetMusic}
      sheetMusicPreviewItem={currentPreviewItem}
      sheetMusicLoading={previewLoading}
      sheetMusicWorkspacePreview
      sheetMusicManagementSlot={
        availableSheetMusic.length > 0 ? (
          <SheetMusicGallery
            files={availableSheetMusic}
            previewMode="controlled"
            onPreviewChange={handleSheetMusicPreviewChange}
            onPreviewLoadingChange={handlePreviewLoadingChange}
          />
        ) : null
      }
      savingLabel="이 콘티에만 저장"
      saveToPresetLabel="프리셋에 저장"
      onOpenChange={onOpenChange}
      onSave={async (draft) => {
        if (!primary.mashupGroupId) {
          return { success: false, error: "매시업 그룹을 찾을 수 없습니다" }
        }
        const result = await updateMashupContiSongs({
          contiId,
          mashupGroupId: primary.mashupGroupId,
          overrides: draftToMashupContiSongOverrides(draft),
        })
        if (result.success) {
          router.refresh()
        }
        return { success: result.success, error: result.error }
      }}
      onSaveToPreset={async (draft) => {
        if (!primary.mashupGroupId || !presetId) {
          return { success: false, error: "매시업 프리셋을 찾을 수 없습니다" }
        }
        // Persist to the current conti (both grouped rows) so the change is
        // visible immediately, then update the shared mashup preset so it
        // carries over to future uses.
        const contiResult = await updateMashupContiSongs({
          contiId,
          mashupGroupId: primary.mashupGroupId,
          overrides: draftToMashupContiSongOverrides(draft),
        })
        if (!contiResult.success) {
          return { success: false, error: contiResult.error }
        }

        const presetResult = await updateSongPreset(presetId, {
          keys: draft.keys,
          tempos: draft.tempos,
          sectionOrder: draft.sectionOrder,
          lyrics: draft.lyrics,
          sectionLyricsMap: draft.sectionLyricsMap,
          notes: draft.notes,
          sheetMusicFileIds: draft.sheetMusicFileIds ?? [],
        })
        if (presetResult.success) {
          router.refresh()
        }
        return { success: presetResult.success, error: presetResult.error }
      }}
    />
  )
}
