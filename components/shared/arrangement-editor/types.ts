import type { ReactNode } from "react"
import type { SheetMusicPreviewItem } from "@/components/shared/sheet-music-preview"
import type {
  PresetPdfMetadata,
  ResolvedSongPresetWithSheetMusic,
  SheetMusicFile,
  SongPreset,
} from "@/lib/types"

export interface ArrangementDraft {
  name: string
  displayTitle: string | null
  keys: string[]
  tempos: number[]
  sectionOrder: string[]
  lyrics: string[]
  sectionLyricsMap: Record<number, number[]>
  notes: string | null
  // null = all available sheet music; [] is a transient invalid selection blocked on save.
  sheetMusicFileIds: string[] | null
  pdfMetadata: PresetPdfMetadata | null
  youtubeReference: string | null
  youtubeTitle: string | null
  isDefault: boolean
  appliedPresetId: string | null
}

export type ArrangementEditorPresetOption = ResolvedSongPresetWithSheetMusic

export type ArrangementEditorMode = "conti-song" | "preset"

export interface ArrangementEditorSaveResult {
  success: boolean
  error?: string
}

export interface ArrangementEditorSaveOptions {
  lyricsSaveScope?: "song" | "preset"
}

export interface ArrangementEditorProps {
  mode: ArrangementEditorMode
  title: string
  songId: string
  songName: string
  open: boolean
  initialDraft: ArrangementDraft
  availableSheetMusic: SheetMusicFile[]
  presetOptions?: ArrangementEditorPresetOption[]
  sheetMusicPreviewItem?: SheetMusicPreviewItem | null
  sheetMusicLoading?: boolean
  sheetMusicWorkspacePreview?: boolean
  showDisplayTitleField?: boolean
  showDefaultPresetField?: boolean
  presetType?: SongPreset["presetType"] | null
  hasExistingPreset?: boolean
  sheetMusicManagementSlot?: ReactNode
  savingLabel?: string
  onOpenChange: (open: boolean) => void
  onSave: (
    draft: ArrangementDraft,
    options?: ArrangementEditorSaveOptions,
  ) => Promise<ArrangementEditorSaveResult>
  onLoadPreset?: (preset: ArrangementEditorPresetOption) => Promise<ArrangementDraft>
  onSaveAsPreset?: (
    draft: ArrangementDraft,
    presetName: string,
    existingPresetId?: string,
  ) => Promise<ArrangementEditorSaveResult>
  onRefreshPresetOptions?: () => Promise<void>
}
