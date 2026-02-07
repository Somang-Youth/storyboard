import type { InferSelectModel } from 'drizzle-orm';
import type { songs, sheetMusicFiles, contis, contiSongs } from './db/schema';

export type Song = InferSelectModel<typeof songs>;
export type SheetMusicFile = InferSelectModel<typeof sheetMusicFiles>;
export type Conti = InferSelectModel<typeof contis>;
export type ContiSong = InferSelectModel<typeof contiSongs>;

export interface ContiSongOverrides {
  keys: string[];
  tempos: number[];
  sectionOrder: string[];
  lyrics: string[];
  sectionLyricsMap: Record<number, number[]>;
  notes: string | null;
}

export interface SongWithSheetMusic extends Song {
  sheetMusic: SheetMusicFile[];
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
