import type { InferSelectModel } from 'drizzle-orm';
import type { songs, sheetMusicFiles, contis, contiSongs, songPresets, contiPdfExports } from './db/schema';

export type Song = InferSelectModel<typeof songs>;
export type SheetMusicFile = InferSelectModel<typeof sheetMusicFiles>;
export type Conti = InferSelectModel<typeof contis>;
export type ContiSong = InferSelectModel<typeof contiSongs>;
export type SongPreset = InferSelectModel<typeof songPresets>;

export interface ContiSongOverrides {
  keys: string[];
  tempos: number[];
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  notes: string | null;
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
}

export interface SongWithSheetMusic extends Song {
  sheetMusic: SheetMusicFile[];
  presets?: SongPreset[];
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

export interface OverlayElement {
  id: string;
  type: 'songNumber' | 'sectionOrder' | 'bpm';
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
  overlays: OverlayElement[];
  imageScale?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
}

export interface PdfLayoutState {
  pages: PageLayout[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface ContiSongWithSheetMusic extends ContiSongWithSong {
  sheetMusic: SheetMusicFile[];
}

export interface ContiWithSongsAndSheetMusic extends Conti {
  songs: ContiSongWithSheetMusic[];
}
