import type { InferSelectModel } from 'drizzle-orm';
import type {
  songs,
  sheetMusicFiles,
  contis,
  contiSongs,
  songPresets,
  contiPdfExports,
  songPageImages,
  presetSheetMusic,
  discordThreadStates,
  discordProcessedMessages,
  discordInteractionReceipts,
} from './db/schema';

export type Song = InferSelectModel<typeof songs>;
export type SheetMusicFile = InferSelectModel<typeof sheetMusicFiles>;
export type Conti = InferSelectModel<typeof contis>;
export type ContiSong = InferSelectModel<typeof contiSongs>;
export type SongPreset = InferSelectModel<typeof songPresets>;
export type PresetSheetMusic = InferSelectModel<typeof presetSheetMusic>;

export interface ContiSongOverrides {
  keys: string[];
  tempos: number[];
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  notes: string | null;
  sheetMusicFileIds: string[] | null;  // null = use all
  presetId: string | null;
}

export interface PresetPdfPageMetadata {
  pdfPageIndex: number | null;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  overlays: OverlayElement[];
}

export interface PresetPdfFileMetadata {
  sheetMusicFileId: string;
  pages: PresetPdfPageMetadata[];
}

export interface PresetPdfMetadata {
  files: PresetPdfFileMetadata[];
}

export interface SongPresetData {
  name: string;
  keys: string[];
  tempos: number[];
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  notes: string | null;
  isDefault: boolean;
  youtubeReference?: string | null;
  sheetMusicFileIds?: string[];  // references to sheet_music_files.id
  pdfMetadata?: PresetPdfMetadata | null;
}

export interface SongWithSheetMusic extends Song {
  sheetMusic: SheetMusicFile[];
  presets?: SongPresetWithSheetMusic[];
}

export interface SongPresetWithSheetMusic extends SongPreset {
  sheetMusicFileIds: string[];
}

export interface ContiSongWithSong extends ContiSong {
  song: Song;
  overrides: ContiSongOverrides;
}

export interface ContiWithSongs extends Conti {
  songs: ContiSongWithSong[];
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

export type ContiPdfExport = InferSelectModel<typeof contiPdfExports>;
export type SongPageImage = InferSelectModel<typeof songPageImages>;
export type DiscordThreadState = InferSelectModel<typeof discordThreadStates>;
export type DiscordProcessedMessage = InferSelectModel<typeof discordProcessedMessages>;
export type DiscordInteractionReceipt = InferSelectModel<typeof discordInteractionReceipts>;

export interface OverlayElement {
  id: string;
  type: 'songNumber' | 'sectionOrder' | 'bpm' | 'custom';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color?: string;
}

export interface PageLayout {
  pageIndex: number;
  songIndex: number;
  sheetMusicFileId: string | null;
  pdfPageIndex?: number | null;
  overlays: OverlayElement[];
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  originalImageUrl?: string;
}

export interface PdfLayoutState {
  pages: PageLayout[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface ContiSongWithSheetMusic extends ContiSongWithSong {
  sheetMusic: SheetMusicFile[];
  presetPdfMetadata?: PresetPdfMetadata | null;
}

export interface ContiWithSongsAndSheetMusic extends Conti {
  songs: ContiSongWithSheetMusic[];
}

export interface YouTubePlaylistItem {
  title: string
  videoId: string
  position: number
}

// PPTX Export types

export interface PptxDriveFile {
  file_id: string;
  name: string;
  modified_time: string;
}

export interface PptxExportSongData {
  title: string;
  section_name: string;
  section_order: string[];
  lyrics: string[];
  section_lyrics_map: Record<string, number[]>;
}

export interface PptxExportRequest {
  action: 'export_lyrics';
  file_id: string;
  overwrite: boolean;
  output_file_name?: string;
  output_folder_id?: string;
  songs: PptxExportSongData[];
}

export interface PptxExportResult {
  file_id: string;
  file_name: string;
  web_view_link: string;
  download_url?: string;
  songs_processed: number;
  slides_generated: number;
}

export interface PptxTemplateSectionInfo {
  name: string;
  id: string;
  slide_ids: number[];
  slide_count: number;
}

export interface PptxTemplateShape {
  name: string;
  shape_type: string;
  has_text_frame: boolean;
  text_preview?: string;
  paragraph_count?: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PptxTemplateSlide {
  slide_index: number;
  shapes: PptxTemplateShape[];
}

export interface PptxTemplateStructure {
  slide_count: number;
  slides: PptxTemplateSlide[];
  sections: PptxTemplateSectionInfo[] | null;
}
